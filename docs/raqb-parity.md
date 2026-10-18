# Feature parity with react-awesome-query-builder (RAQB 6.6)

Source: RAQB README + CONFIG.adoc. Status: ✅ done · 🚧 in progress · ⏭ intentionally different (with reason).

## Field types and widgets

| RAQB | trawlnet | Status |
|---|---|---|
| text, number, boolean, date | `f.text/number/boolean/date` | ✅ |
| time, datetime | `f.time()`, `f.datetime()` | 🚧 |
| select | `f.enum([...])` | ✅ |
| multiselect (field holds an array) | `f.multiEnum([...])` + `hasAny/hasAll/hasNone/setEq/setNeq` | 🚧 |
| treeselect / treemultiselect | `f.enum` / `f.multiEnum` options with `children` | 🚧 |
| `!struct` (subfields) | `f.struct({...})`, flattened to `address.city` paths, grouped in field pickers | 🚧 |
| `!group` some/array mode, aggregation (count) | `f.array({...})` + array groups with `match: some/all/none/{count}` | 🚧 |
| textarea, slider, rangeslider, price widgets | `widget`, `step`, `marks`, `prefix`/`suffix`, `rows` field hints | 🚧 |
| async listValues, search, load more, allowCustomValues | `search` (async options), `allowCustom` | 🚧 |
| `fieldName` / `tableName` (export name) | `column` | 🚧 |
| `label2`, `tooltip` | `description` | 🚧 |
| `hideForSelect`, `hideForCompare` | `hidden`, `comparable: false` | 🚧 |
| `excludeOperators` | `excludeOperators` | 🚧 |
| `defaultValue`, `defaultOperator`, `operators` | same | ✅ |
| `validateValue` (+ fixedValue) | `validate` (+ `fix`) | 🚧 |

## Operators

| RAQB | trawlnet | Status |
|---|---|---|
| equal, not_equal, less(_or_equal), greater(_or_equal) | `eq neq lt lte gt gte` | ✅ |
| like, not_like, starts_with, ends_with | `contains notContains startsWith endsWith` | ✅ |
| between, not_between | `between notBetween` | ✅ |
| is_null, is_not_null | `isNull isNotNull` | ✅ |
| is_empty, is_not_empty | `isEmpty isNotEmpty` | 🚧 |
| select_any_in, select_not_any_in | `in notIn` | ✅ |
| multiselect_contains/not_contains/equals/not_equals | `hasAll hasNone setEq setNeq` (+ `hasAny`) | 🚧 |
| proximity, custom operators with per-format output | `defineOperator()` registry with `evaluate` + per-codec `formats` | 🚧 |
| reversedOp / reverseOperatorsForNot | operator `inverse` | 🚧 |

## Values

| RAQB | trawlnet | Status |
|---|---|---|
| valueSources: value | `value` | ✅ |
| valueSources: field | `ref` | ✅ |
| valueSources: func (RHS functions, nested) | `call: { fn, args }` | 🚧 |
| fieldSources: func (LHS functions) | `field: { fn, args }` | 🚧 |
| funcs config (LOWER, NOW, RELATIVE_DATETIME, …) | `defineFunction()` + `builtinFunctions` | 🚧 |

## Structure and behaviour

| RAQB | trawlnet | Status |
|---|---|---|
| AND / OR conjunctions, NOT | `combinator`, `not` | ✅ |
| custom conjunctions (NOR, XOR…) | ⏭ NOR = NOT+OR; XOR has no portable SQL/Mongo meaning | ⏭ |
| drag and drop, canReorder, canRegroup | DnD + `canReorder`/`canRegroup` settings | 🚧 |
| lock rules/groups, showLock, canDeleteLocked | `locked` on nodes + settings | 🚧 |
| read-only / immutable{Groups,Fields,Ops,Values}Mode | `readOnly` + `immutable` settings | 🚧 |
| maxNesting, maxNumberOfRules | `maxDepth`, `maxRules` | 🚧 |
| canLeaveEmptyGroup, shouldCreateEmptyGroup | same names | 🚧 |
| clearValueOnChangeField/Op, setOpOnChangeField | `onFieldChange`, `onOperatorChange` | 🚧 |
| canCompareFieldWithField | `allowRefs` | 🚧 |
| removeIncomplete/Empty/InvalidRulesOnLoad, removeEmptyGroupsOnLoad | `sanitizeQuery()` + store `sanitize` option | 🚧 |
| ternary / switch-case mode | `CasesOf<F, V>` + `compileCases()` + SQL CASE export | 🚧 |
| showErrorMessage, i18n validation messages | per-node `issues` + schema `messages` overrides | 🚧 |
| renderConfirm / useConfirm | store `confirmRemove` hook | 🚧 |
| compressConfig / decompressConfig | `fieldsToJSON()` / `fieldsFromJSON()` | 🚧 |
| undo/redo | ✅ (RAQB doesn't have it) | ✅ |
| `compile()`/`matches()` evaluation in JS | ✅ (RAQB doesn't have it) | ✅ |

## Formats

| RAQB | trawlnet | Status |
|---|---|---|
| export SQL | `formats/sql` (5 dialects, params) | ✅ |
| export MongoDB | `formats/mongo` (two-way) | ✅ |
| export/import JsonLogic | `formats/jsonlogic` | ✅ |
| export queryString (human readable) | `formats/text` | 🚧 |
| export/import SpEL | `formats/spel` | 🚧 |
| export ElasticSearch | `formats/elasticsearch` | 🚧 |
| import SQL | `formats/sql` decode | 🚧 |
| RAQB's own tree JSON | `formats/raqb` (two-way, interop-tested) | ✅ |

## UI frameworks

RAQB: React only (antd, MUI, Bootstrap, Fluent, vanilla widgets). trawlnet: headless core + React, vanilla DOM, Vue, Svelte, Solid bindings; any UI kit via hooks (coss ui recipe in the playground).
