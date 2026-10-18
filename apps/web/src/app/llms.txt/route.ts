import { docsLlms } from '@/lib/source';
import { SITE_DESCRIPTION, SITE_URL } from '@/lib/site';

export const revalidate = false;

// llms.txt convention: the project's name, a one-line summary, then the docs index. Every page is
// also served as Markdown at <url>.md, and all of them at once at /llms-full.txt.
export function GET() {
  const header = `# trawlnet\n\n> ${SITE_DESCRIPTION}\n\nEvery page is available as Markdown by adding \`.md\` to its URL (e.g. ${SITE_URL}/docs/quick-start.md). The full docs in one file: ${SITE_URL}/llms-full.txt\n\n`;
  return new Response(header + docsLlms.index(), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
