// The indoor unit and its air, drawn the way Mitra draws them (a port of MitraUI's ACUnitView):
// the flap tilts to the up/down louver, the air steers with the left/right one, takes the mode's
// colour, and drifts on Quiet or rushes on High. Turning on, the flap swings open and the fan
// spins up; turning off, the fan winds down and the flap closes.

import { MODE_COLORS, rgb, type ACState, type Fan, type Mode } from './state';

const STREAMS = 13;
const PER_STREAM = 7;
/** The unit's width as a share of the scene's; the air fans out across the rest. */
const UNIT_SHARE = 0.64;
const LOUVER_SPEED = 40; // degrees per second when moving to a new position
const DISPLAY_BLUE = 'rgb(26, 115, 242)';

const noise = (seed: number) => {
  const v = Math.sin(seed * 12.9898) * 43758.5453;
  return v - Math.floor(v);
};
const ease = (x: number) => x * x * (3 - 2 * x);
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

interface Angles { vertical: number; horizontal: number }
interface Power { fan: number; flap: number }
interface Particle { stream: number; seed: number; progress: number; speed: number; fan: Fan; mode: Mode }

function targetAngles(s: ACState, t: number): Angles {
  // Real louvers swing slowly: about 18 s up-down-up and 22 s left-right-left.
  return {
    vertical: s.vertical === 0 ? 42 + 28 * Math.sin((t * 2 * Math.PI) / 18) : 12 + (s.vertical - 1) * 15,
    horizontal: s.horizontal === 0 ? 30 * Math.sin((t * 2 * Math.PI) / 22 + 1) : (s.horizontal - 3) * 17,
  };
}

const pace = (fan: Fan) => ({ quiet: 0.18, low: 0.32, medium: 0.5, high: 0.8, auto: 0.36 })[fan];

function speed(fan: Fan, t: number) {
  return fan === 'auto' ? 0.36 + 0.08 * Math.cos((t % 3600) * 0.5) : pace(fan);
}

function phase(fan: Fan, t: number) {
  t %= 3600;
  return fan === 'auto' ? t * 0.36 + (0.08 / 0.5) * Math.sin(t * 0.5) : t * pace(fan);
}

/** In Auto the air brightens and fades a little, so it reads differently from a fixed speed. */
const breath = (fan: Fan, t: number) => (fan === 'auto' ? 0.75 + 0.25 * Math.sin((t % 3600) * 0.9) : 1);

/** Cool air sinks and warm air rises a little as it travels. */
const buoyancy = (mode: Mode) => (mode === 'cool' || mode === 'dry' ? 0.22 : mode === 'heat' ? -0.18 : 0.05);

function steadyAir(s: ACState, t: number): Particle[] {
  const ph = phase(s.fan, t), sp = speed(s.fan, t);
  const air: Particle[] = [];
  for (let stream = 0; stream < STREAMS; stream++) {
    for (let i = 0; i < PER_STREAM; i++) {
      const seed = noise(stream * 31 + i * 7);
      air.push({ stream, seed, progress: (ph + i / PER_STREAM + seed) % 1, speed: sp, fan: s.fan, mode: s.mode });
    }
  }
  return air;
}

/** Carries the animation from frame to frame, so changes ease in rather than jump, and each bit
 * of air keeps the fan speed and mode it left the unit with: a change flows out from the outlet. */
class AirMotion {
  private current?: Angles;
  private angleTime?: number;
  private air: Particle[] = [];
  private airTime?: number;
  private release: number[] = [];
  private gap: number[] = [];
  private released = 0;
  private fan?: number;
  private flap?: number;
  private powerTime?: number;

  power(s: ACState, t: number): Power {
    const dt = this.powerTime === undefined ? 0 : clamp(t - this.powerTime, 0, 0.1);
    this.powerTime = t;
    let fan = this.fan ?? (s.on ? 1 : 0);
    let flap = this.flap ?? (s.on ? 1 : 0);
    if (s.on) {
      flap = Math.min(1, flap + dt / 0.9);
      if (flap > 0.3) fan = Math.min(1, fan + dt / 1.4);
    } else {
      fan = Math.max(0, fan - dt / 1.4);
      if (fan < 0.45) flap = Math.max(0, flap - dt / 1.0);
    }
    this.fan = fan;
    this.flap = flap;
    return { fan: ease(fan), flap: ease(flap) };
  }

  angles(s: ACState, t: number): Angles {
    const target = targetAngles(s, t);
    const dt = this.angleTime === undefined ? 0 : clamp(t - this.angleTime, 0, 0.1);
    this.angleTime = t;
    const step = LOUVER_SPEED * dt;
    const approach = (cur: number | undefined, goal: number) =>
      cur === undefined ? goal : cur + clamp(goal - cur, -step, step);
    this.current = {
      vertical: approach(this.current?.vertical, target.vertical),
      horizontal: approach(this.current?.horizontal, target.horizontal),
    };
    return this.current;
  }

  particles(s: ACState, power: Power, t: number): Particle[] {
    if (this.release.length === 0) {
      this.air = s.on ? steadyAir(s, t) : [];
      for (let i = 0; i < STREAMS; i++) {
        this.release.push(noise(i * 13 + 5));
        this.gap.push(0.4 + 1.2 * noise(i * 29 + 3));
      }
    }
    const dt = this.airTime === undefined ? 0 : clamp(t - this.airTime, 0, 0.1);
    this.airTime = t;
    const sp = speed(s.fan, t);
    const drive = 0.35 + 0.65 * power.fan;
    for (const p of this.air) p.progress += p.speed * drive * dt;
    this.air = power.fan === 0 ? [] : this.air.filter((p) => p.progress < 1);

    for (let stream = 0; stream < STREAMS; stream++) {
      this.release[stream] += sp * dt * PER_STREAM * power.fan * power.flap;
      while (this.release[stream] >= this.gap[stream]) {
        this.release[stream] -= this.gap[stream];
        this.released++;
        const seed = noise(this.released * 17 + stream);
        this.gap[stream] = 0.4 + 1.2 * noise(this.released * 23 + stream * 7);
        this.air.push({
          stream, seed, progress: this.release[stream] / PER_STREAM, speed: sp * (0.9 + 0.2 * seed),
          fan: s.fan, mode: s.mode,
        });
      }
    }
    return this.air;
  }
}

export class ACScene {
  private ctx: CanvasRenderingContext2D;
  private motion = new AirMotion();
  private width = 0;
  private height = 0;
  private unit = { x: 0, y: 0, w: 0, h: 0 };
  private raf = 0;
  private visible = true;
  /** The display's glow, 0 to 1, and the reading it's showing or fading from. */
  private lit = 0;
  private litTime?: number;
  private reading = '';
  private previousReading = '';
  private readingChanged = -10;

  constructor(
    private canvas: HTMLCanvasElement,
    /** An element laid out by CSS where the unit should be drawn. */
    private anchor: HTMLElement,
    private state: () => ACState,
    private animated: boolean,
  ) {
    this.ctx = canvas.getContext('2d')!;
    const sizes = new ResizeObserver(() => this.resize());
    sizes.observe(canvas);
    sizes.observe(anchor);
    new IntersectionObserver(([entry]) => {
      this.visible = entry.isIntersecting;
      this.schedule();
    }).observe(canvas);
    document.addEventListener('visibilitychange', () => this.schedule());
    this.resize();
  }

  /** Redraws now; when animated, keeps drawing while the scene is on screen. */
  refresh() {
    if (!this.animated) this.draw(1.3);
  }

  private schedule() {
    if (!this.animated) return;
    cancelAnimationFrame(this.raf);
    if (this.visible && !document.hidden) this.raf = requestAnimationFrame(this.frame);
  }

  private frame = (now: number) => {
    this.draw(now / 1000);
    this.raf = requestAnimationFrame(this.frame);
  };

  private resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const box = this.canvas.getBoundingClientRect();
    const a = this.anchor.getBoundingClientRect();
    this.width = box.width;
    this.height = box.height;
    this.canvas.width = Math.round(box.width * dpr);
    this.canvas.height = Math.round(box.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.unit = { x: a.left - box.left, y: a.top - box.top, w: a.width, h: a.height };
    this.refresh();
  }

  private draw(t: number) {
    const s = this.state();
    const ctx = this.ctx;
    const angles = this.animated ? this.motion.angles(s, t) : targetAngles(s, t);
    const power = this.animated ? this.motion.power(s, t) : { fan: s.on ? 1 : 0, flap: s.on ? 1 : 0 };
    const air = this.animated ? this.motion.particles(s, power, t) : s.on ? steadyAir(s, t) : [];
    this.updateDisplay(s, t);

    ctx.clearRect(0, 0, this.width, this.height);
    this.drawAir(air, angles, power.fan, t);
    this.drawUnit(s, angles, power.flap, t);
  }

  private drawAir(air: Particle[], angles: Angles, level: number, t: number) {
    const ctx = this.ctx;
    const { x, y, w, h } = this.unit;
    const sceneW = w / UNIT_SHARE;
    const cx = x + w / 2;
    const top = y + h;
    const reach = Math.min((this.height - top) * 1.05, sceneW * 1.5);
    const tilt = (angles.vertical * Math.PI) / 180;
    const steer = (angles.horizontal * Math.PI) / 180;
    const outlet = UNIT_SHARE * 0.84;
    const scale = clamp(sceneW / 340, 1, 2.4);

    const point = (progress: number, originX: number, steerBy: number, lift: number) => {
      const distance = progress * reach;
      const forward = Math.cos(tilt) * distance;
      const down = Math.sin(tilt) * distance + lift * distance * progress;
      const sideways = Math.sin(steerBy) * distance * 0.9;
      const depth = forward / reach;
      return {
        x: originX + sideways + (originX - cx) * depth * 0.35,
        y: top + 2 + down * 0.85 + forward * 0.32,
        depth,
      };
    };

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    for (const p of air) {
      const u = p.stream / (STREAMS - 1);
      const originX = cx + (u - 0.5) * outlet * sceneW;
      const steerBy = steer + (u - 0.5) * 0.55;
      const lift = buoyancy(p.mode);
      const head = point(p.progress, originX, steerBy, lift);
      const tail = point(Math.max(0, p.progress - 0.12), originX, steerBy, lift);
      const fade = Math.sin(Math.PI * p.progress) * (0.55 + 0.35 * p.seed) * breath(p.fan, t) * level;
      const { tint, glow } = MODE_COLORS[p.mode];
      const g = ctx.createLinearGradient(tail.x, tail.y, head.x, head.y);
      g.addColorStop(0, rgb(tint, 0));
      g.addColorStop(1, rgb(glow, fade));
      ctx.strokeStyle = g;
      ctx.lineWidth = (1.2 + 2.4 * head.depth) * scale;
      ctx.beginPath();
      ctx.moveTo(tail.x, tail.y);
      ctx.lineTo(head.x, head.y);
      ctx.stroke();
    }
    ctx.restore();
  }

  private updateDisplay(s: ACState, t: number) {
    const dt = this.litTime === undefined ? 0 : clamp(t - this.litTime, 0, 0.1);
    this.litTime = t;
    const lit = s.on && s.display;
    this.lit = lit ? Math.min(1, this.lit + dt / 0.7) : Math.max(0, this.lit - dt / 0.35);
    if (!this.animated) this.lit = lit ? 1 : 0;
    const reading = s.mode === 'fan' ? 'FAN' : String(s.setpoint);
    if (reading !== this.reading) {
      this.previousReading = this.reading;
      this.reading = reading;
      this.readingChanged = this.previousReading && this.animated ? t : -10;
    }
  }

  private drawUnit(s: ACState, angles: Angles, openness: number, t: number) {
    const ctx = this.ctx;
    const { x, y, w, h } = this.unit;
    const radius = h * 0.28;
    const seam = h * 0.76; // where the front panel meets the flap
    const cap = w * 0.06; // the casing's end caps, either side of the flap
    const strip = h - seam;
    // 1 when the flap is level (its whole face shows), 0 when it points straight down.
    const level = 1 - clamp((angles.vertical - 12) / 60, 0, 1);
    const gap = openness * h * (0.15 - 0.07 * level);
    const face = strip + openness * (strip * (0.4 + 0.75 * level) - strip);

    ctx.save();
    ctx.translate(x, y);
    const casing = new Path2D();
    casing.roundRect(0, 0, w, h, radius);

    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
    ctx.shadowBlur = h * 0.36;
    ctx.shadowOffsetY = h * 0.1;
    const body = ctx.createLinearGradient(0, 0, 0, h);
    body.addColorStop(0, 'rgb(252, 252, 252)');
    body.addColorStop(1, 'rgb(222, 222, 222)');
    ctx.fillStyle = body;
    ctx.fill(casing);
    ctx.restore();

    // The outlet: dark where the flap has moved away, with the left/right vanes in it.
    ctx.save();
    ctx.clip(casing);
    ctx.fillStyle = 'rgb(36, 36, 36)';
    ctx.fillRect(cap, seam, w - 2 * cap, h - seam);
    if (openness > 0) {
      const lean = Math.tan((angles.horizontal * Math.PI) / 180) * gap * 1.2;
      ctx.strokeStyle = `rgba(140, 140, 140, ${openness})`;
      ctx.lineWidth = 1;
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (let i = 1; i < 12; i++) {
        const vx = cap + ((w - 2 * cap) * i) / 12;
        ctx.moveTo(vx - lean / 2, seam + 1);
        ctx.lineTo(vx + lean / 2, seam + gap - 1);
      }
      ctx.stroke();
    }
    ctx.restore();

    // The flap: clipped to the casing while closed, its own rounded blade as it opens.
    const flapTop = seam + gap;
    ctx.save();
    const flapClip = new Path2D();
    flapClip.roundRect(0, 0, w, h * (1 + 0.6 * openness), radius);
    ctx.clip(flapClip);
    const blade = new Path2D();
    blade.roundRect(cap + 0.5, flapTop, w - 2 * cap - 1, face, openness * Math.min(face / 2, h * 0.08));
    const bladeFill = ctx.createLinearGradient(0, flapTop, 0, flapTop + face);
    bladeFill.addColorStop(0, 'rgb(247, 247, 247)');
    bladeFill.addColorStop(1, 'rgb(204, 204, 204)');
    ctx.fillStyle = bladeFill;
    ctx.fill(blade);
    if (openness > 0) {
      ctx.strokeStyle = `rgba(255, 255, 255, ${openness})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cap + 3.5, flapTop + 0.6);
      ctx.lineTo(w - cap - 3.5, flapTop + 0.6);
      ctx.stroke();
    }
    ctx.restore();
    if (openness < 1) {
      ctx.strokeStyle = `rgba(184, 184, 184, ${1 - openness})`;
      ctx.lineWidth = 0.75;
      ctx.beginPath();
      ctx.moveTo(cap, seam);
      ctx.lineTo(w - cap, seam);
      ctx.stroke();
    }

    // Gloss across the top of the front panel, and a crisp outline.
    const gloss = new Path2D();
    gloss.roundRect(2, 2, w - 4, h * 0.45, Math.max(0, radius - 2));
    const shine = ctx.createLinearGradient(0, 0, 0, h * 0.45);
    shine.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
    shine.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = shine;
    ctx.fill(gloss);
    ctx.strokeStyle = 'rgba(184, 184, 184, 0.6)';
    ctx.lineWidth = 0.75;
    ctx.stroke(casing);

    this.drawDisplay(w, h, t);

    // The status light: green while running with the display on.
    if (s.on && s.display) {
      const d = h * 0.09;
      const lx = w * 0.06 + d / 2, ly = h * 0.245 + d / 2;
      ctx.save();
      ctx.globalAlpha = this.lit;
      ctx.shadowColor = 'rgba(52, 199, 89, 0.7)';
      ctx.shadowBlur = d * 0.8;
      const led = ctx.createRadialGradient(lx - d * 0.1, ly - d * 0.15, 0, lx, ly, d * 0.6);
      led.addColorStop(0, 'rgb(150, 230, 170)');
      led.addColorStop(1, 'rgb(52, 199, 89)');
      ctx.fillStyle = led;
      ctx.beginPath();
      ctx.arc(lx, ly, d / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  /** The set temperature glowing through the casing; a new reading slides up into place. */
  private drawDisplay(w: number, h: number, t: number) {
    if (this.lit <= 0) return;
    const ctx = this.ctx;
    const size = h * 0.3 * 0.7 * 1.25;
    const right = w * 0.95;
    const baseline = h * 0.14 + h * 0.3 * 0.82;
    const p = clamp((t - this.readingChanged) / 0.45, 0, 1);
    const shift = (1 - ease(p)) * size * 0.6;
    const glow = this.lit * this.lit;

    ctx.save();
    ctx.font = `600 ${size}px ui-rounded, "SF Pro Rounded", "Inter Variable", system-ui, sans-serif`;
    ctx.textAlign = 'right';
    ctx.fillStyle = DISPLAY_BLUE;
    ctx.shadowColor = 'rgba(26, 115, 242, 0.35)';
    ctx.shadowBlur = h * 0.06;
    if (p < 1 && this.previousReading) {
      ctx.globalAlpha = glow * (1 - ease(p));
      ctx.fillText(this.previousReading, right, baseline - (size * 0.6 - shift));
    }
    ctx.globalAlpha = glow * (p < 1 ? ease(p) : 1);
    ctx.fillText(this.reading, right, baseline + shift);
    ctx.restore();
  }
}
