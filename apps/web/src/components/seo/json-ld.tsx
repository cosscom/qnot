import { type Crumb, type FaqItem, type JsonLdObject, breadcrumbLd, faqLd } from '@/lib/seo';

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
