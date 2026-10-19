import { decode, encode, type Codec, type Fields, type Query, type QueryOf } from '@trawlnet/core';
import { useQuery, useStore } from '@trawlnet/react';
import { CheckIcon, CircleAlertIcon, CopyIcon, DownloadIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { ScrollBox } from '@/components/trawlnet/scroll-box';
import { Tip } from '@/components/trawlnet/tip';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

export interface FormatEntry {
  id: string;
  label: string;
  codec: Codec<any>;
}

function render(out: unknown): string {
  if (typeof out === 'string') return out;
  if (out && typeof out === 'object' && 'sql' in out && 'params' in out) {
    const { sql, params } = out as { sql: string; params: unknown };
    return `${sql}\n\n-- params\n${JSON.stringify(params, null, 2)}`;
  }
  return JSON.stringify(out, null, 2);
}

/** Live export to every format in `formats`; each codec is tried on its own and failures show inline. */
export function FormatsPanel({ formats }: { formats: readonly FormatEntry[] }) {
  const store = useStore();
  const query = useQuery();
  const [id, setId] = useState(formats.find((f) => f.id === 'sql') ? 'sql' : 'native');
  const [copied, setCopied] = useState(false);
  const [draft, setDraft] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const format = formats.find((f) => f.id === id) ?? formats[0]!;

  // Each codec is tried on its own: one that can't express a feature shows its error inline.
  const { text, error, ms } = useMemo(() => {
    const t0 = performance.now();
    try {
      const out = encode(format.codec, query as Query, store.fields);
      return { text: render(out), error: null, ms: performance.now() - t0 };
    } catch (e) {
      return { text: '', error: (e as Error).message, ms: 0 };
    }
  }, [format, query, store]);

  const isText = typeof text === 'string' && !text.startsWith('{') && !text.startsWith('[');
  const importDraft = () => {
    try {
      // Pasted input is untyped by nature; the store validates it per node (see issues/isValid).
      store.setQuery(decode(format.codec, isText ? draft : JSON.parse(draft), store.fields) as unknown as QueryOf<Fields>);
      setImportError(null);
      setDraft('');
    } catch (e) {
      setImportError((e as Error).message);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <ToggleGroup size="sm" variant="outline" className="flex-wrap" value={[format.id]} onValueChange={(v) => v[0] && setId(v[0] as string)}>
        {formats.map((f) => (
          <ToggleGroupItem key={f.id} value={f.id} data-format={f.id}>
            {f.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <div className="flex items-center gap-2 text-xs">
        <Badge variant="outline">{format.codec.decode ? 'two-way' : 'export only'}</Badge>
        {!error && <span className="text-muted-foreground">encoded in {ms.toFixed(3)} ms (memoized per node)</span>}
        <Tip label={copied ? 'Copied' : 'Copy to clipboard'}>
          <Button
            size="icon-sm"
            variant="ghost"
            className="ms-auto"
            aria-label="Copy"
            disabled={!!error}
            onClick={() => {
              void navigator.clipboard?.writeText(text);
              setCopied(true);
              setTimeout(() => setCopied(false), 1200);
            }}
          >
            {copied ? <CheckIcon /> : <CopyIcon />}
          </Button>
        </Tip>
      </div>
      {error ? (
        <div className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/8 p-3 text-sm" data-format-error>
          <CircleAlertIcon className="mt-0.5 size-4 shrink-0 text-warning-foreground" />
          <div>
            <div className="font-medium">{format.label} can't express this query</div>
            <div className="text-muted-foreground text-xs">{error}</div>
          </div>
        </div>
      ) : (
        <ScrollBox className="rounded-lg border bg-muted/50" viewportClassName="max-h-[50vh]">
          <pre className="whitespace-pre-wrap break-words p-3 font-mono text-xs" data-format-output>
            {text}
          </pre>
        </ScrollBox>
      )}
      {format.codec.decode && (
        <div className="flex flex-col gap-2">
          <Textarea className="font-mono text-xs" rows={3} placeholder={`Paste ${format.label} to load it into the builder`} value={draft} onChange={(e) => setDraft(e.target.value)} />
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" disabled={!draft.trim()} onClick={importDraft}>
              <DownloadIcon /> Import {format.label}
            </Button>
            {importError && <span className="text-destructive-foreground text-xs">{importError}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
