'use client';
import { useEffect, useState } from 'react';
import { ParityPage, type ParityBench } from './ParityPage';

/** Opens a demo from the URL hash (/parity#array) so every "Try it" is linkable. */
export function ParityClient({ markdown, bench }: { markdown: string; bench: ParityBench }) {
  const [demoId, setDemoId] = useState<string | undefined>(undefined);
  useEffect(() => {
    const read = () => setDemoId(window.location.hash.slice(1) || undefined);
    read();
    window.addEventListener('hashchange', read);
    return () => window.removeEventListener('hashchange', read);
  }, []);
  const open = (id: string | null) => {
    if (id) window.location.hash = id;
    else history.replaceState(null, '', window.location.pathname + window.location.search);
    setDemoId(id ?? undefined);
  };
  return <ParityPage markdown={markdown} bench={bench} demoId={demoId} onOpenDemo={open} />;
}
