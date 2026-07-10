import { describe, it, expect } from "vitest";
import { actorFrameUrls, actorSpriteCandidates, visibleActorIds } from "../actorStage";
import type { StageActor, ScenarioLine } from "@tk/data";

const a = (id: string, portrait?: string): StageActor => ({ id, sprite: id, portrait, x: 50 });

describe("actorSpriteCandidates", () => {
  it("씬 포즈 URL → (portrait 있으면) 초상 URL 순", () => {
    const c = actorSpriteCandidates(a("liubei", "유비"));
    expect(c[0]).toContain("/assets/scene-actors/liubei.png");
    expect(c[1]).toContain("/assets/ui/portraits/유비.webp");
    expect(c).toHaveLength(2);
  });
  it("portrait 미저작이면 씬 포즈 1개만(실루엣은 URL 아님)", () => {
    expect(actorSpriteCandidates(a("zhouyu"))).toHaveLength(1);
  });
});

describe("actorFrameUrls (플립북)", () => {
  it("기본·_2·_3 프레임 URL을 순서대로 낸다", () => {
    const f = actorFrameUrls(a("liubei"));
    expect(f[0]).toContain("/assets/scene-actors/liubei.png");
    expect(f[1]).toContain("/assets/scene-actors/liubei_2.png");
    expect(f[2]).toContain("/assets/scene-actors/liubei_3.png");
    expect(f).toHaveLength(3);
  });
  it("frame 1 URL은 폴백 사다리 1단과 동일하다", () => {
    expect(actorFrameUrls(a("guanyu"))[0]).toBe(actorSpriteCandidates(a("guanyu"))[0]);
  });
});

describe("visibleActorIds (선행 스캔 규칙)", () => {
  const lines: ScenarioLine[] = [
    { text: "0 원경 내레이션" },
    { text: "1 근경 전환", enter: ["liubei", "guanyu"] },
    { text: "2", exit: ["liubei"] },
    { text: "3", enter: ["liubei"] },
  ];
  // liubei·guanyu는 lines 어딘가 enter에 나열 → 첫 enter 전 숨김. zhangfei는 미나열 → 상주.
  const actors = [a("liubei"), a("guanyu"), a("zhangfei")];

  it("enter에 나열된 배우는 그 줄 전까지 숨김, 미나열 배우는 상주", () => {
    expect(visibleActorIds(lines, 0, actors)).toEqual(new Set(["zhangfei"]));
  });
  it("enter 줄부터 보인다", () => {
    expect(visibleActorIds(lines, 1, actors)).toEqual(new Set(["zhangfei", "liubei", "guanyu"]));
  });
  it("exit는 그 줄부터 제거", () => {
    expect(visibleActorIds(lines, 2, actors).has("liubei")).toBe(false);
  });
  it("exit 후 enter 재등장", () => {
    expect(visibleActorIds(lines, 3, actors).has("liubei")).toBe(true);
  });
  it("같은 줄에 exit+enter 동시면 enter가 이긴다(exit 먼저 처리 — 재등장 우선)", () => {
    // zhangfei가 enter에 나열되므로 선행 스캔으로 0줄엔 숨김 → 처리 순서가 뒤집히면(enter 후 exit) 1줄에서도 안 보임.
    const sameLine: ScenarioLine[] = [
      { text: "0" },
      { text: "1 재등장", exit: ["zhangfei"], enter: ["zhangfei"] },
    ];
    expect(visibleActorIds(sameLine, 1, actors).has("zhangfei")).toBe(true);
  });
});
