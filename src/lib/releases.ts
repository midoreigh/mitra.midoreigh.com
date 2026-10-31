// The latest Mac and Android releases, read from GitHub when the site builds, so a deploy
// always links the newest downloads. Falls back to the releases below if GitHub can't be reached.

export const REPO = 'https://github.com/midoreigh/mitra-for-miraie';

export interface Release {
  version: string;
  tag: string;
  date: string;
  /** The .dmg or .apk itself. */
  download: string;
  /** The release page, with notes and checksums. */
  page: string;
  size: number;
}

const fallback = (tag: string, version: string, file: string, date: string, size: number): Release => ({
  version, tag, date, size,
  download: `${REPO}/releases/download/${tag}/${file}`,
  page: `${REPO}/releases/tag/${tag}`,
});

const FALLBACK = {
  mac: fallback('v1.5.0', '1.5.0', 'Mitra-for-MirAIe-1.5.0.dmg', '2026-10-31', 3897381),
  android: fallback('android-v1.0.1', '1.0.1', 'Mitra-for-MirAIe-1.0.1.apk', '2026-10-31', 2475491),
};

interface GitHubRelease {
  tag_name: string;
  draft: boolean;
  prerelease: boolean;
  html_url: string;
  published_at: string;
  assets: { name: string; browser_download_url: string; size: number }[];
}

function pick(releases: GitHubRelease[], tagPrefix: RegExp, extension: string): Release | undefined {
  for (const r of releases) {
    if (r.draft || r.prerelease || !tagPrefix.test(r.tag_name)) continue;
    const asset = r.assets.find((a) => a.name.endsWith(extension));
    if (!asset) continue;
    return {
      version: r.tag_name.replace(tagPrefix, ''),
      tag: r.tag_name,
      date: r.published_at.slice(0, 10),
      download: asset.browser_download_url,
      page: r.html_url,
      size: asset.size,
    };
  }
}

export async function latestReleases(): Promise<{ mac: Release; android: Release }> {
  try {
    const response = await fetch('https://api.github.com/repos/midoreigh/mitra-for-miraie/releases?per_page=30', {
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (!response.ok) throw new Error(`GitHub answered ${response.status}`);
    const releases: GitHubRelease[] = await response.json();
    return {
      mac: pick(releases, /^v/, '.dmg') ?? FALLBACK.mac,
      android: pick(releases, /^android-v/, '.apk') ?? FALLBACK.android,
    };
  } catch (error) {
    console.warn(`Using the built-in release links: ${error}`);
    return FALLBACK;
  }
}

export const megabytes = (bytes: number) => `${(bytes / 1_000_000).toFixed(1)} MB`;
