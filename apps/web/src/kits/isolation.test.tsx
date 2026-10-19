// Every kit keeps the O(1) edit: changing one rule re-renders that rule's controls only.
import { createQueryStore, defineFields, f } from '@trawlnet/core';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { headlessKit } from '@/components/trawlnet/kits/headless';
import { muiKit } from '@/components/trawlnet/kits/mui';
import { shadcnKit } from '@/components/trawlnet/kits/shadcn';
import { createQueryBuilder } from '@/components/trawlnet/kits/shared/builder';
import type { Kit } from '@/components/trawlnet/kits/shared/kit';

const fields = defineFields({ name: f.text(), city: f.text(), email: f.text() });
const initial = {
  kind: 'group' as const,
  combinator: 'and' as const,
  children: (['name', 'city', 'email'] as const).map((field) => ({ kind: 'rule' as const, field, operator: 'eq' as const, value: `${field}-0` })),
};

/** The kit with a TextInput that counts its renders, so sibling re-renders show up. */
function counting(kit: Kit) {
  const counter = { renders: 0 };
  const Inner = kit.TextInput;
  const TextInput = (props: ComponentProps<Kit['TextInput']>) => {
    counter.renders++;
    return <Inner {...props} />;
  };
  return { QueryBuilder: createQueryBuilder({ ...kit, TextInput }), counter };
}

afterEach(cleanup);

describe.each([
  ['shadcn', shadcnKit],
  ['mui', muiKit],
  ['headless', headlessKit],
])('%s kit', (_, kit) => {
  it('re-renders only the edited rule when a value changes', () => {
    const store = createQueryStore({ fields, initial });
    const { QueryBuilder, counter } = counting(kit);
    const { container } = render(<QueryBuilder store={store} />);
    expect(counter.renders).toBe(3);
    counter.renders = 0;
    const [first] = store.getGroup(store.rootId).children;
    act(() => store.setRuleValue(first!, 'Ada'));
    expect(counter.renders).toBe(1);
    // And through the DOM, like a keystroke.
    counter.renders = 0;
    const input = [...container.querySelectorAll('input')].find((i) => i.value === 'city-0')!;
    fireEvent.change(input, { target: { value: 'Lisbon' } });
    expect(counter.renders).toBe(1);
    expect(store.getQuery().children[1]).toMatchObject({ field: 'city', value: 'Lisbon' });
  });
});
