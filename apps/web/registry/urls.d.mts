export function siteUrl(env?: Record<string, string | undefined>): string;
export function basePath(env?: Record<string, string | undefined>): string;
export function registryBase(env?: Record<string, string | undefined>): string;
export declare const DEFAULT_REPO_URL: string;
export declare const DEFAULT_PACKAGE_PREFIX: string;
export declare function repoUrl(env?: Record<string, string | undefined>): string;
export declare function packagePrefix(env?: Record<string, string | undefined>): string;
export declare function packageOf(spec: string): string;
export declare function brand(text: string, env?: Record<string, string | undefined>): string;
