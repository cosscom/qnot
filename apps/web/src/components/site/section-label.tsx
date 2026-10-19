'use client';
import { usePathname } from 'next/navigation';

const SECTIONS = new Map([
  ['docs', 'docs'],
  ['examples', 'examples'],
  ['playground', 'playground'],
]);

/** Next to the wordmark: the section the page belongs to (`qnot docs`), like coss.com/ui. */
export function SectionLabel() {
  const section = usePathname().split('/')[1];
  const label = section ? SECTIONS.get(section) : undefined;
  if (!label) return null;
  return <span className="font-normal text-muted-foreground/64">{label}</span>;
}
