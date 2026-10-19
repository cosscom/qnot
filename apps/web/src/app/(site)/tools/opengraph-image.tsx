import { OG_CONTENT_TYPE, OG_SIZE, ogImage } from '@/lib/og';

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = 'Free query converters by qnot';

export default function Image() {
  return ogImage({
    title: 'Convert any query, in your browser.',
    section: 'tools',
    eyebrow: 'Free converters',
    description: 'SQL, MongoDB, JsonLogic, Elasticsearch, react-querybuilder and RAQB JSON. Nothing leaves your browser.',
    path: '/tools',
  });
}
