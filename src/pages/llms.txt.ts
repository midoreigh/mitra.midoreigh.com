import type { APIRoute } from 'astro';
import { latestReleases } from '../lib/releases';
import { SITE } from '../lib/site';

// https://llmstxt.org — a short, LLM-readable map of the site.
export const GET: APIRoute = async () => {
  const { mac, android } = await latestReleases();
  const body = `# ${SITE.name}

> ${SITE.description}

Mitra is a free, open-source (MIT) alternative to the MirAIe app for Panasonic air conditioners, for the Mac menu bar (macOS 26+) and Android (8.0+). It signs in with your MirAIe account and controls the same ACs. Instead of cycling through modes, fan speeds and air directions one tap at a time as the MirAIe remote and app do, Mitra shows every option at once, so each is one click or tap away. It also adds timers and sleep profiles, which other apps for these ACs don't have. It also lets you control a MirAIe AC from a Mac. It's independent and unofficial, not affiliated with Panasonic.

## Docs

- [Everything about Mitra](${SITE.url}/llms-full.txt): features, timers and sleep, Mac and Android, privacy, downloads and FAQ in one Markdown file
- [Home page in Markdown](${SITE.url}/index.md)

## Download

- [Mitra for Mac ${mac.version}](${mac.download}): .dmg, macOS 26 or later, Apple silicon or Intel
- [Mitra for Android ${android.version}](${android.download}): .apk, Android 8.0 or later

## Optional

- [Why I built Mitra](${SITE.blogPost}): the story behind the app, by ${SITE.author.name}
- [Source code on GitHub](${SITE.repo}): install guide, changelogs and issues
`;
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
