import { OG_CONTENT_TYPE, OG_SIZE, ogImage } from '@/lib/og';

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = 'qnot benchmarks: render, typing, memory and bundle size from 10 to 5,000 rules';

export default function Image() {
  return ogImage({
    title: 'Benchmarks',
    section: 'benchmarks',
    eyebrow: '10 to 5,000 rules · 10 builders · every codec',
    description: 'First render, keystrokes, memory and bundle size for qnot and five other query builders, with the method and the raw numbers.',
    path: '/benchmarks',
  });
}
