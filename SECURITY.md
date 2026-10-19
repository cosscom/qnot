# Security

## Reporting a vulnerability

Please report security issues privately to the maintainers (GitHub → Security → "Report a
vulnerability" on this repository) rather than in a public issue. Include the query JSON, the codec
options and the database/version that show the problem. We aim to acknowledge reports within three
working days.

## Threat model

qnot turns a **query** into SQL (and other formats) using a **schema**.

| Input | Trust | Why |
|---|---|---|
| Query JSON (rules, groups, operators, values, refs, calls, list conditions) | **Untrusted** | It comes from a browser or an API request and can be tampered with arbitrarily. |
| Schema (`defineFields`, column names, custom operators, custom functions, their `formats`) | **Trusted** | It is your code. Custom `formats.sql` functions emit SQL text you wrote. |

The goal: no query JSON can change the structure of the generated SQL in any dialect or mode, and no
query JSON can silently widen what it matches.

## Guarantees (sql codec)

- **Values never break out of literals.** Only JSON scalars (string, number, boolean, null) are ever
  written into SQL; objects, functions, symbols and anything with custom `toString`/`valueOf` are
  refused. Strings are written so they mean the same thing under every server setting:
  - Postgres: `'…'`, or `E'…'` with doubled backslashes when the value contains a backslash, which is
    safe with `standard_conforming_strings` on **or off**.
  - MySQL: `'…'`, or a hex literal `_utf8mb4 X'…'` when the value contains a backslash, which is safe
    with or without `NO_BACKSLASH_ESCAPES`.
  - SQL Server: `N'…'`. SQLite and ANSI: `'…'` (backslashes are not special).
  - NUL (`\u0000`) is refused in every mode (Postgres rejects it, SQLite truncates at it).
- **LIKE patterns match literally.** `%`, `_` and the escape character (and `[`, `]` on SQL Server)
  are escaped, and every `LIKE`/`ILIKE` names its escape character (`ESCAPE '!'`): MySQL and Postgres
  otherwise treat backslash as an escape. Case-insensitive equality on Postgres (`ILIKE`) escapes
  wildcards too.
- **Parameters.** With `params`, every untrusted value becomes a placeholder: rule values, list items,
  function arguments, custom operator values and switch-case results. Placeholders carry ids, so a
  function format that reorders or repeats its arguments still binds the right values. The only
  inlined text is the schema's column names and the codec's own keywords.
- **Names come from the schema only.** A rule's field, a field ref, a function name and a list field
  must be the schema's *own* keys (so `__proto__`, `constructor`, `toString` resolve to nothing).
  Unknown fields, operators and functions are refused, never echoed into SQL. Without
  `quoteIdentifiers`, column names must be plain identifiers or encoding throws.
- **Structure is validated.** Groups need `and`/`or`, a boolean `not`, an array of children and a valid
  list quantifier; a malformed group is refused even with `unsupported: 'skip'`. Each rule is read
  once and that snapshot is both validated and emitted, so getters can't swap a value after the check.
- **Nothing widens silently.** Invalid rules and rules a dialect can't express throw by default
  (`unsupported: 'skip'` opts in to dropping them). Only rules that are still missing a value are
  skipped. A switch case with no rules follows `emptyQuery`.
- **Built-in functions** validate their arguments when called directly as well: `relativeDate` only
  accepts a whole amount, a known unit and a known direction before interpolating them.
- **The SQL parser** (`decode`) is bounded: inputs over 1,000,000 characters and nesting deeper than
  200 levels are refused with an error, the tokenizer is linear, and error messages quote at most 120
  characters of the input.

## Your responsibilities

- **Validate untrusted queries** before using them: `assertValidQuery(fields, query)` (or rely on the
  codecs refusing invalid rules) and decide what an empty query means (`emptyQuery: 'all' | 'none' |
  'throw'`; the default `'all'` matches every row).
- **Prefer parameterized output** (`sqlFormat({ params: … })`) and send it through your driver's
  parameter binding (server-side prepared statements where available).
- **Custom operators and functions** are your SQL. Their `formats.sql` receives the field as SQL and
  values as escaped literals or placeholders; never interpolate `raw` values into SQL without
  checking them yourself.
- **Schema names** (`column`, field keys) are written into SQL as identifiers. Keep them static, or
  turn on `quoteIdentifiers`.
- **Collations decide equality.** qnot's escaping is exact, but your database's collation can
  still treat strings as equal that `compile()` doesn't: MySQL PAD SPACE and SQL Server ignore
  trailing spaces, width- or accent-insensitive collations fold characters, SQLite `LIKE` ignores ASCII
  case unless `PRAGMA case_sensitive_like = ON`. These differ in which rows match, never in the
  structure of the query.

## Audit (October 2026)

A review of the sql codec, its parser, the shared codec helpers, the built-in function formats and
the validation gate, followed by differential fuzzing against real databases.

### Findings and fixes

| # | Severity | Where | Finding | Fix | Test |
|---|---|---|---|---|---|
| 1 | Critical | Postgres, inline | With `standard_conforming_strings = off` a backslash in a value escaped the closing quote; an injected `UNION SELECT` was executed. | `E'…'` literals with doubled backslashes whenever a value contains a backslash. | `security.test.ts` › string literals; harness `pg-scs-off` |
| 2 | High | Postgres + MySQL, params | The inline `ESCAPE '\'` literal broke parameterized LIKE queries under non-default settings. | Escape character `!` in every dialect. | › LIKE patterns |
| 3 | High | all, inline | `?`, `$1`, `:p` inside inlined function arguments could be mistaken for placeholders by client-side parameter substitution; arguments were also inlined in params mode. | Function arguments, custom operator values and case results are parameters; placeholder tokens carry ids. | › functions, › switch cases |
| 4 | High | all | `__proto__`/`constructor`/`toString` as a field, ref or function name resolved to `Object.prototype` members (crashes, or an unknown name passed to SQL). | Own-property lookups everywhere; columns must be schema fields. | › untrusted names |
| 5 | Medium | all | A tampered `combinator` (anything but `and`) was treated as OR; a non-boolean `not` was truthy; a bad list quantifier produced broken SQL. | Group shape validation; malformed groups always throw. | › structure |
| 6 | Medium | all | Values with custom `toString`/`valueOf` or getters could differ between validation and emission. | Scalars only; each rule snapshotted once. | › values |
| 7 | Medium | MySQL | With `NO_BACKSLASH_ESCAPES`, doubled backslashes corrupted values (wrong rows, broken JSON). | Hex literals for values containing backslashes. | › string literals; harness `mysql-nobackslash` |
| 8 | Medium | SQL Server | `[`, `]` in LIKE values acted as wildcard classes (wider matches). Non-ASCII literals lacked `N`. | Escape `[ ]`; `N'…'` literals. | › LIKE patterns |
| 9 | Medium | Postgres, `caseInsensitive` | Case-insensitive equality used `ILIKE` without escaping, so `%`/`_` in a value matched more rows. | Escaped pattern + `ESCAPE`. | › LIKE patterns |
| 10 | Medium | parser | 100k-deep parentheses overflowed the stack (`RangeError`); error messages echoed whole inputs. | Depth limit (200), size limit, linear tokenizer, truncated messages. | › the SQL parser; `sql-parse-fuzz.ts` |
| 11 | Low | switch cases | A case whose condition had no rules became `WHEN 1 = 1`. | Follows `emptyQuery`. | › switch cases |
| 12 | Low | built-ins | `relativeDate` interpolated its unit/direction if called directly, bypassing validation. | Argument whitelist inside the format. | › functions |

Earlier in the same audit: present-but-invalid values were silently dropped by export codecs and
`compile()` (widening the query); they are now refused (`unsupported` / `invalidRules`), and only
incomplete rules are skipped. NUL characters are refused.

### Differential fuzzing

`bench/security/sql-dbs.ts` stores a corpus of injection payloads (quote breakouts, comments, stacked
queries, `UNION SELECT`, tautologies, time-based `pg_sleep`/`SLEEP`/`WAITFOR`, Unicode quote
look-alikes, backslash sequences, LIKE metacharacters, control characters, long strings) and queries
them through every operator (text, enum, multi-value, numbers, nested and negated groups) in inline
and parameterized mode, plus a set of hand-tampered queries. For every query: no SQL errors, no
statement over 2 s, a canary table survives, inline results equal parameterized results on the same
server (the escaping oracle: bound parameters can't be injected), and results are compared with
`compile()`.

Results of the final run (1,500 random queries per database, each in both modes, plus 12 tampered
queries × 2 modes):

| Database | Statements run | Refused at encode | SQL errors | Timeouts | inline ≠ params | rows ≠ `compile()` | Canary | Tampered emitted |
|---|---:|---:|---:|---:|---:|---:|---|---:|
| SQLite 3.51 (bun:sqlite) | 2,498 | 444 | 0 | 0 | 0 | 0 | intact | 0 |
| Postgres 16.15 | 2,530 | 470 | 0 | 0 | 0 | 0 | intact | 0 |
| Postgres 16.15, `standard_conforming_strings = off` | 2,522 | 478 | 0 | 0 | 0 | 0 | intact | 0 |
| MySQL 8.4.11 | 2,542 | 458 | 0 | 0 | 0 | 0 | intact | 0 |
| MySQL 8.4.11, `NO_BACKSLASH_ESCAPES` | 2,534 | 466 | 0 | 0 | 0 | 0 | intact | 0 |
| SQL Server (Azure SQL Edge 15.0) | 2,520 | 480 | 0 | 0 | 0 | 6 (trailing-space padding) | intact | 0 |

"Refused at encode" are randomly generated rules that are invalid for their field (for example a list
given to a single-value operator); they throw instead of reaching the database.

Before the fixes, the same harness produced 157 SQL errors and an executed `UNION` on Postgres with
`standard_conforming_strings = off`, and 90 errors plus 20 wrong-row results on MySQL with
`NO_BACKSLASH_ESCAPES`.

Remaining differences from `compile()` are collation semantics, not escaping: SQL Server compares
`''` and `' '` as equal (trailing-space padding), and bun:sqlite drops a leading U+FEFF from *bound*
strings (it binds UTF-16), so those payloads are skipped on SQLite.

`bench/security/sql-parse-fuzz.ts` fed 20,112 inputs to the parser (random token soup with payloads,
100,000-deep parentheses, `NOT` chains and nested calls, 20,000-term OR chains, 50,000-item IN lists,
strings up to 1.2 MB): every input parsed or failed with a qnot error, the slowest in under 50 ms.
20,000 encode → decode → encode round trips across five dialects were identical.

### Running it

```sh
docker run -d --name qn-pg -e POSTGRES_PASSWORD=pw -p 55432:5432 postgres:16
docker run -d --name qn-mysql -e MYSQL_ROOT_PASSWORD=pw -e MYSQL_DATABASE=t -p 53306:3306 mysql:8.4
docker run -d --name qn-mssql -e ACCEPT_EULA=Y -e MSSQL_SA_PASSWORD='Str0ng!Passw0rd' -p 51433:1433 mcr.microsoft.com/mssql/server:2022-latest
bun bench/security/sql-dbs.ts        # N=…, ONLY=sqlite,pg,pg-scs-off,mysql,mysql-nobackslash,mssql
bun bench/security/sql-parse-fuzz.ts
bun bench/core/sql-fuzz.ts           # SQLite only, no Docker
```

CI runs all three on every push (`.github/workflows/ci.yml`, job `security`, with Postgres, MySQL and
SQL Server service containers).

### Not covered

- Other codecs (Mongo, JsonLogic, Elasticsearch, SpEL) produce data structures rather than SQL text;
  they were not part of this audit.
- Oracle, MariaDB-specific modes, CockroachDB and BigQuery were not tested.
- The Azure SQL Edge image stands in for SQL Server locally (arm64); CI uses SQL Server 2022.
