import { createSerwistRoute } from "@serwist/turbopack";

// Changes with every build, so a new deploy refreshes the precached pages.
const revision = process.env.VERCEL_GIT_COMMIT_SHA ?? crypto.randomUUID();

export const { dynamic, dynamicParams, revalidate, generateStaticParams, GET } =
  createSerwistRoute({
    swSrc: "app/sw.ts",
    useNativeEsbuild: true,
    // The app's screens, precached so they open without a connection.
    additionalPrecacheEntries: ["/", "/library", "/article", "/settings", "/welcome"].map(
      (url) => ({ url, revision }),
    ),
  });
