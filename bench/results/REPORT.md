## Bundle size (minified + gzip)

| Library | JS gz (total) | JS gz excl. React | CSS gz |
| --- | ---: | ---: | ---: |
| prototype · React hooks | 70.4 KB | 2.9 KB | 0.0 KB |
| prototype · vanilla DOM | 3.1 KB | 3.1 KB | 0.0 KB |
| react-querybuilder 8.25 | 124.9 KB | 57.5 KB | 2.2 KB |
| react-awesome-query-builder 6.6 | 260.6 KB | 193.1 KB | 2.5 KB |
| jQuery QueryBuilder 3.0 | 68.3 KB | 68.3 KB | 44.2 KB |
| Syncfusion ej2 QueryBuilder 35 | 307.8 KB | 307.8 KB | 194.6 KB |
| DevExtreme FilterBuilder 26 | 283.3 KB | 283.3 KB | 92.2 KB |

## Mount, cold (first render in a fresh page, median)

| Library | 10 rules | 100 rules | 500 rules | 1000 rules |
| --- | ---: | ---: | ---: | ---: |
| prototype · React hooks | 15.9 ms | 40.4 ms | 131.6 ms | 297.4 ms |
| prototype · vanilla DOM | 9.3 ms | 28.2 ms | 122 ms | 266.8 ms |
| react-querybuilder 8.25 | 39.7 ms | 94.4 ms | 314.7 ms | 535.2 ms |
| react-awesome-query-builder 6.6 | 40.9 ms | 110.1 ms | 383.6 ms | 600.3 ms |
| jQuery QueryBuilder 3.0 | 25.9 ms | 85.6 ms | 381 ms | 874 ms |
| Syncfusion ej2 QueryBuilder 35 | 68.6 ms | 281 ms | 3060.3 ms | 6758.6 ms |
| DevExtreme FilterBuilder 26 | 17.9 ms | 35 ms | 85.1 ms | 140.9 ms |

## Mount, warm (second render, JIT warm)

| Library | 10 rules | 100 rules | 500 rules | 1000 rules |
| --- | ---: | ---: | ---: | ---: |
| prototype · React hooks | 3.2 ms | 24.2 ms | 101.8 ms | 260.1 ms |
| prototype · vanilla DOM | 2.7 ms | 24.1 ms | 111.4 ms | 236.7 ms |
| react-querybuilder 8.25 | 8.2 ms | 55.5 ms | 249.6 ms | 479.9 ms |
| react-awesome-query-builder 6.6 | 12.2 ms | 72.6 ms | 311.6 ms | 550.4 ms |
| jQuery QueryBuilder 3.0 | 9.2 ms | 63.5 ms | 356 ms | 833.5 ms |
| Syncfusion ej2 QueryBuilder 35 | 22.8 ms | 223.2 ms | 2811.9 ms | 6626.2 ms |
| DevExtreme FilterBuilder 26 | 2.8 ms | 15.2 ms | 59.7 ms | 109.6 ms |

## Keystroke latency (type into one value input, median)

| Library | 10 rules | 100 rules | 500 rules | 1000 rules |
| --- | ---: | ---: | ---: | ---: |
| prototype · React hooks | 0.1 ms | 0.3 ms | 0.8 ms | 2.5 ms |
| prototype · vanilla DOM | 0.1 ms | 0.2 ms | 0.9 ms | 1.8 ms |
| react-querybuilder 8.25 | 0.8 ms | 6.2 ms | 32.9 ms | 65.4 ms |
| react-awesome-query-builder 6.6 | 0.8 ms | 1.4 ms | 5.1 ms | 11.9 ms |
| jQuery QueryBuilder 3.0 | 0.1 ms | 0.3 ms | 2 ms | 9.3 ms |
| Syncfusion ej2 QueryBuilder 35 | 0.2 ms | 0.4 ms | 1.9 ms | 11.6 ms |
| DevExtreme FilterBuilder 26 | — | — | — | — |

## Keystroke main-thread CPU incl. deferred work + frame

| Library | 10 rules | 100 rules | 500 rules | 1000 rules |
| --- | ---: | ---: | ---: | ---: |
| prototype · React hooks | 1.3 ms | 3.6 ms | 11.2 ms | 10.1 ms |
| prototype · vanilla DOM | 0.9 ms | 2.5 ms | 12.4 ms | 3 ms |
| react-querybuilder 8.25 | 2.4 ms | 11.8 ms | 34 ms | 65.9 ms |
| react-awesome-query-builder 6.6 | 2.5 ms | 4.8 ms | 12.4 ms | 16.7 ms |
| jQuery QueryBuilder 3.0 | 1.5 ms | 0 ms | 0 ms | 0 ms |
| Syncfusion ej2 QueryBuilder 35 | 0.7 ms | 3.7 ms | 16.8 ms | 27.3 ms |
| DevExtreme FilterBuilder 26 | — | — | — | — |

## Add rule to root group (median)

| Library | 10 rules | 100 rules | 500 rules | 1000 rules |
| --- | ---: | ---: | ---: | ---: |
| prototype · React hooks | 0.4 ms | 0.8 ms | 1.9 ms | 3.5 ms |
| prototype · vanilla DOM | 0.3 ms | 0.6 ms | 1.6 ms | 2.1 ms |
| react-querybuilder 8.25 | 1.9 ms | 7.2 ms | 33.5 ms | 61.1 ms |
| react-awesome-query-builder 6.6 | 2.8 ms | 16 ms | 53.3 ms | 96.3 ms |
| jQuery QueryBuilder 3.0 | 0.7 ms | 0.7 ms | 1.4 ms | 7.3 ms |
| Syncfusion ej2 QueryBuilder 35 | 1.2 ms | 2.6 ms | 15.8 ms | 19.5 ms |
| DevExtreme FilterBuilder 26 | 4.8 ms | 4.8 ms | 5.3 ms | 6.2 ms |

## Retained JS heap after mount

| Library | 10 rules | 100 rules | 500 rules | 1000 rules |
| --- | ---: | ---: | ---: | ---: |
| prototype · React hooks | 413 KB | 1097 KB | 3885 KB | 7209 KB |
| prototype · vanilla DOM | 75 KB | 167 KB | 551 KB | 989 KB |
| react-querybuilder 8.25 | 1218 KB | 4481 KB | 17935 KB | 34721 KB |
| react-awesome-query-builder 6.6 | 2107 KB | 5800 KB | 20562 KB | 38603 KB |
| jQuery QueryBuilder 3.0 | 498 KB | 868 KB | 1556 KB | 2261 KB |
| Syncfusion ej2 QueryBuilder 35 | 1294 KB | 2895 KB | 8753 KB | 15336 KB |
| DevExtreme FilterBuilder 26 | 399 KB | 1555 KB | 6069 KB | 11489 KB |

## DOM elements

| Library | 10 rules | 100 rules | 500 rules | 1000 rules |
| --- | ---: | ---: | ---: | ---: |
| prototype · React hooks | 240 | 2319 | 11559 | 23109 |
| prototype · vanilla DOM | 240 | 2319 | 11559 | 23109 |
| react-querybuilder 8.25 | 362 | 3539 | 17659 | 35309 |
| react-awesome-query-builder 6.6 | 421 | 4106 | 20466 | 40916 |
| jQuery QueryBuilder 3.0 | 377 | 3626 | 18066 | 36116 |
| Syncfusion ej2 QueryBuilder 35 | 302 | 2867 | 14267 | 28517 |
| DevExtreme FilterBuilder 26 | 82 | 766 | 3806 | 7606 |

## Export to SQL (per call)

| Library | 10 rules | 100 rules | 500 rules | 1000 rules |
| --- | ---: | ---: | ---: | ---: |
| prototype · React hooks | 0.006 ms | 0.03 ms | 0.095 ms | 0.18 ms |
| prototype · vanilla DOM | 0.006 ms | 0.029 ms | 0.1 ms | 0.22 ms |
| react-querybuilder 8.25 | 0.036 ms | 0.126 ms | 0.465 ms | 0.795 ms |
| react-awesome-query-builder 6.6 | 0.163 ms | 0.966 ms | 4.55 ms | 7.885 ms |
| jQuery QueryBuilder 3.0 | 0.109 ms | 0.721 ms | 3.58 ms | 7.31 ms |
| Syncfusion ej2 QueryBuilder 35 | 0.021 ms | 0.09 ms | 0.425 ms | 0.82 ms |
| DevExtreme FilterBuilder 26 | — | — | — | — |

## Mount, cold (first render in a fresh page, median) — 4× CPU throttle

| Library | 100 rules | 500 rules | 1000 rules |
| --- | ---: | ---: | ---: |
| prototype · React hooks | 151.8 ms | 577.8 ms | 1109.6 ms |
| prototype · vanilla DOM | 105.9 ms | 513.3 ms | 1039.8 ms |
| react-querybuilder 8.25 | 353.5 ms | 1164.6 ms | 2224.2 ms |
| react-awesome-query-builder 6.6 | 462.6 ms | 1626.5 ms | 2645.3 ms |
| jQuery QueryBuilder 3.0 | 387.2 ms | 1726.8 ms | 3988.6 ms |
| Syncfusion ej2 QueryBuilder 35 | 1568.2 ms | 14293.2 ms | 53898.1 ms |
| DevExtreme FilterBuilder 26 | 147.5 ms | 414.5 ms | 617.6 ms |

## Mount, warm (second render, JIT warm) — 4× CPU throttle

| Library | 100 rules | 500 rules | 1000 rules |
| --- | ---: | ---: | ---: |
| prototype · React hooks | 97.8 ms | 500.2 ms | 979.8 ms |
| prototype · vanilla DOM | 82.4 ms | 484.5 ms | 971.2 ms |
| react-querybuilder 8.25 | 213 ms | 932.4 ms | 2077 ms |
| react-awesome-query-builder 6.6 | 315.9 ms | 1368 ms | 2415 ms |
| jQuery QueryBuilder 3.0 | 289 ms | 1615.3 ms | 3817.1 ms |
| Syncfusion ej2 QueryBuilder 35 | 1139.7 ms | 14369.7 ms | 59094.3 ms |
| DevExtreme FilterBuilder 26 | 68.4 ms | 297.4 ms | 485.5 ms |

## Keystroke latency (type into one value input, median) — 4× CPU throttle

| Library | 100 rules | 500 rules | 1000 rules |
| --- | ---: | ---: | ---: |
| prototype · React hooks | 1.3 ms | 7.6 ms | 57.9 ms |
| prototype · vanilla DOM | 0.9 ms | 4.5 ms | 35.8 ms |
| react-querybuilder 8.25 | 28.4 ms | 125.5 ms | 314.7 ms |
| react-awesome-query-builder 6.6 | 13 ms | 35.4 ms | 57.3 ms |
| jQuery QueryBuilder 3.0 | 1.5 ms | 33.9 ms | 59.1 ms |
| Syncfusion ej2 QueryBuilder 35 | 2 ms | 34.4 ms | 86 ms |
| DevExtreme FilterBuilder 26 | — | — | — |

## Keystroke main-thread CPU incl. deferred work + frame — 4× CPU throttle

| Library | 100 rules | 500 rules | 1000 rules |
| --- | ---: | ---: | ---: |
| prototype · React hooks | 10.9 ms | 30.8 ms | 63.9 ms |
| prototype · vanilla DOM | 11.1 ms | 26.8 ms | 45.5 ms |
| react-querybuilder 8.25 | 31 ms | 146.1 ms | 323.1 ms |
| react-awesome-query-builder 6.6 | 22 ms | 39.9 ms | 61.1 ms |
| jQuery QueryBuilder 3.0 | 10.6 ms | 33.7 ms | 69.6 ms |
| Syncfusion ej2 QueryBuilder 35 | 17.8 ms | 38.5 ms | 64.6 ms |
| DevExtreme FilterBuilder 26 | — | — | — |

## Add rule to root group (median) — 4× CPU throttle

| Library | 100 rules | 500 rules | 1000 rules |
| --- | ---: | ---: | ---: |
| prototype · React hooks | 4.3 ms | 28.7 ms | 50.8 ms |
| prototype · vanilla DOM | 2 ms | 6.5 ms | 11.7 ms |
| react-querybuilder 8.25 | 29.4 ms | 118 ms | 302 ms |
| react-awesome-query-builder 6.6 | 72.5 ms | 232.7 ms | 427 ms |
| jQuery QueryBuilder 3.0 | 6.9 ms | 8.2 ms | 34.8 ms |
| Syncfusion ej2 QueryBuilder 35 | 21.9 ms | 51.9 ms | 84.5 ms |
| DevExtreme FilterBuilder 26 | 26.3 ms | 42.7 ms | 43.1 ms |

## Retained JS heap after mount — 4× CPU throttle

| Library | 100 rules | 500 rules | 1000 rules |
| --- | ---: | ---: | ---: |
| prototype · React hooks | 1097 KB | 3880 KB | 7203 KB |
| prototype · vanilla DOM | 167 KB | 551 KB | 989 KB |
| react-querybuilder 8.25 | 4481 KB | 17931 KB | 34722 KB |
| react-awesome-query-builder 6.6 | 5794 KB | 20545 KB | 38622 KB |
| jQuery QueryBuilder 3.0 | 868 KB | 1556 KB | 2248 KB |
| Syncfusion ej2 QueryBuilder 35 | 2898 KB | 8721 KB | 15230 KB |
| DevExtreme FilterBuilder 26 | 1558 KB | 6064 KB | 11519 KB |

## DOM elements — 4× CPU throttle

| Library | 100 rules | 500 rules | 1000 rules |
| --- | ---: | ---: | ---: |
| prototype · React hooks | 2319 | 11559 | 23109 |
| prototype · vanilla DOM | 2319 | 11559 | 23109 |
| react-querybuilder 8.25 | 3539 | 17659 | 35309 |
| react-awesome-query-builder 6.6 | 4106 | 20466 | 40916 |
| jQuery QueryBuilder 3.0 | 3626 | 18066 | 36116 |
| Syncfusion ej2 QueryBuilder 35 | 2867 | 14267 | 28517 |
| DevExtreme FilterBuilder 26 | 766 | 3806 | 7606 |

## Export to SQL (per call) — 4× CPU throttle

| Library | 100 rules | 500 rules | 1000 rules |
| --- | ---: | ---: | ---: |
| prototype · React hooks | 0.086 ms | 0.37 ms | 0.63 ms |
| prototype · vanilla DOM | 0.093 ms | 0.345 ms | 0.765 ms |
| react-querybuilder 8.25 | 0.318 ms | 1.83 ms | 3.105 ms |
| react-awesome-query-builder 6.6 | 3.773 ms | 16.475 ms | 32.595 ms |
| jQuery QueryBuilder 3.0 | 3.027 ms | 14.94 ms | 32.145 ms |
| Syncfusion ej2 QueryBuilder 35 | 0.402 ms | 1.735 ms | 3.83 ms |
| DevExtreme FilterBuilder 26 | — | — | — |

