/**
 * 경로→BGM 라우팅(순수, env=node). 핵심: /battle은 **항상 battle로 시작** —
 * 보스곡(battleBoss)은 라우트가 아니라 교전 트리거(BattleRenderer.maybeBossBgm)가 켠다(2026-07-04).
 * 라우트에서 보스곡이 새면 개전부터 긴장을 낭비하므로 회귀 가드.
 */
import { describe, it, expect } from "vitest";
import { bgmForPath } from "../bgmRoute";

describe("bgmForPath", () => {
  it("/battle은 보스 스테이지여도 항상 battle로 시작(보스곡=교전 트리거)", () => {
    expect(bgmForPath("/battle")).toBe("battle");
    expect(bgmForPath("/battle?stage=01-zhuojun")).toBe("battle");
    expect(bgmForPath("/battle?stage=04-zhangjue")).toBe("battle");
    expect(bgmForPath("/battle?stage=27-huarongdao")).toBe("battle");
  });

  it("씬/타이틀/막간 라우팅", () => {
    expect(bgmForPath("/scene")).toBe("scene");
    expect(bgmForPath("/")).toBe("title");
    expect(bgmForPath("/prep")).toBe("menu");
    expect(bgmForPath("/stages")).toBe("menu");
  });
});
