import { metaSchema, pageSchema } from 'fumadocs-core/source/schema';
import { defineDocs } from 'fumadocs-mdx/macro';

// Compiled by the fumadocs-mdx macro (next.config.ts): `dir` must stay a string literal.
export const docs = defineDocs({
  dir: 'content/docs',
  docs: {
    schema: pageSchema,
    // Markdown of each page for /llms-full.txt and /docs/<page>.md.
    postprocess: { includeProcessedMarkdown: true },
  },
  meta: { schema: metaSchema },
});
