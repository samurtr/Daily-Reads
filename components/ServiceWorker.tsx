"use client";

import { useEffect } from "react";
import { withBasePath } from "@/lib/basePath";

/**
 * Registers the service worker (built into out/sw.js by scripts/build-sw.mjs),
 * so the app installs to the home screen and cached titles and the Library open offline.
 */
export default function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register(withBasePath("/sw.js"), { scope: withBasePath("/") })
      .catch((err) => console.error("Service worker registration failed:", err));
  }, []);
  return null;
}
