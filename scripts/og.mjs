// Renders public/og.png, the 1200×630 share image, in Mitra's own look. Run: npm run og
import sharp from 'sharp';

const W = 1200, H = 630;
const INTER = 'node_modules/inter-ui/InterVariable.ttf';
const MODES = ['#F5A65B', '#B38BFA', '#5CC8FF', '#4FD1B5', '#DCE3EE']; // Heat, Auto, Cool, Dry, Fan

const text = async (markup, width, align = 'left') =>
  sharp({ text: { text: markup, font: 'Inter', fontfile: INTER, width, rgba: true, align, dpi: 72, spacing: 0 } }).png().toBuffer();

// Air in every mode's colour, fanning out behind the panel like the icon
const streaks = MODES.map((c, i) => {
  const x0 = 830 + i * 34, x1 = 660 + i * 120;
  return `<line x1="${x0}" y1="150" x2="${x1}" y2="640" stroke="${c}" stroke-width="26" stroke-linecap="round" opacity=".16"/>`;
}).join('');

const bg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <radialGradient id="glow" cx="72%" cy="20%" r="70%"><stop offset="0" stop-color="#1d3a6b"/><stop offset=".5" stop-color="#0d1526"/><stop offset="1" stop-color="#07090f"/></radialGradient>
    <filter id="blur"><feGaussianBlur stdDeviation="18"/></filter>
    <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="22"/></filter>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>
  <g filter="url(#blur)">${streaks}</g>
  <rect x="790" y="62" width="324" height="520" rx="26" fill="#000" opacity=".55" filter="url(#shadow)"/>
</svg>`;

const PANEL_H = 540;
const panelMeta = await sharp('scripts/og-panel.png').metadata();
const PANEL_W = Math.round((panelMeta.width / panelMeta.height) * PANEL_H);
const radius = Buffer.from(`<svg width="${PANEL_W}" height="${PANEL_H}"><rect width="${PANEL_W}" height="${PANEL_H}" rx="22" fill="#fff"/></svg>`);
const panel = await sharp('scripts/og-panel.png').resize(PANEL_W, PANEL_H).composite([{ input: radius, blend: 'dest-in' }]).png().toBuffer();
const border = Buffer.from(`<svg width="${PANEL_W}" height="${PANEL_H}"><rect x=".5" y=".5" width="${PANEL_W - 1}" height="${PANEL_H - 1}" rx="22" fill="none" stroke="#fff" stroke-opacity=".14"/></svg>`);

const icon = await sharp('public/icon.png').trim().resize(112, 112).png().toBuffer();
const title = await text('<span font_weight="700" font_size="64pt" foreground="#f4f6fb">Mitra for MirAIe</span>', 640);
const tagline = await text('<span font_weight="500" font_size="38pt" foreground="#f4f6fb">Every setting on your AC,\none tap away.</span>', 640);
const sub = await text(
  '<span font_weight="400" font_size="22pt" foreground="#e2e8f5" alpha="66%">No more cycling through modes. Timers and sleep\nprofiles for Panasonic ACs on MirAIe.</span>',
  640,
);
const chips = await text(
  '<span font_weight="600" font_size="19pt" foreground="#7de3ff" letter_spacing="1200">MAC MENU BAR  ·  ANDROID  ·  FREE &amp; OPEN SOURCE</span>',
  700,
);

const px = 1200 - 120 - PANEL_W + 30;
await sharp(Buffer.from(bg))
  .composite([
    { input: panel, left: px, top: 45 },
    { input: border, left: px, top: 45 },
    { input: icon, left: 72, top: 60 },
    { input: title, left: 72, top: 200 },
    { input: tagline, left: 74, top: 292 },
    { input: sub, left: 74, top: 430 },
    { input: chips, left: 74, top: 530 },
  ])
  .png({ compressionLevel: 9 })
  .toFile('public/og.png');
console.log('public/og.png', PANEL_W, PANEL_H);
