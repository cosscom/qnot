import { createQueryStore, encode, type Query } from '@trawlnet/core';
import { sqlFormat } from '@trawlnet/core/formats/sql';
import {
  ArrowDownUpIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CopyIcon,
  EllipsisIcon,
  InfoIcon,
  ListIcon,
  PencilIcon,
  PlusIcon,
  RouteIcon,
  SettingsIcon,
  SplitIcon,
  Trash2Icon,
  TrendingUpIcon,
  UserCheckIcon,
  ZapIcon,
} from 'lucide-react';
import { useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import { CodeBlock } from '@/components/code-block';
import { Tip } from '@/components/tip';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Menu, MenuItem, MenuPopup, MenuSeparator, MenuTrigger } from '@/components/ui/menu';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTab } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { CossSelect } from '@/coss/controls';
import { CossQueryBuilder } from '@/coss/QueryBuilder';
import { cn } from '@/lib/utils';
import {
  EVENTS,
  SAMPLE_RESPONSES,
  formFields,
  initialFallback,
  initialRoutes,
  makeRoute,
  routeFor,
  routeId,
  type Route,
  type RouteAction,
} from './data';
import { PreviewSheet } from './Preview';

const ACTION_TYPES = [
  { value: 'event', label: 'Event' },
  { value: 'page', label: 'Custom page' },
  { value: 'url', label: 'External redirect URL' },
];

function IconBox({ children }: { children: ReactNode }) {
  return <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border bg-background text-muted-foreground shadow-xs/5 [&_svg]:size-4">{children}</span>;
}

function Section({ icon, title, end, children }: { icon: ReactNode; title?: ReactNode; end?: ReactNode; children?: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border bg-background p-3 shadow-xs/5">
      {title !== undefined && (
        <div className="flex items-center gap-2.5 text-sm">
          <IconBox>{icon}</IconBox>
          <div className="font-medium">{title}</div>
          {end && <div className="ms-auto">{end}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

const Connector = () => <div aria-hidden className="ms-[27px] h-4 w-px bg-border" />;

export function ActionEditor({ action, onChange }: { action: RouteAction; onChange: (a: RouteAction) => void }) {
  return (
    <div className="grid gap-2 rounded-xl bg-muted/60 p-2 sm:grid-cols-2 dark:bg-muted/30">
      <CossSelect className="w-full" items={ACTION_TYPES} value={action.type} onChange={(type) => onChange({ ...action, type: type as RouteAction['type'] })} />
      {action.type === 'event' && <CossSelect className="w-full" items={EVENTS} value={action.eventId} placeholder="Select an Event" onChange={(eventId) => onChange({ ...action, eventId })} />}
      {action.type === 'page' && <Textarea className="sm:col-span-1" rows={2} placeholder="Content" value={action.content} onChange={(e) => onChange({ ...action, content: e.target.value })} />}
      {action.type === 'url' && <Input size="sm" placeholder="https://" value={action.url} onChange={(e) => onChange({ ...action, url: e.target.value })} />}
    </div>
  );
}

export const describeAction = (a: RouteAction) =>
  a.type === 'event' ? `Book “${EVENTS.find((e) => e.value === a.eventId)?.label ?? 'no event selected'}”` : a.type === 'page' ? `Show a custom page` : `Redirect to ${a.url || '(no URL)'}`;

function RouteTitle({ name, onRename }: { name: string; onRename: (name: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  if (editing) {
    const commit = () => {
      onRename(draft.trim() || name);
      setEditing(false);
    };
    return (
      <Input
        size="sm"
        autoFocus
        className="w-56"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') setEditing(false);
        }}
      />
    );
  }
  return (
    <button
      type="button"
      className="group/title flex items-center gap-2 rounded-md px-1 font-medium"
      onClick={() => {
        setDraft(name);
        setEditing(true);
      }}
    >
      {name}
      <PencilIcon className="size-3.5 text-muted-foreground/70 group-hover/title:text-foreground" />
    </button>
  );
}

function RouteCard(props: {
  route: Route;
  index: number;
  count: number;
  onChange: (r: Route) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onMove: (delta: -1 | 1) => void;
}) {
  const { route, index, count, onChange, onDuplicate, onDelete, onMove } = props;
  const rules = useQueryCount(route);
  return (
    <div className="rounded-2xl border bg-muted/50 p-2 dark:bg-muted/20" data-route={route.id}>
      <div className="flex items-center gap-1 px-2 py-1.5">
        <Tip label={route.collapsed ? 'Expand' : 'Collapse'}>
          <Button size="icon-sm" variant="ghost" aria-label="Toggle route" onClick={() => onChange({ ...route, collapsed: !route.collapsed })}>
            {route.collapsed ? <ChevronDownIcon /> : <ChevronUpIcon />}
          </Button>
        </Tip>
        <RouteTitle name={route.name} onRename={(name) => onChange({ ...route, name })} />
        {route.collapsed && (
          <span className="ms-2 truncate text-muted-foreground text-xs">
            {rules} {rules === 1 ? 'rule' : 'rules'} · {describeAction(route.action)}
          </span>
        )}
        <Menu>
          <MenuTrigger render={<Button size="icon-sm" variant="ghost" className="ms-auto" aria-label="Route actions" />}>
            <EllipsisIcon />
          </MenuTrigger>
          <MenuPopup align="end">
            <MenuItem onClick={onDuplicate}>
              <CopyIcon /> Duplicate
            </MenuItem>
            <MenuItem disabled={index === 0} onClick={() => onMove(-1)}>
              <ChevronUpIcon /> Move up
            </MenuItem>
            <MenuItem disabled={index === count - 1} onClick={() => onMove(1)}>
              <ChevronDownIcon /> Move down
            </MenuItem>
            <MenuSeparator />
            <MenuItem variant="destructive" onClick={onDelete}>
              <Trash2Icon /> Delete route
            </MenuItem>
          </MenuPopup>
        </Menu>
      </div>
      {!route.collapsed && (
        <div className="flex flex-col">
          <Section icon={null}>
            <CossQueryBuilder
              store={route.store}
              combinatorStyle="sentence"
              compact
              allowGroups={false}
              sentenceIcon={
                <IconBox>
                  <ZapIcon />
                </IconBox>
              }
              labels={{ addRule: 'Add rule', field: 'Select a question', value: 'Select a response', valueText: 'Type a response' }}
            />
          </Section>
          <Connector />
          <Section icon={<ArrowRightIcon />} title="Send to">
            <ActionEditor action={route.action} onChange={(action) => onChange({ ...route, action })} />
          </Section>
          <Connector />
          <Section
            icon={<UserCheckIcon />}
            title={
              <span className="flex items-center gap-1.5">
                Assign to a team member based on their attributes
                <Tip label="Only team members whose attributes match these rules are offered as hosts for the booking.">
                  <InfoIcon className="size-3.5 text-muted-foreground" />
                </Tip>
              </span>
            }
            end={<Switch checked={route.assign.enabled} onCheckedChange={(enabled) => onChange({ ...route, assign: { ...route.assign, enabled } })} aria-label="Assign by attributes" />}
          >
            {route.assign.enabled && (
              <CossQueryBuilder
                store={route.assign.store}
                combinatorStyle="sentence"
                compact
                allowGroups={false}
                labels={{ addRule: 'Add attribute rule', field: 'Select an attribute', value: 'Select a value', sentenceBefore: 'Match members where', sentenceAfter: 'of these are true' }}
              />
            )}
          </Section>
        </div>
      )}
    </div>
  );
}

const countRules = (g: Query): number => g.children.reduce((n, c) => n + (c.kind === 'rule' ? 1 : countRules(c)), 0);

/** Live rule count for a route's collapsed summary. */
function useQueryCount(route: Route) {
  return useSyncExternalStore(route.store.subscribe as (fn: () => void) => () => void, () => countRules(route.store.getQuery() as Query));
}

const postgres = sqlFormat({ dialect: 'postgres', params: 'numbered' });

function ExportPanel({ routes, fallback }: { routes: Route[]; fallback: RouteAction }) {
  const [format, setFormat] = useState<'json' | 'sql'>('json');
  // Re-render on any route edit.
  const tick = useRouteTicks(routes);
  const code = useMemo(() => {
    if (format === 'json') {
      const data = {
        routes: routes.map((r) => ({
          name: r.name,
          query: r.store.getQuery(),
          action: r.action,
          ...(r.assign.enabled && { assignTo: r.assign.store.getQuery() }),
        })),
        fallback,
      };
      return JSON.stringify(data, null, 2);
    }
    return routes
      .map((r) => {
        const { sql, params } = encode(postgres, r.store.getQuery() as Query, formFields);
        return `-- ${r.name}\nSELECT * FROM responses WHERE ${sql};\n-- params: ${JSON.stringify(params)}`;
      })
      .join('\n\n');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routes, fallback, format, tick]);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className="font-medium text-sm">Routing export</span>
        <Tabs value={format} onValueChange={(v) => setFormat(v as 'json' | 'sql')} className="ms-auto">
          <TabsList>
            <TabsTab value="json">JSON</TabsTab>
            <TabsTab value="sql">SQL</TabsTab>
          </TabsList>
        </Tabs>
      </div>
      <CodeBlock code={code} />
    </div>
  );
}

/** Re-render whenever any route's rules change; returns a counter to key memos on. */
export function useRouteTicks(routes: Route[]) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const bump = () => setTick((t) => t + 1);
    const offs = routes.flatMap((r) => [r.store.subscribe(bump), r.assign.store.subscribe(bump)]);
    return () => offs.forEach((off) => off());
  }, [routes]);
  return tick;
}

function FormTab() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-2">
      {Object.entries(formFields).map(([name, def], i) => (
        <div key={name} className="flex items-center gap-3 rounded-xl border bg-background px-4 py-3">
          <span className="w-5 text-muted-foreground text-xs tabular-nums">{i + 1}</span>
          <div className="flex flex-col">
            <span className="font-medium text-sm">{def.label}</span>
            {def.options && <span className="text-muted-foreground text-xs">{def.options.map((o) => o.label).join(' · ')}</span>}
          </div>
          <Badge variant="outline" className="ms-auto">
            {String(def.meta?.type ?? def.kind)}
          </Badge>
          {def.required && <Badge variant="secondary">Required</Badge>}
        </div>
      ))}
    </div>
  );
}

function ReportsTab({ routes }: { routes: Route[] }) {
  useRouteTicks(routes);
  return (
    <div className="mx-auto max-w-4xl overflow-hidden rounded-xl border bg-background">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Respondent</TableHead>
            <TableHead>Visa</TableHead>
            <TableHead>Company size</TableHead>
            <TableHead>Urgency</TableHead>
            <TableHead>Routed to</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {SAMPLE_RESPONSES.map((r) => {
            const route = routeFor(routes, r);
            return (
              <TableRow key={r.email}>
                <TableCell>
                  <div className="font-medium">{r.fullName}</div>
                  <div className="text-muted-foreground text-xs">{r.email}</div>
                </TableCell>
                <TableCell>{formFields.visaType.options?.find((o) => o.value === r.visaType)?.label}</TableCell>
                <TableCell className="tabular-nums">{r.companySize}</TableCell>
                <TableCell>{formFields.urgency.options?.find((o) => o.value === r.urgency)?.label}</TableCell>
                <TableCell>{route ? <Badge variant="info">{route.name}</Badge> : <Badge variant="outline">Fallback</Badge>}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

export function RoutingFormsApp() {
  const [routes, setRoutes] = useState(initialRoutes);
  const [fallback, setFallback] = useState(initialFallback);
  const [tab, setTab] = useState<'form' | 'routing' | 'reports'>('routing');
  const [preview, setPreview] = useState(false);
  const [saved, setSaved] = useState(false);

  const update = (id: string, next: Route) => setRoutes((rs) => rs.map((r) => (r.id === id ? next : r)));
  const move = (index: number, delta: -1 | 1) =>
    setRoutes((rs) => {
      const next = rs.slice();
      const [r] = next.splice(index, 1);
      next.splice(index + delta, 0, r!);
      return next;
    });
  const duplicate = (index: number) =>
    setRoutes((rs) => {
      const src = rs[index]!;
      const copy: Route = {
        ...src,
        id: routeId(),
        name: `${src.name} (copy)`,
        store: createQueryStore({ fields: formFields, initial: src.store.getQuery() }),
        assign: { enabled: src.assign.enabled, store: createQueryStore({ fields: src.assign.store.fields, initial: src.assign.store.getQuery() }) },
      };
      return [...rs.slice(0, index + 1), copy, ...rs.slice(index + 1)];
    });

  return (
    <div className="overflow-hidden rounded-2xl border bg-background shadow-sm/5">
      <div className="flex flex-wrap items-center gap-3 border-b px-4 py-3">
        <Tip label="Back to routing forms">
          <Button size="icon-sm" variant="outline" aria-label="Back">
            <ArrowLeftIcon />
          </Button>
        </Tip>
        <nav className="flex items-center gap-1.5 text-sm">
          <span className="text-muted-foreground">Routing forms</span>
          <span className="text-muted-foreground/60">/</span>
          <span className="font-medium">Immigration fast track</span>
        </nav>
        <div className="mx-auto flex rounded-lg bg-muted p-0.5">
          {(
            [
              ['form', 'Form', ListIcon],
              ['routing', 'Routing', RouteIcon],
              ['reports', 'Reports', TrendingUpIcon],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              data-tab={id}
              onClick={() => setTab(id)}
              className={cn(
                'flex h-7 items-center gap-1.5 rounded-md px-3 text-sm transition-colors',
                tab === id ? 'bg-background font-medium shadow-xs/5' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon className="size-3.5" />
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <Button size="sm" variant="outline" onClick={() => setPreview(true)}>
            Preview
          </Button>
          <Tip label="Form settings">
            <Button size="icon-sm" variant="outline" aria-label="Settings">
              <SettingsIcon />
            </Button>
          </Tip>
          <Tip label="More">
            <Button size="icon-sm" variant="outline" aria-label="More">
              <EllipsisIcon />
            </Button>
          </Tip>
          <Button
            size="sm"
            onClick={() => {
              setSaved(true);
              setTimeout(() => setSaved(false), 1500);
            }}
          >
            {saved ? (
              <>
                <CheckIcon /> Saved
              </>
            ) : (
              'Save'
            )}
          </Button>
        </div>
      </div>

      <div className="bg-background px-4 py-6 sm:px-8">
        {tab === 'form' && <FormTab />}
        {tab === 'reports' && <ReportsTab routes={routes} />}
        {tab === 'routing' && (
          <div className="mx-auto flex max-w-4xl flex-col gap-3">
            {routes.map((route, i) => (
              <RouteCard
                key={route.id}
                route={route}
                index={i}
                count={routes.length}
                onChange={(next) => update(route.id, next)}
                onDuplicate={() => duplicate(i)}
                onDelete={() => setRoutes((rs) => rs.filter((r) => r.id !== route.id))}
                onMove={(d) => move(i, d)}
              />
            ))}
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => setRoutes((rs) => [...rs, makeRoute(`Route ${rs.length + 1}`)])}>
                <PlusIcon /> Add route
              </Button>
              <span className="text-muted-foreground text-xs">
                <ArrowDownUpIcon className="me-1 inline size-3" />
                Routes are checked top to bottom; the first match wins.
              </span>
            </div>
            <div className="rounded-2xl border bg-muted/50 p-2 dark:bg-muted/20">
              <Section icon={<SplitIcon />} title="If no route matches">
                <ActionEditor action={fallback} onChange={setFallback} />
              </Section>
            </div>
            <ExportPanel routes={routes} fallback={fallback} />
          </div>
        )}
      </div>
      <PreviewSheet open={preview} onOpenChange={setPreview} routes={routes} fallback={fallback} />
    </div>
  );
}
