import { fieldDef, withRegistry, type AnyFieldDef, type Fields } from './fields';
import { functionOf, isFnCall, type FnCall } from './functions';
import type { Rule } from './types';

/** The element schema of an array field, sharing the parent's custom operators and functions. */
export function elementFields(fields: Fields, arrayField: string): Fields {
  const of = fieldDef(fields, arrayField)?.of;
  if (!of) throw new Error(`qnot: "${arrayField}" is not an array field`);
  return withRegistry(of, fields);
}

/** The schema governing a rule's left side: the field's def, or a function's return def. */
export function leftDef(fields: Fields, field: string | FnCall): AnyFieldDef | undefined {
  return isFnCall(field) ? functionOf(fields, field)?.returns : fieldDef(fields, field);
}

export const ruleDef = (fields: Fields, rule: Pick<Rule, 'field'>): AnyFieldDef | undefined => leftDef(fields, rule.field);
