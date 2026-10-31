import type { APIRoute } from 'astro';
import { siteMarkdown } from '../lib/markdown';

// https://llmstxt.org — everything on the site in one Markdown file.
export const GET: APIRoute = async () =>
  new Response(await siteMarkdown(), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
