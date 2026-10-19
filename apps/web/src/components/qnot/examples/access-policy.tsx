// Part of qnot (https://github.com/cosscom/qnot). MIT licensed; installable with shadcn.
'use client';
import { compile, defineFields, f, type RowOf } from '@qnot/core';
import { CircleCheckIcon, CircleXIcon, ShieldCheckIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { NumberField, NumberFieldGroup, NumberFieldInput } from '@/components/ui/number-field';
import { Switch } from '@/components/ui/switch';
import { CossSelect, toItems } from '@/components/qnot/controls';
import { CossQueryBuilder } from '@/components/qnot/query-builder';
import { describeQuery } from '@/components/qnot/describe';
import { cn } from '@/lib/utils';
import { useExampleStore, useLiveQuery } from '@/components/qnot/examples/shared';



const fields = defineFields({
  role: f.enum(['viewer', 'editor', 'admin', 'owner']),
  department: f.enum(['engineering', 'sales', 'finance', 'support']),
  resource: f.enum(['customers', 'invoices', 'deployments', 'payroll']),
  action: f.enum(['read', 'write', 'delete', 'export']),
  mfa: f.boolean({ label: 'MFA verified' }),
  isOwner: f.boolean({ label: 'Owns the resource' }),
  hour: f.number({ label: 'Hour of day (UTC)', min: 0, max: 23, integer: true }),
});

type Row = RowOf<typeof fields>;
/** A request's facts: every field present and non-null. */
type Request = { [K in keyof Row]-?: NonNullable<Row[K]> };


export function Demo() {
  const store = useExampleStore(fields, {
    kind: 'group',
    combinator: 'and',
    children: [
      {
        kind: 'group',
        combinator: 'or',
        children: [
          {
            kind: 'group',
            combinator: 'and',
            children: [
              { kind: 'rule', field: 'role', operator: 'in', value: ['admin', 'owner'] },
              { kind: 'rule', field: 'mfa', operator: 'eq', value: true },
            ],
          },
          {
            kind: 'group',
            combinator: 'and',
            children: [
              { kind: 'rule', field: 'action', operator: 'eq', value: 'read' },
              { kind: 'rule', field: 'department', operator: 'in', value: ['engineering', 'support'] },
              { kind: 'rule', field: 'resource', operator: 'in', value: ['customers', 'deployments'] },
            ],
          },
          {
            kind: 'group',
            combinator: 'and',
            children: [
              { kind: 'rule', field: 'isOwner', operator: 'eq', value: true },
              { kind: 'rule', field: 'action', operator: 'in', value: ['read', 'write'] },
            ],
          },
        ],
      },
      {
        kind: 'group',
        combinator: 'and',
        not: true,
        children: [
          { kind: 'rule', field: 'resource', operator: 'eq', value: 'payroll' },
          { kind: 'rule', field: 'role', operator: 'neq', value: 'owner' },
        ],
      },
      { kind: 'rule', field: 'hour', operator: 'between', value: [6, 22] },
    ],
  });
  const query = useLiveQuery(store);
  const [req, setReq] = useState<Request>({ role: 'editor', department: 'support', resource: 'customers', action: 'read', mfa: false, isOwner: false, hour: 14 });
  const { allowed, statements } = useMemo(() => {
    const allowed = compile(fields, query)(req);
    const statements = query.children.map((s) => ({
      text: describeQuery(fields, s),
      ok: compile(fields, { kind: 'group', combinator: 'and', children: [s] })(req),
    }));
    return { allowed, statements };
  }, [query, req]);

  const set = <K extends keyof Request>(k: K, v: Request[K]) => setReq((r) => ({ ...r, [k]: v }));
  const enumInput = (k: 'role' | 'department' | 'resource' | 'action') => (
    <div className="flex flex-col gap-1.5">
      <Label>{k[0]!.toUpperCase() + k.slice(1)}</Label>
      <CossSelect className="w-full" items={toItems(fields[k].options)} value={req[k]} onChange={(v) => set(k, v as Request[typeof k])} />
    </div>
  );

  return (
    <>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <CossQueryBuilder store={store} />
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 rounded-xl border p-4">
            <div className="font-medium text-sm">Test a request</div>
            <div className="grid grid-cols-2 gap-3">
              {enumInput('role')}
              {enumInput('department')}
              {enumInput('resource')}
              {enumInput('action')}
              <div className="flex flex-col gap-1.5">
                <Label>Hour (UTC)</Label>
                <NumberField value={req.hour} min={0} max={23} onValueChange={(v) => set('hour', v ?? 0)}>
                  <NumberFieldGroup>
                    <NumberFieldInput />
                  </NumberFieldGroup>
                </NumberField>
              </div>
              <div className="flex flex-col justify-end gap-2 pb-1">
                <label className="flex items-center gap-2 text-sm">
                  <Switch checked={req.mfa} onCheckedChange={(v) => set('mfa', v)} /> MFA verified
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Switch checked={req.isOwner} onCheckedChange={(v) => set('isOwner', v)} /> Owns resource
                </label>
              </div>
            </div>
          </div>
          <div className={cn('flex items-center gap-3 rounded-xl border p-4', allowed ? 'border-success/40 bg-success/8' : 'border-destructive/40 bg-destructive/8')} data-decision={allowed ? 'allow' : 'deny'}>
            {allowed ? <CircleCheckIcon className="size-6 text-success-foreground" /> : <CircleXIcon className="size-6 text-destructive-foreground" />}
            <div>
              <div className="font-semibold">{allowed ? 'Allowed' : 'Denied'}</div>
              <div className="text-muted-foreground text-xs">
                {req.role} in {req.department} → {req.action} {req.resource}
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            {statements.map((s, i) => (
              <div key={i} className="flex items-start gap-2 rounded-lg border px-3 py-2 text-xs">
                <Badge variant={s.ok ? 'success' : 'error'} className="mt-0.5 shrink-0">
                  {s.ok ? 'pass' : 'fail'}
                </Badge>
                <span className="leading-relaxed">{s.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
