import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { DocsPageFrame } from '@/components/docs/docs-frame';
import { getMDXComponents } from '@/components/docs/mdx';
import { pageMarkdown, source } from '@/lib/source';

export default async function Page({ params }: { params: Promise<{ slug?: string[] }> }) {
  const { slug } = await params;
  const page = source.getPage(slug);
  if (!page) notFound();
  const MDX = page.data.body;
  return (
    <DocsPageFrame
      description={page.data.description}
      markdown={await pageMarkdown(page)}
      markdownUrl={`${page.url === '/docs' ? '/docs/index' : page.url}.md`}
      title={page.data.title}
      toc={page.data.toc}
    >
      <MDX components={getMDXComponents()} />
    </DocsPageFrame>
  );
}

export function generateStaticParams() {
  return source.generateParams();
}

// Every page is prerendered: anything else is a 404 straight away.
export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Promise<{ slug?: string[] }> }): Promise<Metadata> {
  const { slug } = await params;
  const page = source.getPage(slug);
  if (!page) notFound();
  return { title: page.data.title, description: page.data.description };
}
