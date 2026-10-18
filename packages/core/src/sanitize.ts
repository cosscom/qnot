import { flattenOptions, type Fields } from './fields';
import { operatorInfo } from './operators';
import { leftDef } from './scope';
import type { Group, Query, QueryNode, QueryOf } from './types';
import { groupScope, validateRule } from './validate';

export interface SanitizeOptions {
  /**
   * Drop rules whose only problem is a missing value (RAQB removeIncompleteRulesOnLoad). Rules with
   * a present-but-invalid value are kept, so validation can reject them instead of silently
   * widening the query.
   */
  removeIncompleteRules?: boolean;
  /** Drop every rule with an error, including present-but-invalid values. Avoid on servers. */
  removeInvalidRules?: boolean;
  /** Drop groups left without children, except the root (RAQB removeEmptyGroupsOnLoad). */
  removeEmptyGroups?: boolean;
  /** Drop list values that aren't in the field's options (RAQB removeInvalidMultiSelectValuesOnLoad). */
  removeInvalidListValues?: boolean;
  /** Drop rules on fields or operators the schema doesn't know, e.g. after a schema change (default false). */
  removeUnknown?: boolean;
}

/** Clean a query loaded from storage. Returns the input unchanged (same object) when nothing needed fixing. */
export function sanitizeQuery<F extends Fields>(fields: F, query: QueryOf<F>, options: SanitizeOptions = {}): QueryOf<F> {
  const opts = options;
  const fixNode = (node: QueryNode, scope: Fields, isRoot: boolean): QueryNode | null => {
    if (node.kind === 'group') {
      const inner = groupScope(scope, node);
      let changed = false;
      const children: QueryNode[] = [];
      for (const c of node.children) {
        const fixed = fixNode(c, inner, false);
        if (fixed !== c) changed = true;
        if (fixed) children.push(fixed);
      }
      if (!isRoot && opts.removeEmptyGroups && !children.length) return null;
      return changed ? ({ ...node, children } as Group) : node;
    }
    const def = leftDef(scope, node.field);
    if (opts.removeUnknown && (!def || !operatorInfo(scope, node.operator))) return null;
    let rule = node;
    if (opts.removeInvalidListValues && def?.options && Array.isArray(rule.value)) {
      const allowed = new Set(flattenOptions(def.options).map((o) => o.value));
      const kept = rule.value.filter((v) => allowed.has(v));
      if (kept.length !== rule.value.length) rule = { ...rule, value: kept };
    }
    if (opts.removeIncompleteRules || opts.removeInvalidRules) {
      const errors = validateRule(scope, rule).filter((i) => i.severity === 'error');
      if (errors.length && (opts.removeInvalidRules || errors.every((i) => i.code === 'required'))) return null;
    }
    return rule;
  };
  return (fixNode(query as Query, fields, true) ?? query) as QueryOf<F>;
}
