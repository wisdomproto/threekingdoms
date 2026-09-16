import type { NextConfig } from "next";
const config: NextConfig = {
  // Isolate production checks from a running Studio development server.
  distDir: process.env.TK_NEXT_DIST_DIR || ".next",
  // 워크스페이스 패키지는 TS 소스 그대로 export하므로 Next가 직접 트랜스파일해야 한다
  transpilePackages: ["@tk/data", "@tk/engine"],
};
export default config;
