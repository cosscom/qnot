// Open Graph cards for every route, drawn like the site: a ruled sheet between two rails with corner
// marks, a drafting grid, Cal Sans (static instances in src/fonts/og, cut from the site's variable
// font: Satori can't read woff2 or variable axes), the wordmark with its section label, the page title.
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';
import { BASE_PATH, SITE_URL } from './site';

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = 'image/png';

const fonts = Promise.all(
  (['CalSans-SemiBold', 'CalSans-Regular'] as const).map((name) => readFile(join(process.cwd(), 'src', 'fonts', 'og', `${name}.ttf`))),
);

const INK = '#0a0a0a';
const MUTED = '#6b6b6b';
const RULE = '#e4e4e4';
const PAPER = '#fafafa';
const SHEET = '#ffffff';
const ACCENT = '#14b8a6';

const RAIL = 72;
const HEAD = 96;
const FOOT = 76;

export interface OgCard {
  title: string;
  /** Next to the wordmark: "docs", "tools", "examples"… */
  section?: string;
  description?: string;
  /** Shown bottom right, e.g. "/tools/sql-to-mongodb". */
  path?: string;
  /** A small mono label above the title, e.g. "Free converter" or "Guide". */
  eyebrow?: string;
}

/** Drafting-grid dots on the sheet, every 24px (Satori draws no repeating gradients). */
const GRID: [number, number][] = [];
for (let x = RAIL + 24; x < OG_SIZE.width - RAIL; x += 24) for (let y = 12; y < OG_SIZE.height; y += 24) GRID.push([x, y]);

const titleSize = (t: string) => (t.length <= 24 ? 92 : t.length <= 40 ? 78 : t.length <= 60 ? 64 : 54);
/** At most n characters, cut at a word boundary. */
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, s.lastIndexOf(' ', n - 1)).replace(/[\s,;:.]+$/, '')}…` : s);

function Corner({ x, y }: { x: number; y: number }) {
  return (
    <div style={{ position: 'absolute', left: x - 7, top: y - 7, width: 15, height: 15, display: 'flex' }}>
      <div style={{ position: 'absolute', left: 7, top: 0, width: 1, height: 15, background: '#a3a3a3' }} />
      <div style={{ position: 'absolute', left: 0, top: 7, width: 15, height: 1, background: '#a3a3a3' }} />
    </div>
  );
}

/** A 1200×630 PNG for a page. */
export async function ogImage({ title, section, description, path, eyebrow }: OgCard): Promise<ImageResponse> {
  const [semibold, regular] = await fonts;
  const host = `${SITE_URL}${BASE_PATH}`.replace(/^https?:\/\//, '');
  const W = OG_SIZE.width;
  const H = OG_SIZE.height;
  return new ImageResponse(
    <div style={{ display: 'flex', position: 'relative', width: '100%', height: '100%', background: PAPER, fontFamily: 'Cal Sans', color: INK }}>
      {/* The sheet between the rails, with a drafting grid. */}
      <div style={{ position: 'absolute', left: RAIL, top: 0, width: W - RAIL * 2, height: H, background: SHEET, display: 'flex' }} />
      {GRID.map(([x, y]) => (
        <div key={`${x}:${y}`} style={{ position: 'absolute', left: x - 1, top: y - 1, width: 2.5, height: 2.5, borderRadius: 999, background: 'rgba(10,10,10,0.13)' }} />
      ))}
      {/* Rails and rules. */}
      <div style={{ position: 'absolute', left: RAIL, top: 0, width: 1, height: H, background: RULE }} />
      <div style={{ position: 'absolute', left: W - RAIL, top: 0, width: 1, height: H, background: RULE }} />
      <div style={{ position: 'absolute', left: 0, top: HEAD, width: W, height: 1, background: RULE }} />
      <div style={{ position: 'absolute', left: 0, top: H - FOOT, width: W, height: 1, background: RULE }} />
      <Corner x={RAIL} y={HEAD} />
      <Corner x={W - RAIL} y={HEAD} />
      <Corner x={RAIL} y={H - FOOT} />
      <Corner x={W - RAIL} y={H - FOOT} />

      {/* Header: wordmark and section. */}
      <div style={{ position: 'absolute', left: RAIL + 40, top: 0, height: HEAD, display: 'flex', alignItems: 'center', gap: 14 }}>
        {/* The wordmark's net (components/site/wordmark.tsx). */}
        <svg fill="none" height="38" viewBox="0 0 24 24" width="38">
          <path d="M3 7h18M3 7l4.5 10M21 7l-4.5 10M12 7v10M7.5 17h9" stroke={INK} strokeLinecap="round" strokeWidth="1.6" />
          <path d="M5.2 12h13.6" stroke={INK} strokeLinecap="round" strokeOpacity=".45" strokeWidth="1.6" />
          <circle cx="12" cy="12" fill={ACCENT} r="1.8" />
        </svg>
        <div style={{ display: 'flex', fontSize: 34, fontWeight: 600, letterSpacing: -0.8 }}>qnot</div>
        {section && <div style={{ display: 'flex', fontSize: 34, fontWeight: 400, color: '#9a9a9a', letterSpacing: -0.4 }}>{section}</div>}
      </div>

      {/* Title block. */}
      <div style={{ position: 'absolute', left: RAIL + 40, top: HEAD, width: W - RAIL * 2 - 80, height: H - HEAD - FOOT, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 22 }}>
        {eyebrow && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 24, color: MUTED }}>
            <div style={{ display: 'flex', width: 8, height: 8, borderRadius: 999, background: ACCENT }} />
            {eyebrow}
          </div>
        )}
        <div style={{ display: 'flex', fontSize: titleSize(title), fontWeight: 600, lineHeight: 1.0, letterSpacing: -titleSize(title) * 0.022, maxWidth: 1000 }}>{clip(title, 90)}</div>
        {description && <div style={{ display: 'flex', fontSize: 28, fontWeight: 400, lineHeight: 1.3, color: MUTED, maxWidth: 920 }}>{clip(description, 130)}</div>}
      </div>

      {/* Footer. */}
      <div
        style={{
          position: 'absolute',
          left: RAIL + 40,
          top: H - FOOT,
          width: W - RAIL * 2 - 80,
          height: FOOT,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: 22,
          color: MUTED,
        }}
      >
        <div style={{ display: 'flex' }}>The fast, fully typed query builder</div>
        <div style={{ display: 'flex', color: INK }}>{clip(`${host}${path && path !== '/' ? path : ''}`, 56)}</div>
      </div>
    </div>,
    {
      ...OG_SIZE,
      fonts: [
        { name: 'Cal Sans', data: semibold, weight: 600, style: 'normal' },
        { name: 'Cal Sans', data: regular, weight: 400, style: 'normal' },
      ],
    },
  );
}
