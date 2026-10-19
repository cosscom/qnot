import { OG_CONTENT_TYPE, OG_SIZE, ogImage } from '@/lib/og';

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = 'The qnot query builder playground';

export default function Image() {
  return ogImage({
    title: 'Query builder playground',
    section: 'playground',
    eyebrow: 'Try it in your browser',
    description: 'Build a query, export it to SQL, MongoDB and JsonLogic, filter 1,000 rows, and switch frameworks on one store.',
    path: '/playground',
  });
}
