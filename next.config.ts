import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  serverExternalPackages: ["exceljs", "jspdf", "jspdf-autotable", "unpdf", "pdf-lib", "@google/genai", "z-ai-web-dev-sdk"],
};

export default nextConfig;
