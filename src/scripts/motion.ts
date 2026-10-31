// Smooth scrolling (Lenis) driving GSAP ScrollTrigger, off for reduced-motion users.
import Lenis from 'lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const lenis = reduced ? null : new Lenis({ anchors: { offset: -64 } });

if (lenis) {
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
}

gsap.utils.toArray<HTMLElement>('[data-reveal]').forEach((el) => {
  gsap.from(el, {
    opacity: 0,
    y: reduced ? 0 : 40,
    duration: 1,
    ease: 'power3.out',
    scrollTrigger: { trigger: el, start: 'top 88%' },
  });
});
