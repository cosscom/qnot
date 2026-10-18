import { defineFields, f } from '@trawlnet/core';
import { rqb, type RQBRuleGroup } from '@trawlnet/core/formats/rqb';
import { useQueryStore } from '@trawlnet/react';
import { ArrowLeftRightIcon, UploadIcon } from 'lucide-react';
import { useRef, useState } from 'react';
import { CodeBlock } from '@/components/code-block';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { CossQueryBuilder } from '@/coss/QueryBuilder';
import { ExampleFrame, type ExampleMeta } from './frame';

export const meta: ExampleMeta = {
  id: 'rqb-dropin',
  title: 'Drop-in for react-querybuilder',
  blurb: 'Keep your saved RQB JSON: the store speaks its format via `format: rqb`',
  icon: ArrowLeftRightIcon,
  category: 'Integration',
};

const fields = defineFields({
  firstName: f.text({ label: 'First name' }),
  lastName: f.text({ label: 'Last name' }),
  age: f.number({ min: 0 }),
  isMusician: f.boolean({ label: 'Is a musician' }),
  instrument: f.enum(['Guitar', 'Piano', 'Drums', 'Vocals', 'Bass']),
});

// Exactly what react-querybuilder's onQueryChange gives you (and what's already in your database).
const SAVED: RQBRuleGroup = {
  combinator: 'and',
  rules: [
    { field: 'firstName', operator: 'beginsWith', value: 'Stev' },
    { field: 'age', operator: 'between', value: '26,52' },
    {
      combinator: 'or',
      rules: [
        { field: 'isMusician', operator: '=', value: true },
        { field: 'instrument', operator: 'in', value: ['Guitar', 'Piano'] },
      ],
    },
  ],
} as RQBRuleGroup;

const code = `
import { rqb } from '@trawlnet/core/formats/rqb';
import { useQueryStore } from '@trawlnet/react';

// Your app state stays in react-querybuilder's shape. No data migration.
const [query, setQuery] = useState<RuleGroupType>(savedQuery);

// The store decodes it into trawlnet's native tree and re-encodes on every change.
// Encoding is memoized per node, and passing back the value it gave you is a no-op.
const store = useQueryStore({ fields, format: rqb, value: query, onChange: setQuery });

return <QueryBuilder store={store} />;
`;

export function Demo() {
  const [value, setValue] = useState<RQBRuleGroup>(SAVED);
  const changes = useRef(0);
  const store = useQueryStore({
    fields,
    format: rqb,
    value,
    onChange: (v: RQBRuleGroup) => {
      changes.current++;
      setValue(v);
    },
  });
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  return (
    <ExampleFrame meta={meta} code={code} description="Migrating from react-querybuilder? The store takes a `format`, so value/onChange speak RQB's JSON. Saved queries load as-is (note the legacy comma-separated `between` value) and edits come back out in RQB's shape. Paste any RQB query on the right to load it.">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <CossQueryBuilder store={store} />
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-medium">App state</span>
            <Badge variant="outline">react-querybuilder RuleGroupType</Badge>
            <span className="ms-auto text-muted-foreground text-xs" data-changes>
              {changes.current} onChange calls
            </span>
          </div>
          <CodeBlock code={JSON.stringify(value, null, 2)} />
          <Textarea className="font-mono text-xs" rows={5} placeholder='Paste react-querybuilder JSON, e.g. {"combinator":"or","rules":[{"field":"age","operator":">","value":"30"}]}' value={draft} onChange={(e) => setDraft(e.target.value)} />
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={!draft.trim()}
              onClick={() => {
                try {
                  setValue(JSON.parse(draft));
                  setDraft('');
                  setError(null);
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              <UploadIcon /> Load RQB JSON
            </Button>
            {error && <span className="text-destructive-foreground text-xs">{error}</span>}
          </div>
        </div>
      </div>
    </ExampleFrame>
  );
}
