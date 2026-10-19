import { builtinFunctions, createQueryStore, defineFields, f } from '@qnot/core';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { QueryBuilder } from './index';

describe('server rendering', () => {
  it('renders the default builder to HTML without a DOM', () => {
    const fields = defineFields({ name: f.text(), orders: f.array({ qty: f.number() }) }, { functions: builtinFunctions });
    const store = createQueryStore({
      fields,
      initial: { kind: 'group', combinator: 'and', children: [{ kind: 'rule', field: 'name', operator: 'eq', value: 'Ada' }] },
    });
    const html = renderToString(<QueryBuilder store={store} showLock />);
    expect(html).toContain('qn-rule');
    expect(html).toContain('value="Ada"');
  });
});
