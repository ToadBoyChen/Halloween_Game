import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // Any device opening the site goes straight to the join screen. The TV uses /hub.
  redirects() {
    return [
      { source: "/", destination: "/play", permanent: false },
      { source: "/test", destination: "/admin", permanent: false },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
