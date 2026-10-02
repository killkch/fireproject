import type { NextConfig } from "next";

/**
 * ========================================================
 * Next.js 설정 (next.config.ts)
 * ========================================================
 * Firebase Hosting 정적 호스팅 배포를 위해 output: "export" 설정
 */
const nextConfig: NextConfig = {
  output: "export",
  images: {
    unoptimized: true,
  },
  devIndicators: false,
};

export default nextConfig;
