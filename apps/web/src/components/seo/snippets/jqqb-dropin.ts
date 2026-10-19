import '@qnot/core/styles.css';
import { createQueryStore, defineFields, f } from '@qnot/core';
import { jqqb, type JQQBGroup } from '@qnot/core/formats/jqqb';
import { mountQueryBuilder } from '@qnot/dom';

declare const saved: JQQBGroup; // what $('#builder').queryBuilder('getRules') gave you
declare function save(rules: JQQBGroup): void;

// before: $('#builder').queryBuilder({ filters, rules: saved });
const fields = defineFields({
  name: f.text(),
  age: f.number({ integer: true }),
  status: f.enum(['active', 'pending', 'closed']),
});
const store = createQueryStore({ fields, format: jqqb, initial: saved });
mountQueryBuilder(document.getElementById('builder')!, store);

// getValue() is still { condition: 'AND', rules: [...] }, so your API doesn't change.
store.subscribe(() => save(store.getValue()));
