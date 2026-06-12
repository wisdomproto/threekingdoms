import type { NextConfig } from "next";
const config: NextConfig = {
  // 워크스페이스 패키지는 TS 소스 그대로 export하므로 Next가 직접 트랜스파일해야 한다
  transpilePackages: ["@tk/data", "@tk/engine"],
};
export default config;
