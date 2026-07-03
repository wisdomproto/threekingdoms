/**
 * 경로→BGM 라우팅(순수, env=node). 핵심: battleBoss는 보스 스테이지(각 장 결전)에서만 —
 * 고아 트랙이 되거나(종전 버그) 일반 전투에서 잘못 울리지 않게 회귀 가드.
 */
import { describe, it, expect } from "vitest";
import { bgmForPath } from "../bgmRoute";
import { BOSS_STAGE_NUMBERS } from "../../meta/interstitialPolicy";

describe("bgmForPath", () => {
  it("일반 전투는 battle, 보스 스테이지는 battleBoss", () => {
    expect(bgmForPath("/battle", "?stage=01-zhuojun")).toBe("battle");
    expect(bgmForPath("/battle", "?stage=05-sishuiguan")).toBe("battle");
    expect(bgmForPath("/battle", "?stage=04-zhangjue")).toBe("battleBoss");
    expect(bgmForPath("/battle", "?stage=27-huarongdao")).toBe("battleBoss");
  });

  it("모든 보스 번호가 battleBoss로 라우팅된다(정책 SSOT 동기화)", () => {
    for (const n of BOSS_STAGE_NUMBERS) {
      const id = `${String(n).padStart(2, "0")}-x`;
      expect(bgmForPath("/battle", `?stage=${id}`)).toBe("battleBoss");
    }
  });

  it("stage 쿼리 없으면 일반 전투 취급(직접 /battle 진입 폴백)", () => {
    expect(bgmForPath("/battle")).toBe("battle");
    expect(bgmForPath("/battle", "")).toBe("battle");
  });

  it("씬/타이틀/막간 라우팅", () => {
    expect(bgmForPath("/scene", "?stage=04-zhangjue&type=intro")).toBe("scene");
    expect(bgmForPath("/")).toBe("title");
    expect(bgmForPath("/prep", "?stage=04-zhangjue")).toBe("menu");
    expect(bgmForPath("/stages")).toBe("menu");
  });
});
