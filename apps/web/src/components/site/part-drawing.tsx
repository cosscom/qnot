// Adapted from cosscom/coss apps/site/src/components/home/part-drawing.tsx and
// components/home/iso.tsx (AGPL-3.0); see NOTICE.md. Only the email part the "Products" menu
// shows: one product block, isometric, in the manner of coss.com's parts catalog.
import type { ReactNode } from 'react';

const C = Math.cos(Math.PI / 6);
const S = 0.5;

type P3 = readonly [number, number, number];

function iso([x, y, z]: P3): [number, number] {
  return [(x - y) * C, (x + y) * S - z];
}

function points(corners: readonly P3[]): string {
  return corners
    .map((corner) => {
      const [sx, sy] = iso(corner);
      return `${sx.toFixed(2)},${sy.toFixed(2)}`;
    })
    .join(' ');
}

/** Maps 2D artwork onto the top face at height z, with its origin at (x, y). */
const onTop = (x: number, y: number, z: number) => {
  const [tx, ty] = iso([x, y, z]);
  return `matrix(${C} ${S} ${-C} ${S} ${tx} ${ty})`;
};
/** Maps 2D artwork onto the face looking down-left (the plane y = const). */
const onLeft = (x: number, y: number, z: number) => {
  const [tx, ty] = iso([x, y, z]);
  return `matrix(${C} ${S} 0 1 ${tx} ${ty})`;
};
/** Maps 2D artwork onto the face looking down-right (the plane x = const). */
const onRight = (x: number, y: number, z: number) => {
  const [tx, ty] = iso([x, y, z]);
  return `matrix(${C} ${-S} 0 1 ${tx} ${ty})`;
};

const LINE = {
  stroke: 'currentColor',
  strokeLinejoin: 'round',
  strokeLinecap: 'round',
  vectorEffect: 'non-scaling-stroke',
} as const;

const SIZE = 92;
const HEIGHT = 30;

export interface Part {
  /** The SDK namespace printed on the block's side. */
  call: string;
  /** The mark engraved on its top, drawn in a 92 × 92 square. */
  mark: ReactNode;
}

/** The email product's block: an envelope on top, `coss.email` on its side. */
export const EMAIL_PART: Part = {
  call: 'coss.email',
  mark: (
    <>
      <rect fill="none" height={44} rx={3} width={60} x={16} y={24} {...LINE} />
      <path d="M16 27 L46 50 L76 27" fill="none" {...LINE} />
    </>
  ),
};

/** One product's block on its own, as drawn in coss.com's catalog. */
export function PartDrawing({ part, className }: { part: Part; className?: string }) {
  const [left] = iso([0, SIZE, 0]);
  const [right] = iso([SIZE, 0, 0]);
  const [, top] = iso([0, 0, HEIGHT]);
  const [, bottom] = iso([SIZE, SIZE, 0]);
  const pad = 10;
  const faceTop: P3[] = [
    [0, 0, HEIGHT],
    [SIZE, 0, HEIGHT],
    [SIZE, SIZE, HEIGHT],
    [0, SIZE, HEIGHT],
  ];
  const faceLeft: P3[] = [
    [0, SIZE, 0],
    [SIZE, SIZE, 0],
    [SIZE, SIZE, HEIGHT],
    [0, SIZE, HEIGHT],
  ];
  const faceRight: P3[] = [
    [SIZE, 0, 0],
    [SIZE, SIZE, 0],
    [SIZE, SIZE, HEIGHT],
    [SIZE, 0, HEIGHT],
  ];
  const labelSize = Math.min(9.5, (SIZE - 16) / (part.call.length * 0.62));
  return (
    <svg aria-hidden className={className} viewBox={`${left - pad} ${top - pad} ${right - left + pad * 2} ${bottom - top + pad * 2}`}>
      <g className="text-foreground">
        <polygon className="fill-(--iso-left)" points={points(faceLeft)} {...LINE} />
        <polygon className="fill-(--iso-right)" points={points(faceRight)} {...LINE} />
        <polygon className="fill-(--iso-top)" points={points(faceTop)} {...LINE} />
        <g transform={onTop(0, 0, HEIGHT)}>{part.mark}</g>
        <text className="fill-current font-mono" fontSize={labelSize} transform={onLeft(0, SIZE, HEIGHT)} x={8} y={19}>
          {part.call}
        </text>
        <text className="fill-current font-mono opacity-60" fontSize={8} transform={onRight(SIZE, SIZE, HEIGHT)} x={8} y={19}>
          coss.com
        </text>
      </g>
    </svg>
  );
}
