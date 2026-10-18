import { flattenOptions, registryOf, type AnyFieldDef, type Fields } from './fields';
import { functionOf, isFnCall, type FnCall, type Operand } from './functions';
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
  if (isFnCall(operand)) return validateCall(fields, operand, def.kind);
  if ('ref' in operand) {
    const target = fields[operand.ref];
    if (!target) return [issue(fields, 'ref', `Unknown field "${operand.ref}"`)];
    return target.kind === def.kind ? [] : [issue(fields, 'ref', 'Can only use fields of the same type')];
  }
  return checkScalar(fields, def, operand.value, false);
}

/** Problems with one rule, in schema order. An empty array means the rule is valid. */
export function validateRule(fields: Fields, rule: Rule): Issue[] {
  const fnIssues = isFnCall(rule.field) ? validateCall(fields, rule.field) : [];
  if (fnIssues.length) return fnIssues;
  const def = leftDef(fields, rule.field);
  if (!def) return [issue(fields, 'unknownField', `Unknown field "${String(rule.field)}"`)];
  const info = operatorInfo(fields, rule.operator);
  if (!info) return [issue(fields, 'unknownOperator', `Unknown operator "${String(rule.operator)}"`)];
  if (!def.operators.includes(rule.operator)) return [issue(fields, 'operatorNotAllowed', `"${info.label}" is not allowed for this field`)];

  if (rule.ref !== undefined) {
    const target = fields[rule.ref];
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

export function validateGroup(fields: Fields, group: Group): Issue[] {
  const out: Issue[] = [];
  if (group.of) {
    const def = fields[group.of.field];
    if (!def?.of) out.push(issue(fields, 'arrayField', `"${group.of.field}" is not a list field`));
    const m = group.of.match;
    if (typeof m === 'object') {
      const bad = Array.isArray(m.value) ? m.value.some((n) => typeof n !== 'number') : typeof m.value !== 'number';
      if (bad) out.push(issue(fields, 'type', 'The count must be a number'));
    }
  }
  if (!group.children.length) out.push(issue(fields, 'emptyGroup', 'This group is empty', undefined, 'warning'));
  return out;
}

/** The schema that applies inside a group: the element schema for array groups, else unchanged. */
export const groupScope = (fields: Fields, group: Group): Fields => (group.of && fields[group.of.field]?.of ? elementFields(fields, group.of.field) : fields);

/** Every issue in a query, with the path to the node it belongs to. */
export function validateQuery(fields: Fields, query: Query): PathIssue[] {
  const out: PathIssue[] = [];
  const walk = (node: QueryNode, path: number[], scope: Fields) => {
    const issues = node.kind === 'rule' ? validateRule(scope, node) : validateGroup(scope, node);
    for (const i of issues) out.push({ ...i, path });
    if (node.kind === 'group') {
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
    throw new Error(`trawlnet: invalid query:\n${errors.map((e) => `  at [${e.path.join(', ')}] ${e.message}`).join('\n')}`);
  }
}
