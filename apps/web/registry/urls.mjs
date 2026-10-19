// Where the site lives: one place for the origin, the base path and the registry, shared by the site
// (src/lib/site.ts) and the registry build (scripts/build-registry.mjs). No Node APIs: safe in browsers.

/** Origin: NEXT_PUBLIC_SITE_URL, else the Vercel production domain, else the local dev server. */
export function siteUrl(env = process.env) {
  if (env.NEXT_PUBLIC_SITE_URL) return env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '');
  const vercel = env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL ?? env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercel) return `https://${vercel}`;
  return 'http://localhost:5192';
}

/** Next's basePath (e.g. "/qnot"), "" at the root. Set NEXT_PUBLIC_BASE_PATH and next.config's basePath together. */
export const basePath = (env = process.env) => (env.NEXT_PUBLIC_BASE_PATH ?? '').replace(/\/$/, '');

/** Base URL of the shadcn registry: `${registryBase()}/<name>.json`. */
export const registryBase = (env = process.env) => `${siteUrl(env)}${basePath(env)}/r`;

// ---- Brand: where the code lives and what its packages are called ---------------------------------
// The source says `@qnot/…` and links to DEFAULT_REPO_URL; NEXT_PUBLIC_PACKAGE_PREFIX and
// NEXT_PUBLIC_REPO_URL re-point everything the site emits (docs, code panels, install commands,
// registry files, llms.txt) without touching the source.

export const DEFAULT_REPO_URL = 'https://github.com/sean-brydon/trawlnet';
export const DEFAULT_PACKAGE_PREFIX = '@qnot/';

/** The repository's URL (no trailing slash). */
export const repoUrl = (env = process.env) => (env.NEXT_PUBLIC_REPO_URL || DEFAULT_REPO_URL).replace(/\/$/, '');

/** Import prefix of the packages: `@qnot/` gives `@qnot/react`; `@coss/qnot/` gives `@coss/qnot/react`. */
export const packagePrefix = (env = process.env) => {
  const p = env.NEXT_PUBLIC_PACKAGE_PREFIX || DEFAULT_PACKAGE_PREFIX;
  return p.endsWith('/') ? p : `${p}/`;
};

/** The npm package an import specifier comes from: its first two segments when scoped (`@coss/qnot/react` → `@coss/qnot`). */
export const packageOf = (spec) => (spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0]);

const INSTALL = /\b((?:pnpm|npm|yarn|bun)(?: dlx| x)? (?:add|install|i)(?: -{1,2}[A-Za-z-]+)*)((?: +[^\s;&|`'"<>]+)+)/g;

/** Rewrite the default package prefix and repository URL in any text for the configured brand. */
export function brand(text, env = process.env) {
  const prefix = packagePrefix(env);
  const repo = repoUrl(env);
  let out = text;
  if (repo !== DEFAULT_REPO_URL) out = out.split(DEFAULT_REPO_URL).join(repo);
  if (prefix !== DEFAULT_PACKAGE_PREFIX) {
    // Install lines name npm packages, so `@qnot/core @qnot/react` under `@coss/qnot/` installs `@coss/qnot` once.
    out = out.replace(INSTALL, (_, cmd, args) => {
      const pkgs = args.trim().split(/ +/).map((a) => (a.startsWith(DEFAULT_PACKAGE_PREFIX) ? packageOf(prefix + a.slice(DEFAULT_PACKAGE_PREFIX.length)) : a));
      return `${cmd} ${[...new Set(pkgs)].join(' ')}`;
    });
    out = out.split(DEFAULT_PACKAGE_PREFIX).join(prefix);
  }
  return out;
}
