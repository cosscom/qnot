import type { Metadata } from 'next';
import { parityBench, parityMarkdown } from '@/parity/bench';
import { ParityClient } from '@/parity/parity-client';

export const metadata: Metadata = {
  title: 'RAQB parity',
  description: 'Every react-awesome-query-builder feature mapped to trawlnet, each with a live demo, plus the benchmark numbers.',
};

export default function Page() {
  return (
    <main className="mx-auto w-full max-w-[1440px] flex-1">
      <ParityClient bench={parityBench()} markdown={parityMarkdown()} />
    </main>
  );
}
