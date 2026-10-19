import { OG_CONTENT_TYPE, OG_SIZE, ogImage } from '@/lib/og';
import { TOOLS, toolBySlug } from '@/tools/catalog';

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = 'A free qnot converter tool';
export const generateStaticParams = () => TOOLS.map((t) => ({ slug: t.slug }));

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const tool = toolBySlug((await params).slug)!;
  return ogImage({ title: tool.title, section: 'tools', eyebrow: 'Free converter · runs in your browser', description: tool.lede, path: `/tools/${tool.slug}` });
}
