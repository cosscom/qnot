'use client';
import '@qnot/core/styles.css';
import { defineFields, f } from '@qnot/core';
import { raqb, type RAQBGroup } from '@qnot/core/formats/raqb';
import { QueryBuilder } from '@qnot/react';
import { useState } from 'react';

const fields = defineFields({
  name: f.text(),
  age: f.number({ min: 0, integer: true }),
  address: f.struct({ city: f.text(), zip: f.text() }),
  orders: f.array({ status: f.enum(['paid', 'pending']), qty: f.number() }),
});

// tree: what QbUtils.getTree(immutableTree) gave you, stored as JSON.
export function Filters({ tree }: { tree: RAQBGroup }) {
  const [value, setValue] = useState(tree);
  return <QueryBuilder fields={fields} format={raqb} value={value} onChange={setValue} />;
}
