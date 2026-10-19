// Part of trawlnet (https://github.com/sean-brydon/trawlnet). MIT licensed; installable with shadcn.
'use client';
import { compile, defineFields, encode, f, type Query } from '@trawlnet/core';
import { jsonlogic } from '@trawlnet/core/formats/jsonlogic';
import { FlagIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { CodeBlock } from '@/components/trawlnet/code-block';
import { ScrollBox } from '@/components/trawlnet/scroll-box';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { CossQueryBuilder } from '@/components/trawlnet/query-builder';
import { cn } from '@/lib/utils';
import { pickWith, rng, useExampleStore, useLiveQuery } from '@/components/trawlnet/examples/shared';



const fields = defineFields({
  plan: f.enum(['free', 'pro', 'team', 'enterprise']),
  country: f.enum(['US', 'GB', 'DE', 'FR', 'JP', 'BR']),
  appVersion: f.number({ label: 'App version', min: 0 }),
  platform: f.enum(['web', 'ios', 'android']),
  email: f.text(),
  betaOptIn: f.boolean({ label: 'Beta opt-in' }),
  accountAgeDays: f.number({ label: 'Account age (days)', min: 0, integer: true }),
});

const rand = rng(5);
const pick = pickWith(rand);
const NAMES = ['ada', 'grace', 'linus', 'radia', 'ken', 'barbara', 'alan', 'margaret', 'edsger', 'frances', 'dennis', 'hedy', 'john', 'katherine', 'tim', 'guido', 'yukihiro', 'bjarne', 'anders', 'brendan'];
const USERS = NAMES.flatMap((n, i) => [0, 1].map((k) => ({
  id: `u_${i}_${k}`,
  email: `${n}${k || ''}@${k ? 'calmail.com' : 'acme.dev'}`,
  plan: pick(['free', 'free', 'pro', 'team', 'enterprise'] as const),
  country: pick(['US', 'GB', 'DE', 'FR', 'JP', 'BR'] as const),
  appVersion: Math.round((4 + rand() * 2.4) * 10) / 10,
  platform: pick(['web', 'ios', 'android'] as const),
  betaOptIn: rand() > 0.6,
  accountAgeDays: Math.floor(rand() * 900),
})));

/** Stable 0–99 bucket per user so a rollout percentage is sticky. */
const bucket = (id: string) => [...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % 100;


export function Demo() {
  const store = useExampleStore(fields, {
    kind: 'group',
    combinator: 'or',
    children: [
      { kind: 'rule', field: 'email', operator: 'endsWith', value: '@acme.dev' },
      {
        kind: 'group',
        combinator: 'and',
        children: [
          { kind: 'rule', field: 'plan', operator: 'in', value: ['team', 'enterprise'] },
          { kind: 'rule', field: 'appVersion', operator: 'gte', value: 5.2 },
        ],
      },
      { kind: 'rule', field: 'betaOptIn', operator: 'eq', value: true },
    ],
  });
  const query = useLiveQuery(store);
  const [rollout, setRollout] = useState(50);
  const [enabled, setEnabled] = useState(true);
  const { states, logic } = useMemo(() => {
    const inSegment = compile(fields, query);
    const states = USERS.map((u) => {
      const seg = inSegment(u);
      return { u, seg, on: enabled && seg && bucket(u.id) < rollout };
    });
    return { states, logic: encode(jsonlogic, query as Query, fields) };
  }, [query, rollout, enabled]);
  const onCount = states.filter((s) => s.on).length;
  const segCount = states.filter((s) => s.seg).length;
  const flag = { key: 'new-checkout', enabled, rollout, segment: logic };

  return (
    <>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-4 rounded-xl border p-3">
            <code className="rounded-md bg-muted px-2 py-1 font-mono text-xs">new-checkout</code>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={enabled} onCheckedChange={setEnabled} /> Enabled
            </label>
            <div className="flex min-w-56 flex-1 items-center gap-3 text-sm">
              <span className="text-muted-foreground">Rollout</span>
              <Slider value={rollout} onValueChange={(v) => setRollout(Array.isArray(v) ? v[0]! : (v as number))} min={0} max={100} className="flex-1" aria-label="Rollout percentage" />
              <span className="w-10 text-end tabular-nums">{rollout}%</span>
            </div>
          </div>
          <CossQueryBuilder store={store} />
          <CodeBlock label="Flag config (JsonLogic segment)" code={JSON.stringify(flag, null, 2)} />
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-medium">Sample users</span>
            <Badge variant="success">{onCount} on</Badge>
            <Badge variant="outline">{segCount} in segment</Badge>
          </div>
          <ScrollBox className="rounded-xl border" viewportClassName="max-h-[560px]">
          <div className="grid grid-cols-1 gap-1 p-1.5">
            {states.map(({ u, seg, on }) => (
              <div key={u.id} className={cn('flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs', on ? 'bg-success/10' : seg ? 'bg-muted/50' : '')}>
                <span className={cn('size-2 rounded-full', on ? 'bg-success' : seg ? 'bg-warning' : 'bg-muted-foreground/30')} />
                <span className="w-40 truncate font-mono">{u.email}</span>
                <span className="text-muted-foreground">
                  {u.plan} · {u.platform} · v{u.appVersion}
                  {u.betaOptIn && ' · beta'}
                </span>
                <span className="ms-auto text-muted-foreground tabular-nums">#{bucket(u.id)}</span>
              </div>
            ))}
          </div>
          </ScrollBox>
          <p className="text-muted-foreground text-xs">Green: flag on. Amber: in segment but outside the rollout bucket. #n is the user's sticky 0–99 bucket.</p>
        </div>
      </div>
    </>
  );
}
