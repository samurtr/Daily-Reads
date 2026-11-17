/**
 * The path the app is served from: "/Daily-Reads" on a GitHub Pages project
 * site, "" locally. Set from BASE_PATH in next.config.ts.
 */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** An app path with the base path in front, for places Next.js doesn't add it (e.g. location.href). */
export function withBasePath(path: string): string {
  return `${BASE_PATH}${path}`;
}

/** usePathname() without a trailing slash, so "/library/" and "/library" compare equal. */
export function normalizePath(pathname: string): string {
  return pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
}
