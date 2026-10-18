// Canonical dataset every adapter translates into its own format, so all libraries render the same tree.

export type FieldType = 'text' | 'number' | 'select' | 'boolean';
export interface FieldDef {
  name: string;
  label: string;
  type: FieldType;
  options?: string[];
}

export const FIELDS: FieldDef[] = [
  { name: 'firstName', label: 'First name', type: 'text' },
  { name: 'age', label: 'Age', type: 'number' },
  { name: 'status', label: 'Status', type: 'select', options: ['active', 'pending', 'closed', 'banned', 'trial'] },
  { name: 'city', label: 'City', type: 'text' },
  { name: 'score', label: 'Score', type: 'number' },
  { name: 'tier', label: 'Tier', type: 'select', options: ['free', 'pro', 'team', 'enterprise'] },
  { name: 'verified', label: 'Verified', type: 'boolean' },
  { name: 'email', label: 'Email', type: 'text' },
  { name: 'visits', label: 'Visits', type: 'number' },
  { name: 'country', label: 'Country', type: 'select', options: ['US', 'UK', 'DE', 'FR', 'JP'] },
];

export interface CRule {
  field: string;
  type: FieldType;
  value: string | number | boolean;
}
export interface CGroup {
  combinator: 'and' | 'or';
  rules: (CRule | CGroup)[];
}
export const isGroup = (n: CRule | CGroup): n is CGroup => 'rules' in n;

// Root AND group holding ceil(n/10) OR sub-groups of up to 10 rules each (depth 2).
export function makeTree(n: number): CGroup {
  const groups: CGroup[] = [];
  for (let i = 0; i < n; i++) {
    if (i % 10 === 0) groups.push({ combinator: 'or', rules: [] });
    const f = FIELDS[i % FIELDS.length];
    const value =
      f.type === 'text' ? `v${i}` : f.type === 'number' ? i : f.type === 'select' ? f.options![i % f.options!.length] : i % 2 === 0;
    groups[groups.length - 1].rules.push({ field: f.name, type: f.type, value });
  }
  return { combinator: 'and', rules: groups };
}

export interface Adapter {
  name: string;
  /** Untimed: build the library's own serialized format for an n-rule tree (what an app would have stored). */
  prepare(n: number): void;
  /** Timed: load the prepared data and render it. */
  mount(el: HTMLElement): void | Promise<void>;
  unmount(el: HTMLElement): void;
  /** Number of rendered rule rows, used to verify the render finished. */
  ruleCount(el: HTMLElement): number;
  /** Inline text inputs bound to text-field rule values (null = no inline editing). */
  textInputs(el: HTMLElement): HTMLInputElement[] | null;
  /** Perform the UI action that appends a rule to the root group. */
  addRule(el: HTMLElement): void | Promise<void>;
  /** Serialize current state to SQL using the library's own exporter (null = unsupported). */
  sql: (() => string) | null;
}
