import { FIELDS, type Adapter, type Done } from './shared';

const ch = new MessageChannel();
const queue: (() => void)[] = [];
ch.port1.onmessage = () => queue.shift()?.();
// Yields one macrotask without setTimeout's clamping.
const nextTask = () => new Promise<void>((r) => { queue.push(r); ch.port2.postMessage(0); });

async function settle(done: () => boolean, limit = 60_000) {
  await nextTask();
  const start = performance.now();
  while (!done()) {
    await new Promise((r) => setTimeout(r, 0));
    if (performance.now() - start > limit) throw new Error('settle timeout');
  }
  void document.body.offsetHeight; // force style + layout
}

async function timed(action: () => Done) {
  let t0 = performance.now();
  // An action may restart the clock to leave out untimed setup (pointer travel before a drop).
  (window as any).__benchMark = () => void (t0 = performance.now());
  const done = await action();
  await settle(done, 20_000);
  return performance.now() - t0;
}

const setNativeValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;

export function install(adapter: Adapter) {
  const el = document.getElementById('root')!;
  (window as any).bench = {
    name: adapter.name,
    async mount(n: number) {
      adapter.prepare(n);
      const t0 = performance.now();
      await adapter.mount(el);
      await settle(() => adapter.ruleCount(el) >= n);
      return { ms: performance.now() - t0, rules: adapter.ruleCount(el) };
    },
    unmount() {
      adapter.unmount(el);
      el.innerHTML = '';
    },
    async type(keys: number) {
      const inputs = adapter.textInputs(el);
      if (!inputs) return null;
      const idx = Math.floor(inputs.length / 2);
      const times: number[] = [];
      let typed = inputs[idx].value;
      for (let k = 0; k < keys; k++) {
        const input = adapter.textInputs(el)![idx];
        typed += String.fromCharCode(97 + (k % 26));
        const target = typed;
        const t0 = performance.now();
        input.focus();
        setNativeValue.call(input, target);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        await settle(() => adapter.textInputs(el)![idx].value === target);
        times.push(performance.now() - t0);
      }
      return { times, typed };
    },
    async addRule(times: number) {
      const out: number[] = [];
      for (let k = 0; k < times; k++) {
        const before = adapter.ruleCount(el);
        const t0 = performance.now();
        await adapter.addRule(el);
        await settle(() => adapter.ruleCount(el) > before);
        out.push(performance.now() - t0);
      }
      return out;
    },
    // The rule the field/operator/drag actions target: the first rule of the middle group (a text
    // field in the canonical tree), so every library edits the same row.
    target: () => Math.min(adapter.ruleCount(el) - 1, 10 * Math.floor(adapter.ruleCount(el) / 20)),
    async removeRule(times: number) {
      if (!adapter.removeRule) return null;
      const out: number[] = [];
      for (let k = 0; k < times; k++) {
        const before = adapter.ruleCount(el);
        const t0 = performance.now();
        await adapter.removeRule(el, Math.floor(before / 2));
        await settle(() => adapter.ruleCount(el) < before);
        out.push(performance.now() - t0);
      }
      return out;
    },
    async changeField(times: number) {
      if (!adapter.changeField) return null;
      const idx = (window as any).bench.target();
      const out: number[] = [];
      for (let k = 0; k < times; k++) {
        const to = FIELDS[k % 2 === 0 ? 1 : 0]!; // Age (number) <-> First name (text): the value editor changes too
        out.push(await timed(() => adapter.changeField!(el, idx, to)));
      }
      return out;
    },
    async changeOperator(times: number) {
      if (!adapter.changeOperator) return null;
      const idx = (window as any).bench.target() + 3;
      const out: number[] = [];
      for (let k = 0; k < times; k++) out.push(await timed(() => adapter.changeOperator!(el, idx, k % 2 === 0)));
      return out;
    },
    async reorder(times: number) {
      if (!adapter.reorder) return null;
      const idx = (window as any).bench.target() + 5;
      const out: number[] = [];
      for (let k = 0; k < times; k++) out.push(await timed(() => adapter.reorder!(el, idx)));
      return out;
    },
    notes: adapter.notes ?? {},
    sql(reps: number) {
      if (!adapter.sql) return null;
      let s = '';
      const t0 = performance.now();
      for (let i = 0; i < reps; i++) s = adapter.sql();
      return { ms: (performance.now() - t0) / reps, length: s.length, sample: s.slice(0, 160) };
    },
    committed: (typed: string) => (adapter.sql ? adapter.sql().includes(typed) : null),
    domNodes: () => el.getElementsByTagName('*').length,
  };
}
