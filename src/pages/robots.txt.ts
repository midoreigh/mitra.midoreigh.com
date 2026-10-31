import type { APIRoute } from 'astro';
import { SITE } from '../lib/site';

// Search engines and AI crawlers are explicitly welcome.
const bots = ['Googlebot', 'Bingbot', 'GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-User', 'Claude-SearchBot', 'PerplexityBot', 'Perplexity-User', 'Google-Extended', 'Applebot', 'Applebot-Extended', 'DuckAssistBot', 'CCBot'];

export const GET: APIRoute = () =>
  new Response(
    `${bots.map((b) => `User-agent: ${b}\nAllow: /\n`).join('\n')}
User-agent: *
Allow: /

Sitemap: ${SITE.url}/sitemap-index.xml
`,
    { headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
  );
