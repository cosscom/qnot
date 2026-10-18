import { decode, encode, native, type Codec, type Query } from '@trawlnet/core';
import { jqqb } from '@trawlnet/core/formats/jqqb';
import { jsonlogic } from '@trawlnet/core/formats/jsonlogic';
import { mongo } from '@trawlnet/core/formats/mongo';
import { raqb } from '@trawlnet/core/formats/raqb';
import { rqb } from '@trawlnet/core/formats/rqb';
import { sqlFormat } from '@trawlnet/core/formats/sql';
import { useQuery, useStore } from '@trawlnet/react';
import { CheckIcon, CopyIcon, DownloadIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Tip } from '@/components/tip';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

const postgres = sqlFormat({ dialect: 'postgres' });
const postgresParams = sqlFormat({ dialect: 'postgres', params: 'numbered' });

const FORMATS: { id: string; label: string; codec: Codec<any>; text?: boolean }[] = [
  { id: 'native', label: 'trawlnet', codec: native },
  { id: 'sql', label: 'SQL', codec: postgres, text: true },
  { id: 'sqlp', label: 'SQL + params', codec: postgresParams },
  { id: 'mongo', label: 'MongoDB', codec: mongo },
  { id: 'jsonlogic', label: 'JsonLogic', codec: jsonlogic },
  { id: 'rqb', label: 'react-querybuilder', codec: rqb },
  { id: 'raqb', label: 'RAQB', codec: raqb },
  { id: 'jqqb', label: 'jQuery QB', codec: jqqb },
];

export function FormatsPanel() {
  const store = useStore();
  const query = useQuery();
  const [id, setId] = useState('sql');
  const [copied, setCopied] = useState(false);
  const [draft, setDraft] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const format = FORMATS.find((f) => f.id === id)!;

  const { text, ms } = useMemo(() => {
    const t0 = performance.now();
    const out = encode(format.codec, query as Query, store.fields);
    const ms = performance.now() - t0;
    return { text: format.text ? String(out) : JSON.stringify(out, null, 2), ms };
  }, [format, query, store]);

  const importDraft = () => {
    try {
      store.setQuery(decode(format.codec, format.text ? draft : JSON.parse(draft), store.fields) as never);
      setImportError(null);
      setDraft('');
    } catch (e) {
      setImportError((e as Error).message);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <ToggleGroup size="sm" variant="outline" className="flex-wrap" value={[id]} onValueChange={(v) => v[0] && setId(v[0] as string)}>
        {FORMATS.map((f) => (
          <ToggleGroupItem key={f.id} value={f.id}>
            {f.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <div className="flex items-center gap-2 text-xs">
        <Badge variant="outline">{format.codec.decode ? 'two-way' : 'export only'}</Badge>
        <span className="text-muted-foreground">encoded in {ms.toFixed(3)} ms (memoized per node: only edited branches re-encode)</span>
        <Tip label={copied ? 'Copied' : 'Copy to clipboard'}>
        <Button
          size="icon-sm"
          variant="ghost"
          className="ms-auto"
          aria-label="Copy"
          onClick={() => {
            void navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
          }}
        >
          {copied ? <CheckIcon /> : <CopyIcon />}
        </Button>
        </Tip>
      </div>
      <pre className="max-h-[50vh] overflow-auto whitespace-pre-wrap break-words rounded-lg border bg-muted/50 p-3 font-mono text-xs">{text}</pre>
      {format.codec.decode && (
        <div className="flex flex-col gap-2">
          <Textarea
            className="font-mono text-xs"
            rows={4}
            placeholder={`Paste ${format.label} ${format.text ? 'text' : 'JSON'} to load it into the builder`}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
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
