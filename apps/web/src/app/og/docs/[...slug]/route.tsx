import { notFound } from 'next/navigation';
import { ogImage } from '@/lib/og';
import { source } from '@/lib/source';

// Docs pages live under an optional catch-all, where opengraph-image files can't go: their cards
// are served here as /og/docs/<slug>/image.png and linked from the page's metadata.

export const revalidate = false;
export const dynamicParams = false;

export function generateStaticParams() {
  return source.getPages().map((page) => ({ slug: [...page.slugs, 'image.png'] }));
}

export async function GET(_: Request, { params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  const page = source.getPage(slug.slice(0, -1));
  if (!page) notFound();
  const section = page.slugs[0];
  const eyebrow = page.slugs.length > 1 && section ? section.charAt(0).toUpperCase() + section.slice(1) : 'Documentation';
  return ogImage({ title: page.data.metaTitle ?? page.data.title, section: 'docs', eyebrow, description: page.data.description, path: page.url });
}
