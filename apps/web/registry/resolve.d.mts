export interface ResolvedFile {
  /** Path in this repository (apps/web). */
  path: string;
  /** shadcn target, with the @components/ placeholder. */
  target: string;
  /** Where it lands in a user's project with the default aliases. */
  install: string;
  content: string;
}

export interface ResolvedItem {
  name: string;
  type: string;
  title: string;
  description: string;
  docs?: string;
  files: ResolvedFile[];
  dependencies: string[];
  registryDependencies: string[];
  /** Other items of this registry it depends on. */
  own: string[];
}

export { registryBase } from './urls.mjs';
export function installPath(path: string): string;
export function resolveRegistry(options: { root: string; base: string }): ResolvedItem[];
