# @qnot/solid

## 0.1.0

### Minor Changes

- 0d2040c: First release: typed schema builders, a normalized query store with per-node subscriptions, validation, evaluation (`compile`/`matches`/`compileCases`), format codecs (SQL, MongoDB, JsonLogic, Elasticsearch, SpEL, text, react-querybuilder, react-awesome-query-builder, jQuery QueryBuilder), and bindings for React, Vue, Svelte 5, Solid and the plain DOM with feature parity with react-awesome-query-builder.

### Patch Changes

- ab18048: Solid: about 1.9× faster first render and 5× less memory at 1,000 rules (now ahead of `@qnot/react`), with the same API. Rows no longer spread props onto elements or go through `<Dynamic>`/`<Show>`/`<Switch>`; each node has one shared store subscription; permissions, settings and drag-and-drop each use one channel per builder (drag state fans out through selectors, so a pointer move wakes only the rows whose drop line changes); option lists and editor specs are cached per schema; lazy selects build their options in a single effect.
- Updated dependencies [0d2040c]
  - @qnot/core@0.1.0
