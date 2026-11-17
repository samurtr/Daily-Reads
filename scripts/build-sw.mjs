// Builds out/sw.js after `next build` has written the static export to out/.
// The service worker precaches every file of the export under the base path.
import { getFileManifestEntries } from "@serwist/build";
import { build } from "esbuild";

// Same rule as next.config.ts: "/Daily-Reads" on a GitHub Pages project site, "" locally.
const trimmed = (process.env.BASE_PATH ?? "").replace(/^\/+|\/+$/g, "");
const basePath = trimmed ? `/${trimmed}` : "";

const { manifestEntries, count, size, warnings } = await getFileManifestEntries({
  globDirectory: "out",
  globPatterns: ["**/*.{html,txt,js,css,png,ico,svg,webmanifest,woff,woff2}"],
  globIgnores: ["sw.js"],
  maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
  // Hashed file names change with their content, so they need no revision.
  dontCacheBustURLsMatching: /\/_next\/static\//,
  manifestTransforms: [
    async (entries) => ({
      manifest: entries.map((entry) => ({ ...entry, url: `${basePath}/${entry.url}` })),
    }),
  ],
});
for (const warning of warnings) console.warn(`⚠ ${warning}`);

await build({
  entryPoints: ["worker/sw.ts"],
  outfile: "out/sw.js",
  bundle: true,
  minify: true,
  format: "iife",
  target: "es2022",
  define: {
    "self.__SW_MANIFEST": JSON.stringify(manifestEntries ?? []),
    "process.env.NODE_ENV": JSON.stringify("production"),
  },
  logLevel: "warning",
});

console.log(
  `✓ out/sw.js: ${count} precache entries (${(size / 1024).toFixed(0)} KiB), base path "${basePath || "/"}"`,
);
