# Query builder benchmark

Compares React/JS query-builder libraries rendering the same tree, in headless Chromium, production builds.

```sh
pnpm install
node build.mjs          # esbuild prod bundles -> dist/, sizes -> dist/sizes.json
node run.mjs            # -> results/results.json   (env: ONLY=rqb,raqb SIZES=10,100 PAGES=5 CPU=4)
node report.mjs         # -> results/REPORT.md
node dbg.mjs dist <page>.html "<js expr>" [shot.png]   # poke at one page
MINIFY=0 node build.mjs && node profile.mjs qnot-svelte 1000 mount   # readable CPU profile
```

## Full suite

```sh
pnpm --filter cqb-bench suite     # or: cd bench && node suite.mjs   (~25 min)
```

Builds every page, then runs the UI matrix (10 adapters, including the Vue, Svelte and Solid
bindings, × 10…5,000 rules), a 4× CPU-throttled pass for mount/keystroke/add-rule, the core
benchmarks (`core/suite.ts`, Node, no DOM), and bundle sizes (`build.mjs`: per page plus every
`@qnot/*` entry, gzip and brotli). Writes `results/suite.json` (median, p25/p75/p95, min/max and
sample count per metric, plus machine/browser/library versions) and refreshes `results/results.json`
from the same run. The site's `/benchmarks` page reads `suite.json` at build time.

Sizes whose projected cold mount exceeds `MOUNT_BUDGET_MS` (45 s) are recorded as skipped, with the
reason, instead of being dropped. A quick slice: `ONLY=qnot,rqb SIZES=10,100 OUT=/tmp/s.json node suite.mjs --no-core --no-throttle`.

Interactions on the last page of each size, all through the library's own UI: type into a text value,
switch a rule's field (Age ↔ First name, so the value editor changes too), toggle its operator
(equals ↔ not equals), drag a rule to the top of its group (timed from the drop), add a rule, remove a
rule. Each is timed until the DOM shows the change, then one macrotask and a forced layout.

## Method

- **Dataset** (`src/shared.ts`): 10 fields (text/number/select/boolean). Root AND group with
  `ceil(n/10)` OR sub-groups of 10 rules. Every adapter converts it to the library's own stored
  format *outside* the timed region; mount times "load stored JSON + render".
- **Adapters** (`src/adapters/*`): each library with its default/recommended CSS and default
  widgets. Each exposes the same interface; `src/runner.ts` does the timing in-page.
- **Mount**: `performance.now()` around load+render until the expected rule rows are in the DOM,
  then a forced layout. Cold = first mount in a fresh page; warm = remount in the same page.
  Median over 5 fresh pages.
- **Keystroke**: set a value on a mid-tree text input + dispatch `input`/`change`, wait one
  macrotask, force layout. 30 keystrokes, median. Afterwards the library's SQL export is checked
  to contain the typed text, proving the model (not just the DOM) was updated.
- **Keystroke CPU**: CDP `TaskDuration` delta across a 150 ms window per keystroke, minus a
  no-op baseline. Catches debounced/deferred work, but it is noisy at small values.
- **Add rule**: the UI action that appends a rule to the root group (menu-based libraries include
  opening the menu).
- **Heap**: CDP `Runtime.getHeapUsage` after forced GC, before vs. after the first mount.
- **SQL export**: library's own SQL formatter on the current state, averaged over repeats.
- **Bundle**: esbuild minify + gzip -9 of the whole bench page. "excl. React" subtracts a
  React+ReactDOM hello-world bundle.

## Caveats

- DevExtreme renders values as text and opens editors on click, so it has no inline typing
  path (keystroke = n/a) and far fewer DOM nodes. That's a real design difference, not a bug.
- Syncfusion and DevExtreme run unlicensed (trial banner shown); behaviour is otherwise identical.
- The prototype renders a comparable set of controls (combinator, +rule, +group, remove; field,
  operator, value, remove), but none of the extras (drag and drop, lock, clone, validation UI).
