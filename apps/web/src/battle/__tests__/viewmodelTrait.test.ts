/**
 * viewmodel.classTraitText 상성 방향 검증 (§8 부대특성).
 * lineAdvantage(cavalry→infantry→archer→cavalry)에서 "X에 강함 / Y에 약함"을 파생할 때
 * 방향이 뒤집히면 공략 정보가 거짓이 된다 — 엔진 ground-truth와 같은 방향임을 잠근다.
 * 사수관 픽스처에 4계열(관우=기병/조잠=보병/이숙=궁병/간옹=보조)이 모두 있다.
 */
import { describe, expect, it } from "vitest";
import { createBattle } from "@tk/engine";
import { unitVM } from "../viewmodel";
import { findUnit, sishuiCtx } from "./fixtures";

const ctx = sishuiCtx;
const battle = createBattle(ctx, 42);
const traitOf = (id: string): string => unitVM(ctx, findUnit(battle, id)).traitText ?? "";

describe("classTraitText — 상성 방향 (lineAdvantage 파생)", () => {
  it("기병계(관우): 보병계에 강함 · 궁병계에 약함", () => {
    const t = traitOf("관우");
    expect(t).toContain("기병계");
    expect(t).toContain("보병계에 강함");
    expect(t).toContain("궁병계에 약함");
  });

  it("보병계(조잠): 궁병계에 강함 · 기병계에 약함", () => {
    const t = traitOf("조잠");
    expect(t).toContain("보병계");
    expect(t).toContain("궁병계에 강함");
    expect(t).toContain("기병계에 약함");
  });

  it("궁병계(이숙): 기병계에 강함 · 보병계에 약함 + 간접공격(무반격)", () => {
    const t = traitOf("이숙");
    expect(t).toContain("궁병계");
    expect(t).toContain("기병계에 강함");
    expect(t).toContain("보병계에 약함");
    // 궁병은 rangeMax>1 → 간접 공격 무반격 문구
    const u = findUnit(battle, "이숙");
    if (u.rangeMax > 1) expect(t).toContain("간접 공격");
  });

  it("보조계(간옹): 상성 보정 없음", () => {
    const t = traitOf("간옹");
    expect(t).toContain("보조계");
    expect(t).toContain("상성 보정 없음");
  });

  it("방향 역전 금지: '강함'과 '약함'이 같은 계열을 가리키지 않는다", () => {
    // 기병계가 보병계에 강하면, 보병계는 기병계에 약해야 한다(역참조 일관성)
    expect(traitOf("관우")).toContain("보병계에 강함");
    expect(traitOf("조잠")).toContain("기병계에 약함");
  });
});

describe("classPassiveText — 병종 패시브 설명 (§7)", () => {
  const passiveOf = (id: string): string | undefined => unitVM(ctx, findUnit(battle, id)).passiveText;
  it("기병(관우): 돌격", () => expect(passiveOf("관우")).toContain("돌격"));
  it("보병(조잠): 철벽", () => expect(passiveOf("조잠")).toContain("철벽"));
  it("궁병(이숙): 저격", () => expect(passiveOf("이숙")).toContain("저격"));
  it("보조계(간옹): 패시브 없음", () => expect(passiveOf("간옹")).toBeUndefined());
});
