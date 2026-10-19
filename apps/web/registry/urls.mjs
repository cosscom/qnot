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
