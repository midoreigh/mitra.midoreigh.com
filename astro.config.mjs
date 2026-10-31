// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://mitra.midoreigh.com',
  trailingSlash: 'never',
  build: { format: 'file' },
  server: { port: 4322 },
  devToolbar: { enabled: false },
  // lastmod is the build date: the site is rebuilt whenever Mitra or the page changes.
  integrations: [sitemap({ serialize: (item) => ({ ...item, lastmod: new Date().toISOString() }) })],
});
