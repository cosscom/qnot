import { ImageResponse } from 'next/og';
import { SITE_DESCRIPTION } from '@/lib/site';

export const alt = 'qnot: a query builder that stays fast at a thousand rules';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/** A static card in the site's ruled-sheet style. */
export default function Image() {
  const dots = Array.from({ length: 12 }, (_, i) => i);
  return new ImageResponse(
    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', width: '100%', height: '100%', background: '#0b0b0b', color: '#f5f5f5', padding: 72 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 40, fontWeight: 700 }}>
        <div style={{ display: 'flex', width: 14, height: 14, borderRadius: 999, background: '#2dd4bf' }} />
        qnot
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div style={{ fontSize: 76, fontWeight: 700, letterSpacing: -3, lineHeight: 1 }}>A query builder that stays fast at a thousand rules.</div>
        <div style={{ fontSize: 28, color: '#a3a3a3', maxWidth: 900 }}>{SITE_DESCRIPTION}</div>
      </div>
      <div style={{ display: 'flex', gap: 12 }}>
        {dots.map((i) => (
          <div key={i} style={{ display: 'flex', width: 64, height: 36, borderRadius: 8, border: '1px solid #333', background: i === 6 ? 'rgba(45,212,191,0.18)' : '#141414' }} />
        ))}
      </div>
    </div>,
    size,
  );
}
