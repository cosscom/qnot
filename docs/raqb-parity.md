# Feature parity with react-awesome-query-builder (RAQB 6.6)

Source: RAQB README + CONFIG.adoc. Status: ✅ done · ⏭ not supported or intentionally different (with reason). Every ✅ row is covered by tests (`packages/core/src/parity.test.ts`, `packages/*/src/**/parity.test.*`, `packages/core/src/formats/*.test.ts`).

## Field types and widgets

| RAQB | qnot | Status |
|---|---|---|
| text, number, boolean, date | `f.text/number/boolean/date` | ✅ |
| time, datetime | `f.time()`, `f.datetime()` | ✅ |
| select | `f.enum([...])` | ✅ |
| multiselect (field holds an array) | `f.multiEnum([...])` + `hasAny/hasAll/hasNone/setEq/setNeq` | ✅ |
| treeselect / treemultiselect | `f.enum` / `f.multiEnum` options with `children` | ✅ |
| `!struct` (subfields) | `f.struct({...})`, flattened to `address.city` paths, grouped in field pickers | ✅ |
| `!group` some/array mode, aggregation (count) | `f.array({...})` + array groups with `match: some/all/none/{count}` | ✅ |
| textarea, slider, rangeslider, price widgets | `widget: 'textarea' \| 'slider'`, `step`, `min`/`max`, `prefix`/`suffix` hints (a between on a slider field renders two sliders); slider `marks` not supported | ✅ |
| async listValues, search, allowCustomValues | `search(query, signal)` (async options), `allowCustom` | ✅ |
| async "load more" paging | not built: `search` returns the whole page of matches | ⏭ |
| `fieldName` / `tableName` (export name) | `column` | ✅ |
| `label2`, `tooltip` | `description` | ✅ |
| `hideForSelect`, `hideForCompare` | `hidden`, `comparable: false` | ✅ |
| `excludeOperators` | `excludeOperators` | ✅ |
| `defaultValue`, `defaultOperator`, `operators` | same | ✅ |
| `validateValue` | `validate(value) => message` | ✅ |
| `validateValue` returning `fixedValue` | not supported; clean values with `sanitizeQuery` or your own pass | ⏭ |

## Operators

| RAQB | qnot | Status |
|---|---|---|
| equal, not_equal, less(_or_equal), greater(_or_equal) | `eq neq lt lte gt gte` | ✅ |
| like, not_like, starts_with, ends_with | `contains notContains startsWith endsWith` | ✅ |
| between, not_between | `between notBetween` | ✅ |
| is_null, is_not_null | `isNull isNotNull` | ✅ |
| is_empty, is_not_empty | `isEmpty isNotEmpty` | ✅ |
| select_any_in, select_not_any_in | `in notIn` | ✅ |
| multiselect_contains/not_contains/equals/not_equals | `hasAll hasNone setEq setNeq` (+ `hasAny`) | ✅ |
| proximity, custom operators with per-format output | `defineOperator()` registry with `evaluate` + per-codec `formats` | ✅ |
| reversedOp / reverseOperatorsForNot | operator `inverse` | ✅ |

## Values

| RAQB | qnot | Status |
|---|---|---|
| valueSources: value | `value` | ✅ |
| valueSources: field | `ref` | ✅ |
| valueSources: func (RHS functions, nested) | `call: { fn, args }` | ✅ |
| fieldSources: func (LHS functions) | `field: { fn, args }` | ✅ |
| funcs config (LOWER, NOW, RELATIVE_DATETIME, …) | `defineFunction()` + `builtinFunctions` | ✅ |

## Structure and behaviour

| RAQB | qnot | Status |
|---|---|---|
| AND / OR conjunctions, NOT | `combinator`, `not` | ✅ |
| custom conjunctions (NOR, XOR…) | ⏭ NOR = NOT+OR; XOR has no portable SQL/Mongo meaning | ⏭ |
| drag and drop, canReorder, canRegroup | DnD + `canReorder`/`canRegroup` settings | ✅ |
| lock rules/groups, showLock, canDeleteLocked | `locked` on nodes + settings | ✅ |
| read-only / immutable{Groups,Fields,Ops,Values}Mode | `readOnly` + `immutable` settings | ✅ |
| maxNesting, maxNumberOfRules | `maxDepth`, `maxRules` | ✅ |
| canLeaveEmptyGroup, shouldCreateEmptyGroup | `canLeaveEmptyGroup`, `emptyNewGroups` (new groups start with one rule by default, like RAQB) | ✅ |
| clearValueOnChangeField/Op, setOpOnChangeField | settings `valueOnFieldChange`, `valueOnOperatorChange`, `operatorOnFieldChange` (`'keep' \| 'reset'`) | ✅ |
| canCompareFieldWithField | `allowRefs` | ✅ |
| removeIncomplete/Empty/InvalidRulesOnLoad, removeEmptyGroupsOnLoad | `sanitizeQuery()` / store `sanitize`: `removeIncompleteRules`, `removeInvalidRules`, `removeEmptyGroups`, `removeInvalidListValues`, `removeUnknown` (all opt-in) | ✅ |
| ternary / switch-case mode | `CasesOf<F, V>` + `compileCases()` + SQL CASE export | ✅ |
| showErrorMessage, i18n validation messages | per-node `issues` + schema `messages` overrides | ✅ |
| renderConfirm / useConfirm | `settings.confirmRemove(node)` (sync or async) + `store.requestRemove(id)` | ✅ |
| compressConfig / decompressConfig | `fieldsToJSON()` / `fieldsFromJSON()` | ✅ |
| undo/redo | ✅ (RAQB doesn't have it) | ✅ |
| `compile()`/`matches()` evaluation in JS | ✅ (RAQB doesn't have it) | ✅ |

## Formats

Per-codec support and lossy mappings: [formats.md](formats.md).

| RAQB | qnot | Status |
|---|---|---|
| export SQL | `formats/sql`: 5 dialects, params, CASE WHEN; Postgres jsonb array groups; multiEnum via arrays / JSON functions | ✅ |
| import SQL | `formats/sql` decode: hand-written WHERE parser (comparisons, LIKE, IN, BETWEEN, IS NULL, AND/OR/NOT, functions) | ✅ |
| export/import MongoDB | `formats/mongo`: `$elemMatch` / `$expr` + `$filter` counts, `$switch` cases | ✅ |
| export/import JsonLogic | `formats/jsonlogic`: some/all/none + reduce counts, `if` cases; checked with json-logic-js | ✅ |
| export queryString (human readable) | `formats/text` | ✅ |
| export/import SpEL | `formats/spel`: RAQB-compatible both ways (interop-tested with `spelFormat`/`loadFromSpel`) | ✅ |
| export ElasticSearch | `formats/elasticsearch`: bool/term/terms/range/wildcard/exists, `nested` array groups | ✅ |
| RAQB's own tree JSON | `formats/raqb`: rule_group, funcs (LOWER/UPPER/NOW/TODAY/RELATIVE_DATE), isLocked; interop-tested | ✅ |
| react-querybuilder / jQuery QueryBuilder JSON | `formats/rqb`, `formats/jqqb` (no functions or array groups in those libraries) | ✅ |

## UI frameworks

RAQB: React only (antd, MUI, Bootstrap, Fluent, vanilla widgets). qnot: headless core + React, vanilla DOM, Vue, Svelte, Solid bindings; any UI kit via hooks (coss ui recipe in the playground).
