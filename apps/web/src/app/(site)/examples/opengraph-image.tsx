import { OG_CONTENT_TYPE, OG_SIZE, ogImage } from '@/lib/og';

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = 'Query builder examples built with qnot';

export default function Image() {
  return ogImage({
    title: 'What people build with a query builder.',
    section: 'examples',
    eyebrow: 'Examples with full source',
    description: 'Filter bars, CRM segments, feature flags, alert rules and access policies, each a working app on the same typed store.',
    path: '/examples',
  });
}
