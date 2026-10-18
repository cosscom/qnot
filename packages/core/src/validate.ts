import type { AnyFieldDef, Fields } from './fields';
import { OPERATORS, isOperator } from './operators';
import type { Group, Query, QueryNode, QueryOf, Rule, StrictQueryOf } from './types';

export type IssueCode =
  | 'unknownField'
  | 'unknownOperator'
  | 'operatorNotAllowed'
  | 'required'
  | 'type'
  | 'option'
  | 'min'
  | 'max'
  | 'integer'
  | 'minLength'
  | 'maxLength'
  | 'pattern'
  | 'range'
  | 'ref'
  | 'emptyGroup'
  | 'custom';

export interface Issue {
  readonly code: IssueCode;
  readonly message: string;
  /** Errors make a query invalid; warnings (an empty group) don't. */
  readonly severity: 'error' | 'warning';
  /** For between/in values: which element the issue is about. */
  readonly index?: number;
}

export interface PathIssue extends Issue {
  /** Child indexes from the root group to the node. */
  readonly path: readonly number[];
}

const err = (code: IssueCode, message: string, index?: number): Issue =>
  index === undefined ? { code, message, severity: 'error' } : { code, message, severity: 'error', index };

const isEmpty = (v: unknown) => v === null || v === undefined || v === '' || (typeof v === 'number' && Number.isNaN(v));

function checkScalar(def: AnyFieldDef, v: unknown, textMatch: boolean, index?: number): Issue[] {
  if (isEmpty(v)) return def.required ? [err('required', 'A value is required', index)] : [];
  if (textMatch) return typeof v === 'string' ? [] : [err('type', 'Expected text', index)];
  const out: Issue[] = [];
  switch (def.kind) {
    case 'text':
      if (typeof v !== 'string') return [err('type', 'Expected text', index)];
      if (def.minLength !== undefined && v.length < def.minLength) out.push(err('minLength', `At least ${def.minLength} characters`, index));
      if (def.maxLength !== undefined && v.length > def.maxLength) out.push(err('maxLength', `At most ${def.maxLength} characters`, index));
      if (def.pattern && !def.pattern.test(v)) out.push(err('pattern', 'Invalid format', index));
      break;
    case 'number':
      if (typeof v !== 'number' || !Number.isFinite(v)) return [err('type', 'Expected a number', index)];
      if (def.min !== undefined && v < def.min) out.push(err('min', `Must be at least ${def.min}`, index));
      if (def.max !== undefined && v > def.max) out.push(err('max', `Must be at most ${def.max}`, index));
      if (def.integer && !Number.isInteger(v)) out.push(err('integer', 'Must be a whole number', index));
      break;
    case 'boolean':
      if (typeof v !== 'boolean') return [err('type', 'Expected true or false', index)];
      break;
    case 'date':
      if (typeof v !== 'string' || Number.isNaN(Date.parse(v))) return [err('type', 'Expected a date', index)];
      break;
  }
  if (def.options && !def.options.some((o) => o.value === v)) out.push(err('option', 'Not one of the allowed values', index));
  if (def.validate && !out.length) {
    const msg = def.validate(v);
    if (msg) out.push(err('custom', msg, index));
  }
  return out;
}

/** Problems with one rule, in schema order. An empty array means the rule is valid. */
export function validateRule(fields: Fields, rule: Rule): Issue[] {
  const def = fields[rule.field];
  if (!def) return [err('unknownField', `Unknown field "${rule.field}"`)];
  if (!isOperator(rule.operator)) return [err('unknownOperator', `Unknown operator "${String(rule.operator)}"`)];
  if (!def.operators.includes(rule.operator)) return [err('operatorNotAllowed', `"${rule.operator}" is not allowed for this field`)];
  const info = OPERATORS[rule.operator];

  if (rule.ref !== undefined) {
    const target = fields[rule.ref];
    if (!info.comparable) return [err('ref', 'This operator cannot compare fields')];
    if (!target) return [err('ref', `Unknown field "${rule.ref}"`)];
    if (target.kind !== def.kind) return [err('ref', 'Can only compare fields of the same type')];
    return [];
  }

  const v = rule.value;
  switch (info.arity) {
    case 'none':
      return [];
    case 'one':
      return checkScalar(def, v, info.textMatch);
    case 'two': {
      if (!Array.isArray(v) || v.length !== 2) return [err('type', 'Expected two values')];
      const issues = [...checkScalar(def, v[0], false, 0), ...checkScalar(def, v[1], false, 1)];
      if (!issues.length && v[0] > v[1]) issues.push(err('range', 'The first value must not exceed the second'));
      return issues;
    }
    case 'many': {
      if (!Array.isArray(v)) return [err('type', 'Expected a list of values')];
      if (!v.length) return def.required ? [err('required', 'Pick at least one value')] : [];
      return v.flatMap((x, i) => checkScalar(def, x, false, i));
    }
  }
}

export function validateGroup(group: Group): Issue[] {
  return group.children.length ? [] : [{ code: 'emptyGroup', message: 'This group is empty', severity: 'warning' }];
}

/** Every issue in a query, with the path to the node it belongs to. */
export function validateQuery(fields: Fields, query: Query): PathIssue[] {
  const out: PathIssue[] = [];
  const walk = (node: QueryNode, path: number[]) => {
    const issues = node.kind === 'rule' ? validateRule(fields, node) : validateGroup(node);
    for (const issue of issues) out.push({ ...issue, path });
    if (node.kind === 'group') node.children.forEach((c, i) => walk(c, [...path, i]));
  };
  walk(query, []);
  return out;
}

/** Narrows a draft query to `StrictQueryOf<F>` when it has no errors (warnings are allowed). */
export function isValidQuery<F extends Fields>(fields: F, query: QueryOf<F>): query is QueryOf<F> & StrictQueryOf<F> {
  return !validateQuery(fields, query as Query).some((i) => i.severity === 'error');
}

export function assertValidQuery<F extends Fields>(fields: F, query: QueryOf<F>): asserts query is QueryOf<F> & StrictQueryOf<F> {
  const errors = validateQuery(fields, query as Query).filter((i) => i.severity === 'error');
  if (errors.length) {
    throw new Error(`trawlnet: invalid query:\n${errors.map((e) => `  at [${e.path.join(', ')}] ${e.message}`).join('\n')}`);
  }
}
