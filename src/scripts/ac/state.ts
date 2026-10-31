// The demo AC's state, shared by the drawing, the control panel and the scroll story.

export type Mode = 'auto' | 'cool' | 'dry' | 'fan' | 'heat';
export type Fan = 'auto' | 'quiet' | 'low' | 'medium' | 'high';

export interface ACState {
  on: boolean;
  setpoint: number;
  mode: Mode;
  fan: Fan;
  /** Up/down louver: 0 swing, 1 (highest) to 5 (lowest). */
  vertical: number;
  /** Left/right louver: 0 swing, 1 (far left) to 5 (far right). */
  horizontal: number;
  display: boolean;
}

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
