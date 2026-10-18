import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep HTTP test output/lock separate from the owner's development server.
  distDir: process.env.ARCHIVE_TEST_SERVER === "1" ? ".next-test" : process.env.ARCHIVE_TEST_SERVER === "manual" ? ".next-testing" : ".next",
};

export default nextConfig;
