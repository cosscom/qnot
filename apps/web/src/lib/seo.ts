// Page metadata and structured data, built the same way on every route: an absolute canonical URL
// (SITE_URL + BASE_PATH + path), Open Graph and a large Twitter card. Images come from each
// segment's opengraph-image file (Next adds those itself) or from `image` for route-handler images.
import type { Metadata } from 'next';
import { BASE_PATH, GITHUB_URL, SITE_DESCRIPTION, SITE_NAME, SITE_TITLE, SITE_URL } from './site';

/** The public URL of a site path ("/docs" → https://…/docs), base path included. */
export const absoluteUrl = (path: string) => `${SITE_URL}${BASE_PATH}${path === '/' ? '' : path}`;

/** The Open Graph card of a docs page (app/og/docs/[...slug]/route.tsx). */
export const docsOgPath = (slugs: readonly string[]) => `/og/docs/${[...slugs, 'image.png'].join('/')}`;

export interface PageMeta {
  /** The <title> before " · qnot": the search term first. */
  title: string;
  description: string;
  /** The page's path, e.g. "/tools/sql-to-mongodb". */
  path: string;
  /** An explicit OG image path (route handlers); file-based opengraph-image needs nothing. */
  image?: string;
  /** Open Graph type: "article" for docs pages. */
  type?: 'website' | 'article';
  /** For articles. */
  publishedTime?: string;
  modifiedTime?: string;
  /** Use the title as-is (no " · qnot"). */
  absoluteTitle?: boolean;
}

/** Metadata for a page: title, description, canonical URL, Open Graph and Twitter. */
export function pageMetadata({ title, description, path, image, type = 'website', publishedTime, modifiedTime, absoluteTitle }: PageMeta): Metadata {
  const url = absoluteUrl(path);
  const fullTitle = absoluteTitle ? title : `${title} · ${SITE_NAME}`;
  const images = image ? [{ url: absoluteUrl(image), width: 1200, height: 630, alt: fullTitle }] : undefined;
  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type,
      siteName: SITE_NAME,
      title: fullTitle,
      description,
      url,
      locale: 'en_US',
      ...(images && { images }),
      ...(type === 'article' && { publishedTime, modifiedTime }),
    },
    twitter: { card: 'summary_large_image', title: fullTitle, description, ...(images && { images: images.map((i) => i.url) }) },
  };
}

// --- schema.org ----------------------------------------------------------------------------------

export type JsonLdObject = { '@context'?: 'https://schema.org'; '@type': string } & Record<string, unknown>;

export interface Crumb {
  name: string;
  path: string;
}

/** BreadcrumbList from Home down to the page: positions from 1, absolute item URLs. */
export function breadcrumbLd(crumbs: Crumb[]): JsonLdObject {
  const all = [{ name: SITE_NAME, path: '/' }, ...crumbs];
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: all.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: absoluteUrl(c.path) })),
  };
}

export interface FaqItem {
  q: string;
  a: string;
}

/** FAQPage from question/answer pairs (plain text answers). */
export function faqLd(faq: readonly FaqItem[]): JsonLdObject {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
  };
}

const publisher = { '@type': 'Organization', name: 'coss.com', url: 'https://coss.com' };

/** TechArticle for a docs page. */
export function techArticleLd({ title, description, path, modified }: { title: string; description?: string; path: string; modified?: string }): JsonLdObject {
  return {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    headline: title,
    ...(description && { description }),
    url: absoluteUrl(path),
    mainEntityOfPage: absoluteUrl(path),
    inLanguage: 'en',
    isPartOf: { '@type': 'WebSite', name: SITE_NAME, url: absoluteUrl('/') },
    ...(modified && { dateModified: modified }),
    author: publisher,
    publisher,
    about: { '@type': 'SoftwareSourceCode', name: SITE_NAME, codeRepository: GITHUB_URL },
  };
}

/** WebApplication for a free in-browser tool. */
export function webAppLd({ name, description, path }: { name: string; description: string; path: string }): JsonLdObject {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name,
    description,
    url: absoluteUrl(path),
    applicationCategory: 'DeveloperApplication',
    operatingSystem: 'Any (runs in the browser)',
    browserRequirements: 'Requires JavaScript',
    isAccessibleForFree: true,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    publisher,
  };
}

/** The home page: the library itself and the site. */
export function homeLd(): JsonLdObject[] {
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'SoftwareSourceCode',
      name: SITE_NAME,
      description: SITE_DESCRIPTION,
      url: absoluteUrl('/'),
      codeRepository: GITHUB_URL,
      programmingLanguage: { '@type': 'ComputerLanguage', name: 'TypeScript' },
      runtimePlatform: ['Browser', 'Node.js'],
      license: 'https://opensource.org/licenses/MIT',
      keywords: 'query builder, filter builder, SQL, MongoDB, JsonLogic, Elasticsearch, React, Vue, Svelte, Solid, TypeScript',
      author: publisher,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: SITE_NAME,
      alternateName: SITE_TITLE,
      description: SITE_DESCRIPTION,
      url: absoluteUrl('/'),
      inLanguage: 'en',
      publisher,
    },
  ];
}
