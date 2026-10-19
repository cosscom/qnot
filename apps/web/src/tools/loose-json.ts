// A forgiving reader for pasted JSON: what people copy out of a Mongo shell, a JS file or a log line.
// Accepts strict JSON plus unquoted keys, single quotes, trailing commas, comments, regex literals,
// ISODate()/new Date()/ObjectId()/NumberInt()… wrappers and a surrounding `db.coll.find(…)`.

export class LooseJsonError extends Error {}

const WRAPPER = /^\s*(?:db\.[\w$.]+?\.)?(?:find|findOne|countDocuments|count|deleteMany|deleteOne|updateMany|updateOne|aggregate)\s*\(/;
const STRING_CALLS = new Set(['ISODate', 'Date', 'ObjectId', 'UUID', 'Timestamp']);
const NUMBER_CALLS = new Set(['NumberInt', 'NumberLong', 'NumberDecimal', 'NumberDouble', 'Int32', 'Long', 'Decimal128', 'Double']);

export function parseLooseJson(src: string): unknown {
  try {
    return JSON.parse(src);
  } catch {
    // fall through to the forgiving reader
  }
  let s = src;
  const wrapped = WRAPPER.exec(s);
  if (wrapped) s = s.slice(wrapped[0].length);
  let i = 0;

  const fail = (msg: string): never => {
    const line = src.slice(0, src.length - s.length + i).split('\n').length;
    throw new LooseJsonError(`${msg} (line ${line})`);
  };
  const ws = () => {
    for (;;) {
      const c = s[i];
      if (c === ' ' || c === '\n' || c === '\r' || c === '\t') i++;
      else if (c === '/' && s[i + 1] === '/') while (i < s.length && s[i] !== '\n') i++;
      else if (c === '/' && s[i + 1] === '*') {
        const end = s.indexOf('*/', i + 2);
        i = end < 0 ? s.length : end + 2;
      } else return;
    }
  };
  const ident = () => {
    const m = /^[A-Za-z_$][\w$]*/.exec(s.slice(i, i + 256));
    if (!m) return undefined;
    i += m[0].length;
    return m[0];
  };
  const str = (): string => {
    const q = s[i++];
    let out = '';
    while (i < s.length && s[i] !== q) {
      if (s[i] === '\\') {
        const e = s[i + 1];
        i += 2;
        if (e === 'n') out += '\n';
        else if (e === 't') out += '\t';
        else if (e === 'r') out += '\r';
        else if (e === 'b') out += '\b';
        else if (e === 'f') out += '\f';
        else if (e === 'u') {
          out += String.fromCharCode(parseInt(s.slice(i, i + 4), 16));
          i += 4;
        } else out += e ?? '';
      } else out += s[i++];
    }
    if (s[i] !== q) fail('Unterminated string');
    i++;
    return out;
  };
  const num = () => {
    const m = /^[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/.exec(s.slice(i, i + 64));
    if (!m) return fail(`Unexpected "${s[i] ?? 'end of input'}"`);
    i += m[0].length;
    return Number(m[0]);
  };
  const regex = () => {
    i++;
    let body = '';
    let inClass = false;
    while (i < s.length && (s[i] !== '/' || inClass)) {
      if (s[i] === '\\') body += s[i++];
      else if (s[i] === '[') inClass = true;
      else if (s[i] === ']') inClass = false;
      body += s[i++] ?? '';
    }
    if (s[i] !== '/') fail('Unterminated regular expression');
    i++;
    const flags = /^[a-z]*/.exec(s.slice(i))![0];
    i += flags.length;
    try {
      return new RegExp(body, flags);
    } catch (e) {
      return fail(`Invalid regular expression: ${(e as Error).message}`);
    }
  };
  let depth = 0;
  const value = (): unknown => {
    ws();
    const c = s[i];
    if (c === undefined) return fail('Unexpected end of input');
    if (c === '{' || c === '[') {
      if (++depth > 200) fail('Nesting too deep');
      i++;
      const close = c === '{' ? '}' : ']';
      const obj: Record<string, unknown> = {};
      const arr: unknown[] = [];
      for (;;) {
        ws();
        if (s[i] === close) break;
        if (c === '{') {
          const k = s[i] === '"' || s[i] === "'" ? str() : (ident() ?? (/[\d-]/.test(s[i] ?? '') ? String(num()) : fail(`Expected a key, found "${s[i] ?? 'end of input'}"`)));
          ws();
          if (s[i] !== ':') fail(`Expected ":" after "${k}"`);
          i++;
          Object.defineProperty(obj, k, { value: value(), enumerable: true, writable: true, configurable: true });
        } else arr.push(value());
        ws();
        if (s[i] === ',') i++;
        else if (s[i] !== close) fail(`Expected "," or "${close}"`);
      }
      i++;
      depth--;
      return c === '{' ? obj : arr;
    }
    if (c === '"' || c === "'") return str();
    if (c === '/') return regex();
    if (c === '-' || c === '+' || c === '.' || (c >= '0' && c <= '9')) return num();
    const word = ident();
    if (word === undefined) return fail(`Unexpected "${c}"`);
    if (word === 'true') return true;
    if (word === 'false') return false;
    if (word === 'null' || word === 'undefined') return null;
    if (word === 'new') {
      ws();
      return value();
    }
    ws();
    if (s[i] === '(' && (STRING_CALLS.has(word) || NUMBER_CALLS.has(word))) {
      i++;
      ws();
      const arg = s[i] === ')' ? (word === 'Date' || word === 'ISODate' ? new Date().toISOString() : '') : value();
      ws();
      if (s[i] !== ')') fail(`Expected ")" after ${word}(`);
      i++;
      // Dates stay ISO strings, as the mongo codec writes them.
      return NUMBER_CALLS.has(word) ? Number(arg) : arg;
    }
    return fail(`Unexpected "${word}"`);
  };

  const out = value();
  ws();
  if (wrapped) {
    // `find(filter, projection)`: the filter is all we need.
    if (s[i] !== ',' && s[i] !== ')') fail('Expected ")"');
  } else {
    if (s[i] === ';') i++;
    ws();
    if (i < s.length) fail(`Unexpected "${s[i]}" after the end of the value`);
  }
  return out;
}

const toJson = (v: unknown): unknown => (v instanceof RegExp ? (v.flags ? { $regex: v.source, $options: v.flags } : { $regex: v.source }) : v);

/** One line with spaces, as a reader would type it: `{ "$gte": 21, "$lte": 65 }`. */
function inline(v: unknown): string {
  const x = toJson(v);
  if (Array.isArray(x)) return x.length ? `[${x.map(inline).join(', ')}]` : '[]';
  if (x && typeof x === 'object') {
    const entries = Object.entries(x).filter(([, val]) => val !== undefined);
    return entries.length ? `{ ${entries.map(([k, val]) => `${JSON.stringify(k)}: ${inline(val)}`).join(', ')} }` : '{}';
  }
  return JSON.stringify(x) ?? 'null';
}

/**
 * JSON for display, printed like Prettier does: a value that fits on the line stays on one line,
 * anything longer breaks one entry per line. Regular expressions show as Mongo's `{ $regex, $options }`.
 */
export function stringify(value: unknown, indent = '', offset = 0, width = 80): string {
  const flat = inline(value);
  const x = toJson(value);
  if (indent.length + offset + flat.length <= width || !x || typeof x !== 'object') return flat;
  const inner = `${indent}  `;
  if (Array.isArray(x)) return `[\n${x.map((item) => inner + stringify(item, inner, 0, width)).join(',\n')}\n${indent}]`;
  const entries = Object.entries(x).filter(([, val]) => val !== undefined);
  return `{\n${entries.map(([k, val]) => `${inner}${JSON.stringify(k)}: ${stringify(val, inner, JSON.stringify(k).length + 2, width)}`).join(',\n')}\n${indent}}`;
}
