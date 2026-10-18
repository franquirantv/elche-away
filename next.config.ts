import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep HTTP test output/lock separate from the owner's development server.
  distDir: process.env.ARCHIVE_TEST_SERVER === "1" ? ".next-test" : ".next",
};

export default nextConfig;
