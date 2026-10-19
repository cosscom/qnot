import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { DocsPageFrame } from '@/components/docs/docs-frame';
import { getMDXComponents } from '@/components/docs/mdx';
import { BreadcrumbJsonLd, JsonLd } from '@/components/seo/json-ld';
import { lastModified } from '@/lib/git-dates';
import { docsOgPath, pageMetadata, techArticleLd, type Crumb } from '@/lib/seo';
import { pageMarkdown, source, type DocsPage } from '@/lib/source';

/** Docs › folder (when it has a page of its own) › page. */
function crumbs(page: DocsPage): Crumb[] {
  const out: Crumb[] = [{ name: 'Docs', path: '/docs' }];
  if (page.url === '/docs') return out;
  for (let i = 1; i < page.slugs.length; i++) {
    const parent = source.getPage(page.slugs.slice(0, i));
    if (parent) out.push({ name: parent.data.title, path: parent.url });
  }
  out.push({ name: page.data.title, path: page.url });
  return out;
}

export default async function Page({ params }: { params: Promise<{ slug?: string[] }> }) {
  const { slug } = await params;
  const page = source.getPage(slug);
  if (!page) notFound();
  const MDX = page.data.body;
  return (
    <>
      <BreadcrumbJsonLd crumbs={crumbs(page)} />
      <JsonLd data={techArticleLd({ title: page.data.metaTitle ?? page.data.title, description: page.data.metaDescription ?? page.data.description, path: page.url, modified: lastModified(`content/docs/${page.path}`) })} />
      <DocsPageFrame
        description={page.data.description}
        markdown={await pageMarkdown(page)}
        markdownUrl={`${page.url === '/docs' ? '/docs/index' : page.url}.md`}
        title={page.data.title}
        toc={page.data.toc}
      >
        <MDX components={getMDXComponents()} />
      </DocsPageFrame>
    </>
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
  return pageMetadata({
    title: page.data.metaTitle ?? page.data.title,
    description: page.data.metaDescription ?? page.data.description ?? '',
    path: page.url,
    image: docsOgPath(page.slugs),
    type: 'article',
    modifiedTime: lastModified(`content/docs/${page.path}`),
  });
}
