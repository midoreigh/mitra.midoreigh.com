// The home page: the live AC and its panel, the scroll story that drives them, and the
// section reveals below.
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { ACScene } from './ac/scene';
import { createStore, FAN_NAMES, MODE_COLORS, MODE_NAMES, rgb, summary, type ACState } from './ac/state';
import { reduced } from './motion';

gsap.registerPlugin(ScrollTrigger, SplitText);

const $ = <T extends Element = HTMLElement>(sel: string, root: any = document) => root.querySelector(sel)! as T;
const $$ = <T extends Element = HTMLElement>(sel: string, root: any = document) => [...root.querySelectorAll(sel)] as T[];

const stage = $('.stage');
const beats = $$('[data-beat]');
const steps = $$('.step');
const dots = $$('.dots li');
const unit = $<HTMLButtonElement>('[data-unit]');
const panel = $('.panel');

const first: Partial<ACState> = JSON.parse(beats[0].dataset.state!);
// Starts off, so the page opens with the AC turning on.
const store = createStore({ ...(first as ACState), display: true, on: reduced });
const scene = new ACScene($<HTMLCanvasElement>('.scene'), unit, store.get, !reduced);

// Reflect the state in the panel and the page's accent colours.
store.subscribe((s) => {
  const c = MODE_COLORS[s.mode];
  const root = document.documentElement.style;
  root.setProperty('--tint', rgb(c.tint));
  root.setProperty('--glow', rgb(c.glow));
  root.setProperty('--control', rgb(c.control));

  stage.classList.toggle('off', !s.on);
  panel.classList.toggle('off', !s.on);
  $('[data-power]').setAttribute('aria-pressed', String(s.on));
  unit.setAttribute('aria-label', s.on ? 'Turn the AC off' : 'Turn the AC on');
  $('[data-temp]').textContent = String(s.setpoint);
  $('[data-summary]').textContent = summary(s);
  $('[data-label="mode"]').textContent = MODE_NAMES[s.mode];
  $('[data-label="fan"]').textContent = FAN_NAMES[s.fan];
  for (const b of $$('[data-set]', panel)) {
    const key = b.dataset.set as keyof ACState;
    b.setAttribute('aria-pressed', String(String(s[key]) === b.dataset.value));
  }
  scene.refresh();
});

if (!reduced) setTimeout(() => active === 0 && store.set({ on: true }), 700);

// The panel. Touching it stops the story's demo loop: the visitor has taken over.
let cycleTimer = 0;
const takeOver = () => {
  clearInterval(cycleTimer);
  gsap.to('.hint', { autoAlpha: 0, duration: 0.4 });
};

panel.addEventListener('click', (event) => {
  const button = (event.target as Element).closest<HTMLButtonElement>('button');
  if (!button) return;
  takeOver();
  const s = store.get();
  if (button.dataset.power !== undefined) {
    store.set({ on: !s.on });
  } else if (button.dataset.stepTemp) {
    store.set({ on: true, setpoint: s.setpoint + Number(button.dataset.stepTemp) });
  } else if (button.dataset.set) {
    const key = button.dataset.set;
    const value = key === 'vertical' || key === 'horizontal' ? Number(button.dataset.value) : button.dataset.value;
    store.set({ on: true, [key]: value });
  }
});

unit.addEventListener('click', () => {
  takeOver();
  store.set({ on: !store.get().on });
});

// The story: each beat of scrolling sets the AC to what its copy describes.
let active = 0;

function activate(index: number) {
  if (index === active) return;
  const previous = steps[active];
  active = index;
  clearInterval(cycleTimer);

  const beat = beats[index];
  store.set(JSON.parse(beat.dataset.state!));
  if (beat.dataset.cycle) {
    const cycle: Partial<ACState>[] = JSON.parse(beat.dataset.cycle);
    let k = 0;
    cycleTimer = window.setInterval(() => {
      k = (k + 1) % cycle.length;
      store.set(cycle[k]);
    }, 2800);
  }

  const next = steps[index];
  dots.forEach((dot, i) => dot.classList.toggle('on', i === index));
  previous.classList.remove('is-active');
  next.classList.add('is-active');
  if (reduced) {
    gsap.set(previous, { autoAlpha: 0 });
    gsap.set(next, { autoAlpha: 1 });
    return;
  }
  gsap.killTweensOf([previous, next, ...next.children]);
  gsap.to(previous, { autoAlpha: 0, y: -24, duration: 0.35, ease: 'power2.in' });
  gsap.set(next, { autoAlpha: 1, y: 0 });
  gsap.fromTo(
    next.children,
    { autoAlpha: 0, y: 28 },
    { autoAlpha: 1, y: 0, duration: 0.8, stagger: 0.07, ease: 'power3.out', delay: 0.2 },
  );
  const tally = next.querySelectorAll('.tally i');
  if (tally.length) {
    gsap.fromTo(tally, { scale: 0 }, { scale: 1, duration: 0.4, stagger: 0.22, ease: 'back.out(3)', delay: 0.7 });
  }
}

beats.forEach((beat, i) => {
  ScrollTrigger.create({
    trigger: beat,
    start: 'top 50%',
    end: 'bottom 50%',
    onToggle: (self) => self.isActive && activate(i),
  });
});

// The header turns to glass once the page has moved.
const bar = $('.bar');
const onScroll = () => bar.classList.toggle('scrolled', window.scrollY > 8);
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();

// Timers and sleep: show the Mac or the Android screens.
const columns = $('.columns');
for (const button of $$<HTMLButtonElement>('[data-platform]')) {
  button.addEventListener('click', () => {
    columns.dataset.show = button.dataset.platform;
    for (const b of $$('[data-platform]')) b.setAttribute('aria-pressed', String(b === button));
  });
}

if (!reduced) {
  // The opening line rises into place.
  document.fonts.ready.then(() => {
    const hero = $('.step.hero');
    SplitText.create(hero.querySelector('h1')!, {
      type: 'words',
      mask: 'words',
      onSplit: (self) =>
        gsap.from(self.words, { yPercent: 110, duration: 1.2, stagger: 0.08, ease: 'expo.out', delay: 0.15 }),
    });
    gsap.from([...hero.children].filter((el) => el.tagName !== 'H1'), {
      autoAlpha: 0, y: 20, duration: 1, stagger: 0.1, ease: 'power3.out', delay: 0.5,
    });
    gsap.from('.dock', { autoAlpha: 0, y: 40, duration: 1.2, ease: 'expo.out', delay: 0.9 });

    for (const heading of $$('[data-split]')) {
      SplitText.create(heading, {
        type: 'lines',
        mask: 'lines',
        autoSplit: true,
        onSplit: (self) =>
          gsap.from(self.lines, {
            yPercent: 105, duration: 1.1, stagger: 0.1, ease: 'expo.out',
            scrollTrigger: { trigger: heading, start: 'top 88%' },
          }),
      });
    }
  });

  // Screens tip back flat as they scroll into view.
  for (const figure of $$('[data-tilt]')) {
    gsap.fromTo(
      figure,
      { rotateX: 18, scale: 0.9, transformPerspective: 1400, transformOrigin: '50% 0%' },
      { rotateX: 0, scale: 1, ease: 'none', scrollTrigger: { trigger: figure, start: 'top bottom', end: 'top 35%', scrub: true } },
    );
  }

  // Settings windows drift apart at different speeds.
  for (const figure of $$('[data-drift]')) {
    gsap.fromTo(
      figure,
      { yPercent: -Number(figure.dataset.drift) },
      { yPercent: Number(figure.dataset.drift), ease: 'none', scrollTrigger: { trigger: figure, start: 'top bottom', end: 'bottom top', scrub: true } },
    );
  }

  // The phones start stacked behind the middle one and fan out as they arrive.
  for (const phone of $$('[data-fan]')) {
    const side = Number(phone.dataset.fan);
    gsap.fromTo(
      phone,
      { xPercent: -side * 70, yPercent: side ? 14 : 8, rotate: -side * 8, scale: side ? 0.86 : 0.94 },
      {
        xPercent: 0, yPercent: side ? 6 : 0, rotate: side * 4, scale: 1, ease: 'none',
        scrollTrigger: { trigger: phone.closest('.phones'), start: 'top 95%', end: 'center 55%', scrub: true },
      },
    );
  }
}
