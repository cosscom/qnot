import { metaSchema, pageSchema } from 'fumadocs-core/source/schema';
import { defineDocs } from 'fumadocs-mdx/macro';
import { z } from 'zod';

// Compiled by the fumadocs-mdx macro (next.config.ts): `dir` must stay a string literal.
export const docs = defineDocs({
  dir: 'content/docs',
  docs: {
    // metaTitle / metaDescription: the <title> and meta description for search (search term first,
    // 140–160 characters); title and description stay what the page shows.
    schema: pageSchema.extend({ metaTitle: z.string().optional(), metaDescription: z.string().optional() }),
    // Markdown of each page for /llms-full.txt and /docs/<page>.md.
    postprocess: { includeProcessedMarkdown: true },
  },
  meta: { schema: metaSchema },
});
