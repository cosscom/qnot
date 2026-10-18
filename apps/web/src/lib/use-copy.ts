'use client';
import { useEffect, useState } from 'react';

/** Copy text to the clipboard; `copied` stays true for a moment after. */
export function useCopy(timeout = 1600) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), timeout);
    return () => clearTimeout(t);
  }, [copied, timeout]);
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      // Clipboard access can be refused; the text stays selectable.
    }
  };
  return { copied, copy };
}
