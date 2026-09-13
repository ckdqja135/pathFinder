import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 상위 폴더(D:\Project)에 다른 lockfile이 있어 워크스페이스 루트 추론이 어긋나는
  // 것을 방지한다.
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
