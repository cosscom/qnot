# Benchmark report

Headless Chromium (Playwright), production builds, the same tree of 10 fields in groups of 10 rules for every library, medians over fresh pages. Each bundle includes the library's own SQL/JSON export used to verify edits reached the model. Regenerate with `node build.mjs && node run.mjs && node report.mjs`.

## Bundle size (minified + gzip)

| Library | JS gz (total) | JS gz excl. React | CSS gz |
| --- | ---: | ---: | ---: |
| @qnot/react (default UI) | 89.9 KB | 22.4 KB | 0.8 KB |
| @qnot/dom (no framework) | 23.1 KB | 23.1 KB | 0.8 KB |
| react-querybuilder 8.25 | 124.9 KB | 57.5 KB | 2.2 KB |
| react-awesome-query-builder 6.6 | 260.6 KB | 193.1 KB | 2.5 KB |
| jQuery QueryBuilder 3.0 | 68.3 KB | 68.3 KB | 44.2 KB |
| Syncfusion ej2 QueryBuilder 35 | 307.8 KB | 307.8 KB | 194.6 KB |
| DevExtreme FilterBuilder 26 | 283.3 KB | 283.3 KB | 92.2 KB |

## Mount, cold (first render in a fresh page, median)

| Library | 10 rules | 100 rules | 500 rules | 1000 rules |
| --- | ---: | ---: | ---: | ---: |
| @qnot/react (default UI) | 20.4 ms | 44.8 ms | 84.4 ms | 120.9 ms |
| @qnot/dom (no framework) | 9.2 ms | 14.9 ms | 42.7 ms | 107.6 ms |
| react-querybuilder 8.25 | 32.6 ms | 75.7 ms | 256.3 ms | 484.3 ms |
| react-awesome-query-builder 6.6 | 34.7 ms | 94.2 ms | 317.9 ms | 588.7 ms |
| jQuery QueryBuilder 3.0 | 25.9 ms | 86 ms | 373.2 ms | 857.3 ms |
| Syncfusion ej2 QueryBuilder 35 | 58.8 ms | 268.2 ms | 2015 ms | 6569.6 ms |
| DevExtreme FilterBuilder 26 | 17.3 ms | 35 ms | 84.5 ms | 141.3 ms |

## Mount, warm (second render, JIT warm)

| Library | 10 rules | 100 rules | 500 rules | 1000 rules |
| --- | ---: | ---: | ---: | ---: |
| @qnot/react (default UI) | 2.1 ms | 24.9 ms | 59.4 ms | 92.2 ms |
| @qnot/dom (no framework) | 1.9 ms | 6.8 ms | 29.3 ms | 82.6 ms |
| react-querybuilder 8.25 | 6.8 ms | 44.4 ms | 202.8 ms | 435.8 ms |
| react-awesome-query-builder 6.6 | 10.1 ms | 57.4 ms | 273.8 ms | 546.3 ms |
| jQuery QueryBuilder 3.0 | 9.2 ms | 64.7 ms | 351 ms | 836.7 ms |
| Syncfusion ej2 QueryBuilder 35 | 20.4 ms | 217.3 ms | 1880.5 ms | 6294.3 ms |
| DevExtreme FilterBuilder 26 | 2.8 ms | 15.8 ms | 61.2 ms | 116.3 ms |

## Keystroke latency (type into one value input, median)

| Library | 10 rules | 100 rules | 500 rules | 1000 rules |
| --- | ---: | ---: | ---: | ---: |
| @qnot/react (default UI) | 0.2 ms | 0.3 ms | 0.3 ms | 0.4 ms |
| @qnot/dom (no framework) | 0.1 ms | 0.1 ms | 0.3 ms | 0.4 ms |
| react-querybuilder 8.25 | 0.7 ms | 4.8 ms | 26 ms | 57.3 ms |
| react-awesome-query-builder 6.6 | 0.7 ms | 1.1 ms | 3.5 ms | 8.4 ms |
| jQuery QueryBuilder 3.0 | 0.1 ms | 0.3 ms | 1.8 ms | 7.5 ms |
| Syncfusion ej2 QueryBuilder 35 | 0.2 ms | 0.4 ms | 1.5 ms | 3.1 ms |
| DevExtreme FilterBuilder 26 | — | — | — | — |

## Keystroke main-thread CPU incl. deferred work + frame

| Library | 10 rules | 100 rules | 500 rules | 1000 rules |
| --- | ---: | ---: | ---: | ---: |
| @qnot/react (default UI) | 1.7 ms | 2.3 ms | 6.2 ms | 5.8 ms |
| @qnot/dom (no framework) | 1.9 ms | 3.5 ms | 6.1 ms | 7.1 ms |
| react-querybuilder 8.25 | 3.6 ms | 14.1 ms | 40.3 ms | 64.7 ms |
| react-awesome-query-builder 6.6 | 3.7 ms | 6.3 ms | 15.1 ms | 21.5 ms |
| jQuery QueryBuilder 3.0 | 0.9 ms | 0 ms | 0 ms | 0 ms |
| Syncfusion ej2 QueryBuilder 35 | 0.4 ms | 3.5 ms | 15.1 ms | 16.8 ms |
| DevExtreme FilterBuilder 26 | — | — | — | — |

## Add rule to root group (median)

| Library | 10 rules | 100 rules | 500 rules | 1000 rules |
| --- | ---: | ---: | ---: | ---: |
| @qnot/react (default UI) | 0.7 ms | 0.6 ms | 0.8 ms | 1.5 ms |
| @qnot/dom (no framework) | 0.5 ms | 0.4 ms | 0.8 ms | 1.2 ms |
| react-querybuilder 8.25 | 2.2 ms | 5.7 ms | 27.3 ms | 52.3 ms |
| react-awesome-query-builder 6.6 | 2.3 ms | 11.7 ms | 48.2 ms | 94.6 ms |
| jQuery QueryBuilder 3.0 | 0.4 ms | 0.6 ms | 1.3 ms | 3.2 ms |
| Syncfusion ej2 QueryBuilder 35 | 1.1 ms | 1.5 ms | 2.7 ms | 16.3 ms |
| DevExtreme FilterBuilder 26 | 4.5 ms | 4.5 ms | 4.7 ms | 6 ms |

## Retained JS heap after mount

| Library | 10 rules | 100 rules | 500 rules | 1000 rules |
| --- | ---: | ---: | ---: | ---: |
| @qnot/react (default UI) | 690 KB | 2012 KB | 7355 KB | 13944 KB |
| @qnot/dom (no framework) | 274 KB | 726 KB | 2581 KB | 4870 KB |
| react-querybuilder 8.25 | 1217 KB | 4481 KB | 17934 KB | 34721 KB |
| react-awesome-query-builder 6.6 | 2107 KB | 5798 KB | 20562 KB | 38591 KB |
| jQuery QueryBuilder 3.0 | 498 KB | 868 KB | 1557 KB | 2261 KB |
| Syncfusion ej2 QueryBuilder 35 | 1294 KB | 2896 KB | 8726 KB | 15336 KB |
| DevExtreme FilterBuilder 26 | 399 KB | 1555 KB | 6069 KB | 11490 KB |

## DOM elements

| Library | 10 rules | 100 rules | 500 rules | 1000 rules |
| --- | ---: | ---: | ---: | ---: |
| @qnot/react (default UI) | 141 | 1311 | 6511 | 13011 |
| @qnot/dom (no framework) | 185 | 1643 | 8123 | 16223 |
| react-querybuilder 8.25 | 362 | 3539 | 17659 | 35309 |
| react-awesome-query-builder 6.6 | 421 | 4106 | 20466 | 40916 |
| jQuery QueryBuilder 3.0 | 377 | 3626 | 18066 | 36116 |
| Syncfusion ej2 QueryBuilder 35 | 302 | 2867 | 14267 | 28517 |
| DevExtreme FilterBuilder 26 | 82 | 766 | 3806 | 7606 |

## Export to SQL (per call)

| Library | 10 rules | 100 rules | 500 rules | 1000 rules |
| --- | ---: | ---: | ---: | ---: |
| @qnot/react (default UI) | 0.031 ms | 0.009 ms | 0.065 ms | 0.09 ms |
| @qnot/dom (no framework) | 0.006 ms | 0.008 ms | 0.075 ms | 0.1 ms |
| react-querybuilder 8.25 | 0.028 ms | 0.086 ms | 0.375 ms | 0.78 ms |
| react-awesome-query-builder 6.6 | 0.142 ms | 0.837 ms | 3.835 ms | 7.515 ms |
| jQuery QueryBuilder 3.0 | 0.108 ms | 0.723 ms | 3.54 ms | 6.895 ms |
| Syncfusion ej2 QueryBuilder 35 | 0.019 ms | 0.092 ms | 0.41 ms | 0.82 ms |
| DevExtreme FilterBuilder 26 | — | — | — | — |

## Mount, cold (first render in a fresh page, median) — 4× CPU throttle

| Library | 100 rules | 500 rules | 1000 rules |
| --- | ---: | ---: | ---: |
| react-querybuilder 8.25 | 353.5 ms | 1164.6 ms | 2224.2 ms |
| react-awesome-query-builder 6.6 | 462.6 ms | 1626.5 ms | 2645.3 ms |
| jQuery QueryBuilder 3.0 | 387.2 ms | 1726.8 ms | 3988.6 ms |
| Syncfusion ej2 QueryBuilder 35 | 1568.2 ms | 14293.2 ms | 53898.1 ms |
| DevExtreme FilterBuilder 26 | 147.5 ms | 414.5 ms | 617.6 ms |

## Mount, warm (second render, JIT warm) — 4× CPU throttle

| Library | 100 rules | 500 rules | 1000 rules |
| --- | ---: | ---: | ---: |
| react-querybuilder 8.25 | 213 ms | 932.4 ms | 2077 ms |
| react-awesome-query-builder 6.6 | 315.9 ms | 1368 ms | 2415 ms |
| jQuery QueryBuilder 3.0 | 289 ms | 1615.3 ms | 3817.1 ms |
| Syncfusion ej2 QueryBuilder 35 | 1139.7 ms | 14369.7 ms | 59094.3 ms |
| DevExtreme FilterBuilder 26 | 68.4 ms | 297.4 ms | 485.5 ms |

## Keystroke latency (type into one value input, median) — 4× CPU throttle

| Library | 100 rules | 500 rules | 1000 rules |
| --- | ---: | ---: | ---: |
| react-querybuilder 8.25 | 28.4 ms | 125.5 ms | 314.7 ms |
| react-awesome-query-builder 6.6 | 13 ms | 35.4 ms | 57.3 ms |
| jQuery QueryBuilder 3.0 | 1.5 ms | 33.9 ms | 59.1 ms |
| Syncfusion ej2 QueryBuilder 35 | 2 ms | 34.4 ms | 86 ms |
| DevExtreme FilterBuilder 26 | — | — | — |

## Keystroke main-thread CPU incl. deferred work + frame — 4× CPU throttle

| Library | 100 rules | 500 rules | 1000 rules |
| --- | ---: | ---: | ---: |
| react-querybuilder 8.25 | 31 ms | 146.1 ms | 323.1 ms |
| react-awesome-query-builder 6.6 | 22 ms | 39.9 ms | 61.1 ms |
| jQuery QueryBuilder 3.0 | 10.6 ms | 33.7 ms | 69.6 ms |
| Syncfusion ej2 QueryBuilder 35 | 17.8 ms | 38.5 ms | 64.6 ms |
| DevExtreme FilterBuilder 26 | — | — | — |

## Add rule to root group (median) — 4× CPU throttle

| Library | 100 rules | 500 rules | 1000 rules |
| --- | ---: | ---: | ---: |
| react-querybuilder 8.25 | 29.4 ms | 118 ms | 302 ms |
| react-awesome-query-builder 6.6 | 72.5 ms | 232.7 ms | 427 ms |
| jQuery QueryBuilder 3.0 | 6.9 ms | 8.2 ms | 34.8 ms |
| Syncfusion ej2 QueryBuilder 35 | 21.9 ms | 51.9 ms | 84.5 ms |
| DevExtreme FilterBuilder 26 | 26.3 ms | 42.7 ms | 43.1 ms |

## Retained JS heap after mount — 4× CPU throttle

| Library | 100 rules | 500 rules | 1000 rules |
| --- | ---: | ---: | ---: |
| react-querybuilder 8.25 | 4481 KB | 17931 KB | 34722 KB |
| react-awesome-query-builder 6.6 | 5794 KB | 20545 KB | 38622 KB |
| jQuery QueryBuilder 3.0 | 868 KB | 1556 KB | 2248 KB |
| Syncfusion ej2 QueryBuilder 35 | 2898 KB | 8721 KB | 15230 KB |
| DevExtreme FilterBuilder 26 | 1558 KB | 6064 KB | 11519 KB |

## DOM elements — 4× CPU throttle

| Library | 100 rules | 500 rules | 1000 rules |
| --- | ---: | ---: | ---: |
| react-querybuilder 8.25 | 3539 | 17659 | 35309 |
| react-awesome-query-builder 6.6 | 4106 | 20466 | 40916 |
| jQuery QueryBuilder 3.0 | 3626 | 18066 | 36116 |
| Syncfusion ej2 QueryBuilder 35 | 2867 | 14267 | 28517 |
| DevExtreme FilterBuilder 26 | 766 | 3806 | 7606 |

## Export to SQL (per call) — 4× CPU throttle

| Library | 100 rules | 500 rules | 1000 rules |
| --- | ---: | ---: | ---: |
| react-querybuilder 8.25 | 0.318 ms | 1.83 ms | 3.105 ms |
| react-awesome-query-builder 6.6 | 3.773 ms | 16.475 ms | 32.595 ms |
| jQuery QueryBuilder 3.0 | 3.027 ms | 14.94 ms | 32.145 ms |
| Syncfusion ej2 QueryBuilder 35 | 0.402 ms | 1.735 ms | 3.83 ms |
| DevExtreme FilterBuilder 26 | — | — | — |

