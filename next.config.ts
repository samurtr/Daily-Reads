import type { NextConfig } from "next";

// The GitHub Pages workflow sets BASE_PATH (e.g. "/Daily-Reads" for a project
// site, "" for a user site or custom domain); locally it is unset.
const trimmed = (process.env.BASE_PATH ?? "").replace(/^\/+|\/+$/g, "");
const basePath = trimmed ? `/${trimmed}` : "";

const nextConfig: NextConfig = {
  // A static site in out/: GitHub Pages has no server, so the browser calls Claude directly.
  output: "export",
  basePath,
  // Emits /library/index.html etc., which every static host serves at /library/.
  trailingSlash: true,
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
};

export default nextConfig;
