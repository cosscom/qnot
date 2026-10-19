import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pageFileFor } from '@/lib/git-dates';
import { absoluteUrl } from '@/lib/seo';
import { SEO_ROUTES } from '@/lib/seo-routes';
import { docsLlms } from '@/lib/source';
import { SITE_DESCRIPTION, SITE_URL, withBrand } from '@/lib/site';
import { TOOLS } from '@/tools/catalog';

export const revalidate = false;

/** A page's meta description, read from its source (`description: '…'`), for the Pages list. */
function describe(path: string): string | undefined {
  const tool = TOOLS.find((t) => `/tools/${t.slug}` === path);
  if (tool) return tool.description;
  const file = pageFileFor(path);
  if (!file) return undefined;
  try {
    const m = /\bdescription:\s*(['"`])((?:\\.|(?!\1)[^\\])*)\1/.exec(readFileSync(join(process.cwd(), file), 'utf8'));
    return m?.[2]?.replace(/\\(['"`\\])/g, '$1').replace(/\s+/g, ' ').trim() || undefined;
  } catch {
    return undefined;
  }
}

function pages(): string {
  const sections = [...new Set(SEO_ROUTES.map((r) => r.group))].map((group) => {
    const routes = SEO_ROUTES.filter((r) => r.group === group);
    if (!routes.length) return '';
    const lines = routes.map((r) => {
      const d = describe(r.path);
      return `- [${r.label}](${absoluteUrl(r.path)})${d ? `: ${d}` : ''}`;
    });
    return `### ${group}\n\n${lines.join('\n')}`;
  }).filter(Boolean);
  return sections.length ? `\n\n## Pages\n\n${sections.join('\n\n')}\n` : '';
}

// llms.txt convention: the project's name, a one-line summary, then the docs index. Every page is
// also served as Markdown at <url>.md, and all of them at once at /llms-full.txt. The Pages section
// lists the guides, comparisons and tools outside the docs (lib/seo-routes.ts).
export function GET() {
  const header = `# qnot\n\n> ${SITE_DESCRIPTION}\n\nEvery page is available as Markdown by adding \`.md\` to its URL (e.g. ${SITE_URL}/docs/quick-start.md). The full docs in one file: ${SITE_URL}/llms-full.txt\n\n`;
  return new Response(withBrand(header + docsLlms.index() + pages()), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
