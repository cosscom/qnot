import { OG_CONTENT_TYPE, OG_SIZE } from '@/lib/og';
import { seoPageOg } from '@/lib/seo-og';
import { metadata } from './page';

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = typeof metadata.title === 'string' ? metadata.title : 'qnot';

export default function Image() {
  return seoPageOg('/shadcn-query-builder', metadata);
}
