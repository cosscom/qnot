import 'server-only';
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

// When each source file last changed, from one `git log` over the app at build time: the sitemap's
// lastModified. Files git doesn't know (new, or a shallow clone that misses their commit) fall
// back to the build time.

const APP = process.cwd();
export const BUILD_TIME = new Date().toISOString();

let cache: Map<string, string> | undefined;

function load(): Map<string, string> {
  if (cache) return cache;
  cache = new Map();
  try {
    const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: APP, encoding: 'utf8' }).trim();
    // Newest first: the first date seen for a file is its last change.
    const log = execFileSync('git', ['log', '--format=%x00%cI', '--name-only', '--', '.'], { cwd: APP, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    let date = '';
    for (const line of log.split('\n')) {
      if (line.startsWith('\0')) date = line.slice(1);
      else if (line && !cache.has(join(root, line))) cache.set(join(root, line), date);
    }
  } catch {
    // No git (or no history): everything gets the build time.
  }
  return cache;
}

/** The last commit date (ISO) of the newest of `files` (paths relative to apps/web), or the build time. */
export function lastModified(...files: (string | undefined)[]): string {
  const dates = load();
  let newest: string | undefined;
  for (const f of files) {
    if (!f) continue;
    const d = dates.get(join(APP, f));
    if (d && (!newest || d > newest)) newest = d;
  }
  return newest ?? BUILD_TIME;
}

/** Static routes under src/app → their page file (route groups like `(site)` dropped). */
let routes: Map<string, string> | undefined;
export function pageFileFor(path: string): string | undefined {
  if (!routes) {
    routes = new Map();
    const walk = (dir: string, route: string) => {
      if (!existsSync(dir)) return;
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        if (e.isDirectory()) {
          const seg = e.name;
          if (seg.startsWith('_') || seg.startsWith('[') || seg.startsWith('@')) continue;
          walk(join(dir, seg), seg.startsWith('(') ? route : `${route}/${seg}`);
        } else if (/^page\.(tsx|ts|mdx|jsx|js)$/.test(e.name)) {
          routes!.set(route || '/', relative(APP, join(dir, e.name)));
        }
      }
    };
    walk(join(APP, 'src', 'app'), '');
  }
  return routes.get(path);
}
