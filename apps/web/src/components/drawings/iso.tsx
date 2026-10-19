// Isometric line-art primitives in the manner of the coss.com catalog. Adapted from
// cosscom/coss apps/site/src/components/shipyard/drawings.tsx and components/home/iso.tsx
// (AGPL-3.0); see NOTICE.md. Geometry is in "catalog units": x runs to the lower right, y to the
// lower left, z up. Faces, bars and words are classes styled by styles/drawings.css, so light and
// dark come from the site's tokens.
import type { CSSProperties, ReactNode } from 'react';

export type Pt = readonly [number, number];
export type Origin = Pt;

const C = Math.cos(Math.PI / 6);
const S = 0.5;
const round = (n: number) => Math.round(n * 10) / 10;

/** A point in catalog units, drawn from the screen origin `o`. */
export function at(o: Origin, x: number, y: number, z: number): Pt {
  return [round(o[0] + (x - y) * C), round(o[1] + (x + y) * S - z)];
}

const points = (pts: Pt[]) => pts.map((p) => p.join(',')).join(' ');
export const segment = (a: Pt, b: Pt) => `M${a[0]} ${a[1]} L${b[0]} ${b[1]}`;
export const middle = (a: Pt, b: Pt, dy = 0): Pt => [round((a[0] + b[0]) / 2), round((a[1] + b[1]) / 2 + dy)];

/** A part that drops in, `i`-th in its drawing. */
export function Part({ i, className, children }: { i: number; className?: string; children: ReactNode }) {
  return (
    <g className={className ? `part ${className}` : 'part'} style={{ '--i': i } as CSSProperties}>
      {children}
    </g>
  );
}

/** A group that rises when its drawing is hovered. */
export function Lift({ children, className }: { children: ReactNode; className?: string }) {
  return <g className={className ? `lift ${className}` : 'lift'}>{children}</g>;
}

interface BoxProps {
  o: Origin;
  x: number;
  y: number;
  z: number;
  w: number;
  d: number;
  h: number;
  className?: string;
}

/** The three visible faces of a box. */
export function Box({ o, x, y, z, w, d, h, className }: BoxProps) {
  const x1 = x + w;
  const y1 = y + d;
  const z1 = z + h;
  return (
    <g className={className}>
      <polygon className="face l" points={points([at(o, x, y1, z), at(o, x1, y1, z), at(o, x1, y1, z1), at(o, x, y1, z1)])} />
      <polygon className="face r" points={points([at(o, x1, y1, z), at(o, x1, y, z), at(o, x1, y, z1), at(o, x1, y1, z1)])} />
      <polygon className="face t" points={points([at(o, x, y, z1), at(o, x1, y, z1), at(o, x1, y1, z1), at(o, x, y1, z1)])} />
    </g>
  );
}

/** A shape lying on a top face at height z. */
export function Flat({ o, x, y, z, w, d, className }: Omit<BoxProps, 'h'> & { className: string }) {
  return <polygon className={className} points={points([at(o, x, y, z), at(o, x + w, y, z), at(o, x + w, y + d, z), at(o, x, y + d, z)])} />;
}

export type Tone = 'ink' | 'line' | 'dim' | 'soft' | 'lamp';

/** A bar of "text" on a face. */
export function Bar({ from, to, tone, width = 3 }: { from: Pt; to: Pt; tone: Tone; width?: number }) {
  return <path className={`bar ${tone}`} d={segment(from, to)} strokeWidth={width} />;
}

export type TextTone = 'ink' | 'muted' | 'lamp' | 'red';

/** Words printed on a face: the top (along x), across the top (along −y), the left or right face. */
export function Print({
  o,
  x,
  y,
  z,
  on,
  size = 10,
  tone = 'muted',
  children,
}: {
  o: Origin;
  x: number;
  y: number;
  z: number;
  on: 'top' | 'across' | 'left' | 'right';
  size?: number;
  tone?: TextTone;
  children: ReactNode;
}) {
  const [tx, ty] = at(o, x, y, z);
  const m = { top: `${C} ${S} ${-C} ${S}`, across: `${C} ${-S} ${C} ${S}`, left: `${C} ${S} 0 1`, right: `${C} ${-S} 0 1` }[on];
  return (
    <text className={`print ${tone}`} fontSize={size} transform={`matrix(${m} ${tx} ${ty})`}>
      {children}
    </text>
  );
}

/** Flat words beside the drawing. */
export function Caption({ p, size = 10, anchor = 'middle', tone = 'muted', children }: { p: Pt; size?: number; anchor?: 'start' | 'middle' | 'end'; tone?: TextTone; children: ReactNode }) {
  return (
    <text className={`print ${tone}`} fontSize={size} textAnchor={anchor} x={p[0]} y={p[1]}>
      {children}
    </text>
  );
}

/** qnot's teal lamp: lit, with a glow that breathes. */
export function Lamp({ p, r = 3.5 }: { p: Pt; r?: number }) {
  return (
    <g className="lamp-dot">
      <circle className="glow" cx={p[0]} cy={p[1]} r={round(r * 2.6)} />
      <circle className="dot" cx={p[0]} cy={p[1]} r={r} />
    </g>
  );
}

/** A dashed connection; its dashes march. */
export function Wire({ a, b, tone }: { a: Pt; b: Pt; tone?: 'quiet' | 'lamp' }) {
  return <path className={tone ? `wire ${tone}` : 'wire'} d={segment(a, b)} />;
}

/** A callout: a big label and a mono sub-line, with a short pinned rule pointing at the drawing. */
export function Callout({ p, title, sub, anchor = 'start', rule }: { p: Pt; title: string; sub: string; anchor?: 'start' | 'middle' | 'end'; rule?: [Pt, Pt] }) {
  return (
    <g className="callout">
      <text className="call" textAnchor={anchor} x={p[0]} y={p[1]}>
        {title}
      </text>
      <text className="print muted" fontSize={11} textAnchor={anchor} x={p[0]} y={p[1] + 19}>
        {sub}
      </text>
      {rule && (
        <>
          <path className="stroke" d={segment(rule[0], rule[1])} />
          <circle className="pin" cx={rule[0][0]} cy={rule[0][1]} r={2.5} />
          <circle className="pin" cx={rule[1][0]} cy={rule[1][1]} r={2.5} />
        </>
      )}
    </g>
  );
}

export function Drawing({ name, viewBox, title, className, children }: { name: string; viewBox: string; title: string; className?: string; children: ReactNode }) {
  return (
    <svg className={`qn-iso qn-iso-${name}${className ? ` ${className}` : ''}`} role="img" viewBox={viewBox} xmlns="http://www.w3.org/2000/svg">
      <title>{title}</title>
      {children}
    </svg>
  );
}
