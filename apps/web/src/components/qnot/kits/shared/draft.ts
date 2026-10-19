// Part of qnot (https://github.com/cosscom/qnot). MIT licensed; installable with shadcn.
// Text-backed numeric input state: keeps what the user is typing ("1.", "-") while committing parsed
// numbers, and follows external value changes (undo, controlled updates). MIT licensed.
import { useState } from 'react';

const format = (v: number | null) => (v === null || Number.isNaN(v) ? '' : String(v));
const parse = (raw: string): number | null => {
  if (raw.trim() === '') return null;
  const n = Number(raw);
  return Number.isNaN(n) ? null : n;
};

export function useNumberDraft(value: number | null, onChange: (v: number | null) => void) {
  const [draft, setDraft] = useState(() => format(value));
  const [prev, setPrev] = useState(value);
  if (prev !== value) {
    setPrev(value);
    if (parse(draft) !== value) setDraft(format(value));
  }
  return {
    draft,
    onDraftChange(raw: string) {
      setDraft(raw);
      onChange(parse(raw));
    },
  };
}
