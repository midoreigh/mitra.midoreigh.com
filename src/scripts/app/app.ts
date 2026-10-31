// Main controller for Mitra Web App

import { ACScene } from '../ac/scene';
import {
  createStore,
  FAN_NAMES,
  Louver,
  MODE_COLORS,
  MODE_NAMES,
  parseStatusFields,
  rgb,
  summary,
  type ACState,
  type Fan,
  type Mode,
} from '../ac/state';
import { apiGetDevices, apiGetDeviceStatus, apiLogin, apiSendCommand, type ApiDevice } from './api';
import {
  loadSavedProfiles,
  saveProfiles,
  wireTemperatures,
  type SleepProfile,
} from './sleep-profiles';

const $ = <T extends Element = HTMLElement>(sel: string, root: any = document) =>
  root.querySelector(sel)! as T;
const $$ = <T extends Element = HTMLElement>(sel: string, root: any = document) => [
  ...root.querySelectorAll(sel),
] as T[];

// Initial state
const initialState: ACState = {
  on: false,
  setpoint: 24,
  mode: 'cool',
  fan: 'auto',
  vertical: 3,
  horizontal: 3,
  display: true,
  eco: false,
  powerful: false,
  converti: 0,
  nanoe: false,
  isOnline: true,
  roomTemperature: 27,
  offTimer: null,
  onTimer: null,
  sleepProfile: null,
  sleepHour: null,
};

const store = createStore(initialState);

// Scene canvas
const canvas = $<HTMLCanvasElement>('.app-canvas');
const unitBtn = $<HTMLButtonElement>('.app-unit-btn');
const scene = new ACScene(canvas, unitBtn, store.get, true);

// Local persistence keys
const KEY_SESSION = 'mitra_session';
const KEY_DEMO = 'mitra_demo_mode';
const KEY_SELECTED_DEV = 'mitra_selected_device';

interface SessionData {
  accessToken: string;
  homeId?: string;
  expiresAt: number;
}

let session: SessionData | null = null;
let isDemo = false;
let currentDevices: ApiDevice[] = [];
let activeDevice: ApiDevice | null = null;
let pollInterval: number | null = null;

function loadSession(): void {
  try {
    const raw = localStorage.getItem(KEY_SESSION);
    if (raw) session = JSON.parse(raw);
    isDemo = localStorage.getItem(KEY_DEMO) === 'true';
  } catch {
    session = null;
    isDemo = false;
  }
}

function saveSession(data: SessionData): void {
  session = data;
  isDemo = false;
  localStorage.setItem(KEY_SESSION, JSON.stringify(data));
  localStorage.removeItem(KEY_DEMO);
}

function clearSession(): void {
  session = null;
  isDemo = false;
  localStorage.removeItem(KEY_SESSION);
  localStorage.removeItem(KEY_DEMO);
  localStorage.removeItem(KEY_SELECTED_DEV);
}

// UI Elements
const stage = $('.app-stage');
const panel = $('.app-panel');
const statusDot = $('.status-dot');
const deviceNameText = $('[data-device-name]');
const signinOverlay = $('#signin-overlay');
const timerOverlay = $('#timer-overlay');
const sleepOverlay = $('#sleep-overlay');
const convertiStrip = $('#converti-strip');

// Update UI on Store Changes
store.subscribe((s) => {
  const c = MODE_COLORS[s.mode] || MODE_COLORS.cool;
  const root = document.documentElement.style;
  root.setProperty('--tint', rgb(c.tint));
  root.setProperty('--glow', rgb(c.glow));
  root.setProperty('--control', rgb(c.control));

  stage.classList.toggle('off', !s.on);
  panel.classList.toggle('off', !s.on);

  $('[data-power]').setAttribute('aria-pressed', String(s.on));
  unitBtn.setAttribute('aria-label', s.on ? 'Turn the AC off' : 'Turn the AC on');

  $('[data-temp]').textContent = String(s.setpoint);
  $('[data-summary]').textContent = summary(s);
  $('[data-label="mode"]').textContent = MODE_NAMES[s.mode];
  $('[data-label="fan"]').textContent = FAN_NAMES[s.fan];

  // Room temp
  const roomTempEl = $('[data-room-temp]');
  if (s.roomTemperature !== undefined && s.roomTemperature !== null) {
    roomTempEl.textContent = `Room ${Math.round(s.roomTemperature)}°`;
    roomTempEl.style.display = 'inline';
  } else {
    roomTempEl.style.display = 'none';
  }

  // Pills (mode, fan, vertical, horizontal)
  for (const b of $$('[data-set]', panel)) {
    const key = b.dataset.set as keyof ACState;
    b.setAttribute('aria-pressed', String(String(s[key]) === b.dataset.value));
  }

  // Features
  $('[data-feature="eco"]').setAttribute('aria-pressed', String(s.eco));
  $('[data-feature="powerful"]').setAttribute('aria-pressed', String(s.powerful));
  $('[data-feature="converti"]').setAttribute('aria-pressed', String(s.converti > 0));
  $('[data-feature="converti-label"]').textContent =
    s.converti > 0 ? `Converti: ${s.converti}%` : 'Converti7';
  $('[data-feature="display"]').setAttribute('aria-pressed', String(s.display));
  $('[data-feature="nanoe"]').setAttribute('aria-pressed', String(s.nanoe));

  // Converti strip pills
  for (const pill of $$('[data-converti-level]', convertiStrip)) {
    const level = Number(pill.dataset.convertiLevel);
    pill.setAttribute('aria-pressed', String(level === s.converti));
  }

  // Status banner underneath unit
  const banner = $('[data-banner]');
  if (s.sleepProfile) {
    banner.textContent = `Night profile active · hour ${s.sleepHour || 1}`;
    banner.style.opacity = '1';
    $('[data-schedule-btn="sleep"]').classList.add('is-active');
  } else if (s.offTimer) {
    const diffMin = Math.max(1, Math.round((s.offTimer.getTime() - Date.now()) / 60000));
    banner.textContent = diffMin > 60
      ? `Off at ${s.offTimer.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
      : `Off in ${diffMin} min`;
    banner.style.opacity = '1';
    $('[data-schedule-btn="timer"]').classList.add('is-active');
  } else {
    banner.style.opacity = '0';
    $('[data-schedule-btn="timer"]').classList.remove('is-active');
    $('[data-schedule-btn="sleep"]').classList.remove('is-active');
  }

  // Status dot
  statusDot.className = 'status-dot';
  if (isDemo) {
    statusDot.classList.add('demo');
  } else if (s.isOnline) {
    statusDot.classList.add('online');
  } else {
    statusDot.classList.add('offline');
  }

  scene.refresh();
});

// Command Dispatcher
async function sendCommand(fields: Record<string, any>, kind = 1) {
  console.log('[Mitra Web] sendCommand:', fields, { isDemo, hasSession: !!session, device: activeDevice?.name });
  if (isDemo || !session || !activeDevice) {
    console.log('[Mitra Web] Demo mode or no active device — state applied locally only.');
    return;
  }

  // Ensure homeId exists
  if (!session.homeId) {
    try {
      const devRes = await apiGetDevices(session.accessToken);
      if (devRes.id) {
        session.homeId = devRes.id;
        saveSession(session);
      }
    } catch (e) {
      console.warn('[Mitra Web] Failed to fetch homeId:', e);
    }
  }

  try {
    const reply = await apiSendCommand({
      deviceId: activeDevice.id,
      token: session.accessToken,
      homeId: session.homeId || '',
      topicBase: activeDevice.topicBase,
      fields,
      kind,
    });

    console.log('[Mitra Web] Command reply from AC:', reply);

    if (reply) {
      const patch = parseStatusFields(reply);
      patch.isOnline = true;
      store.set(patch);
    }
  } catch (err: any) {
    console.error('[Mitra Web] Failed to send command:', err);
    const banner = $('[data-banner]');
    banner.textContent = `Command error: ${err.message || 'Failed'}`;
    banner.style.opacity = '1';
    setTimeout(() => {
      banner.style.opacity = '0';
    }, 4000);

    if (String(err).includes('expired')) {
      handleSessionExpired();
    }
  }
}

// Poll status
async function refreshStatus() {
  if (isDemo || !session || !activeDevice) return;
  try {
    const rawStatus = await apiGetDeviceStatus(activeDevice.id, session.accessToken);
    const patch = parseStatusFields(rawStatus);
    store.set(patch);
  } catch (err) {
    console.warn('Poll failed:', err);
  }
}

function startPolling() {
  if (pollInterval) clearInterval(pollInterval);
  pollInterval = window.setInterval(() => {
    if (document.visibilityState === 'visible') {
      refreshStatus();
    }
  }, 25000);
}

function handleSessionExpired() {
  clearSession();
  showSignin();
}

function showSignin() {
  signinOverlay.classList.remove('is-hidden');
}

function hideSignin() {
  signinOverlay.classList.add('is-hidden');
}

// Panel interactions
panel.addEventListener('click', async (e) => {
  const btn = (e.target as Element).closest<HTMLButtonElement>('button');
  if (!btn) return;
  const s = store.get();

  if (btn.dataset.power !== undefined) {
    const nextOn = !s.on;
    store.set({ on: nextOn });
    await sendCommand({ ps: nextOn ? 'on' : 'off' });
  } else if (btn.dataset.stepTemp) {
    const nextTemp = Math.min(30, Math.max(16, s.setpoint + Number(btn.dataset.stepTemp)));
    store.set({ on: true, setpoint: nextTemp });
    await sendCommand({ actmp: String(nextTemp) });
  } else if (btn.dataset.set) {
    const key = btn.dataset.set;
    if (key === 'mode') {
      const mode = btn.dataset.value as Mode;
      store.set({ on: true, mode });
      await sendCommand({ acmd: mode });
    } else if (key === 'fan') {
      const fan = btn.dataset.value as Fan;
      store.set({ on: true, fan });
      await sendCommand({ acfs: fan });
    } else if (key === 'vertical') {
      const vertical = Number(btn.dataset.value);
      store.set({ on: true, vertical });
      await sendCommand({ acvs: vertical });
    } else if (key === 'horizontal') {
      const slot = Number(btn.dataset.value);
      store.set({ on: true, horizontal: slot });
      const rawPos = Louver.slotToHorizontal(slot);
      await sendCommand({ achs: rawPos });
    }
  } else if (btn.dataset.feature) {
    const feat = btn.dataset.feature;
    if (feat === 'eco') {
      const next = !s.eco;
      store.set({ eco: next, powerful: false, ...(next ? { setpoint: 26 } : {}) });
      await sendCommand(next ? { acem: 'on', acpm: 'off', actmp: '26' } : { acem: 'off' });
    } else if (feat === 'powerful') {
      const next = !s.powerful;
      store.set({ powerful: next, eco: false });
      await sendCommand(next ? { acpm: 'on', acem: 'off' } : { acpm: 'off' });
    } else if (feat === 'converti') {
      // Toggle Converti7 strip
      convertiStrip.classList.toggle('is-hidden');
    } else if (feat === 'nanoe') {
      const next = !s.nanoe;
      store.set({ nanoe: next });
      await sendCommand({ acng: next ? 'on' : 'off' });
    } else if (feat === 'display') {
      const next = !s.display;
      store.set({ display: next });
      await sendCommand({ acdc: next ? 'on' : 'off' });
    }
  }
});

// Converti7 Strip selection
convertiStrip.addEventListener('click', async (e) => {
  const pill = (e.target as Element).closest<HTMLButtonElement>('[data-converti-level]');
  if (!pill) return;
  const level = Number(pill.dataset.convertiLevel);
  convertiStrip.classList.add('is-hidden');

  store.set({ converti: level, eco: false, powerful: false });
  if (level === 0) {
    await sendCommand({ cnv: 0 });
  } else {
    await sendCommand({ cnv: level, acem: 'off', acpm: 'off' });
  }
});

// Click outside Converti strip to close
document.addEventListener('click', (e) => {
  if (
    !convertiStrip.classList.contains('is-hidden') &&
    !(e.target as Element).closest('#converti-strip') &&
    !(e.target as Element).closest('[data-feature="converti"]')
  ) {
    convertiStrip.classList.add('is-hidden');
  }
});

// Unit on/off button click
unitBtn.addEventListener('click', async () => {
  const nextOn = !store.get().on;
  store.set({ on: nextOn });
  await sendCommand({ ps: nextOn ? 'on' : 'off' });
});

// Timers Modal
$('[data-schedule-btn="timer"]').addEventListener('click', () => {
  timerOverlay.classList.remove('is-hidden');
});
$('#close-timer-modal').addEventListener('click', () => {
  timerOverlay.classList.add('is-hidden');
});

timerOverlay.addEventListener('click', async (e) => {
  const btn = (e.target as Element).closest<HTMLButtonElement>('[data-timer-min]');
  if (!btn) return;
  const mins = Number(btn.dataset.timerMin);
  timerOverlay.classList.add('is-hidden');

  if (mins === 0) {
    store.set({ offTimer: null });
    await sendCommand({ actm: [-1, -1] }, 14);
  } else {
    const offDate = new Date(Date.now() + mins * 60000);
    store.set({ offTimer: offDate });
    await sendCommand({ actm: [mins * 60, -1] }, 14);
  }
});

// Sleep Profile Modal & Curve Editor
const profiles = loadSavedProfiles();
let activeProfile: SleepProfile = profiles[0];

$('[data-schedule-btn="sleep"]').addEventListener('click', () => {
  renderSleepEditor();
  sleepOverlay.classList.remove('is-hidden');
});
$('#close-sleep-modal').addEventListener('click', () => {
  sleepOverlay.classList.add('is-hidden');
});

function renderSleepEditor() {
  const container = $('.sleep-chart');
  container.innerHTML = '';
  const currentSetpoint = store.get().setpoint;

  const temps = activeProfile.id === 'default'
    ? activeProfile.temperatures.map((t) => currentSetpoint + t - activeProfile.temperatures[0])
    : activeProfile.temperatures;

  temps.forEach((temp, i) => {
    const col = document.createElement('div');
    col.className = 'sleep-col';

    const badge = document.createElement('span');
    badge.className = 'sleep-temp-badge';
    badge.textContent = `${Math.round(temp)}°`;

    const bar = document.createElement('div');
    bar.className = 'sleep-bar';
    // Visual height percentage normalized between 16 and 30 °C
    const pct = Math.max(15, Math.min(100, ((temp - 16) / 14) * 100));
    bar.style.height = `${pct}%`;

    // Click / drag to change temperature
    bar.addEventListener('click', () => {
      if (activeProfile.id === 'default') return; // default is read-only
      const nextTemp = temp >= 29 ? 22 : temp + 1;
      activeProfile.temperatures[i] = nextTemp;
      saveProfiles(profiles);
      renderSleepEditor();
    });

    const label = document.createElement('span');
    label.className = 'sleep-hour-label';
    label.textContent = `H${i + 1}`;

    col.appendChild(badge);
    col.appendChild(bar);
    col.appendChild(label);
    container.appendChild(col);
  });

  const stopBtn = $<HTMLButtonElement>('#stop-sleep-btn');
  stopBtn.style.display = store.get().sleepProfile ? 'inline-flex' : 'none';
}

$('#start-sleep-btn').addEventListener('click', async () => {
  sleepOverlay.classList.add('is-hidden');
  const wire = wireTemperatures(activeProfile, store.get().setpoint);
  store.set({ sleepProfile: activeProfile.id, sleepHour: 1 });
  await sendCommand({ acsp: 'on', pid: activeProfile.id, temps: wire }, 12);
});

$('#stop-sleep-btn').addEventListener('click', async () => {
  sleepOverlay.classList.add('is-hidden');
  store.set({ sleepProfile: null, sleepHour: null });
  await sendCommand({ acsp: 'off', pid: activeProfile.id, temps: [] }, 12);
});

// Sign-In Form Submission
const signinForm = $<HTMLFormElement>('#signin-form');
const signinError = $('.error-banner');
const signinSubmit = $<HTMLButtonElement>('#signin-submit');

signinForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = ($('#input-username') as HTMLInputElement).value;
  const password = ($('#input-password') as HTMLInputElement).value;

  signinError.classList.remove('is-visible');
  signinSubmit.disabled = true;
  signinSubmit.textContent = 'Signing in…';

  try {
    const res = await apiLogin(username, password);
    saveSession({
      accessToken: res.accessToken,
      homeId: res.homeId,
      expiresAt: Date.now() + res.expiresIn * 1000,
    });
    currentDevices = res.devices || [];
    if (currentDevices.length > 0) {
      activeDevice = currentDevices[0];
      deviceNameText.textContent = activeDevice.name;
    }
    hideSignin();
    await initLiveApp();
  } catch (err: any) {
    signinError.textContent = err.message || 'Sign in failed';
    signinError.classList.add('is-visible');
  } finally {
    signinSubmit.disabled = false;
    signinSubmit.textContent = 'Sign In';
  }
});

// Demo mode trigger
$('#try-demo-btn').addEventListener('click', () => {
  isDemo = true;
  localStorage.setItem(KEY_DEMO, 'true');
  deviceNameText.textContent = 'Demo AC';
  hideSignin();
  initDemoApp();
});

// Sign-out action
$('[data-action="signout"]').addEventListener('click', () => {
  clearSession();
  showSignin();
});

// App initialization
async function initLiveApp() {
  if (!session) return;
  try {
    const devRes = await apiGetDevices(session.accessToken);
    currentDevices = devRes.devices;
    if (currentDevices.length > 0) {
      activeDevice = currentDevices[0];
      deviceNameText.textContent = activeDevice.name;
      await refreshStatus();
      startPolling();
    }
  } catch {
    handleSessionExpired();
  }
}

function initDemoApp() {
  store.set({
    on: true,
    setpoint: 24,
    mode: 'cool',
    fan: 'auto',
    vertical: 3,
    horizontal: 3,
    display: true,
    isOnline: true,
    roomTemperature: 27,
  });
}

// Bootstrap
loadSession();
if (session && !isDemo) {
  hideSignin();
  initLiveApp();
} else if (isDemo) {
  hideSignin();
  initDemoApp();
} else {
  showSignin();
}
