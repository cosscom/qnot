---
"@qnot/svelte": patch
---

Svelte: about 2.5× faster first render and 6× less memory at 1,000 rules (now level with `@qnot/react` on first render and below it on memory), with the same API. Reactive helpers read shared per-store signals (one per node, one permissions channel that wakes only nodes whose answers flip, one drag-and-drop channel per builder) instead of a `createSubscriber` per read; option lists and editor specs are cached per schema; lazy selects render their full list imperatively on first use, with no observer or effect per select; the default group renders its rows' elements itself, so rows are inserted straight into their container with one set of listeners per group, and the default value editor's common cases render inline.
