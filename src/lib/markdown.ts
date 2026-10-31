// The whole site as Markdown, for AI apps and anyone who'd rather read plain text.
// Served at /index.md and /llms-full.txt.

import { latestReleases, megabytes } from './releases';
import { FAQ, FEATURES, SITE } from './site';

export async function siteMarkdown(): Promise<string> {
  const { mac, android } = await latestReleases();
  const md = (html: string) => html.replace(/<b>(.*?)<\/b>/g, '**$1**').replace(/&amp;/g, '&');

  return `# ${SITE.name}

> ${SITE.description}

Website: ${SITE.url} · Source: ${SITE.repo} · Made by [${SITE.author.name}](${SITE.author.url})

Mitra for MirAIe lets you control a Panasonic MirAIe air conditioner from your Mac. It lives in the menu bar of your MacBook or any Mac, and there's an Android app too. It's a free, open-source alternative to the MirAIe app: you sign in with your MirAIe account and control the same ACs. It's independent and unofficial, free and open source (MIT licence). Mitra means friend.

## Why it exists: no more cycling

The MirAIe remote and app make Mode a single button: Auto, Cool, Dry, tap after tap. Fan speed and air direction work the same way. Mitra puts every option side by side, so any mode, fan speed or louver position is one click or tap away. Dry is one tap instead of three.

## What you can do

${FEATURES.map(([title, body]) => `- **${title}:** ${body}`).join('\n')}

Mitra only shows what your unit has: Heat and nanoe X appear when the AC reports them, and you can switch features on or off for each AC.

## See what your AC is doing

Mitra draws your unit blowing air the way it really does. The flap tilts to the louver position you pick; on swing, the air sweeps up and down and side to side at the unit's own pace. The air takes on the mode's colour (Cool blue, Auto violet, Dry teal, Fan silver, Heat orange), drifts on Quiet and rushes on High. Turning on, the flap swings open and the fan spins up; turning off, the air thins out and the flap swings shut. A light on the drawn unit shows whether the AC is online. Change anything with the remote or the MirAIe app and Mitra follows straight away.

## Timers and sleep profiles

A feature you won't find in other apps for these ACs.

- **Timers:** turn the AC off or on at a set time, or anywhere from 30 minutes to 4 hours from now.
- **Sleep profiles:** start one and the AC follows it through the night. Gentle, the AC's own profile, holds your temperature for three hours, then warms a degree, then another.
- **Your own nights:** drag a bar to set each hour's temperature, and choose whether the AC turns off when the profile ends.

The AC keeps its timers and profiles itself, so they carry on while your Mac sleeps or your phone is off.

## On the Mac

Mitra lives in the menu bar, with the set temperature beside its icon. One click opens the panel.

- **Siri and Shortcuts:** "Turn on the AC in Mitra for MirAIe." Siri handles power, temperature, mode and fan speed, and every action is in Shortcuts, so the AC can switch itself on before you get home.
- **Made for your AC:** switch Heating, nanoe X and Converti7 on or off for each unit.
- **Updates, quietly:** Mitra checks GitHub once a day and offers the new version in the panel. You can turn that off.

## On Android

The AC and its air fill the screen, with every control on a glass panel at the bottom, within thumb reach.

- **Converti7, one tap:** a glass strip with Off and every level from 40% to 110% in one row.
- **Preview Mode:** try every control without touching your AC.
- **Home-screen widget:** what the AC is doing, a power button, the set and room temperature, and − and +.
- **App shortcuts:** long-press the icon for AC on, AC off, Cooler and Warmer.
- **Quick Settings tile:** turn the AC on or off from anywhere.

## Privacy

- Your MirAIe password is kept in the Keychain on your Mac, or encrypted with the Android Keystore on your phone, and is only ever sent to MirAIe's own servers.
- No analytics. Apart from MirAIe, the Mac app talks only to GitHub to check for updates; the Android app talks to nothing else.
- The whole source is on GitHub: SwiftUI on the Mac and native Kotlin on Android.

## Download

Works with Panasonic ACs you control through the MirAIe app.

- **Mac ${mac.version}** (${megabytes(mac.size)}, released ${mac.date}): macOS 26 or later, on Apple silicon or Intel. [Download .dmg](${mac.download}) · [What's new](${mac.page})
- **Android ${android.version}** (${megabytes(android.size)}, released ${android.date}): Android 8.0 or later. [Download .apk](${android.download}) · [What's new](${android.page})
- **iPhone:** in the works.

## FAQ

${FAQ.map(({ q, a }) => `### ${q}\n\n${md(a)}`).join('\n\n')}

## More

- [Why I built Mitra](${SITE.blogPost}), the story behind the app
- [Source code, install guide and issues](${SITE.repo})
- [Report a problem](${SITE.repo}/issues/new?template=bug_report.yml) · [Suggest a feature](${SITE.repo}/issues/new?template=feature_request.yml)

Mitra is an independent, unofficial project, not affiliated with or endorsed by Panasonic. MirAIe is Panasonic's trademark.
`.replace(/\n{3,}/g, '\n\n');
}
