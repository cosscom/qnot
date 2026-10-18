import type { AnyFieldDef, Fields } from './fields';
import { OPERATORS, type OperatorId } from './operators';
import type { Rule } from './types';

const first = (v: unknown) => (Array.isArray(v) ? (v.length ? v[0] : null) : v);

/**
 * Reshape a value for an operator's arity, keeping what the user entered where it still fits:
 * `5` -> `[5, null]` for between, `[5, 9]` -> `5` for eq, anything -> `null` for isNull.
 */
export function coerceValue(def: AnyFieldDef | undefined, op: OperatorId, value: unknown): unknown {
  const fallback = def?.defaultValue ?? null;
  switch (OPERATORS[op].arity) {
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
      if (OPERATORS[op].textMatch) return v === null || v === undefined ? '' : String(v);
      return v === undefined ? fallback : v;
    }
  }
}

/** A complete rule for `field` using the schema's defaults, with any overrides coerced to fit. */
export function makeRule(fields: Fields, partial: Partial<Rule> = {}): Rule {
  const names = Object.keys(fields);
  const field = partial.field ?? names[0];
  if (field === undefined) throw new Error('trawlnet: cannot create a rule without any fields');
  const def = fields[field];
  const operator = partial.operator && (!def || def.operators.includes(partial.operator)) ? partial.operator : (def?.defaultOperator ?? 'eq');
  if (partial.ref !== undefined && OPERATORS[operator].comparable) return { kind: 'rule', field, operator, ref: partial.ref };
  return { kind: 'rule', field, operator, value: coerceValue(def, operator, 'value' in partial ? partial.value : def?.defaultValue) };
}

/**
 * The rule after switching to another field: keeps the operator when the new field supports it,
 * keeps the value when the field kind is unchanged, and drops a ref that no longer type-checks.
 */
export function changeField(fields: Fields, rule: Rule, field: string): Rule {
  const prev = fields[rule.field];
  const next = fields[field];
  const operator = next && next.operators.includes(rule.operator) ? rule.operator : (next?.defaultOperator ?? rule.operator);
  if (rule.ref !== undefined && rule.ref !== field && OPERATORS[operator].comparable && fields[rule.ref]?.kind === next?.kind) {
    return { kind: 'rule', field, operator, ref: rule.ref };
  }
  const sameKind = prev && next && prev.kind === next.kind && !next.options;
  return { kind: 'rule', field, operator, value: coerceValue(next, operator, sameKind ? rule.value : next?.defaultValue) };
}

export function changeOperator(fields: Fields, rule: Rule, operator: OperatorId): Rule {
  if (rule.ref !== undefined && OPERATORS[operator].comparable) return { ...rule, operator };
  const def = fields[rule.field];
  return { kind: 'rule', field: rule.field, operator, value: coerceValue(def, operator, rule.ref !== undefined ? def?.defaultValue : rule.value) };
}
