// Server-safe metadata for every example: what it is and what it's for. Its source is read from disk
// by the example page; titles come from registry/items.json.
// The live demos are client components in ./demos.ts; the catalog drawings are in ./sketches.tsx.
import type { ReactNode } from 'react';
import manifest from '../../registry/items.json';

/** Title and one-line purpose come from the shadcn registry manifest, so the two never drift. */
function registryMeta(slug: string): { title: string; blurb: string } {
  const item = manifest.items.find((i) => i.name === slug);
  if (!item) throw new Error(`examples: "${slug}" is missing from registry/items.json`);
  return { title: item.title, blurb: item.description };
}

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
  /** The demo brings its own chrome (an app window), so it renders without the card. */
  bleed?: boolean;
}

export const EXAMPLES: ExampleInfo[] = [
  {
    slug: 'linear-filters',
    ...registryMeta('linear-filters'),
    category: "Product",
    tags: ["useGroup", "useRule", "headless"],
    description: "No nested groups, no field/operator/value rows: just chips. Built directly on useGroup and useRule, which shows the headless hooks don't dictate a layout. Click the operator or values in a chip to change them.",
  },
  {
    slug: 'workflow',
    ...registryMeta('workflow'),
    category: "Product",
    tags: ["compile", "sentence builder"],
    description: "The classic automation shape: a trigger, conditions, then an action. The conditions are a trawlnet query over the booking's properties; the log on the right replays recent bookings and shows which would have fired.",
  },
  {
    slug: 'saved-views',
    ...registryMeta('saved-views'),
    category: "Product",
    tags: ["store.reset", "useHistory", "formats/text"],
    description: "Views are named queries. Switch between them, tweak, undo, and save. A view is just native JSON, so it serializes cleanly to your database or a URL. The sentence under the toolbar is the same query rendered read-only in plain English.",
  },
  {
    slug: 'product-filters',
    ...registryMeta('product-filters'),
    category: "Data",
    tags: ["compile", "nested groups"],
    description: "Classic faceted search, but the facets compose: nest groups for (Audio under $100) OR (Wearables rated 4.5+). The store is the source of truth; the grid re-filters with a compiled predicate on every change.",
  },
  {
    slug: 'segments',
    ...registryMeta('segments'),
    category: "Data",
    tags: ["formats/sql", "params", "compile"],
    description: "Marketers build the segment; your backend gets parameterized SQL with no string concatenation. The audience count runs the same query client-side over 5,000 sample contacts, so there's no round trip while editing.",
  },
  {
    slug: 'feature-flags',
    ...registryMeta('feature-flags'),
    category: "Platform",
    tags: ["formats/jsonlogic", "compile"],
    description: "Target internal users, big customers on recent versions, or beta opt-ins, then roll out to a percentage of that segment. The segment ships as JsonLogic, so your edge function or Go/Python service can evaluate it without trawlnet.",
  },
  {
    slug: 'alerting',
    ...registryMeta('alerting'),
    category: "Platform",
    tags: ["ref", "compile", "between"],
    description: "Alert when CPU runs hot, errors spike, or p99 latency exceeds that service's own SLO, a field-to-field comparison (click the (x) icon on a rule to switch between a literal and another field). Metrics tick every second; rows light up while the rule fires.",
  },
  {
    slug: 'access-policy',
    ...registryMeta('access-policy'),
    category: "Platform",
    tags: ["NOT groups", "compile"],
    description: "An authorization policy as a query: allow statements are ORed, a NOT group carves out a deny (payroll is owner-only), and office hours apply to everything. The simulator evaluates a request and explains which top-level statement passed or failed.",
  },
  {
    slug: 'rqb-dropin',
    ...registryMeta('rqb-dropin'),
    category: "Integration",
    tags: ["format: rqb", "useQueryStore"],
    description: "Migrating from react-querybuilder? The store takes a `format`, so value/onChange speak RQB's JSON. Saved queries load as-is (note the legacy comma-separated `between` value) and edits come back out in RQB's shape. Paste any RQB query on the right to load it.",
  },
  {
    slug: 'server-side',
    ...registryMeta('server-side'),
    category: "Integration",
    tags: ["formats/sql", "formats/mongo", "formats/jsonlogic"],
    description: "Build once, run anywhere. The first rule is a SQL-injection attempt and the email rule contains a LIKE wildcard: watch every dialect escape them (or turn them into bound parameters). Codecs are memoized per node, so re-encoding after an edit only touches the changed branch.",
  },
];

export const exampleBySlug = (slug: string) => EXAMPLES.find((e) => e.slug === slug);
