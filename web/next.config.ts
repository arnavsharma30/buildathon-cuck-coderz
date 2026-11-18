import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The analytics dashboard was removed (DropOS is chat-only); old links go home instead of 404.
  async redirects() {
    return [
      { source: "/dashboard", destination: "/", permanent: false },
      { source: "/d/:path*", destination: "/", permanent: false },
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
