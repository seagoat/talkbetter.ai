import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable static export for Capacitor Android builds when BUILD_TARGET=android
  ...(process.env.BUILD_TARGET === 'android' && { output: 'export' as const }),
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
