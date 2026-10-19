import { Fragment } from 'react';
import { at, Bar, Box, Callout, Caption, Drawing, Flat, Lamp, Lift, middle, type Origin, Part, Print, Wire } from './iso';

/*
 * The landing page's drawings: qnot's pipeline (schema → store → outputs) as catalog line art.
 * Each part drops in when its drawing scrolls into view; `.lift` groups rise on hover.
 */

const CELL = '0 0 719 339';

/** One rule in a tray: a tile with field / operator / value bars on its top face. */
function Tile({ o, x, y, z, w, d, lit, label }: { o: Origin; x: number; y: number; z: number; w: number; d: number; lit?: boolean; label?: string }) {
  const h = lit ? 10 : 8;
  const top = z + h;
  return (
    <g className={lit ? 'lit' : undefined}>
      <Box d={d} h={h} o={o} w={w} x={x} y={y} z={z} />
      {label ? (
        <Print o={o} on="top" size={Math.min(11, w / 7)} tone="ink" x={x + 7} y={y + d / 2 + 3} z={top}>
          {label}
        </Print>
      ) : (
        <>
          <Bar from={at(o, x + 8, y + d * 0.38, top)} to={at(o, x + w * 0.42, y + d * 0.38, top)} tone={lit ? 'lamp' : 'dim'} width={2.5} />
          <Bar from={at(o, x + 8, y + d * 0.66, top)} to={at(o, x + w * 0.72, y + d * 0.66, top)} tone="line" width={2.5} />
        </>
      )}
    </g>
  );
}

/** The hero: a typed schema feeds the store (one tile per rule, one lit as it's edited), which encodes to every format. */
export function HeroDrawing({ className }: { className?: string }) {
  const S: Origin = [232, 186];
  const T: Origin = [646, 120];
  const O: Origin = [1150, 214];
  const tiles = [0, 1, 2].flatMap((row) => [0, 1, 2, 3].map((col) => ({ row, col })));
  const outputs = ['SQL', 'MongoDB', 'JsonLogic'];
  const a = at(S, 150, 90, 13);
  const b = at(T, 110, 260, 8);
  const c = at(T, 360, 140, 8);
  const d = at(O, 60, 100, 20);
  return (
    <Drawing
      className={className}
      name="hero"
      title="A typed schema feeding a query store of rule tiles, one tile lit as it is edited, encoding to SQL, MongoDB and JsonLogic."
      viewBox="40 80 1360 430"
    >
      <Part i={0}>
        <Box d={170} h={24} o={S} w={150} x={0} y={0} z={0} />
        {['age: f.number()', 'plan: f.enum([…])', 'tags: f.multiEnum()', 'orders: f.array()'].map((line, n) => (
          <Print key={line} o={S} on="top" size={10.5} tone={n === 1 ? 'ink' : 'muted'} x={14} y={34 + n * 34} z={24}>
            {line}
          </Print>
        ))}
        <Print o={S} on="left" x={12} y={170} z={8}>
          fields.ts
        </Print>
      </Part>
      <Part i={1}>
        <Box className="tray" d={260} h={16} o={T} w={360} x={0} y={0} z={0} />
        <Print o={T} on="left" x={196} y={260} z={5}>
          createQueryStore()
        </Print>
        <Print o={T} on="right" x={360} y={250} z={5}>
          1 node per rule
        </Print>
      </Part>
      {tiles.map(({ row, col }, n) => {
        const x = 18 + col * 84;
        const y = 18 + row * 80;
        if (row === 1 && col === 2) return null;
        return (
          <Part i={2 + Math.floor(n / 3)} key={`${row}-${col}`}>
            <Tile d={64} o={T} w={72} x={x} y={y} z={16} />
          </Part>
        );
      })}
      <g className="slab">
        <Lift>
          <Tile d={64} label="age ≥ 21" lit o={T} w={72} x={18 + 2 * 84} y={98} z={30} />
          <Lamp p={at(T, 18 + 2 * 84 + 62, 106, 40)} />
        </Lift>
      </g>
      {outputs.map((name, n) => (
        <Part i={6 + n} key={name}>
          <Lift className={n === 2 ? 'l2' : undefined}>
            <Box d={100} h={14} o={O} w={140} x={0} y={0} z={n * 30} />
            <Print o={O} on="left" size={9.5} tone={n === 0 ? 'ink' : 'muted'} x={8} y={100} z={n * 30 + 3.5}>
              {name}
            </Print>
            {n === 2 && (
              <>
                <Print o={O} on="top" size={10.5} tone="ink" x={14} y={42} z={74}>
                  age &gt;= $1
                </Print>
                <Bar from={at(O, 14, 68, 74)} to={at(O, 96, 68, 74)} tone="line" width={2.5} />
              </>
            )}
          </Lift>
        </Part>
      ))}
      <Part i={9}>
        <Wire a={a} b={b} />
        <Caption p={middle(a, b, -12)}>QueryOf&lt;typeof fields&gt;</Caption>
        <Wire a={c} b={d} tone="lamp" />
        <Caption p={middle(c, d, 22)}>encode()</Caption>
      </Part>
      <Part className="callout" i={10}>
        <Callout anchor="middle" p={[222, 410]} sub="typed end to end" title="Your schema" />
        <Callout anchor="middle" p={[690, 486]} sub="one rule re-renders · 0.4 ms" title="One store" />
        <Callout anchor="middle" p={[1162, 410]} sub="SQL · Mongo · JsonLogic · ES · SpEL" title="Every format" />
      </Part>
    </Drawing>
  );
}

/** 01 Typed end to end: the schema's enum narrows a rule's value slot. */
export function TypedDrawing() {
  const S: Origin = [150, 96];
  const R: Origin = [430, 112];
  const a = at(S, 150, 60, 10);
  const b = at(R, 0, 50, 8);
  return (
    <Drawing name="typed" title="A schema card defining plan as an enum, and a rule whose value slot only accepts 'free' or 'pro'." viewBox={CELL}>
      <Part i={0}>
        <Box d={120} h={20} o={S} w={150} x={0} y={0} z={0} />
        <Print o={S} on="top" size={10.5} tone="ink" x={12} y={40} z={20}>
          plan: f.enum([
        </Print>
        <Print o={S} on="top" size={10.5} tone="lamp" x={24} y={66} z={20}>
          'free', 'pro'
        </Print>
        <Print o={S} on="top" size={10.5} tone="ink" x={12} y={92} z={20}>
          ])
        </Print>
      </Part>
      <Part i={1}>
        <Box className="tray" d={100} h={14} o={R} w={222} x={0} y={0} z={0} />
        <Flat className="ghost" d={60} o={R} w={52} x={10} y={20} z={14} />
        <Print o={R} on="top" size={10} tone="ink" x={16} y={54} z={14}>
          plan
        </Print>
        <Flat className="ghost" d={60} o={R} w={36} x={70} y={20} z={14} />
        <Print o={R} on="top" size={10} tone="muted" x={76} y={54} z={14}>
          eq
        </Print>
      </Part>
      <Part i={2}>
        <Wire a={a} b={b} />
        <Caption p={middle(a, b, -12)}>RuleOf&lt;F&gt;</Caption>
      </Part>
      <g className="slab">
        <Lift>
          <g className="lit">
            <Box d={60} h={8} o={R} w={100} x={114} y={20} z={14} />
          </g>
          <Print o={R} on="top" size={9} tone="lamp" x={120} y={54} z={22}>
            'free' | 'pro'
          </Print>
          <Lamp p={at(R, 204, 28, 22)} r={3} />
        </Lift>
      </g>
      <g className="pop">
        <Caption anchor="start" p={[455, 305]} tone="red">
          'gold' → Type error
        </Caption>
      </g>
    </Drawing>
  );
}

/** 02 O(1) edits: a tray of rules, all quiet but the one being edited. */
export function EditsDrawing() {
  const T: Origin = [366, 52];
  const cols = 5;
  const rows = 4;
  return (
    <Drawing name="edits" title="A tray of twenty rule tiles, nineteen quiet, one lit and raised as it is edited." viewBox={CELL}>
      <Part i={0}>
        <Box className="tray" d={232} h={14} o={T} w={300} x={0} y={0} z={0} />
        <Print o={T} on="left" x={12} y={232} z={4}>
          1,000 rules
        </Print>
      </Part>
      {Array.from({ length: rows }, (_, row) =>
        Array.from({ length: cols }, (_, col) => {
          const lit = row === 2 && col === 3;
          const x = 12 + col * 57;
          const y = 12 + row * 55;
          return lit ? (
            <g className="slab" key={`${row}-${col}`}>
              <Lift className="l2">
                <Tile d={44} lit o={T} w={48} x={x} y={y} z={26} />
                <Lamp p={at(T, x + 40, y + 6, 36)} r={3} />
              </Lift>
            </g>
          ) : (
            <Part className="dim" i={1 + row} key={`${row}-${col}`}>
              <Tile d={44} o={T} w={48} x={x} y={y} z={14} />
            </Part>
          );
        }),
      )}
      <Part i={6}>
        <Caption anchor="start" p={[40, 60]} size={11} tone="ink">
          setRuleValue(id, 22)
        </Caption>
        <Caption anchor="start" p={[40, 80]}>
          notifies 1 subscriber
        </Caption>
        <Caption anchor="end" p={[690, 300]}>
          0.4 ms at 1,000 rules
        </Caption>
      </Part>
    </Drawing>
  );
}

/** 03 Every format: one query, wired out to each codec. */
export function FormatsDrawing() {
  const Q: Origin = [150, 120];
  const formats = ['SQL', 'MongoDB', 'JsonLogic', 'Elasticsearch', 'react-querybuilder', 'RAQB'];
  const q = at(Q, 120, 60, 22);
  return (
    <Drawing name="formats" title="One query block with wires to SQL, MongoDB, JsonLogic, Elasticsearch, react-querybuilder and RAQB." viewBox={CELL}>
      <Part i={0}>
        <Lift>
          <g className="lit">
            <Box d={120} h={44} o={Q} w={120} x={0} y={0} z={0} />
          </g>
          <Print o={Q} on="left" size={11} tone="ink" x={12} y={120} z={18}>
            query
          </Print>
          <Lamp p={at(Q, 96, 22, 44)} />
        </Lift>
      </Part>
      {formats.map((name, n) => {
        const o: Origin = [432 + (n % 2) * 150, 38 + Math.floor(n / 2) * 88];
        const end = at(o, 0, 17, 5);
        return (
          <Fragment key={name}>
            <Part i={1 + n}>
              <Lift className={n === 0 ? 'l2' : undefined}>
                <Box d={34} h={10} o={o} w={110} x={0} y={0} z={0} />
                <Print o={o} on="top" size={name.length > 12 ? 8 : 9.5} tone={n < 2 ? 'ink' : 'muted'} x={8} y={21} z={10}>
                  {name}
                </Print>
              </Lift>
            </Part>
            <Part i={7}>
              <Wire a={q} b={end} tone={n === 0 ? 'lamp' : 'quiet'} />
            </Part>
          </Fragment>
        );
      })}
      <Part i={8}>
        <Caption anchor="start" p={[40, 312]}>
          encode() · decode() · memoized per node
        </Caption>
      </Part>
    </Drawing>
  );
}

/** 04 Five frameworks, one store. */
export function FrameworksDrawing() {
  const S: Origin = [372, 160];
  const frameworks: { name: string; o: Origin }[] = [
    { name: 'React', o: [130, 84] },
    { name: 'Vue', o: [330, 50] },
    { name: 'Svelte', o: [540, 64] },
    { name: 'Solid', o: [610, 186] },
    { name: 'DOM', o: [120, 214] },
  ];
  const s = at(S, 60, 60, 26);
  return (
    <Drawing name="frameworks" title="One store block in the middle, wired to React, Vue, Svelte, Solid and vanilla DOM screens around it." viewBox={CELL}>
      <Part i={0}>
        <g className="lit">
          <Box d={120} h={26} o={S} w={120} x={0} y={0} z={0} />
        </g>
        <Print o={S} on="left" size={11} tone="ink" x={12} y={120} z={8}>
          store
        </Print>
        <Lamp p={at(S, 98, 18, 26)} />
      </Part>
      {frameworks.map((fw, n) => (
        <Fragment key={fw.name}>
          <Part i={1 + n}>
            <Lift>
              <Box d={52} h={34} o={fw.o} w={74} x={0} y={0} z={0} />
              <Flat className="screen" d={30} o={fw.o} w={50} x={12} y={11} z={34} />
              <Bar from={at(fw.o, 18, 20, 34)} to={at(fw.o, 44, 20, 34)} tone="dim" width={2} />
              <Bar from={at(fw.o, 18, 30, 34)} to={at(fw.o, 36, 30, 34)} tone="line" width={2} />
              <Print o={fw.o} on="left" size={10} tone="ink" x={8} y={52} z={10}>
                {fw.name}
              </Print>
            </Lift>
          </Part>
          <Part i={6}>
            <Wire a={at(fw.o, 37, 26, 17)} b={s} tone="quiet" />
          </Part>
        </Fragment>
      ))}
    </Drawing>
  );
}

/** 05 Runs on the server: the browser posts the query, the server validates it and sends SQL with params. */
export function ServerDrawing() {
  const B: Origin = [110, 120];
  const V: Origin = [372, 104];
  const DB = [626, 196] as const;
  const a = at(B, 110, 50, 30);
  const b = at(V, 0, 60, 34);
  const c = at(V, 120, 50, 34);
  return (
    <Drawing name="server" title="A browser posts a query to a server that validates it and sends parameterized SQL to a database." viewBox={CELL}>
      <Part i={0}>
        <Box d={90} h={60} o={B} w={110} x={0} y={0} z={0} />
        <Flat className="screen" d={60} o={B} w={84} x={13} y={15} z={60} />
        <Bar from={at(B, 22, 32, 60)} to={at(B, 70, 32, 60)} tone="dim" width={2.5} />
        <Bar from={at(B, 22, 50, 60)} to={at(B, 56, 50, 60)} tone="line" width={2.5} />
        <Print o={B} on="left" size={10} tone="ink" x={8} y={90} z={22}>
          browser
        </Print>
      </Part>
      <Part i={1}>
        <Lift>
          <g className="lit">
            <Box d={110} h={70} o={V} w={120} x={0} y={0} z={0} />
          </g>
          <Print o={V} on="left" size={10} tone="ink" x={8} y={110} z={40}>
            server
          </Print>
          <Print o={V} on="left" size={9} x={8} y={110} z={24}>
            assertValidQuery()
          </Print>
          <Lamp p={at(V, 100, 16, 70)} />
        </Lift>
      </Part>
      <Part i={2}>
        <path className="face l" d={`M${DB[0] - 50} ${DB[1]} L${DB[0] - 50} ${DB[1] + 70} A50 18 0 0 0 ${DB[0] + 50} ${DB[1] + 70} L${DB[0] + 50} ${DB[1]}`} />
        <ellipse className="face t" cx={DB[0]} cy={DB[1]} rx={50} ry={18} />
        <path className="stroke" d={`M${DB[0] - 50} ${DB[1] + 30} A50 18 0 0 0 ${DB[0] + 50} ${DB[1] + 30}`} />
        <Caption p={[DB[0], DB[1] + 112]}>postgres</Caption>
      </Part>
      <Part i={3}>
        <Wire a={a} b={b} />
        <Caption p={middle(a, b, 20)}>POST query</Caption>
        <Wire a={c} b={[DB[0] - 50, DB[1] + 10]} tone="lamp" />
        <Caption p={middle(c, [DB[0] - 50, DB[1] + 10], -14)}>age &gt;= $1</Caption>
      </Part>
      <g className="pop">
        <Caption anchor="start" p={[300, 318]} tone="red">
          age ≥ -5 → 400: Must be at least 0
        </Caption>
      </g>
    </Drawing>
  );
}

/** 06 Drop-in: react-querybuilder's JSON drops into a store speaking its format. */
export function DropInDrawing() {
  const T: Origin = [380, 120];
  return (
    <Drawing name="dropin" title="A react-querybuilder JSON block lowering into a socket on a qnot store set to format rqb." viewBox={CELL}>
      <Part i={0}>
        <Box className="tray" d={170} h={18} o={T} w={230} x={0} y={0} z={0} />
        <Flat className="ghost" d={90} o={T} w={110} x={60} y={40} z={18} />
        <Print o={T} on="left" x={12} y={170} z={6}>
          {'useQueryStore({ format: rqb })'}
        </Print>
      </Part>
      <Part i={1}>
        {[
          [60, 130],
          [170, 130],
          [170, 40],
        ].map(([x, y]) => (
          <path className="drop" d={`M${at(T, x!, y!, 18).join(' ')} L${at(T, x!, y!, 62).join(' ')}`} key={`${x}-${y}`} />
        ))}
      </Part>
      <g className="slab">
        <Lift>
          <Box d={90} h={22} o={T} w={110} x={60} y={40} z={62} />
          <Print o={T} on="top" size={9.5} tone="ink" x={68} y={70} z={84}>
            {'{ combinator,'}
          </Print>
          <Print o={T} on="top" size={9.5} tone="ink" x={76} y={90} z={84}>
            {'rules: […] }'}
          </Print>
          <Print o={T} on="left" size={9} x={66} y={130} z={68}>
            your saved RQB JSON
          </Print>
        </Lift>
      </g>
      <Part i={2}>
        <Caption anchor="start" p={[40, 70]} size={11} tone="ink">
          No migration script
        </Caption>
        <Caption anchor="start" p={[40, 90]}>
          value / onChange keep RQB's shape
        </Caption>
      </Part>
    </Drawing>
  );
}
