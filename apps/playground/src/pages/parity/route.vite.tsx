// Vite-only wrapper: loads the parity doc (?raw) and benchmark results from the repo, then renders
// the host-agnostic <ParityPage>. Other hosts (Next.js) can read the same files at build time.
import parityMarkdown from '../../../../../docs/raqb-parity.md?raw';
import sizes from '../../../../../bench/dist/sizes.json';
import results from '../../../../../bench/results/results-parity-check.json';
import { ParityPage, type ParityBench } from './ParityPage';

const kb = (bytes: number) => Math.round(bytes / 102.4) / 10;
const react = sizes['_react-baseline' as keyof typeof sizes].jsGz;
const at = (lib: 'trawlnet' | 'raqb') => results.results[lib]['1000'];

const bench: ParityBench = {
  bundleKb: { trawlnet: kb(sizes.trawlnet.jsGz - react), raqb: kb(sizes.raqb.jsGz - react) },
  keystrokeMs: { trawlnet: at('trawlnet').keystrokeMedianMs, raqb: at('raqb').keystrokeMedianMs },
  mountMs: { trawlnet: Math.round(at('trawlnet').mountColdMs), raqb: Math.round(at('raqb').mountColdMs) },
  heapMb: { trawlnet: Math.round(at('trawlnet').heapKB / 102.4) / 10, raqb: Math.round(at('raqb').heapKB / 102.4) / 10 },
};

export function ParityRoute({ demoId }: { demoId?: string }) {
  return <ParityPage markdown={parityMarkdown} bench={bench} demoId={demoId} onOpenDemo={(id) => (window.location.hash = id ? `#/parity/${id}` : '#/parity')} />;
}
