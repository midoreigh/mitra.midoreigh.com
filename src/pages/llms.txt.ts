import type { APIRoute } from 'astro';
import { latestReleases } from '../lib/releases';
import { SITE } from '../lib/site';

// https://llmstxt.org — a short, LLM-readable map of the site.
export const GET: APIRoute = async () => {
  const { mac, android } = await latestReleases();
  const body = `# ${SITE.name}

> ${SITE.description}

Mitra solves two problems with Panasonic MirAIe air conditioners. First, there's been no easy way to control one from a computer, only the physical remote or the MirAIe phone app: Mitra puts the AC in the menu bar of a MacBook or any Mac (macOS 26+), and there's an Android app (8.0+) too. Second, the remote and the MirAIe app both make mode, fan speed and air direction single buttons you cycle through one press at a time: Mitra shows every option at once, so each is one click or tap away. It's a free, open-source (MIT) alternative to the MirAIe app that signs in with your MirAIe account and controls the same ACs, and it adds timers and sleep profiles, which other apps for these ACs don't have. It's independent and unofficial, not affiliated with Panasonic.

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
