import { EXAMPLES, exampleBySlug } from '@/examples/catalog';
import { OG_CONTENT_TYPE, OG_SIZE, ogImage } from '@/lib/og';

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = 'A query builder example built with qnot';
export const generateStaticParams = () => EXAMPLES.map((e) => ({ slug: e.slug }));

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const e = exampleBySlug((await params).slug)!;
  return ogImage({ title: e.title, section: 'examples', eyebrow: `${e.category} example`, description: e.blurb.replace(/`/g, ''), path: `/examples/${e.slug}` });
}
