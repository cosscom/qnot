// One focused live demo per parity feature, opened from the parity table's "Try it" links.
import {
  builtinFunctions,
  compile,
  compileCases,
  createQueryStore,
  decode,
  defineFields,
  defineOperator,
  encode,
  encodeCases,
  f,
  fieldOptions,
  fieldsFromJSON,
  fieldsToJSON,
  sanitizeQuery,
  validateQuery,
  type Codec,
  type Query,
  type QueryOf,
  type SanitizeOptions,
} from '@trawlnet/core';
import { elasticsearch } from '@trawlnet/core/formats/elasticsearch';
import { jsonlogic } from '@trawlnet/core/formats/jsonlogic';
import { mongo } from '@trawlnet/core/formats/mongo';
import { raqb } from '@trawlnet/core/formats/raqb';
import { spel } from '@trawlnet/core/formats/spel';
import { sql, sqlFormat } from '@trawlnet/core/formats/sql';
import { text, textFormat } from '@trawlnet/core/formats/text';
import { DownloadIcon } from 'lucide-react';
import { useMemo, useState, type ComponentType, type ReactNode } from 'react';
import { CodeBlock } from '@/components/code-block';
import { AlertDialog, AlertDialogClose, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogPopup, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { CossQueryBuilder } from '@/coss/QueryBuilder';
import { Mini, SettingNumber, SettingSwitch, useLive } from './mini';

export interface Demo {
  id: string;
  title: string;
  blurb: ReactNode;
  Component: ComponentType;
}

// --- shared sample data -----------------------------------------------------------------------------

const PEOPLE = [
  { name: 'Ada', age: 36, plan: 'pro', active: true, signedUp: '2024-03-01', tags: ['vip', 'beta'], nickname: '' },
  { name: 'Grace', age: 85, plan: 'team', active: false, signedUp: '2019-11-20', tags: [], nickname: 'Amazing Grace' },
  { name: 'Linus', age: 54, plan: 'free', active: true, signedUp: '2025-06-12', tags: ['beta'], nickname: '' },
  { name: 'Radia', age: null, plan: 'enterprise', active: true, signedUp: '2022-01-30', tags: ['vip', 'partner'], nickname: 'Mother of the Internet' },
  { name: 'Ken', age: 82, plan: 'pro', active: false, signedUp: '2018-07-04', tags: ['churn-risk'], nickname: '' },
];
const byName = (r: { name: string }) => r.name;

const basicFields = defineFields({
  name: f.text(),
  age: f.number({ min: 0, integer: true }),
  plan: f.enum(['free', 'pro', 'team', 'enterprise']),
  active: f.boolean(),
  signedUp: f.date({ label: 'Signed up' }),
});
const and = <const T,>(...children: T[]) => ({ kind: 'group' as const, combinator: 'and' as const, children });

// --- demos ------------------------------------------------------------------------------------------

function Basics() {
  return (
    <Mini
      fields={basicFields}
      initial={and(
        { kind: 'rule', field: 'name', operator: 'contains', value: 'a' },
        { kind: 'rule', field: 'age', operator: 'between', value: [30, 60] },
        { kind: 'rule', field: 'plan', operator: 'in', value: ['pro', 'free'] },
      )}
      rows={PEOPLE}
      rowLabel={byName}
      outputs={['text', 'sql', 'json']}
    />
  );
}

const widgetFields = defineFields({
  opensAt: f.time({ label: 'Office opens' }),
  lastSeen: f.datetime({ label: 'Last seen' }),
  bio: f.text({ widget: 'textarea', required: false, placeholder: 'Free text…' }),
  satisfaction: f.number({ widget: 'slider', min: 0, max: 10 }),
  budget: f.number({ prefix: '$', suffix: 'USD', min: 0, step: 50 }),
});
function Widgets() {
  return (
    <Mini
      fields={widgetFields}
      initial={and(
        { kind: 'rule', field: 'opensAt', operator: 'lt', value: '09:30' },
        { kind: 'rule', field: 'lastSeen', operator: 'gte', value: '2026-10-01T09:00' },
        { kind: 'rule', field: 'satisfaction', operator: 'gte', value: 7 },
        { kind: 'rule', field: 'budget', operator: 'between', value: [500, 2000] },
        { kind: 'rule', field: 'bio', operator: 'contains', value: 'sailing' },
      )}
      outputs={['text', 'sql', 'json']}
    />
  );
}

const multiFields = defineFields({ name: f.text(), tags: f.multiEnum(['vip', 'beta', 'partner', 'churn-risk']), nickname: f.text({ required: false }) });
function Multi() {
  return (
    <Mini
      fields={multiFields}
      initial={and(
        { kind: 'rule', field: 'tags', operator: 'hasAny', value: ['vip', 'beta'] },
        { kind: 'rule', field: 'tags', operator: 'hasNone', value: ['churn-risk'] },
        { kind: 'rule', field: 'nickname', operator: 'isEmpty' },
      )}
      rows={PEOPLE}
      rowLabel={(r) => `${r.name} [${r.tags.join(', ')}]`}
      outputs={['text', 'sql', 'mongo']}
    />
  );
}

const treeFields = defineFields({
  region: f.enum(
    [
      { value: 'emea', label: 'EMEA', children: [{ value: 'de', label: 'Germany' }, { value: 'fr', label: 'France' }, { value: 'gb', label: 'United Kingdom' }] },
      { value: 'amer', label: 'Americas', children: [{ value: 'us', label: 'United States' }, { value: 'br', label: 'Brazil' }] },
      { value: 'apac', label: 'APAC', children: [{ value: 'jp', label: 'Japan' }] },
    ],
    { leafOnly: true },
  ),
});
function Tree() {
  return (
    <Mini
      fields={treeFields}
      initial={and({ kind: 'rule', field: 'region', operator: 'in', value: ['de', 'gb'] }, { kind: 'rule', field: 'region', operator: 'neq', value: 'us' })}
      outputs={['text', 'json']}
    />
  );
}

const structFields = defineFields({
  name: f.text(),
  address: f.struct({ city: f.text(), zip: f.text({ column: 'postal_code', label: 'ZIP' }), country: f.enum(['DE', 'GB', 'US']) }, { label: 'Address' }),
  company: f.struct({ name: f.text({ column: 'company_name' }), size: f.number({ min: 1 }) }, { label: 'Company' }),
});
function Struct() {
  return (
    <Mini
      fields={structFields}
      initial={and(
        { kind: 'rule', field: 'address.city', operator: 'eq', value: 'Berlin' },
        { kind: 'rule', field: 'address.zip', operator: 'startsWith', value: '10' },
        { kind: 'rule', field: 'company.size', operator: 'gte', value: 50 },
      )}
      rows={[
        { name: 'Ada', address: { city: 'Berlin', zip: '10115', country: 'DE' }, company: { name: 'Acme', size: 120 } },
        { name: 'Grace', address: { city: 'Berlin', zip: '20095', country: 'DE' }, company: { name: 'Hooli', size: 900 } },
        { name: 'Linus', address: { city: 'London', zip: 'N1', country: 'GB' }, company: { name: 'Initech', size: 40 } },
      ]}
      rowLabel={(r) => `${r.name} · ${r.address.city} ${r.address.zip}`}
      outputs={['sql', 'mongo', 'text']}
    />
  );
}

const arrayFields = defineFields({
  customer: f.text(),
  orders: f.array({ product: f.enum(['Mast', 'Sail', 'Keel']), qty: f.number({ min: 1 }), status: f.enum(['paid', 'refunded']) }, { label: 'Orders' }),
});
const CUSTOMERS = [
  { customer: 'Ada', orders: [{ product: 'Mast', qty: 2, status: 'paid' }, { product: 'Sail', qty: 1, status: 'refunded' }] },
  { customer: 'Grace', orders: [] },
  { customer: 'Linus', orders: [{ product: 'Keel', qty: 5, status: 'paid' }, { product: 'Mast', qty: 1, status: 'paid' }, { product: 'Sail', qty: 1, status: 'paid' }] },
  { customer: 'Radia', orders: [{ product: 'Sail', qty: 3, status: 'refunded' }] },
];
function ArrayGroups() {
  return (
    <Mini
      fields={arrayFields}
      initial={and({ kind: 'group', combinator: 'and', of: { field: 'orders', match: { count: 'gte', value: 2 } }, children: [{ kind: 'rule', field: 'status', operator: 'eq', value: 'paid' }] })}
      rows={CUSTOMERS}
      rowLabel={(r) => `${r.customer} (${r.orders.filter((o: { status: string }) => o.status === 'paid').length}/${r.orders.length} paid)`}
      outputs={['text', 'mongo', 'sql', 'json']}
    />
  );
}

const COMPANIES = ['Acme', 'Globex', 'Initech', 'Umbrella', 'Hooli', 'Soylent', 'Stark Industries', 'Wayne Enterprises', 'Pied Piper', 'Wonka'];
const asyncFields = defineFields({
  company: f.enum<string>([], {
    allowCustom: true,
    search: async (q, signal) => {
      await new Promise<void>((resolve, reject) => {
        const t = setTimeout(resolve, 300);
        signal?.addEventListener('abort', () => (clearTimeout(t), reject(new DOMException('aborted', 'AbortError'))));
      });
      return COMPANIES.filter((c) => c.toLowerCase().includes(q.toLowerCase())).map((c) => ({ value: c, label: c }));
    },
  }),
});
function Async() {
  return <Mini fields={asyncFields} initial={and({ kind: 'rule', field: 'company', operator: 'in', value: ['Hooli'] }, { kind: 'rule', field: 'company', operator: 'eq', value: null })} outputs={['text', 'json']} />;
}

const optionFields = defineFields({
  name: f.text({ description: 'Shown as a tooltip in pickers (RAQB label2/tooltip)', excludeOperators: ['contains', 'notContains'] }),
  plan: f.enum(['free', 'pro', 'team'], { defaultOperator: 'in', defaultValue: 'pro' }),
  internalId: f.text({ hidden: true }),
  score: f.number({ comparable: false }),
  minScore: f.number({ label: 'Minimum score' }),
});
function FieldOptions() {
  return (
    <Mini
      fields={optionFields}
      initial={and({ kind: 'rule', field: 'name', operator: 'eq', value: 'Ada' })}
      outputs={['json']}
      extra={{
        label: 'Field picker',
        render: () => (
          <CodeBlock
            code={JSON.stringify(
              fieldOptions(optionFields).map((o) => ({ value: o.value, label: o.label, description: o.description })),
              null,
              2,
            )}
            label="fieldOptions(fields): internalId is hidden; name has no contains operators; score can't be a comparison target"
          />
        ),
      }}
    />
  );
}

const validationFields = defineFields(
  {
    age: f.number({ min: 0, max: 120, integer: true }),
    email: f.text({ pattern: /^[^@\s]+@[^@\s]+$/ }),
    seats: f.number({ validate: (n) => (n % 5 ? 'Seats come in packs of 5' : undefined) }),
  },
  { messages: { required: 'Please fill this in' } },
);
function Validation() {
  return (
    <Mini
      fields={validationFields}
      initial={and(
        { kind: 'rule', field: 'age', operator: 'eq', value: 130.5 },
        { kind: 'rule', field: 'email', operator: 'eq', value: 'not-an-email' },
        { kind: 'rule', field: 'seats', operator: 'eq', value: 12 },
        { kind: 'rule', field: 'age', operator: 'gt', value: null },
      )}
      outputs={['json']}
      extra={{
        label: 'Issues',
        render: (q) => <CodeBlock code={JSON.stringify(validateQuery(validationFields, q).map(({ path, code, message }) => ({ path, code, message })), null, 2)} />,
      }}
    />
  );
}

const near = defineOperator({
  id: 'near',
  arity: 'one',
  label: 'is within (km)',
  evaluate: (v, km) => typeof v === 'number' && typeof km === 'number' && v <= km,
  formats: { sql: ({ field, value }) => `${String(field)} <= ${String(value)}`, text: ({ field, value }) => `${String(field)} is within ${String(value)} km` },
});
const customOpFields = defineFields({ city: f.text(), distanceKm: f.number({ label: 'Distance from HQ', extraOperators: ['near'] }) }, { operators: [near] });
function CustomOp() {
  return (
    <Mini
      fields={customOpFields}
      initial={and(
        { kind: 'rule', field: 'distanceKm', operator: 'near', value: 500 },
        { kind: 'group', combinator: 'and', not: true, children: [{ kind: 'rule', field: 'city', operator: 'eq', value: 'Paris' }] },
      )}
      rows={[
        { city: 'Berlin', distanceKm: 0 },
        { city: 'Paris', distanceKm: 878 },
        { city: 'Hamburg', distanceKm: 255 },
        { city: 'Munich', distanceKm: 504 },
      ]}
      rowLabel={(r) => `${r.city} (${r.distanceKm} km)`}
      outputs={['sql', 'text', 'json']}
    />
  );
}

const fnFields = defineFields(
  { name: f.text(), age: f.number(), minAge: f.number({ label: 'Minimum age' }), signedUp: f.date({ label: 'Signed up' }) },
  { functions: builtinFunctions },
);
function Functions() {
  return (
    <Mini
      fields={fnFields}
      initial={and(
        { kind: 'rule', field: { fn: 'lower', args: { text: { ref: 'name' } } }, operator: 'startsWith', value: 'a' },
        { kind: 'rule', field: 'signedUp', operator: 'gt', call: { fn: 'relativeDate', args: { amount: { value: 3 }, unit: { value: 'year' }, direction: { value: 'ago' } } } },
        { kind: 'rule', field: 'age', operator: 'gt', ref: 'minAge' },
      )}
      rows={[
        { name: 'Ada', age: 36, minAge: 18, signedUp: '2024-03-01' },
        { name: 'alan', age: 17, minAge: 18, signedUp: '2025-01-10' },
        { name: 'Grace', age: 85, minAge: 21, signedUp: '2019-11-20' },
      ]}
      rowLabel={(r) => `${r.name}, ${r.age}`}
      outputs={['sql', 'text', 'json']}
    />
  );
}

const sampleTwoLevel = and(
  { kind: 'rule' as const, field: 'name' as const, operator: 'contains' as const, value: 'a' },
  {
    kind: 'group' as const,
    combinator: 'or' as const,
    children: [
      { kind: 'rule' as const, field: 'plan' as const, operator: 'eq' as const, value: 'pro' as const },
      { kind: 'rule' as const, field: 'age' as const, operator: 'gte' as const, value: 21 },
    ],
  },
) satisfies QueryOf<typeof basicFields>;

function Dnd() {
  return (
    <Mini
      fields={basicFields}
      initial={sampleTwoLevel}
      outputs={['text']}
      controls={(store) => (
        <>
          <SettingSwitch store={store} setting="canReorder" label="Reorder" hint="canReorder" defaultValue />
          <SettingSwitch store={store} setting="canRegroup" label="Regroup" hint="canRegroup" defaultValue />
        </>
      )}
    />
  );
}

function Locks() {
  const initial: QueryOf<typeof basicFields> = and(
    { kind: 'rule', field: 'name', operator: 'contains', value: 'a' },
    { kind: 'group', combinator: 'or', locked: true, children: [{ kind: 'rule', field: 'plan', operator: 'eq', value: 'pro' }, { kind: 'rule', field: 'active', operator: 'eq', value: true }] },
  );
  return (
    <Mini
      fields={basicFields}
      initial={initial}
      builder={{ showLock: true }}
      outputs={['json']}
      controls={(store) => <SettingSwitch store={store} setting="canDeleteLocked" label="Allow deleting locked" hint="canDeleteLocked" defaultValue={false} />}
    />
  );
}

function ImmutableToggle({ store, part, label }: { store: Parameters<typeof SettingSwitch>[0]['store']; part: 'groups' | 'fields' | 'operators' | 'values'; label: string }) {
  const [on, setOn] = useState(false);
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-1.5 text-sm" data-demo-setting={`immutable.${part}`}>
      <Switch
        checked={on}
        onCheckedChange={(v) => {
          setOn(v);
          store.setSettings({ immutable: { ...store.settings.immutable, [part]: v } });
        }}
      />
      {label}
    </label>
  );
}

function ReadOnly() {
  return (
    <Mini
      fields={basicFields}
      initial={sampleTwoLevel}
      outputs={['text']}
      controls={(store) => (
        <>
          <SettingSwitch store={store} setting="readOnly" label="Read-only" hint="readOnly" defaultValue={false} />
          <ImmutableToggle store={store} part="groups" label="Structure" />
          <ImmutableToggle store={store} part="fields" label="Fields" />
          <ImmutableToggle store={store} part="operators" label="Operators" />
          <ImmutableToggle store={store} part="values" label="Values" />
        </>
      )}
    />
  );
}

function Limits() {
  return (
    <Mini
      fields={basicFields}
      initial={sampleTwoLevel}
      settings={{ maxRules: 4, maxDepth: 1 }}
      outputs={['text']}
      controls={(store) => (
        <>
          <SettingNumber store={store} setting="maxRules" label="Max rules" />
          <SettingNumber store={store} setting="maxDepth" label="Max depth" />
        </>
      )}
    />
  );
}

function EmptyGroups() {
  return (
    <Mini
      fields={basicFields}
      initial={sampleTwoLevel}
      settings={{ canLeaveEmptyGroup: false }}
      outputs={['json']}
      controls={(store) => (
        <>
          <SettingSwitch store={store} setting="canLeaveEmptyGroup" label="Keep emptied groups" hint="canLeaveEmptyGroup" defaultValue={false} />
          <SettingSwitch store={store} setting="emptyNewGroups" label="New groups start empty" hint="!shouldCreateEmptyGroup" defaultValue={false} />
        </>
      )}
    />
  );
}

function ChangeBehaviour() {
  const [opts, setOpts] = useState({ operatorOnFieldChange: false, valueOnFieldChange: false, valueOnOperatorChange: false });
  return (
    <Mini
      fields={defineFields({ minAge: f.number({ label: 'Minimum age' }), maxAge: f.number({ label: 'Maximum age' }), name: f.text() })}
      initial={and({ kind: 'rule', field: 'minAge', operator: 'gte', value: 21 })}
      outputs={['json']}
      controls={(store) =>
        (['operatorOnFieldChange', 'valueOnFieldChange', 'valueOnOperatorChange'] as const).map((k) => (
          <label key={k} className="flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-1.5 text-sm">
            <Switch
              checked={opts[k]}
              onCheckedChange={(v) => {
                setOpts((o) => ({ ...o, [k]: v }));
                store.setSettings({ [k]: v ? 'reset' : 'keep' });
              }}
            />
            Reset <code className="font-mono text-xs">{k}</code>
          </label>
        ))
      }
    />
  );
}

function Sanitize() {
  const dirty: Query = {
    kind: 'group',
    combinator: 'and',
    children: [
      { kind: 'rule', field: 'name', operator: 'eq', value: '' },
      { kind: 'rule', field: 'plan', operator: 'in', value: ['pro', 'ghost'] },
      { kind: 'rule', field: 'deleted', operator: 'eq', value: 'x' },
      { kind: 'group', combinator: 'or', children: [{ kind: 'rule', field: 'age', operator: 'gt', value: null }] },
      { kind: 'rule', field: 'age', operator: 'gte', value: 18 },
    ],
  };
  const [opts, setOpts] = useState<Required<Pick<SanitizeOptions, 'removeIncompleteRules' | 'removeEmptyGroups' | 'removeInvalidListValues'>> & { removeInvalidRules: boolean }>({
    removeIncompleteRules: true,
    removeEmptyGroups: true,
    removeInvalidListValues: true,
    removeInvalidRules: false,
  });
  const clean = useMemo(() => sanitizeQuery(basicFields, dirty as QueryOf<typeof basicFields>, opts), [opts]);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {(Object.keys(opts) as (keyof typeof opts)[]).map((k) => (
          <label key={k} className="flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-1.5 text-sm">
            <Switch checked={opts[k]} onCheckedChange={(v) => setOpts((o) => ({ ...o, [k]: v }))} />
            <code className="font-mono text-xs">{k}</code>
          </label>
        ))}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <CodeBlock label="Loaded from storage" code={JSON.stringify(dirty, null, 2)} />
        <CodeBlock label="sanitizeQuery(fields, query, options)" code={JSON.stringify(clean, null, 2)} />
      </div>
    </div>
  );
}

const caseFields = defineFields({ plan: f.enum(['free', 'pro', 'team', 'enterprise']), seats: f.number({ min: 1 }), country: f.enum(['US', 'DE', 'JP']) });
function Cases() {
  const [stores] = useState(() => [
    { then: 'enterprise-desk', store: createQueryStore({ fields: caseFields, initial: and({ kind: 'rule', field: 'plan', operator: 'eq', value: 'enterprise' }) }) },
    { then: 'dach-team', store: createQueryStore({ fields: caseFields, initial: and({ kind: 'rule', field: 'country', operator: 'eq', value: 'DE' }, { kind: 'rule', field: 'seats', operator: 'gte', value: 10 }) }) },
  ]);
  const [values, setValues] = useState(stores.map((s) => s.then));
  const [otherwise, setOtherwise] = useState('self-serve');
  const qs = stores.map((s) => useLive(s.store)); // stable list: hooks run in the same order every render
  const cases = { cases: qs.map((when, i) => ({ when, then: values[i]! })), otherwise };
  const route = compileCases(caseFields, cases);
  const rows = [
    { plan: 'enterprise', seats: 400, country: 'US' },
    { plan: 'team', seats: 25, country: 'DE' },
    { plan: 'pro', seats: 3, country: 'DE' },
    { plan: 'free', seats: 1, country: 'JP' },
  ] as const;
  let sqlCase = '';
  try {
    sqlCase = String(encodeCases(sql as Codec<unknown>, cases, caseFields));
  } catch (e) {
    sqlCase = `-- ${(e as Error).message}`;
  }
  return (
    <div className="flex flex-col gap-3">
      {stores.map((s, i) => (
        <div key={i} className="flex flex-col gap-2 rounded-xl border p-3">
          <div className="flex items-center gap-2 text-sm">
            <Badge variant="outline">Case {i + 1}</Badge> then
            <Input size="sm" className="w-48 font-mono" value={values[i]} onChange={(e) => setValues((v) => v.map((x, j) => (j === i ? e.target.value : x)))} />
          </div>
          <CossQueryBuilder store={s.store} combinatorStyle="sentence" compact allowGroups={false} labels={{ sentenceBefore: 'When', sentenceAfter: 'of these match' }} />
        </div>
      ))}
      <div className="flex items-center gap-2 text-sm">
        Otherwise <Input size="sm" className="w-48 font-mono" value={otherwise} onChange={(e) => setOtherwise(e.target.value)} />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="overflow-hidden rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Account</TableHead>
                <TableHead>compileCases → value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r, i) => {
                const m = route(r);
                return (
                  <TableRow key={i}>
                    <TableCell className="text-xs">
                      {r.plan} · {r.seats} seats · {r.country}
                    </TableCell>
                    <TableCell>
                      <Badge variant={m.index === -1 ? 'outline' : 'info'} data-case-result>
                        {String(m.value)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        <CodeBlock wrap label="encodeCases(sql, cases, fields)" code={sqlCase} />
      </div>
    </div>
  );
}

const germanFields = defineFields(
  { alter: f.number({ label: 'Alter', min: 0 }), stadt: f.text({ label: 'Stadt' }) },
  { messages: { required: 'Pflichtfeld', min: 'Zu klein', type: 'Ungültiger Wert' } },
);
const germanText = textFormat({ words: { and: 'UND', or: 'ODER', not: 'NICHT' } });
function I18n() {
  return (
    <Mini
      fields={germanFields}
      initial={and({ kind: 'rule', field: 'alter', operator: 'gte', value: -1 }, { kind: 'rule', field: 'stadt', operator: 'eq', value: '' })}
      builder={{ labels: { addRule: 'Regel', addGroup: 'Gruppe', addArrayGroup: 'Listenbedingung', valueText: 'Wert eingeben', field: 'Feld wählen' } }}
      outputs={['json']}
      extra={{
        label: 'Text (deutsch)',
        render: (q) => (
          <div className="flex flex-col gap-2">
            <CodeBlock wrap code={encode(germanText, q as Query, germanFields)} />
            <CodeBlock code={JSON.stringify(validateQuery(germanFields, q).map(({ path, message }) => ({ path, message })), null, 2)} label="Validierung" />
          </div>
        ),
      }}
    />
  );
}

function Confirm() {
  const [pending, setPending] = useState<{ resolve: (ok: boolean) => void; text: string } | null>(null);
  const answer = (ok: boolean) => {
    pending?.resolve(ok);
    setPending(null);
  };
  return (
    <>
      <Mini
        fields={basicFields}
        initial={sampleTwoLevel}
        settings={{ confirmRemove: (node) => new Promise<boolean>((resolve) => setPending({ resolve, text: encode(text, node.kind === 'group' ? node : and(node), basicFields) })) }}
        outputs={['text']}
      />
      <AlertDialog open={!!pending} onOpenChange={(o) => !o && answer(false)}>
        <AlertDialogPopup>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this?</AlertDialogTitle>
            <AlertDialogDescription>{pending?.text}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose render={<Button variant="ghost" />}>Cancel</AlertDialogClose>
            <Button variant="destructive" onClick={() => answer(true)}>
              Remove
            </Button>
          </AlertDialogFooter>
        </AlertDialogPopup>
      </AlertDialog>
    </>
  );
}

const evenSeats = (n: number) => (n % 2 ? 'Seats must be even' : undefined);
const serialFields = defineFields({
  name: f.text({ pattern: /^[A-Z]/ }),
  seats: f.number({ min: 1, validate: evenSeats }),
  plan: f.enum(['free', 'pro'], { description: 'Billing plan' }),
  address: f.struct({ city: f.text() }, { label: 'Address' }),
});
function Serialize() {
  const json = useMemo(() => fieldsToJSON(serialFields, { fns: { evenSeats } }), []);
  const [restored] = useState(() => fieldsFromJSON(JSON.parse(JSON.stringify(json)), { fns: { evenSeats } }));
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <CodeBlock label="fieldsToJSON(fields, { fns }): send this from your server" code={JSON.stringify(json, null, 2)} />
      <div className="flex flex-col gap-2">
        <div className="font-medium text-sm">A builder over fieldsFromJSON(json, {'{ fns }'})</div>
        <Mini fields={restored} initial={{ kind: 'group', combinator: 'and', children: [{ kind: 'rule', field: 'seats', operator: 'eq', value: 3 }] }} outputs={['json']} />
      </div>
    </div>
  );
}

const FORMAT_CODECS: [string, Codec<unknown>][] = [
  ['SQL (Postgres)', sqlFormat({ dialect: 'postgres' }) as Codec<unknown>],
  ['MongoDB', mongo as Codec<unknown>],
  ['JsonLogic', jsonlogic as Codec<unknown>],
  ['Text', text as Codec<unknown>],
  ['SpEL', spel as Codec<unknown>],
  ['Elasticsearch', elasticsearch as Codec<unknown>],
  ['RAQB tree', raqb as Codec<unknown>],
];
function Formats() {
  const [store] = useState(() => createQueryStore({ fields: basicFields, initial: sampleTwoLevel }));
  const q = useLive(store);
  return (
    <div className="flex flex-col gap-3">
      <CossQueryBuilder store={store} />
      <div className="grid gap-3 md:grid-cols-2">
        {FORMAT_CODECS.map(([label, codec]) => {
          let out: string;
          try {
            const v = encode(codec, q as Query, basicFields);
            out = typeof v === 'string' ? v : JSON.stringify(v, null, 2);
          } catch (e) {
            out = `// ${(e as Error).message}`;
          }
          return <CodeBlock key={label} wrap label={label} code={out} />;
        })}
      </div>
    </div>
  );
}

function SqlImport() {
  const [store] = useState(() => createQueryStore({ fields: basicFields }));
  const [draft, setDraft] = useState("plan IN ('pro', 'team') AND (age >= 21 OR name LIKE 'A%') AND NOT active = FALSE");
  const [error, setError] = useState<string | null>(null);
  const load = () => {
    try {
      store.setQuery(decode(sql as Codec<unknown>, draft, basicFields) as QueryOf<typeof basicFields>);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <div className="flex flex-col gap-3">
      <Textarea className="font-mono text-xs" rows={3} value={draft} onChange={(e) => setDraft(e.target.value)} />
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={load} data-sql-import>
          <DownloadIcon /> Parse WHERE clause
        </Button>
        {error && <span className="text-destructive-foreground text-xs">{error}</span>}
      </div>
      <CossQueryBuilder store={store} />
    </div>
  );
}

function Undo() {
  return <Mini fields={basicFields} initial={sampleTwoLevel} history outputs={['text']} />;
}

function CompileDemo() {
  const rows = useMemo(
    () =>
      Array.from({ length: 100_000 }, (_, i) => ({
        name: ['Ada', 'Grace', 'Linus', 'Radia', 'Ken'][i % 5]!,
        age: 18 + (i % 60),
        plan: (['free', 'pro', 'team', 'enterprise'] as const)[i % 4],
        active: i % 3 !== 0,
        signedUp: `20${10 + (i % 15)}-0${1 + (i % 9)}-15`,
      })),
    [],
  );
  return (
    <Mini
      fields={basicFields}
      initial={sampleTwoLevel}
      outputs={['text']}
      extra={{
        label: '100k rows',
        render: (q) => {
          const t0 = performance.now();
          const pred = compile(basicFields, q);
          const n = rows.filter(pred).length;
          const ms = performance.now() - t0;
          return (
            <p className="text-sm" data-compile-result>
              <Badge variant="info">{n.toLocaleString()}</Badge> of 100,000 rows match. compile() + filter took <strong>{ms.toFixed(1)} ms</strong>. RAQB has no evaluator; you'd export JsonLogic and run json-logic-js.
            </p>
          );
        },
      }}
    />
  );
}

export const DEMOS: Demo[] = [
  { id: 'basics', title: 'Types, operators and conjunctions', blurb: 'text, number, boolean, date, enum; eq/contains/between/in/isNull; AND/OR/NOT.', Component: Basics },
  { id: 'widgets', title: 'Time, datetime and widgets', blurb: 'f.time(), f.datetime(), textarea, slider and prefix/suffix hints.', Component: Widgets },
  { id: 'multi', title: 'Multi-select fields', blurb: 'f.multiEnum with hasAny / hasAll / hasNone / setEq, plus isEmpty.', Component: Multi },
  { id: 'tree', title: 'Tree options', blurb: 'Nested `children` options with leafOnly: parents are headings, not choices.', Component: Tree },
  { id: 'struct', title: 'Struct fields and columns', blurb: 'f.struct flattens to address.city, grouped in pickers; `column` renames exports.', Component: Struct },
  { id: 'array', title: 'Array groups and aggregation', blurb: 'some / all / none / count of a list field’s items match.', Component: ArrayGroups },
  { id: 'async', title: 'Async search', blurb: 'Remote option search as you type (debounced, abortable), allowCustom.', Component: Async },
  { id: 'field-options', title: 'Field options', blurb: 'description, hidden, comparable: false, excludeOperators, defaultOperator/Value.', Component: FieldOptions },
  { id: 'validation', title: 'Validation messages', blurb: 'min/max/integer/pattern/validate with per-node messages and overrides.', Component: Validation },
  { id: 'custom-op', title: 'Custom operators', blurb: 'defineOperator() with evaluate + per-codec formats (proximity-style).', Component: CustomOp },
  { id: 'functions', title: 'Functions and field comparisons', blurb: 'Functions on the left or right (nested), and field-to-field refs.', Component: Functions },
  { id: 'dnd', title: 'Drag and drop', blurb: 'Drag rules and groups; canReorder / canRegroup restrict moves.', Component: Dnd },
  { id: 'locks', title: 'Locks', blurb: 'Lock a rule or group (and its children); canDeleteLocked.', Component: Locks },
  { id: 'readonly', title: 'Read-only and immutability', blurb: 'readOnly, or freeze structure / fields / operators / values separately.', Component: ReadOnly },
  { id: 'limits', title: 'Limits', blurb: 'maxRules and maxDepth (RAQB maxNumberOfRules / maxNesting).', Component: Limits },
  { id: 'empty-groups', title: 'Empty groups', blurb: 'canLeaveEmptyGroup and emptyNewGroups (shouldCreateEmptyGroup).', Component: EmptyGroups },
  { id: 'change', title: 'Change behaviour', blurb: 'Keep or reset operator/value when the field or operator changes.', Component: ChangeBehaviour },
  { id: 'sanitize', title: 'Sanitize on load', blurb: 'removeIncomplete/Invalid rules, empty groups and invalid list values.', Component: Sanitize },
  { id: 'cases', title: 'Switch / cases', blurb: 'Ordered cases with results: compileCases() and SQL CASE WHEN.', Component: Cases },
  { id: 'i18n', title: 'i18n', blurb: 'Message overrides in the schema, UI labels and text-codec words.', Component: I18n },
  { id: 'confirm', title: 'Confirm before removing', blurb: 'confirmRemove setting with a coss AlertDialog (RAQB renderConfirm).', Component: Confirm },
  { id: 'serialize', title: 'Schema as JSON', blurb: 'fieldsToJSON / fieldsFromJSON, functions referenced by name.', Component: Serialize },
  { id: 'formats', title: 'Exports', blurb: 'SQL, MongoDB, JsonLogic, text, SpEL, Elasticsearch and RAQB’s own tree.', Component: Formats },
  { id: 'sql-import', title: 'Import SQL', blurb: 'Parse a WHERE clause back into a query.', Component: SqlImport },
  { id: 'undo', title: 'Undo / redo', blurb: 'Built into the store; consecutive keystrokes merge into one step.', Component: Undo },
  { id: 'compile', title: 'Evaluate in JS', blurb: 'compile() turns a query into a predicate: 100k rows in milliseconds.', Component: CompileDemo },
];

/** Which demo a parity row's RAQB cell maps to. First match wins. */
const ROUTES: [RegExp, string][] = [
  [/^time, datetime/, 'widgets'],
  [/textarea, slider/, 'widgets'],
  [/^multiselect|is_empty|multiselect_contains/, 'multi'],
  [/treeselect/, 'tree'],
  [/!struct|fieldName/, 'struct'],
  [/!group/, 'array'],
  [/async/, 'async'],
  [/label2|hideForSelect|excludeOperators|defaultValue/, 'field-options'],
  [/validateValue|showErrorMessage/, 'validation'],
  [/proximity|reversedOp/, 'custom-op'],
  [/valueSources: field|valueSources: func|fieldSources|funcs config|canCompareFieldWithField/, 'functions'],
  [/drag and drop/, 'dnd'],
  [/lock rules/, 'locks'],
  [/read-only/, 'readonly'],
  [/maxNesting/, 'limits'],
  [/canLeaveEmptyGroup/, 'empty-groups'],
  [/clearValueOnChange/, 'change'],
  [/removeIncomplete/, 'sanitize'],
  [/ternary/, 'cases'],
  [/renderConfirm/, 'confirm'],
  [/compressConfig/, 'serialize'],
  [/^undo/, 'undo'],
  [/compile\(\)/, 'compile'],
  [/import SQL/, 'sql-import'],
  [/^export|RAQB's own tree/, 'formats'],
  [/custom conjunctions/, ''],
  [/./, 'basics'],
];

export const demoFor = (raqbCell: string): string | null => {
  const hit = ROUTES.find(([re]) => re.test(raqbCell));
  return hit && hit[1] ? hit[1] : null;
};

