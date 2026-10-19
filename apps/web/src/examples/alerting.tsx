'use client';
import { compile, defineFields, f } from '@trawlnet/core';
import { BellRingIcon, CircleCheckIcon, PauseIcon, PlayIcon } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CossQueryBuilder } from '@/coss/QueryBuilder';
import { cn } from '@/lib/utils';
import { rng, useExampleStore, useLiveQuery } from './shared';



const fields = defineFields({
  service: f.enum(['api', 'web', 'worker', 'search', 'billing']),
  region: f.enum(['us-east-1', 'eu-west-1', 'ap-south-1']),
  cpu: f.number({ label: 'CPU %', min: 0, max: 100 }),
  errorRate: f.number({ label: 'Error rate %', min: 0 }),
  p99: f.number({ label: 'p99 latency (ms)', min: 0 }),
  slo: f.number({ label: 'p99 SLO (ms)', min: 0 }),
  rps: f.number({ label: 'Requests/s', min: 0 }),
});

type Service = 'api' | 'web' | 'worker' | 'search' | 'billing';
type Region = 'us-east-1' | 'eu-west-1' | 'ap-south-1';
type Sample = { id: string; service: Service; region: Region; cpu: number; errorRate: number; p99: number; slo: number; rps: number };

const SERVICES: Pick<Sample, 'service' | 'region' | 'slo'>[] = [
  { service: 'api', region: 'us-east-1', slo: 300 },
  { service: 'api', region: 'eu-west-1', slo: 300 },
  { service: 'web', region: 'us-east-1', slo: 800 },
  { service: 'worker', region: 'us-east-1', slo: 2000 },
  { service: 'search', region: 'eu-west-1', slo: 250 },
  { service: 'search', region: 'ap-south-1', slo: 250 },
  { service: 'billing', region: 'us-east-1', slo: 400 },
];

const rand = rng(21);
const walk = (v: number, step: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v + (rand() - 0.5) * 2 * step));
const round = (v: number, d = 0) => Math.round(v * 10 ** d) / 10 ** d;

function initial(): Sample[] {
  return SERVICES.map((s, i) => ({
    ...s,
    id: `${s.service}/${s.region}`,
    // A couple of services start near their thresholds so the demo fires within a few seconds.
    cpu: i === 6 ? 88 : 30 + rand() * 40,
    errorRate: i === 3 ? 1.9 : rand() * 1.2,
    p99: s.slo * (i === 1 ? 1.08 : 0.5 + rand() * 0.45),
    rps: 200 + rand() * 1800,
  }));
}

function tick(samples: Sample[]): Sample[] {
  return samples.map((s) => ({
    ...s,
    cpu: walk(s.cpu, 9, 2, 100),
    errorRate: walk(s.errorRate, 0.6, 0, 12),
    p99: walk(s.p99, s.slo * 0.18, s.slo * 0.2, s.slo * 2.2),
    rps: walk(s.rps, 160, 20, 4000),
  }));
}

interface LogEntry {
  at: string;
  id: string;
  firing: boolean;
}


export function Demo() {
  const store = useExampleStore(fields, {
    kind: 'group',
    combinator: 'or',
    children: [
      { kind: 'rule', field: 'cpu', operator: 'gt', value: 85 },
      { kind: 'rule', field: 'errorRate', operator: 'gte', value: 2 },
      { kind: 'rule', field: 'p99', operator: 'gt', ref: 'slo' },
    ],
  });
  const query = useLiveQuery(store);
  const firing = useMemo(() => compile(fields, query), [query]);
  const [samples, setSamples] = useState(initial);
  const [running, setRunning] = useState(true);
  const [log, setLog] = useState<LogEntry[]>([]);
  const prev = useRef(new Map<string, boolean>());

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setSamples(tick), 1000);
    return () => clearInterval(t);
  }, [running]);

  const states = samples.map((s) => ({ s, on: firing(s) }));

  // Record transitions (fired / resolved) for the event log.
  useEffect(() => {
    const changes: LogEntry[] = [];
    const at = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    for (const { s, on } of states) {
      const was = prev.current.get(s.id);
      if (was !== undefined && was !== on) changes.push({ at, id: s.id, firing: on });
      prev.current.set(s.id, on);
    }
    if (changes.length) setLog((l) => [...changes, ...l].slice(0, 8));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [samples, firing]);

  const count = states.filter((x) => x.on).length;
  return (
    <>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-4">
          <CossQueryBuilder store={store} />
          <div className="rounded-xl border">
            <div className="border-b px-3 py-2 font-medium text-sm">Events</div>
            {log.length === 0 && <p className="px-3 py-4 text-muted-foreground text-xs">Waiting for state changes…</p>}
            {log.map((e, i) => (
              <div key={`${e.at}-${e.id}-${i}`} className="flex items-center gap-2 border-b px-3 py-1.5 text-xs last:border-b-0">
                {e.firing ? <BellRingIcon className="size-3.5 text-destructive-foreground" /> : <CircleCheckIcon className="size-3.5 text-success-foreground" />}
                <span className="font-mono">{e.id}</span>
                <span className="text-muted-foreground">{e.firing ? 'started firing' : 'resolved'}</span>
                <span className="ms-auto text-muted-foreground tabular-nums">{e.at}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">Live metrics</span>
            <Badge variant={count ? 'error' : 'success'} data-firing={count}>
              {count ? `${count} firing` : 'All clear'}
            </Badge>
            <Button size="sm" variant="ghost" className="ms-auto" onClick={() => setRunning((r) => !r)}>
              {running ? <PauseIcon /> : <PlayIcon />} {running ? 'Pause' : 'Resume'}
            </Button>
          </div>
          <div className="overflow-hidden rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Service</TableHead>
                  <TableHead className="text-end">CPU</TableHead>
                  <TableHead className="text-end">Errors</TableHead>
                  <TableHead className="text-end">p99 / SLO</TableHead>
                  <TableHead className="text-end">RPS</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {states.map(({ s, on }) => (
                  <TableRow key={s.id} className={cn('transition-colors', on && 'bg-destructive/8 hover:bg-destructive/12')}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {on ? <BellRingIcon className="size-4 animate-pulse text-destructive-foreground" /> : <span className="size-4" />}
                        <span className="font-medium">{s.service}</span>
                        <span className="text-muted-foreground text-xs">{s.region}</span>
                      </div>
                    </TableCell>
                    <TableCell className={cn('text-end tabular-nums', s.cpu > 85 && 'text-destructive-foreground')}>{round(s.cpu)}%</TableCell>
                    <TableCell className="text-end tabular-nums">{round(s.errorRate, 1)}%</TableCell>
                    <TableCell className={cn('text-end tabular-nums', s.p99 > s.slo && 'text-destructive-foreground')}>
                      {round(s.p99)} / {s.slo}
                    </TableCell>
                    <TableCell className="text-end text-muted-foreground tabular-nums">{round(s.rps).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </>
  );
}
