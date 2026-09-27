import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: { root: __dirname },
  serverExternalPackages: ["exceljs"],
  // The marketplace zips plugin source at request time, so ship it with that function.
  outputFileTracingIncludes: {
    "/api/marketplace/download/[slug]": ["./plugins/**/*"],
  },
};

export default nextConfig;
