// Server-safe metadata for every example: what it is, what it's for, and the code worth reading.
// The live demos are client components in ./demos.ts; the catalog drawings are in ./sketches.tsx.
import type { ReactNode } from 'react';

export type Category = 'Product' | 'Data' | 'Platform' | 'Integration';
export const CATEGORIES: readonly Category[] = ['Product', 'Data', 'Platform', 'Integration'];

export interface ExampleInfo {
  slug: string;
  title: string;
  /** One line for the catalog card: what it's for. */
  blurb: string;
  category: Category;
  tags: string[];
  description: ReactNode;
  code: string;
  /** The demo brings its own chrome (an app window), so it renders without the card. */
  bleed?: boolean;
}

export const EXAMPLES: ExampleInfo[] = [
  {
    slug: 'routing-forms',
    title: 'Cal.com routing forms',
    blurb: 'Route form responses to events, pages or the right team member',
    category: 'Product',
    tags: ["createQueryStore", "compile", "sentence builder", "multiEnum"],
    bleed: true,
    description: (
      <>
        A replica of Cal.com's routing form editor. Every route is its own trawlnet store over the form's questions; <strong className="font-medium text-foreground">all / any / none</strong> map to AND,
        OR and NOT(OR). The second builder filters team members by their attributes. Hit <strong className="font-medium text-foreground">Preview</strong> to answer the form and watch the first matching route win.
      </>
    ),
    code: `
import { createQueryStore, compile } from '@trawlnet/core';

// The form's questions are the schema.
const formFields = defineFields({
  visaType: f.enum([{ value: 'o1', label: 'O-1 extraordinary ability' }, …]),
  companySize: f.number({ min: 1 }),
  urgency: f.enum([{ value: 'asap', label: 'Within 2 weeks' }, …]),
});

// Each route owns a store; the UI is <CossQueryBuilder combinatorStyle="sentence" compact />.
const routes = [
  { name: 'Extraordinary talent', store: createQueryStore({ fields: formFields, initial }), action },
  …
];

// "all / any / none" is just the group's combinator and NOT flag:
//   all  -> { combinator: 'and' }
//   any  -> { combinator: 'or' }
//   none -> { combinator: 'or', not: true }

// First match wins, else the fallback.
const route = routes.find((r) => compile(formFields, r.store.getQuery())(response));
const action = route?.action ?? fallback;

// Assign hosts by attributes with a second schema + store per route.
const hosts = team.filter(compile(attributeFields, route.assign.store.getQuery()));
`,
  },
  {
    slug: "linear-filters",
    title: "Linear-style filter bar",
    blurb: "Inline filter chips: the same hooks, a completely different UI",
    category: "Product",
    tags: ["useGroup", "useRule", "headless"],
    description: "No nested groups, no field/operator/value rows: just chips. Built directly on useGroup and useRule, which shows the headless hooks don't dictate a layout. Click the operator or values in a chip to change them.",
    code: `
// Flat filters: no groups, one rule per field, rendered as chips with the headless hooks.
const fields = defineFields({
  status: f.enum(['Backlog', 'Todo', 'In progress', 'In review', 'Done'], { operators: ['in', 'notIn'] }),
  estimate: f.number({ operators: ['gte', 'lte', 'eq'] }),
});

function Chip({ id }) {
  const { rule, operators, setOperator, setValue, remove } = useRule(id);
  // [Status] [is any of ▾] [Todo, In progress ▾] [×]
}

function FilterBar() {
  const store = useStore();
  const { group, addRule } = useGroup(store.rootId);
  return <>{group.children.map((id) => <Chip key={id} id={id} />)}<AddFilterMenu onPick={(field) => addRule({ field, operator: 'in', value: [] })} /></>;
}

const visible = issues.filter(compile(fields, store.getQuery()));
`,
  },
  {
    slug: "workflow",
    title: "Workflow automation triggers",
    blurb: "\u201cWhen a booking is created and \u2026, then \u2026\u201d with a live event log",
    category: "Product",
    tags: ["compile", "sentence builder"],
    description: "The classic automation shape: a trigger, conditions, then an action. The conditions are a trawlnet query over the booking's properties; the log on the right replays recent bookings and shows which would have fired.",
    code: `
const workflow = {
  trigger: 'created',
  when: createQueryStore({ fields, initial }),  // "and …" conditions
  then: { action: 'email', to: '{attendee.email}', template: 'demo-prep' },
};

bus.on('booking.created', (booking) => {
  if (compile(fields, workflow.when.getQuery())(booking)) run(workflow.then, booking);
});
`,
  },
  {
    slug: "saved-views",
    title: "Saved views & undo",
    blurb: "Named views, dirty tracking, undo/redo, and queries as plain English",
    category: "Product",
    tags: ["store.reset", "useHistory", "formats/text"],
    description: "Views are named queries. Switch between them, tweak, undo, and save. A view is just native JSON, so it serializes cleanly to your database or a URL. The sentence under the toolbar is the same query rendered read-only in plain English.",
    code: `
// A view is just a name + native JSON. Load one into the store; save writes it back.
const store = createQueryStore({ fields, initial: views[0].query });
const open = (view) => store.reset(view.query); // new baseline, fresh undo history
const save = () => (view.query = store.getQuery());

// Dirty tracking is a reference check: getQuery() is structurally shared, so an unchanged
// query is the same object it was when you loaded it.
const dirty = store.getQuery() !== loaded;

// Undo/redo come with the store (keystrokes in one field merge into a single step).
const { canUndo, undo, canRedo, redo } = useHistory();
`,
  },
  {
    slug: "product-filters",
    title: "E-commerce product filters",
    blurb: "Faceted search over a catalogue, filtered client-side with compile()",
    category: "Data",
    tags: ["compile", "nested groups"],
    description: "Classic faceted search, but the facets compose: nest groups for (Audio under $100) OR (Wearables rated 4.5+). The store is the source of truth; the grid re-filters with a compiled predicate on every change.",
    code: `
const fields = defineFields({
  category: f.enum(['Audio', 'Wearables', 'Home', 'Outdoor', 'Office']),
  price: f.number({ min: 0 }),
  rating: f.number({ min: 0, max: 5 }),
  inStock: f.boolean(),
  released: f.date(),
});

const store = createQueryStore({ fields, initial });
const query = useSyncExternalStore(store.subscribe, store.getQuery);

// compile() once per query change, then filter: ~0.05ms for 60 products, ~1ms for 10k.
const visible = useMemo(() => products.filter(compile(fields, query)), [query]);
`,
  },
  {
    slug: "segments",
    title: "CRM audience segments",
    blurb: "Marketing segments with a live audience count and parameterized SQL",
    category: "Data",
    tags: ["formats/sql", "params", "compile"],
    description: "Marketers build the segment; your backend gets parameterized SQL with no string concatenation. The audience count runs the same query client-side over 5,000 sample contacts, so there's no round trip while editing.",
    code: `
import { sqlFormat } from '@trawlnet/core/formats/sql';

const postgres = sqlFormat({ dialect: 'postgres', params: 'numbered', quoteIdentifiers: true });
const { sql, params } = encode(postgres, store.getQuery(), fields);

// Safe to hand straight to your driver: every value is a $n placeholder.
await db.query(\`SELECT id, email FROM contacts WHERE \${sql}\`, params);
`,
  },
  {
    slug: "feature-flags",
    title: "Feature-flag targeting",
    blurb: "Segment rules + percentage rollout, shipped to the edge as JsonLogic",
    category: "Platform",
    tags: ["formats/jsonlogic", "compile"],
    description: "Target internal users, big customers on recent versions, or beta opt-ins, then roll out to a percentage of that segment. The segment ships as JsonLogic, so your edge function or Go/Python service can evaluate it without trawlnet.",
    code: `
import { jsonlogic } from '@trawlnet/core/formats/jsonlogic';

// Ship the segment as JsonLogic: evaluable in any language, at the edge, without trawlnet.
const flag = {
  key: 'new-checkout',
  enabled: true,
  rollout: 25,
  segment: encode(jsonlogic, store.getQuery(), fields),
};

// Server / edge (json-logic-js, json-logic-py, …):
const on = flag.enabled && jsonLogic.apply(flag.segment, user) && bucket(user.id) < flag.rollout;

// Or in JS, compile once and reuse:
const inSegment = compile(fields, store.getQuery());
`,
  },
  {
    slug: "alerting",
    title: "Monitoring alert rules",
    blurb: "Thresholds, ranges and field-vs-field checks over a live metric stream",
    category: "Platform",
    tags: ["ref", "compile", "between"],
    description: "Alert when CPU runs hot, errors spike, or p99 latency exceeds that service's own SLO, a field-to-field comparison (click the (x) icon on a rule to switch between a literal and another field). Metrics tick every second; rows light up while the rule fires.",
    code: `
const fields = defineFields({
  cpu: f.number({ min: 0, max: 100 }),
  errorRate: f.number({ min: 0 }),
  p99: f.number(),
  slo: f.number(),
});

// "p99 latency greater than p99 SLO": compares two fields of the same row.
const rule = { kind: 'rule', field: 'p99', operator: 'gt', ref: 'slo' };

// Recompile only when the rule changes; evaluate on every scrape.
const firing = compile(fields, store.getQuery());
setInterval(() => scrape().forEach((s) => notify(s.id, firing(s))), 1000);
`,
  },
  {
    slug: "access-policy",
    title: "Access-control policies",
    blurb: "Allow-if rules with NOT-group denies, plus a request simulator",
    category: "Platform",
    tags: ["NOT groups", "compile"],
    description: "An authorization policy as a query: allow statements are ORed, a NOT group carves out a deny (payroll is owner-only), and office hours apply to everything. The simulator evaluates a request and explains which top-level statement passed or failed.",
    code: `
// Policy = "allow if" query. Deny-overrides are NOT groups ANDed at the root.
const policy = createQueryStore({ fields, initial: {
  kind: 'group', combinator: 'and', children: [
    { kind: 'group', combinator: 'or', children: [/* allow statements */] },
    { kind: 'group', combinator: 'and', not: true, children: [/* payroll unless owner */] },
  ],
}});

const can = compile(fields, policy.getQuery());
app.use((req, res, next) => (can(toFacts(req)) ? next() : res.status(403).end()));

// Explain a decision by compiling each top-level statement on its own.
const explain = policy.getQuery().children.map((s) => compile(fields, { kind: 'group', combinator: 'and', children: [s] })(facts));
`,
  },
  {
    slug: "rqb-dropin",
    title: "Drop-in for react-querybuilder",
    blurb: "Keep your saved RQB JSON: the store speaks its format via `format: rqb`",
    category: "Integration",
    tags: ["format: rqb", "useQueryStore"],
    description: "Migrating from react-querybuilder? The store takes a `format`, so value/onChange speak RQB's JSON. Saved queries load as-is (note the legacy comma-separated `between` value) and edits come back out in RQB's shape. Paste any RQB query on the right to load it.",
    code: `
import { rqb } from '@trawlnet/core/formats/rqb';
import { useQueryStore } from '@trawlnet/react';

// Your app state stays in react-querybuilder's shape. No data migration.
const [query, setQuery] = useState<RuleGroupType>(savedQuery);

// The store decodes it into trawlnet's native tree and re-encodes on every change.
// Encoding is memoized per node, and passing back the value it gave you is a no-op.
const store = useQueryStore({ fields, format: rqb, value: query, onChange: setQuery });

return <QueryBuilder store={store} />;
`,
  },
  {
    slug: "server-side",
    title: "One query, every backend",
    blurb: "The same query as Postgres, MySQL, SQL Server, MongoDB and JsonLogic",
    category: "Integration",
    tags: ["formats/sql", "formats/mongo", "formats/jsonlogic"],
    description: "Build once, run anywhere. The first rule is a SQL-injection attempt and the email rule contains a LIKE wildcard: watch every dialect escape them (or turn them into bound parameters). Codecs are memoized per node, so re-encoding after an edit only touches the changed branch.",
    code: `
// One endpoint, any storage. Validate first, then encode for the backend you have.
app.post('/search', async (req, res) => {
  const query = req.body.query;
  if (!isValidQuery(fields, query)) return res.status(400).json(validateQuery(fields, query));

  const { sql, params } = encode(sqlFormat({ dialect: 'postgres', params: 'numbered' }), query, fields);
  res.json(await pg.query(\`SELECT * FROM users WHERE \${sql}\`, params));

  // or: db.collection('users').find(encode(mongo, query, fields))
  // or: jsonLogic.apply(encode(jsonlogic, query, fields), record)
});
`,
  },
];

export const exampleBySlug = (slug: string) => EXAMPLES.find((e) => e.slug === slug);
