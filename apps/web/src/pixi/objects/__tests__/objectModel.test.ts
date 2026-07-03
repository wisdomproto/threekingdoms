// apps/web/src/pixi/objects/__tests__/objectModel.test.ts
import { describe, it, expect } from "vitest";
import { objectKind, decoVariant } from "../objectModel";

describe("objectKind", () => {
  it("wall → wall (autotiled)", () => expect(objectKind("wall")).toBe("wall"));
  it("gate → gate (stateful)", () => expect(objectKind("gate")).toBe("gate"));
  it.each(["mountain", "village", "barracks", "depot", "bridge", "plain", "grass"])(
    "%s → deco (texture layer decides)", (t) => expect(objectKind(t)).toBe("deco"),
  );
});

describe("decoVariant (유기적 변형 — Chunk 3 #4)", () => {
  it("결정론: 같은 (지형,칸)은 항상 같은 변형", () => {
    const a = decoVariant("forest", 7, 11);
    const b = decoVariant("forest", 7, 11);
    expect(a).toEqual(b);
  });

  it("미매핑 지형(plain 등)은 undefined — 자동 데코 없음", () => {
    expect(decoVariant("plain", 3, 3)).toBeUndefined();
    expect(decoVariant("grass", 3, 3)).toBeUndefined();
  });

  it("범위: scale 0.88~1.14, 자연물 오프셋 ±0.12 이내", () => {
    for (let gx = 0; gx < 20; gx++) {
      for (const t of ["forest", "mountain", "cliff"]) {
        const v = decoVariant(t, gx, gx * 3 + 1)!;
        expect(v.scale).toBeGreaterThanOrEqual(0.88);
        expect(v.scale).toBeLessThanOrEqual(1.14);
        expect(Math.abs(v.dx)).toBeLessThanOrEqual(0.12);
        expect(Math.abs(v.dy)).toBeLessThanOrEqual(0.12);
      }
    }
  });

  it("구조물(village 수레 등)은 오프셋 없이 제자리(반전/크기만)", () => {
    for (let gx = 0; gx < 10; gx++) {
      const v = decoVariant("village", gx, 5)!;
      expect(v.dx).toBe(0);
      expect(v.dy).toBe(0);
    }
  });

  it("산지는 rock_cluster/rock_boulder 2종이 섞인다", () => {
    const keys = new Set<string>();
    for (let gx = 0; gx < 12; gx++)
      for (let gy = 0; gy < 12; gy++) keys.add(decoVariant("mountain", gx, gy)!.key);
    expect(keys).toEqual(new Set(["rock_cluster", "rock_boulder"]));
  });

  it("숲은 나무 키 유지 + 반전이 양쪽 다 나온다", () => {
    const flips = new Set<boolean>();
    for (let gx = 0; gx < 12; gx++) {
      const v = decoVariant("forest", gx, 2)!;
      expect(v.key).toBe("tree_leafy");
      flips.add(v.flip);
    }
    expect(flips).toEqual(new Set([true, false]));
  });
});
