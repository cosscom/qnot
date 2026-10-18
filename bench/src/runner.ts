import type { Adapter } from './shared';

const ch = new MessageChannel();
const queue: (() => void)[] = [];
ch.port1.onmessage = () => queue.shift()?.();
// Yields one macrotask without setTimeout's clamping.
const nextTask = () => new Promise<void>((r) => { queue.push(r); ch.port2.postMessage(0); });

async function settle(done: () => boolean) {
  await nextTask();
  const start = performance.now();
  while (!done()) {
    await new Promise((r) => setTimeout(r, 0));
    if (performance.now() - start > 60_000) throw new Error('settle timeout');
  }
  void document.body.offsetHeight; // force style + layout
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
