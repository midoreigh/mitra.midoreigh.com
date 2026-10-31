import type { APIRoute } from 'astro';
import { siteMarkdown } from '../lib/markdown';

// The home page as plain Markdown, advertised with <link rel="alternate" type="text/markdown">.
export const GET: APIRoute = async () =>
  new Response(await siteMarkdown(), { headers: { 'Content-Type': 'text/markdown; charset=utf-8' } });
