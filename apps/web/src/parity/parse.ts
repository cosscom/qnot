// Parses docs/raqb-parity.md: `## Section` headings, pipe tables (RAQB | trawlnet | Status) and
// plain paragraphs.

export type Status = 'done' | 'progress' | 'different';

export interface ParityRow {
  raqb: string;
  trawlnet: string;
  status: Status;
  /** The raw status cell (may carry a reason for ⏭ rows). */
  statusText: string;
}

export interface ParitySection {
  title: string;
  rows: ParityRow[];
  paragraphs: string[];
}

export interface ParityDoc {
  title: string;
  intro: string[];
  sections: ParitySection[];
}

const statusOf = (cell: string): Status => (cell.includes('✅') ? 'done' : cell.includes('⏭') ? 'different' : 'progress');

// Split on unescaped pipes only: cells may contain `a \| b` (escaped for markdown tables).
const cells = (line: string) =>
  line
    .trim()
    .replace(/^\||\|$/g, '')
    .split(/(?<!\\)\|/)
    .map((c) => c.trim().replace(/\\\|/g, '|'));

export function parseParity(markdown: string): ParityDoc {
  const doc: ParityDoc = { title: '', intro: [], sections: [] };
  let section: ParitySection | null = null;
  let headerSeen = false;
  for (const raw of markdown.split('\n')) {
    const line = raw.trim();
    if (line.startsWith('# ')) doc.title = line.slice(2);
    else if (line.startsWith('## ')) {
      section = { title: line.slice(3), rows: [], paragraphs: [] };
      doc.sections.push(section);
      headerSeen = false;
    } else if (line.startsWith('|')) {
      if (/^\|[\s:-]+\|/.test(line) && !/[a-z]/i.test(line)) continue; // separator row
      if (!headerSeen) {
        headerSeen = true; // column titles
        continue;
      }
      const [raqb = '', trawlnet = '', status = ''] = cells(line);
      section?.rows.push({ raqb, trawlnet, status: statusOf(status), statusText: status });
    } else if (line) {
      (section ? section.paragraphs : doc.intro).push(line);
    }
  }
  return doc;
}
