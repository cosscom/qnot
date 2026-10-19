import { OG_CONTENT_TYPE, OG_SIZE, ogImage } from '@/lib/og';

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = 'qnot in coss ui, shadcn/ui, MUI and plain HTML';

export default function Image() {
  return ogImage({
    title: 'Any UI kit',
    section: 'kits',
    eyebrow: 'coss ui · shadcn/ui · MUI · headless',
    description: 'One headless query builder, every look. Each kit is the same hooks and the same store; only the controls change.',
    path: '/kits',
  });
}
