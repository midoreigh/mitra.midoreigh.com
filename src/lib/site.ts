// Facts about Mitra shared by the page, its structured data, and the plain-text versions
// for AI apps (llms.txt, llms-full.txt, index.md), so they never drift apart.

import { REPO } from './releases';

export const SITE = {
  name: 'Mitra for MirAIe',
  url: 'https://mitra.midoreigh.com',
  title: 'Mitra for MirAIe — every setting on your AC, one tap away',
  description:
    'A free, open-source Mac menu bar and Android app that lays out every mode, fan speed and air direction of your Panasonic MirAIe AC at once, and draws the air while it flows.',
  author: { name: 'Mido Reigh', url: 'https://midoreigh.com' },
  blogPost: 'https://midoreigh.com/blog/mitra-for-miraie',
  repo: REPO,
  locale: 'en_IN',
};

export const FEATURES: [string, string][] = [
  ['Power and temperature', 'On and off, 16 to 30 °C with − and +, and the room temperature your AC measures.'],
  ['Every mode', 'Auto, Cool, Dry and Fan, plus Heat on units that have it.'],
  ['Every fan speed', 'Auto, Quiet, Low, Medium and High, as the MirAIe app names them.'],
  ['Both louvers', 'Swing, or any of five positions up and down and left and right.'],
  ['The extras', 'Eco, Powerful, Converti7 cooling levels, nanoe X and the display light.'],
  ['Timers and sleep', 'Off or on at a set time, and sleep profiles with a temperature for each hour of the night.'],
  ['Every AC', 'Switch between all the ACs on your MirAIe account.'],
  ['Try it first', 'A demo AC before you sign in, and Preview Mode that never touches your unit.'],
];

/** Answers are HTML (only <b>), shown as-is on the page and as plain text elsewhere. */
export const FAQ: { q: string; a: string }[] = [
  {
    q: 'Why does my Mac ask before opening it?',
    a: 'Mitra isn’t signed with a paid Apple Developer ID. The first time, click <b>Open Anyway</b> in System Settings › Privacy &amp; Security. After each update macOS asks for your password once or twice before the new version can read your saved sign-in; choose <b>Always Allow</b> and it stays quiet until the next one.',
  },
  {
    q: 'How do I install the Android app?',
    a: 'Mitra isn’t on Google Play, so download the APK on your phone and open it. If Android asks, allow your browser to <b>install unknown apps</b>, then tap <b>Install</b>. If Play Protect says it doesn’t recognise the app, tap <b>More details › Install anyway</b>. To update, install the new APK over the old one; you stay signed in.',
  },
  {
    q: 'Where are the Mac widgets?',
    a: 'The widgets and the Control Center toggle need an Apple developer team, so the downloaded app doesn’t include them. Build Mitra from source with your own team to get them. Siri and Shortcuts work either way.',
  },
  {
    q: 'Can I try it without signing in?',
    a: 'Yes. Choose <b>Try it without an account</b> for a demo AC, or switch on <b>Preview Mode</b> to try the controls without sending anything to your real unit.',
  },
  {
    q: 'How does it talk to my AC?',
    a: 'The way the official app does. MirAIe has no public API, so Mitra signs in to your MirAIe account over REST, then sends commands and receives live status over MQTT. Commands update the panel instantly, and the AC confirms them a second or two later.',
  },
];

export const plain = (html: string) =>
  html.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
