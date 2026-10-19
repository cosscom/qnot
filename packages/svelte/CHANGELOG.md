# @qnot/svelte

## 0.1.0

### Minor Changes

- 0d2040c: First release: typed schema builders, a normalized query store with per-node subscriptions, validation, evaluation (`compile`/`matches`/`compileCases`), format codecs (SQL, MongoDB, JsonLogic, Elasticsearch, SpEL, text, react-querybuilder, react-awesome-query-builder, jQuery QueryBuilder), and bindings for React, Vue, Svelte 5, Solid and the plain DOM with feature parity with react-awesome-query-builder.

### Patch Changes

- cc5a2fa: Svelte: about 2.5× faster first render and 6× less memory at 1,000 rules (now level with `@qnot/react` on first render and below it on memory), with the same API. Reactive helpers read shared per-store signals (one per node, one permissions channel that wakes only nodes whose answers flip, one drag-and-drop channel per builder) instead of a `createSubscriber` per read; option lists and editor specs are cached per schema; lazy selects render their full list imperatively on first use, with no observer or effect per select; the default group renders its rows' elements itself, so rows are inserted straight into their container with one set of listeners per group, and the default value editor's common cases render inline.
- Updated dependencies [0d2040c]
  - @qnot/core@0.1.0
