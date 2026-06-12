import { defineConfig } from "vitest/config";

// node 환경 — Pixi 무균 지대 (설계 §7). src/battle/* 전체와
// src/pixi/{projection,camera,gesture}는 pixi.js를 import하지 않으므로 jsdom 불필요.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/__tests__/**/*.test.ts"],
  },
});
