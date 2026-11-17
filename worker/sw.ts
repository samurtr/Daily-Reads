/// <reference lib="esnext" />
/// <reference lib="webworker" />
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    // Replaced at build time with every file of the static export (scripts/build-sw.mjs).
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  // The whole static app (pages, scripts, styles, icons), so cached titles and
  // the Library open offline. Claude API calls are never cached.
  precacheEntries: self.__SW_MANIFEST,
  precacheOptions: {
    // "/library/" is served by the precached "/library/index.html".
    directoryIndex: "index.html",
    cleanURLs: true,
    // "/article/?id=5" is served by the one precached article page; "_rsc" is
    // the cache-busting parameter of Next.js client navigations.
    ignoreURLParametersMatching: [/^utm_/, /^fbclid$/, /^id$/, /^_rsc$/],
  },
  skipWaiting: true,
  clientsClaim: true,
});

serwist.addEventListeners();
