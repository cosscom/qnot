import type { AnyFieldDef, Fields } from './fields';
import type { FnCall } from './functions';
import { operatorInfo } from './operators';
import { leftDef } from './scope';
import type { Rule } from './types';

const first = (v: unknown) => (Array.isArray(v) ? (v.length ? v[0] : null) : v);

/**
 * Reshape a value for an operator's arity, keeping what the user entered where it still fits:
 * `5` -> `[5, null]` for between, `[5, 9]` -> `5` for eq, anything -> `null` for isNull.
 */
export function coerceValue(fields: Fields, def: AnyFieldDef | undefined, op: string, value: unknown): unknown {
  const info = operatorInfo(fields, op);
  const fallback = def?.defaultValue ?? null;
  switch (info?.arity ?? 'one') {
    case 'none':
      return null;
    case 'two': {
      if (Array.isArray(value)) return [value[0] ?? null, value[1] ?? null];
      return [value ?? fallback ?? null, null];
    }
    case 'many': {
      if (Array.isArray(value)) return value.filter((v) => v !== null && v !== undefined && v !== '');
      return value === null || value === undefined || value === '' ? [] : [value];
    }
    case 'one': {
      const v = first(value);
      if (info?.textMatch) return v === null || v === undefined ? '' : String(v);
      return v === undefined ? (Array.isArray(fallback) ? null : fallback) : v;
    }
  }
}

/** What happens to a rule's operator and value when its field changes. RAQB setOpOnChangeField / clearValueOnChangeField. */
export interface ChangeOptions {
  /** `keep` (default) keeps the operator when the new field supports it; `reset` always uses the default. */
  operatorOnFieldChange?: 'keep' | 'reset';
  /** `keep` (default) keeps a value of the same kind; `reset` always resets to the default. */
  valueOnFieldChange?: 'keep' | 'reset';
  /** `keep` (default) reshapes the value for the new operator; `reset` resets it. */
  valueOnOperatorChange?: 'keep' | 'reset';
}

const pickableField = (fields: Fields) => Object.keys(fields).find((k) => !fields[k]!.hidden && fields[k]!.kind !== 'array') ?? Object.keys(fields)[0];

/** A complete rule for `field` using the schema's defaults, with any overrides coerced to fit. */
export function makeRule(fields: Fields, partial: Partial<Rule> = {}): Rule {
  const field = partial.field ?? pickableField(fields);
  if (field === undefined) throw new Error('qnot: cannot create a rule without any fields');
  const def = leftDef(fields, field);
  const operator = partial.operator && (!def || def.operators.includes(partial.operator)) ? partial.operator : (def?.defaultOperator ?? 'eq');
  const lock = partial.locked ? { locked: true } : {};
  if (partial.ref !== undefined && operatorInfo(fields, operator)?.comparable) return { kind: 'rule', field, operator, ref: partial.ref, ...lock };
  if (partial.call !== undefined && operatorInfo(fields, operator)?.comparable) return { kind: 'rule', field, operator, call: partial.call, ...lock };
  return { kind: 'rule', field, operator, value: coerceValue(fields, def, operator, 'value' in partial ? partial.value : def?.defaultValue), ...lock };
}

/**
 * The rule after switching to another field (or a function call): keeps the operator when the new
 * field supports it, keeps the value when the field kind is unchanged, and drops a ref that no
 * longer type-checks.
 */
export function changeField(fields: Fields, rule: Rule, field: string | FnCall, opts: ChangeOptions = {}): Rule {
  const prev = leftDef(fields, rule.field);
  const next = leftDef(fields, field);
  const keepOp = opts.operatorOnFieldChange !== 'reset' && next?.operators.includes(rule.operator);
  const operator = keepOp ? rule.operator : (next?.defaultOperator ?? rule.operator);
  const lock = rule.locked ? { locked: true } : {};
  const comparable = operatorInfo(fields, operator)?.comparable;
  if (rule.ref !== undefined && rule.ref !== field && comparable && fields[rule.ref]?.kind === next?.kind) {
    return { kind: 'rule', field, operator, ref: rule.ref, ...lock };
  }
  if (rule.call !== undefined && comparable) return { kind: 'rule', field, operator, call: rule.call, ...lock };
  const sameKind = opts.valueOnFieldChange !== 'reset' && prev && next && prev.kind === next.kind && !next.options;
  return { kind: 'rule', field, operator, value: coerceValue(fields, next, operator, sameKind ? rule.value : next?.defaultValue), ...lock };
}

export function changeOperator(fields: Fields, rule: Rule, operator: string, opts: ChangeOptions = {}): Rule {
  const comparable = operatorInfo(fields, operator)?.comparable;
  if ((rule.ref !== undefined || rule.call !== undefined) && comparable) return { ...rule, operator };
  const def = leftDef(fields, rule.field);
  const keep = opts.valueOnOperatorChange !== 'reset' && rule.ref === undefined && rule.call === undefined;
  return {
    kind: 'rule',
    field: rule.field,
    operator,
    value: coerceValue(fields, def, operator, keep ? rule.value : def?.defaultValue),
    ...(rule.locked && { locked: true }),
  };
}
