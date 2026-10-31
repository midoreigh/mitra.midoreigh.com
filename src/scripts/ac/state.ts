// The AC's state, shared by the drawing, the control panel, the scroll story and the live app.

export type Mode = 'auto' | 'cool' | 'dry' | 'fan' | 'heat';
export type Fan = 'auto' | 'quiet' | 'low' | 'medium' | 'high';

export interface ACCapabilities {
  heat: boolean;
  nanoe: boolean;
  converti: boolean;
}

export interface ACState {
  on: boolean;
  setpoint: number;
  mode: Mode;
  fan: Fan;
  /** Up/down louver: 0 swing, 1 (highest) to 5 (lowest). */
  vertical: number;
  /** Left/right louver: 0 swing, 1 (far left) to 5 (far right) in UI display slot. */
  horizontal: number;
  display: boolean;

  // Extended properties for live AC control
  roomTemperature?: number;
  eco: boolean;
  powerful: boolean;
  /** Converti7 cooling level: 0 is off, or 40, 55, 70, 80, 90, 100, 110. */
  converti: number;
  nanoe: boolean;
  isOnline: boolean;
  offTimer?: Date | null;
  onTimer?: Date | null;
  sleepProfile?: string | null;
  sleepHour?: number | null;
}

export const Converti = {
  off: 0,
  levels: [40, 55, 70, 80, 90, 100, 110] as const,
};

/**
 * Louver positions. MirAIe uses 0 for swing, and 1-5 for fixed positions.
 * For horizontal, MirAIe values are out of order: 1 = center, 2 = far left, 3 = left, 4 = right, 5 = far right.
 * The UI slot order from left to right is: [2, 3, 1, 4, 5].
 */
export const Louver = {
  swing: 0,
  horizontalLeftToRight: [2, 3, 1, 4, 5] as const,

  /** Converts MirAIe horizontal position (1-5) to 1-based UI visual slot (1 to 5). */
  horizontalSlot(pos: number): number {
    if (pos === 0) return 0;
    const idx = this.horizontalLeftToRight.indexOf(pos as any);
    return idx >= 0 ? idx + 1 : 3;
  },

  /** Converts 1-based UI visual slot (1 to 5) to MirAIe horizontal position (1-5). */
  slotToHorizontal(slot: number): number {
    if (slot === 0) return 0;
    return this.horizontalLeftToRight[Math.max(0, Math.min(4, slot - 1))] ?? 1;
  },
};

type RGB = [number, number, number];

/** The colours of each mode, as in the apps: the air's `tint`, a lighter `glow` for
 * gradients, and a deeper `control` shade for buttons showing the mode. */
export const MODE_COLORS: Record<Mode, { tint: RGB; glow: RGB; control: RGB }> = {
  cool: { tint: [0.33, 0.68, 1.0], glow: [0.49, 0.89, 1.0], control: [0.12, 0.42, 0.9] },
  auto: { tint: [0.62, 0.55, 1.0], glow: [0.86, 0.62, 1.0], control: [0.42, 0.32, 0.85] },
  dry: { tint: [0.22, 0.83, 0.76], glow: [0.55, 0.95, 0.8], control: [0.0, 0.48, 0.44] },
  fan: { tint: [0.78, 0.84, 0.93], glow: [0.95, 0.97, 1.0], control: [0.33, 0.4, 0.52] },
  heat: { tint: [1.0, 0.55, 0.24], glow: [1.0, 0.78, 0.42], control: [0.82, 0.36, 0.08] },
};

export const rgb = (c: RGB, alpha = 1) =>
  `rgba(${Math.round(c[0] * 255)}, ${Math.round(c[1] * 255)}, ${Math.round(c[2] * 255)}, ${alpha})`;

export const MODE_NAMES: Record<Mode, string> = {
  auto: 'Auto', cool: 'Cool', dry: 'Dry', fan: 'Fan', heat: 'Heat',
};

export const FAN_NAMES: Record<Fan, string> = {
  auto: 'Auto', quiet: 'Quiet', low: 'Low', medium: 'Medium', high: 'High',
};

/** Decodes room temperature, handling firmware 3.02+ sub-degree packing */
export function decodeRoomTemperature(value: any, firmware?: string): number | null {
  if (value === undefined || value === null) return null;
  const str = String(value);
  const parts = str.split('.');
  const vParts = (firmware || '').split('.').map((p) => parseInt(p, 10)).filter((n) => !isNaN(n));
  const is302 = vParts.length >= 2 && (vParts[0] > 3 || (vParts[0] === 3 && vParts[1] >= 2));

  if (is302 && parts.length === 2) {
    const fraction = parseFloat(parts[0]);
    const degrees = parseFloat(parts[1]);
    if (fraction < 256 && degrees >= 10 && degrees <= 50) {
      return degrees + fraction / 256;
    }
  }

  const num = parseFloat(str);
  return isNaN(num) ? null : num;
}

/** Parses raw MirAIe status fields into an ACState patch */
export function parseStatusFields(fields: Record<string, any>): Partial<ACState> {
  const patch: Partial<ACState> = {};

  if (fields.ps !== undefined) {
    patch.on = fields.ps === 'on';
  }
  if (fields.actmp !== undefined) {
    const t = parseFloat(String(fields.actmp));
    if (!isNaN(t)) patch.setpoint = t;
  }
  if (fields.acmd !== undefined && fields.acmd in MODE_NAMES) {
    patch.mode = fields.acmd as Mode;
  }
  if (fields.acfs !== undefined && fields.acfs in FAN_NAMES) {
    patch.fan = fields.acfs as Fan;
  }
  if (fields.acvs !== undefined) {
    patch.vertical = parseInt(String(fields.acvs), 10) || 0;
  }
  if (fields.achs !== undefined) {
    const rawH = parseInt(String(fields.achs), 10) || 0;
    patch.horizontal = Louver.horizontalSlot(rawH);
  }
  if (fields.acdc !== undefined) {
    patch.display = fields.acdc === 'on';
  }
  if (fields.acem !== undefined) {
    patch.eco = fields.acem === 'on';
  }
  if (fields.acpm !== undefined) {
    patch.powerful = fields.acpm === 'on';
  }
  if (fields.cnv !== undefined) {
    patch.converti = parseInt(String(fields.cnv), 10) || 0;
  }
  if (fields.acng !== undefined) {
    patch.nanoe = fields.acng === 'on';
  }
  if (fields.onlineStatus !== undefined) {
    patch.isOnline = String(fields.onlineStatus).toLowerCase() === 'true';
  }
  if (fields.rmtmp !== undefined) {
    const r = decodeRoomTemperature(fields.rmtmp, fields.V);
    if (r !== null) patch.roomTemperature = r;
  }

  // Timers
  if (Array.isArray(fields.actm) && fields.actm.length >= 2) {
    const offSec = Number(fields.actm[0]);
    const onSec = Number(fields.actm[1]);
    patch.offTimer = offSec > 0 ? new Date(offSec * 1000) : null;
    patch.onTimer = onSec > 0 ? new Date(onSec * 1000) : null;
  }

  // Sleep
  if (fields.acsp !== undefined) {
    patch.sleepProfile = fields.acsp === 'none' || fields.acsp === 'off' ? null : String(fields.acsp);
  }
  if (fields.sleep_indx !== undefined) {
    patch.sleepHour = parseInt(String(fields.sleep_indx), 10) || null;
  }

  return patch;
}

/** What the AC is doing, in a few words, e.g. "Cooling to 24°". */
export function summary(s: ACState): string {
  if (!s.on) return 'Off';
  const t = `${s.setpoint}°`;
  switch (s.mode) {
    case 'cool': return `Cooling to ${t}`;
    case 'heat': return `Heating to ${t}`;
    case 'dry': return `Drying at ${t}`;
    case 'fan': return 'Fan only';
    default: return `Auto at ${t}`;
  }
}

type Listener = (state: ACState) => void;

export function createStore(initial: ACState) {
  let state = { ...initial };
  const listeners = new Set<Listener>();
  return {
    get: () => state,
    set(patch: Partial<ACState>) {
      state = { ...state, ...patch };
      state.setpoint = Math.min(30, Math.max(16, state.setpoint));
      listeners.forEach((l) => l(state));
    },
    subscribe(l: Listener) {
      listeners.add(l);
      l(state);
      return () => listeners.delete(l);
    },
  };
}

export type Store = ReturnType<typeof createStore>;
