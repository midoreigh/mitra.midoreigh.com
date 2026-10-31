// Smooth scrolling (Lenis) driving GSAP ScrollTrigger, off for reduced-motion users.
import Lenis from 'lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const lenis = reduced ? null : new Lenis();

// In-page links land where each target's CSS `scroll-margin-top` says (just under the header),
// smoothly with Lenis, and update the address so the place can be shared or returned to.
document.addEventListener('click', (event) => {
  const link = (event.target as Element).closest<HTMLAnchorElement>('a[href^="#"]');
  const target = link && document.getElementById(link.hash.slice(1));
  if (!link || !target || event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey) return;
  event.preventDefault();
  const margin = parseFloat(getComputedStyle(target).scrollMarginTop) || 0;
  // Where the target rests once revealed: a card still waiting to slide up sits lower for now.
  const lift = Number(gsap.getProperty(target, 'y')) || 0;
  const top = target.getBoundingClientRect().top + window.scrollY - lift - margin;
  if (lenis) lenis.scrollTo(top);
  else window.scrollTo({ top });
  history.pushState(null, '', link.hash);
});

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
