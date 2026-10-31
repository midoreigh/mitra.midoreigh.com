// MirAIe REST API client for Cloudflare Workers.
// Clean, stateless pass-through to MirAIe's authentication and home services.

const CLIENT_ID = 'PBcMcfG19njNCL8AOgvRzIC8AjQa';
const SCOPE = 'an_14214235325';
const LOGIN_URL = 'https://auth.miraie.in/simplifi/v1/userManagement/login';
const HOMES_URL = 'https://app.miraie.in/simplifi/v1/homeManagement/homes';
const DEVICES_URL = 'https://app.miraie.in/simplifi/v1/deviceManagement/devices/';

export interface DeviceInfo {
  id: string;
  name: string;
  kind: 'airConditioner' | 'unsupported';
  topicBase: string;
  room?: string;
}

export interface HomeInfo {
  id: string;
  devices: DeviceInfo[];
}

export interface LoginResult {
  accessToken: string;
  expiresIn: number;
  homeId?: string;
  devices: DeviceInfo[];
}

export function parseLoginIdentifier(username: string): { field: 'email' | 'mobile'; value: string } | null {
  const trimmed = username.trim();
  if (trimmed.includes('@')) {
    const valid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmed);
    return valid ? { field: 'email', value: trimmed } : null;
  }

  // Filter only digits and check valid formats
  const digits = trimmed.replace(/\D/g, '');
  if (trimmed.startsWith('+')) {
    return digits.length >= 8 && digits.length <= 15 ? { field: 'mobile', value: '+' + digits } : null;
  }
  if (digits.length === 10) {
    return { field: 'mobile', value: '+91' + digits };
  }
  if (digits.length === 11 && digits.startsWith('0')) {
    return { field: 'mobile', value: '+91' + digits.slice(1) };
  }
  if (digits.length === 12 && digits.startsWith('91')) {
    return { field: 'mobile', value: '+' + digits };
  }
  return null;
}

export async function login(username: string, password: string): Promise<LoginResult> {
  const ident = parseLoginIdentifier(username);
  if (!ident) {
    throw new Error('Enter a 10-digit mobile number or an email address.');
  }

  console.log(`[MirAIe Login] logging in with ${ident.field}`);

  const payload: Record<string, string> = {
    clientId: CLIENT_ID,
    scope: SCOPE,
    password,
    [ident.field]: ident.value,
  };

  const res = await fetch(LOGIN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const json: any = await res.json().catch(() => ({}));
  if (res.status !== 200 || !json.accessToken) {
    const msg = json.message || `Sign-in failed (HTTP ${res.status})`;
    console.error(`[MirAIe Login] failed:`, msg);
    throw new Error(msg);
  }

  const accessToken: string = json.accessToken;
  const expiresIn: number = Number(json.expiresIn) || 3600;

  console.log(`[MirAIe Login] success! Fetching home and devices...`);
  const home = await getHome(accessToken);

  return {
    accessToken,
    expiresIn,
    homeId: home?.id,
    devices: home?.devices || [],
  };
}

export async function getHome(accessToken: string): Promise<HomeInfo | null> {
  const res = await fetch(HOMES_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (res.status === 401 || res.status === 403) {
    throw new Error('Your MirAIe session expired.');
  }
  if (!res.ok) {
    throw new Error(`Failed to load homes (HTTP ${res.status})`);
  }

  const list: any = await res.json().catch(() => []);
  if (!Array.isArray(list) || list.length === 0) {
    return null;
  }

  const home = list[0];
  const homeId: string = home.homeId || home.id || '';
  const spaces = Array.isArray(home.spaces) ? home.spaces : [];
  const devices: DeviceInfo[] = [];

  const allDevices: any[] = [
    ...spaces.flatMap((s: any) =>
      Array.isArray(s.devices) ? s.devices.map((d: any) => ({ ...d, spaceName: s.spaceName })) : []
    ),
    ...(Array.isArray(home.devices) ? home.devices : []),
  ];

  for (const dev of allDevices) {
    const id: string = dev.deviceId || dev.id;
    let topic: string = '';
    if (typeof dev.topic === 'string') {
      topic = dev.topic;
    } else if (Array.isArray(dev.topic) && dev.topic.length > 0) {
      topic = String(dev.topic[0]);
    }
    if (!id || !topic) continue;

    const category = String(dev.category || 'AC').toUpperCase();
    devices.push({
      id,
      name: dev.deviceName || dev.name || 'AC',
      kind: category.includes('AC') ? 'airConditioner' : 'unsupported',
      topicBase: topic,
      room: dev.spaceName || undefined,
    });
  }

  console.log(`[MirAIe getHome] homeId=${homeId}, found ${devices.length} AC devices:`, devices.map((d) => d.name));

  return {
    id: homeId,
    devices: devices.filter((d) => d.kind === 'airConditioner'),
  };
}

export async function getDeviceStatus(deviceId: string, accessToken: string): Promise<any> {
  const url = `${DEVICES_URL}${deviceId}/mobile/status`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (res.status === 401 || res.status === 403) {
    throw new Error('Your MirAIe session expired.');
  }
  if (!res.ok) {
    throw new Error(`MirAIe status returned HTTP ${res.status}`);
  }

  return await res.json();
}
