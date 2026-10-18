import type { Codec, CodecContext } from '../codec';
import { fieldLabel, flattenOptions, type AnyFieldDef, type Fields } from '../fields';
import type { Group, Quantifier, Rule } from '../types';
import { encodeCall, encodeIn, groupScope, infoOf, isArrayGroupIn, isCompleteRule, isFnCall, ruleDef, type Operand } from './_util';

export interface TextOptions {
  /** Use field/option labels (default) or raw keys and values. */
  labels?: boolean;
  /** Words for AND / OR / NOT (default `AND`, `OR`, `NOT`). */
  words?: { and?: string; or?: string; not?: string };
}

export interface TextFragment {
  readonly text: string;
  readonly compound: boolean;
}

const SYMBOLS: Record<string, string> = { eq: '=', neq: '≠', lt: '<', lte: '≤', gt: '>', gte: '≥' };
const COUNT_WORDS: Record<string, string> = { eq: 'exactly', neq: 'not exactly', lt: 'fewer than', lte: 'at most', gt: 'more than', gte: 'at least' };

/** Read-only, human-readable summaries like `Age ≥ 21 AND (Plan is any of Pro, Team)`. */
export function textFormat(options: TextOptions = {}): Codec<string, TextFragment> {
  const labels = options.labels ?? true;
  const AND = options.words?.and ?? 'AND';
  const OR = options.words?.or ?? 'OR';
  const NOT = options.words?.not ?? 'NOT';

  const label = (fields: Fields, name: string) => (labels ? fieldLabel(name, fields[name]) : name);

  function scalar(def: AnyFieldDef | undefined, v: unknown): string {
    if (v === null || v === undefined) return 'empty';
    if (labels && def?.options) {
      const opt = flattenOptions(def.options).find((o) => o.value === v);
      if (opt) return opt.label;
    }
    if (typeof v === 'string') return labels && def?.kind !== 'text' ? v : `"${v.replace(/"/g, '\\"')}"`;
    return String(v);
  }

  const operand = (fields: Fields) =>
    function arg(o: Operand, def?: AnyFieldDef): string | undefined {
      if (isFnCall(o)) return encodeCall('text', fields, o, arg) ?? `${o.fn}(${Object.values(o.args).map((a) => arg(a) ?? '?').join(', ')})`;
      return 'ref' in o ? label(fields, o.ref) : scalar(def, o.value);
    };

  function encodeRule(rule: Rule, { fields }: CodecContext): TextFragment | undefined {
    if (!isCompleteRule(fields, rule)) return undefined;
    const def = ruleDef(fields, rule);
    const arg = operand(fields);
    const left = isFnCall(rule.field) ? arg(rule.field) : label(fields, rule.field);
    const info = infoOf(fields, rule.operator);
    const v = rule.value;
    const custom = info.formats?.text;
    if (custom) return { text: String(custom({ field: left, value: v, raw: v })), compound: false };
    const op = labels && SYMBOLS[rule.operator] ? SYMBOLS[rule.operator] : labels ? info.label : rule.operator;
    let rhs: string | undefined;
    if (rule.ref !== undefined) rhs = label(fields, rule.ref);
    else if (rule.call !== undefined) rhs = arg(rule.call);
    else if (info.arity === 'two') rhs = (v as unknown[]).map((x) => scalar(def, x)).join(' and ');
    else if (info.arity === 'many') rhs = (v as unknown[]).map((x) => scalar(def, x)).join(', ');
    else if (info.arity === 'one') rhs = info.textMatch ? `"${String(v).replace(/"/g, '\\"')}"` : scalar(def, v);
    return { text: rhs === undefined ? `${left} ${op}` : `${left} ${op} ${rhs}`, compound: false };
  }

  const join = (g: Pick<Group, 'combinator'>, children: TextFragment[]): TextFragment | undefined => {
    if (!children.length) return undefined;
    if (children.length === 1) return children[0];
    return { text: children.map((c) => (c.compound ? `(${c.text})` : c.text)).join(g.combinator === 'and' ? ` ${AND} ` : ` ${OR} `), compound: true };
  };

  function quantifier(m: Quantifier): string {
    if (m === 'some') return 'any';
    if (m === 'all') return 'all';
    if (m === 'none') return 'no';
    return m.count === 'between' ? `between ${m.value[0]} and ${m.value[1]}` : `${COUNT_WORDS[m.count]} ${m.value}`;
  }

  function encodeGroup(g: Group, children: TextFragment[], ctx: CodecContext): TextFragment | undefined {
    let out: TextFragment | undefined;
    if (g.of) {
      if (!isArrayGroupIn(ctx.fields, g)) return undefined;
      const inner = join(g, encodeIn(codec, g.children, { fields: groupScope(ctx.fields, g) }));
      out = { text: `${quantifier(g.of.match)} ${label(ctx.fields, g.of.field)} match (${inner?.text ?? 'anything'})`, compound: false };
    } else out = join(g, children);
    if (!out) return undefined;
    return g.not ? { text: `${NOT} (${out.text})`, compound: false } : out;
  }

  const codec: Codec<string, TextFragment> = {
    name: 'text',
    encodeRule,
    encodeGroup,
    finish: (root) => root?.text ?? '',
    encodeCases: (whens, otherwise) =>
      [
        ...whens.map(({ when, then }, i) => `${i ? 'else if' : 'If'} ${when?.text ?? 'always'} then ${String(then)}`),
        ...(otherwise === undefined ? [] : [`otherwise ${String(otherwise)}`]),
      ].join('; '),
  };
  return codec;
}

/** Human-readable text with labels. */
export const text = textFormat();
