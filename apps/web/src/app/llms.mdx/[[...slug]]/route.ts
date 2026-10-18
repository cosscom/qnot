import { notFound } from 'next/navigation';
import { pageMarkdown, source } from '@/lib/source';

export const revalidate = false;

/** A docs page as Markdown, served at /docs/<page>.md (next.config.ts rewrites to here). */
export async function GET(_req: Request, { params }: { params: Promise<{ slug?: string[] }> }) {
  const { slug } = await params;
  const page = source.getPage(slug?.length === 1 && slug[0] === 'index' ? [] : slug);
  if (!page) notFound();
  return new Response(await pageMarkdown(page), { headers: { 'Content-Type': 'text/markdown; charset=utf-8' } });
}

export function generateStaticParams() {
  return [...source.generateParams(), { slug: ['index'] }];
}
