// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://mitra.midoreigh.com',
  trailingSlash: 'never',
  build: { format: 'file' },
  server: { port: 4322 },
  devToolbar: { enabled: false },
  integrations: [sitemap()],
});
