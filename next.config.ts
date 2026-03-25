import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // output: 'export', // Commented out for development with API routes. Uncomment for static export.
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
