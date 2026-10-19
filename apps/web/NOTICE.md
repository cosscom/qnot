# Notice: code adapted from cosscom/coss (AGPL-3.0)

This app (`apps/web`, the qnot website and docs) adapts code and design from
[cosscom/coss](https://github.com/cosscom/coss) and the coss ui component registry
([cosscom/ui](https://github.com/cosscom/ui)), both licensed **AGPL-3.0**. Those parts stay under
AGPL-3.0; this directory is therefore distributed under AGPL-3.0 as a whole.

**The `@qnot/*` packages in `packages/` are separate works, licensed MIT.** None of the code
listed here is used by, imported into, or shipped with any package under `packages/`.

## Adapted from cosscom/coss `apps/site`

| Here | Original |
| --- | --- |
| `src/components/site/site-shell.tsx` | `src/components/site-shell.tsx` |
| `src/components/site/site-header.tsx` | `src/components/site-header.tsx` |
| `src/components/site/site-footer.tsx` | `src/components/site-footer.tsx` |
| `src/components/site/command-menu.tsx` | `src/components/command-menu.tsx` |
| `src/components/site/mobile-nav.tsx` | `src/components/mobile-nav.tsx` |
| `src/components/site/copy-line.tsx` | `src/components/shipyard/copy-line.tsx` |
| `src/components/docs/docs-frame.tsx` | `src/components/docs-frame.tsx` |
| `src/components/docs/docs-sidebar.tsx` | `src/components/docs-sidebar.tsx` |
| `src/components/docs/docs-toc.tsx` | `src/components/docs-toc.tsx` |
| `src/components/docs/mdx.tsx` | `src/components/mdx.tsx`, `src/components/docs-table.tsx` |
| `src/components/drawings/stage.tsx` | `src/components/shipyard/stage.tsx` |
| `src/components/drawings/iso.tsx` | primitives of `src/components/shipyard/drawings.tsx`, `src/components/home/iso.tsx` |
| `src/styles/drawings.css` | `src/app/(shipyard)/shipyard/(home)/landing.css` |
| `src/app/global.css` (drafting grid, leader, container, code blocks) | `src/app/global.css` |
| `src/lib/docs-tree.ts` | `src/lib/docs-tree.ts` |
| `src/lib/use-active-indicator.ts` | `src/lib/use-active-indicator.ts` |
| page structure of `src/app/(site)/page.tsx` | `src/app/(shipyard)/shipyard/(home)/page.tsx` |

## From cosscom/coss `packages/ui` and the coss ui registry

- `src/styles/theme.css` (coss ui tokens) from `packages/ui/src/styles/theme.css`.
- `src/components/ui/*` (coss ui components, Base UI based), installed from the coss ui registry.

## Fonts

- Cal Sans (`src/fonts/CalSansVF*.woff2`): SIL Open Font License 1.1, see `src/fonts/OFL.txt`.
- JetBrains Mono, via `next/font/google`: SIL Open Font License 1.1.

## The shadcn registry is MIT

Everything served from `/r/*.json` (built from `registry/items.json` by `scripts/build-registry.mjs`)
is our own code under `src/components/qnot/`, MIT licensed like the `@qnot/*` packages; each
file says so in its header. None of the AGPL-3.0 files above is in the registry: the coss ui
components it needs are pulled from coss's own registry (`https://coss.com/ui/r/<name>.json`), never
copied into ours. `registry/resolve.mjs` rejects any registry file importing something outside npm,
`@/components/ui/*`, `@/lib/utils` or another registry file.
