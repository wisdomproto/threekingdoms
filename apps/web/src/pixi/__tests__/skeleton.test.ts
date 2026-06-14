import { describe, expect, it } from "vitest";
import {
  type Skeleton,
  computeBoneWorlds,
  isLooping,
  isSkeleton,
  localToMat,
  mulMat,
  poseSkeleton,
} from "../skeleton";

/** 2본(root→arm) + 1슬롯(weapon on arm) 최소 강체 리그. */
function makeSkeleton(): Skeleton {
  return {
    version: 1,
    name: "test",
    bones: [
      { name: "root", parent: null, x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
      { name: "arm", parent: "root", x: 10, y: -20, rotation: 0, scaleX: 1, scaleY: 1 },
    ],
    slots: [
      { name: "body", bone: "root", attachment: "torso", z: 0 },
      { name: "weapon", bone: "arm", attachment: "sword", z: 10 },
    ],
    attachments: {
      body: { torso: { name: "torso", image: "torso.png", x: 0, y: -10, rotation: 0, scaleX: 1, scaleY: 1, width: 20, height: 40 } },
      weapon: {
        sword: { name: "sword", image: "sword.png", x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, width: 8, height: 30 },
        spear: { name: "spear", image: "spear.png", x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, width: 6, height: 50 },
      },
    },
    clips: {
      idle: { duration: 2, timelines: {} },
      attack: {
        duration: 1,
        timelines: {
          arm: [
            { time: 0, x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
            { time: 1, x: 0, y: 0, rotation: 90, scaleX: 1, scaleY: 1 },
          ],
        },
      },
    },
  };
}

describe("skeleton math", () => {
  it("localToMat — 회전 0이면 스케일만, tx/ty 보존", () => {
    const m = localToMat(5, 7, 0, 2, 3);
    expect(m.a).toBe(2);
    expect(m.b).toBe(0);
    expect(m.c).toBeCloseTo(0, 12); // -0 가능 (−sin0)
    expect(m.d).toBe(3);
    expect(m.tx).toBe(5);
    expect(m.ty).toBe(7);
  });

  it("localToMat — 90도 회전(CCW)", () => {
    const m = localToMat(0, 0, 90, 1, 1);
    expect(m.a).toBeCloseTo(0, 6);
    expect(m.b).toBeCloseTo(1, 6);
    expect(m.c).toBeCloseTo(-1, 6);
    expect(m.d).toBeCloseTo(0, 6);
  });

  it("mulMat — identity는 항등원", () => {
    const m = localToMat(3, 4, 30, 1.5, 0.5);
    const id = { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 };
    const left = mulMat(id, m);
    expect(left.a).toBeCloseTo(m.a, 9);
    expect(left.tx).toBeCloseTo(m.tx, 9);
    expect(left.ty).toBeCloseTo(m.ty, 9);
  });
});

describe("computeBoneWorlds", () => {
  it("부모 변환이 자식에 누적된다 (root→arm world tx/ty)", () => {
    const sk = makeSkeleton();
    const worlds = computeBoneWorlds(sk, sk.clips.idle!, 0);
    const arm = worlds.get("arm")!;
    expect(arm.tx).toBeCloseTo(10, 6);
    expect(arm.ty).toBeCloseTo(-20, 6);
  });

  it("부모 회전이 자식 위치를 회전시킨다", () => {
    const sk = makeSkeleton();
    // root를 90도 회전 → arm(10,-20)이 world에서 (20,10)으로 (CCW, y축 부호 포함)
    sk.bones[0]!.rotation = 90;
    const worlds = computeBoneWorlds(sk, sk.clips.idle!, 0);
    const arm = worlds.get("arm")!;
    expect(arm.tx).toBeCloseTo(20, 5);
    expect(arm.ty).toBeCloseTo(10, 5);
  });

  it("사이클 데이터는 무한 루프 없이 폴백한다", () => {
    const sk = makeSkeleton();
    sk.bones[0]!.parent = "arm"; // root↔arm 사이클
    expect(() => computeBoneWorlds(sk, sk.clips.idle!, 0)).not.toThrow();
  });
});

describe("poseSkeleton — 결정론 + 클립 보간", () => {
  it("같은 입력 → 같은 출력 (결정론)", () => {
    const sk = makeSkeleton();
    const a = poseSkeleton(sk, "attack", 0.37);
    const b = poseSkeleton(sk, "attack", 0.37);
    expect(a).toEqual(b);
  });

  it("z 오름차순 정렬 (body=0 먼저, weapon=10 뒤)", () => {
    const sk = makeSkeleton();
    const posed = poseSkeleton(sk, "idle", 0);
    expect(posed.map((p) => p.slot)).toEqual(["body", "weapon"]);
  });

  it("attack 클립 t=0.5에서 arm이 45도 → weapon world가 회전한다", () => {
    const sk = makeSkeleton();
    const at0 = poseSkeleton(sk, "attack", 0).find((p) => p.slot === "weapon")!;
    const at5 = poseSkeleton(sk, "attack", 0.5).find((p) => p.slot === "weapon")!;
    // t=0은 회전 0(셋업), t=0.5는 45도 → 행렬 a 성분이 cos45≈0.707로 달라진다.
    expect(at0.world.a).toBeCloseTo(1, 5);
    expect(at5.world.a).toBeCloseTo(Math.cos((45 * Math.PI) / 180), 4);
  });

  it("무기 슬롯 실시간 교체 (override) — image가 바뀐다", () => {
    const sk = makeSkeleton();
    const base = poseSkeleton(sk, "idle", 0).find((p) => p.slot === "weapon")!;
    const swapped = poseSkeleton(sk, "idle", 0, { weapon: "spear" }).find((p) => p.slot === "weapon")!;
    expect(base.image).toBe("sword.png");
    expect(swapped.image).toBe("spear.png");
    expect(swapped.width).toBe(6);
  });

  it("override=null이면 슬롯 미표시", () => {
    const sk = makeSkeleton();
    const posed = poseSkeleton(sk, "idle", 0, { weapon: null });
    expect(posed.find((p) => p.slot === "weapon")).toBeUndefined();
  });

  it("정의되지 않은 클립은 idle/셋업으로 폴백 (throw 없음)", () => {
    const sk = makeSkeleton();
    expect(() => poseSkeleton(sk, "hit", 0.5)).not.toThrow();
    const posed = poseSkeleton(sk, "hit", 0.5);
    expect(posed.length).toBe(2); // body + weapon
  });

  it("t 클램프 — t<0, t>1도 안전", () => {
    const sk = makeSkeleton();
    expect(() => poseSkeleton(sk, "attack", -1)).not.toThrow();
    expect(() => poseSkeleton(sk, "attack", 5)).not.toThrow();
    const lo = poseSkeleton(sk, "attack", -1).find((p) => p.slot === "weapon")!;
    const at0 = poseSkeleton(sk, "attack", 0).find((p) => p.slot === "weapon")!;
    expect(lo.world.a).toBeCloseTo(at0.world.a, 9);
  });
});

describe("isLooping / isSkeleton", () => {
  it("idle/move는 루프, attack/hit는 1회 (기본 추론)", () => {
    const c = { duration: 1, timelines: {} };
    expect(isLooping("idle", c)).toBe(true);
    expect(isLooping("move", c)).toBe(true);
    expect(isLooping("attack", c)).toBe(false);
    expect(isLooping("hit", c)).toBe(false);
  });

  it("clip.loop 명시가 추론보다 우선", () => {
    expect(isLooping("attack", { duration: 1, timelines: {}, loop: true })).toBe(true);
    expect(isLooping("idle", { duration: 1, timelines: {}, loop: false })).toBe(false);
  });

  it("isSkeleton — 유효 스켈레톤 통과, 잡것 거부", () => {
    expect(isSkeleton(makeSkeleton())).toBe(true);
    expect(isSkeleton(null)).toBe(false);
    expect(isSkeleton({ version: 2, bones: [], slots: [], attachments: {}, clips: {} })).toBe(false);
    expect(isSkeleton({ version: 1, bones: "x", slots: [], attachments: {}, clips: {} })).toBe(false);
  });
});
