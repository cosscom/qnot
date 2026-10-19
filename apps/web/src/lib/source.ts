import 'server-only';
import { llms, loader } from 'fumadocs-core/source';
import { docs } from './collections';
import { DOCS_ROUTE, withBrand } from './site';

export const source = loader({ source: docs.toFumadocsSource(), baseUrl: DOCS_ROUTE });

export type DocsPage = NonNullable<ReturnType<typeof source.getPage>>;

/** A page as Markdown: "Copy Markdown", /docs/<page>.md, /llms.txt and /llms-full.txt. */
export async function pageMarkdown(page: DocsPage): Promise<string> {
  return withBrand(`# ${page.data.title} (${page.url})\n\n${page.data.description ? `${page.data.description}\n\n` : ''}${await page.data.getText('processed')}`);
}

export const docsLlms = llms(source, { renderPage: pageMarkdown });
