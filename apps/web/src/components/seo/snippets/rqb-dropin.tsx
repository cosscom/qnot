'use client';
import '@qnot/core/styles.css';
import { defineFields, f } from '@qnot/core';
import { rqb, type RQBRuleGroup } from '@qnot/core/formats/rqb';
import { QueryBuilder } from '@qnot/react';
import { useState } from 'react';

const fields = defineFields({
  firstName: f.text({ label: 'First name' }),
  age: f.number({ integer: true }),
  plan: f.enum(['free', 'pro', 'team']),
});

export function Filters({ saved }: { saved: RQBRuleGroup }) {
  const [query, setQuery] = useState(saved);
  // before: <QueryBuilder fields={rqbFields} query={query} onQueryChange={setQuery} />
  return <QueryBuilder fields={fields} format={rqb} value={query} onChange={setQuery} />;
}
