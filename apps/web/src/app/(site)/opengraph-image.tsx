import { OG_CONTENT_TYPE, OG_SIZE, ogImage } from '@/lib/og';

export const alt = 'qnot: a query builder that stays fast at a thousand rules';
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return ogImage({
    title: 'A query builder that stays fast at a thousand rules.',
    description: 'Typed from schema to SQL. React, Vue, Svelte, Solid or plain JS, any UI kit, about 15 KB.',
    path: '/',
  });
}
