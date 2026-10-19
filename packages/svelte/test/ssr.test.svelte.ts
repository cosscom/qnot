// @vitest-environment node
import { builtinFunctions, createQueryStore, defineFields, f } from '@qnot/core';
import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import { QueryBuilder } from '../src/index';

describe('Svelte server rendering', () => {
  it('renders the default builder to HTML without a DOM', () => {
    const fields = defineFields(
      { name: f.text(), age: f.number(), status: f.enum(['active', 'banned']), ok: f.boolean(), orders: f.array({ qty: f.number() }) },
      { functions: builtinFunctions },
    );
    const store = createQueryStore({
      fields,
      initial: {
        kind: 'group',
        combinator: 'and',
        children: [
          { kind: 'rule', field: 'name', operator: 'eq', value: 'Ada' },
          { kind: 'rule', field: 'age', operator: 'gt', value: 30 },
          { kind: 'rule', field: 'status', operator: 'eq', value: 'banned' },
          { kind: 'group', combinator: 'or', of: { field: 'orders', match: 'some' }, children: [{ kind: 'rule', field: 'qty', operator: 'gt', value: 2 }] },
        ],
      },
    });
    const { body } = render(QueryBuilder, { props: { store, showLock: true } });
    expect(body).toContain('qn-rule');
    expect(body).toContain('value="Ada"');
    expect(body).toContain('value="30"');
    // Lazy selects render their chosen option, selected.
    expect(body).toMatch(/<select class="qn-operator"[^>]*>(?:<!--[^>]*-->)*<option value="gt" selected/);
    expect(body).toMatch(/<option value="banned" selected/);
    expect(body).toContain('qn-array-group');
  });
});
