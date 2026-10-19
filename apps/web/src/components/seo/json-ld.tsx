import { type Crumb, type FaqItem, type JsonLdObject, breadcrumbLd, faqLd } from '@/lib/seo';
import { SEO_ROUTES } from '@/lib/seo-routes';

/**
 * schema.org structured data as a `<script type="application/ld+json">`. A server component: the
 * JSON is in the HTML crawlers fetch. `<` is escaped so a string can't close the script.
 */
export function JsonLd({ data }: { data: JsonLdObject | JsonLdObject[] }) {
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  // biome-ignore lint/security/noDangerouslySetInnerHtml: serialized JSON with `<` escaped
  return <script dangerouslySetInnerHTML={{ __html: json }} type="application/ld+json" />;
}

/** FAQPage for a page's `faq` export ({ q, a }[]); renders nothing for an empty list. */
export function FaqJsonLd({ faq }: { faq: readonly FaqItem[] | undefined }) {
  return faq?.length ? <JsonLd data={faqLd(faq)} /> : null;
}

/** BreadcrumbList from the site root down to the page (the root is added for you). */
export function BreadcrumbJsonLd({ crumbs }: { crumbs: Crumb[] }) {
  return <JsonLd data={breadcrumbLd(crumbs)} />;
}

/** BreadcrumbList for a search-landing page (lib/seo-routes.ts): Home › parent page (e.g. Compare) › the page. */
export function SeoRouteJsonLd({ path }: { path: string }) {
  const route = SEO_ROUTES.find((r) => r.path === path);
  if (!route) return null;
  const parent = SEO_ROUTES.find((r) => r.path !== path && path.startsWith(`${r.path}/`));
  const crumbs: Crumb[] = [...(parent ? [{ name: parent.group, path: parent.path }] : []), { name: route.label.startsWith('vs ') ? `qnot ${route.label}` : route.label.replace(/^./, (c) => c.toUpperCase()), path }];
  return <BreadcrumbJsonLd crumbs={crumbs} />;
}
