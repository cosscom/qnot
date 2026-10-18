// A minimal plain-HTML UI built only on the public hooks, to measure the architecture itself.
import { createContext, memo, useContext } from 'react';
import type { FieldDef } from '../shared';
import type { QueryStore } from './core';
import { useGroup, useRule } from './react';

const OPS: Record<FieldDef['type'], string[]> = {
  text: ['=', '!=', 'contains', 'beginsWith', 'endsWith', 'null', 'notNull'],
  number: ['=', '!=', '<', '>', '<=', '>=', 'null', 'notNull'],
  select: ['=', '!=', 'null', 'notNull'],
  boolean: ['='],
};

interface Ctx { store: QueryStore; fields: FieldDef[]; byName: Map<string, FieldDef> }
const QBContext = createContext<Ctx>(null!);

export function QueryBuilder({ store, fields }: { store: QueryStore; fields: FieldDef[] }) {
  const ctx = { store, fields, byName: new Map(fields.map((f) => [f.name, f])) };
  return (
    <QBContext.Provider value={ctx}>
      <div className="cqb">
        <Group id={store.rootId} />
      </div>
    </QBContext.Provider>
  );
}

const Group = memo(function Group({ id }: { id: string }) {
  const { store, fields } = useContext(QBContext);
  const { group, isRoot, setCombinator, addRule, addGroup, remove } = useGroup(store, id);
  return (
    <div className="cqb-group">
      <div className="cqb-group-header">
        <select value={group.combinator} onChange={(e) => setCombinator(e.target.value as 'and' | 'or')}>
          <option value="and">AND</option>
          <option value="or">OR</option>
        </select>
        <button className="cqb-add-rule" onClick={() => addRule({ field: fields[0].name, operator: '=', value: '' })}>+ Rule</button>
        <button onClick={() => addGroup()}>+ Group</button>
        {!isRoot && <button onClick={remove}>×</button>}
      </div>
      <div className="cqb-children">
        {group.children.map((c) => (store.get(c).kind === 'group' ? <Group key={c} id={c} /> : <Rule key={c} id={c} />))}
      </div>
    </div>
  );
});

const Rule = memo(function Rule({ id }: { id: string }) {
  const { store, fields, byName } = useContext(QBContext);
  const { rule, setField, setOperator, setValue, remove } = useRule(store, id);
  const field = byName.get(rule.field)!;
  return (
    <div className="cqb-rule">
      <select value={rule.field} onChange={(e) => setField(e.target.value)}>
        {fields.map((f) => <option key={f.name} value={f.name}>{f.label}</option>)}
      </select>
      <select value={rule.operator} onChange={(e) => setOperator(e.target.value)}>
        {OPS[field.type].map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
      {field.type === 'select' ? (
        <select className="cqb-value" value={String(rule.value)} onChange={(e) => setValue(e.target.value)}>
          {field.options!.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : field.type === 'boolean' ? (
        <input className="cqb-value" type="checkbox" checked={!!rule.value} onChange={(e) => setValue(e.target.checked)} />
      ) : (
        <input
          className="cqb-value"
          type={field.type === 'number' ? 'number' : 'text'}
          value={String(rule.value ?? '')}
          onChange={(e) => setValue(field.type === 'number' ? e.target.valueAsNumber : e.target.value)}
        />
      )}
      <button onClick={remove}>×</button>
    </div>
  );
});
