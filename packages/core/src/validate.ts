import { fieldDef, flattenOptions, registryOf, type AnyFieldDef, type Fields } from './fields';
import { functionOf, isFnCall, isWellFormedCall, type FnCall, type Operand } from './functions';
import { operatorInfo } from './operators';
import { elementFields, leftDef } from './scope';
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
  | 'function'
  | 'emptyGroup'
  | 'arrayField'
  | 'shape'
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

const isEmpty = (v: unknown) => v === null || v === undefined || v === '' || (typeof v === 'number' && Number.isNaN(v));
const TIME = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d(\.\d+)?)?$/;

function issue(fields: Fields, code: IssueCode, message: string, index?: number, severity: Issue['severity'] = 'error'): Issue {
  const override = registryOf(fields).messages?.[code];
  const text = override === undefined ? message : typeof override === 'function' ? override({ code, message }) : override;
  return index === undefined ? { code, message: text, severity } : { code, message: text, severity, index };
}

function checkScalar(fields: Fields, def: AnyFieldDef, v: unknown, textMatch: boolean, index?: number): Issue[] {
  const err = (code: IssueCode, message: string) => issue(fields, code, message, index);
  if (isEmpty(v)) return def.required ? [err('required', 'A value is required')] : [];
  if (textMatch) return typeof v === 'string' ? [] : [err('type', 'Expected text')];
  const out: Issue[] = [];
  switch (def.kind) {
    case 'text':
      if (typeof v !== 'string') return [err('type', 'Expected text')];
      if (def.minLength !== undefined && v.length < def.minLength) out.push(err('minLength', `At least ${def.minLength} characters`));
      if (def.maxLength !== undefined && v.length > def.maxLength) out.push(err('maxLength', `At most ${def.maxLength} characters`));
      if (def.pattern && !def.pattern.test(v)) out.push(err('pattern', 'Invalid format'));
      break;
    case 'number':
      if (typeof v !== 'number' || !Number.isFinite(v)) return [err('type', 'Expected a number')];
      if (def.min !== undefined && v < def.min) out.push(err('min', `Must be at least ${def.min}`));
      if (def.max !== undefined && v > def.max) out.push(err('max', `Must be at most ${def.max}`));
      if (def.integer && !Number.isInteger(v)) out.push(err('integer', 'Must be a whole number'));
      break;
    case 'boolean':
      if (typeof v !== 'boolean') return [err('type', 'Expected true or false')];
      break;
    case 'date':
    case 'datetime':
      if (typeof v !== 'string' || Number.isNaN(Date.parse(v))) return [err('type', def.kind === 'date' ? 'Expected a date' : 'Expected a date and time')];
      break;
    case 'time':
      if (typeof v !== 'string' || !TIME.test(v)) return [err('type', 'Expected a time (HH:mm)')];
      break;
    case 'enum':
    case 'multiEnum':
      if (typeof v !== 'string' && typeof v !== 'number') return [err('type', 'Expected one of the options')];
      break;
  }
  if (def.options && !def.allowCustom && !def.search) {
    if (!flattenOptions(def.options, def.leafOnly).some((o) => o.value === v)) out.push(err('option', 'Not one of the allowed values'));
  }
  if (def.validate && !out.length) {
    const msg = def.validate(v);
    if (msg) out.push(err('custom', msg));
  }
  return out;
}

function validateCall(fields: Fields, call: FnCall, expectKind?: string): Issue[] {
  if (!isWellFormedCall(call)) return [issue(fields, 'shape', 'Malformed function call')];
  const def = functionOf(fields, call);
  if (!def) return [issue(fields, 'function', `Unknown function "${call.fn}"`)];
  if (expectKind && def.returns.kind !== expectKind) return [issue(fields, 'function', `${def.label ?? call.fn} returns ${def.returns.kind}, expected ${expectKind}`)];
  const out: Issue[] = [];
  for (const [name, argDef] of Object.entries(def.args)) {
    const a = call.args[name];
    if (a === undefined) {
      if (argDef.required) out.push(issue(fields, 'function', `${def.label ?? call.fn}: "${name}" is required`));
    } else out.push(...validateOperand(fields, a, argDef));
  }
  return out;
}

function validateOperand(fields: Fields, operand: Operand, def: AnyFieldDef): Issue[] {
  if (typeof operand !== 'object' || operand === null || Array.isArray(operand)) return [issue(fields, 'shape', 'Malformed function argument')];
  if (isFnCall(operand)) return validateCall(fields, operand, def.kind);
  if ('ref' in operand) {
    const target = typeof operand.ref === 'string' ? fieldDef(fields, operand.ref) : undefined;
    if (!target) return [issue(fields, 'ref', `Unknown field "${operand.ref}"`)];
    return target.kind === def.kind ? [] : [issue(fields, 'ref', 'Can only use fields of the same type')];
  }
  if (!('value' in operand)) return [issue(fields, 'shape', 'Malformed function argument')];
  return checkScalar(fields, def, operand.value, false);
}

/** What JSON can carry in a value slot: the codecs only ever emit these. */
const isPlain = (v: unknown) => v === null || v === undefined || typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean';

/**
 * Shape checks for an untrusted rule (query JSON from a request): the right kinds of things in the
 * right places, before any schema lookups.
 */
function ruleShape(fields: Fields, rule: Rule, def: AnyFieldDef | undefined): Issue[] {
  const bad = (message: string) => [issue(fields, 'shape', message)];
  if (typeof rule !== 'object' || rule === null || rule.kind !== 'rule') return bad('Malformed rule');
  if (typeof rule.operator !== 'string') return bad('Malformed operator');
  if (typeof rule.field !== 'string' && !isWellFormedCall(rule.field)) return bad('Malformed field');
  const sources = (rule.ref !== undefined ? 1 : 0) + (rule.call !== undefined ? 1 : 0) + (rule.value !== undefined && rule.value !== null ? 1 : 0);
  if (sources > 1) return bad('A rule compares against one value, field or function');
  if (rule.ref !== undefined && typeof rule.ref !== 'string') return bad('Malformed field reference');
  if (rule.call !== undefined && !isWellFormedCall(rule.call)) return bad('Malformed function call');
  // Custom field kinds may hold structured values; built-in kinds only hold JSON scalars (or lists of them).
  const builtin = !def || ['text', 'number', 'boolean', 'date', 'time', 'datetime', 'enum', 'multiEnum', 'array'].includes(def.kind);
  const v = rule.value;
  if (builtin && !isPlain(v) && !(Array.isArray(v) && v.every(isPlain))) return bad('Malformed value');
  return [];
}

/** Problems with one rule, in schema order. An empty array means the rule is valid. */
export function validateRule(fields: Fields, rule: Rule): Issue[] {
  const shape = ruleShape(fields, rule, typeof rule?.field === 'string' ? fieldDef(fields, rule.field) : undefined);
  if (shape.length) return shape;
  const fnIssues = isFnCall(rule.field) ? validateCall(fields, rule.field) : [];
  if (fnIssues.length) return fnIssues;
  const def = leftDef(fields, rule.field);
  if (!def) return [issue(fields, 'unknownField', `Unknown field "${String(rule.field)}"`)];
  const info = operatorInfo(fields, rule.operator);
  if (!info) return [issue(fields, 'unknownOperator', `Unknown operator "${String(rule.operator)}"`)];
  if (!def.operators.includes(rule.operator)) return [issue(fields, 'operatorNotAllowed', `"${info.label}" is not allowed for this field`)];

  if (rule.ref !== undefined) {
    const target = fieldDef(fields, rule.ref);
    if (!info.comparable) return [issue(fields, 'ref', 'This operator cannot compare fields')];
    if (!target || target.comparable === false) return [issue(fields, 'ref', `Unknown field "${rule.ref}"`)];
    if (target.kind !== def.kind) return [issue(fields, 'ref', 'Can only compare fields of the same type')];
    return [];
  }
  if (rule.call !== undefined) {
    if (!info.comparable) return [issue(fields, 'function', 'This operator cannot compare against a function')];
    return validateCall(fields, rule.call, def.kind);
  }

  const v = rule.value;
  // Multi-value fields compare element-wise against their options.
  const elementDef = def.kind === 'multiEnum' ? def : def;
  switch (info.arity) {
    case 'none':
      return [];
    case 'one':
      return checkScalar(fields, elementDef, v, info.textMatch);
    case 'two': {
      if (!Array.isArray(v) || v.length !== 2) return [issue(fields, 'type', 'Expected two values')];
      const issues = [...checkScalar(fields, def, v[0], false, 0), ...checkScalar(fields, def, v[1], false, 1)];
      if (!issues.length && v[0] > v[1]) issues.push(issue(fields, 'range', 'The first value must not exceed the second'));
      return issues;
    }
    case 'many': {
      if (!Array.isArray(v)) return [issue(fields, 'type', 'Expected a list of values')];
      if (!v.length) return def.required ? [issue(fields, 'required', 'Pick at least one value')] : [];
      return v.flatMap((x, i) => checkScalar(fields, elementDef, x, false, i));
    }
  }
}

const COUNT_OPS = new Set(['eq', 'neq', 'lt', 'lte', 'gt', 'gte', 'between']);

export function validateGroup(fields: Fields, group: Group): Issue[] {
  const out: Issue[] = [];
  const bad = (message: string) => [issue(fields, 'shape', message)];
  if (typeof group !== 'object' || group === null || group.kind !== 'group' || !Array.isArray(group.children)) return bad('Malformed group');
  if (group.combinator !== 'and' && group.combinator !== 'or') return bad('A group combines with "and" or "or"');
  if (group.not !== undefined && typeof group.not !== 'boolean') return bad('Malformed NOT flag');
  if (group.of !== undefined) {
    const of = group.of as { field?: unknown; match?: unknown };
    if (typeof of !== 'object' || of === null || typeof of.field !== 'string') return bad('Malformed list condition');
    const def = fieldDef(fields, of.field);
    if (!def?.of) out.push(issue(fields, 'arrayField', `"${of.field}" is not a list field`));
    const m = of.match as { count?: unknown; value?: unknown } | string;
    if (typeof m === 'string') {
      if (m !== 'some' && m !== 'all' && m !== 'none') return bad('Malformed list quantifier');
    } else if (typeof m !== 'object' || m === null || typeof m.count !== 'string' || !COUNT_OPS.has(m.count)) {
      return bad('Malformed list quantifier');
    } else {
      const count = (n: unknown) => typeof n === 'number' && Number.isInteger(n) && n >= 0;
      const ok = m.count === 'between' ? Array.isArray(m.value) && m.value.length === 2 && m.value.every(count) : count(m.value);
      if (!ok) out.push(issue(fields, 'type', 'The count must be a whole number'));
    }
  }
  if (!group.children.length) out.push(issue(fields, 'emptyGroup', 'This group is empty', undefined, 'warning'));
  return out;
}

/** The schema that applies inside a group: the element schema for array groups, else unchanged. */
export const groupScope = (fields: Fields, group: Group): Fields => (group.of && fieldDef(fields, group.of.field)?.of ? elementFields(fields, group.of.field) : fields);

/** Every issue in a query, with the path to the node it belongs to. */
export function validateQuery(fields: Fields, query: Query): PathIssue[] {
  const out: PathIssue[] = [];
  const walk = (node: QueryNode, path: number[], scope: Fields) => {
    const issues = typeof node === 'object' && node !== null && node.kind === 'rule' ? validateRule(scope, node) : validateGroup(scope, node as Group);
    for (const i of issues) out.push({ ...i, path });
    if (typeof node === 'object' && node !== null && node.kind === 'group' && Array.isArray(node.children)) {
      const inner = groupScope(scope, node);
      node.children.forEach((c, i) => walk(c, [...path, i], inner));
    }
  };
  walk(query, [], fields);
  return out;
}

/** Narrows a draft query to `StrictQueryOf<F>` when it has no errors (warnings are allowed). */
export function isValidQuery<F extends Fields>(fields: F, query: QueryOf<F>): query is QueryOf<F> & StrictQueryOf<F> {
  return !validateQuery(fields, query as Query).some((i) => i.severity === 'error');
}

export function assertValidQuery<F extends Fields>(fields: F, query: QueryOf<F>): asserts query is QueryOf<F> & StrictQueryOf<F> {
  const errors = validateQuery(fields, query as Query).filter((i) => i.severity === 'error');
  if (errors.length) {
    throw new Error(`qnot: invalid query:\n${errors.map((e) => `  at [${e.path.join(', ')}] ${e.message}`).join('\n')}`);
  }
}
