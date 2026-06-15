/**
 * 밸런스 리포트 카드 + 회귀 게이트 (§11-A) 테스트.
 * 결정론 엔진이라 셀당 1런 — 시드 루프 없이 {정책 티어}×{레벨 오프셋} 매트릭스가 분포를 대체.
 *
 * 게이트(하드): 전 스테이지 greedy@+2 승(불가 구간 제로) + greedy@0 승·timeout 0(베이스라인 회귀).
 * 스냅샷: 스테이지별 분류 라벨을 BASELINE_LABELS와 대조 — 드리프트 시 실패.
 */
import { describe, it, expect } from "vitest";
import { stages } from "@tk/data";
import { withLevelOffset, runBattle } from "../src/runner";
import {
  classify,
  buildRows,
  type Label,
  type MatrixResult,
  type Cell,
} from "../src/reportCard";

/**
 * 회귀 스냅샷 — 스테이지별 분류 베이스라인(report-card CLI 출력으로 갱신).
 * 의도적 밸런스 변경 시 이 맵을 1줄 고치면 diff가 PR에 그대로 보인다.
 * 🟡BRITTLE(17 여남) = 그리디 봇이 +2에서 비단조로 짐 — 정책 한계지 데이터 불가 아님(게이트 비차단).
 */
const BASELINE_LABELS: Record<string, Label> = {
  "01-zhuojun": "HEALTHY", "02-yingchuan": "HEALTHY", "03-guangzong": "HEALTHY",
  "04-zhangjue": "EASY", "05-sishuiguan": "HEALTHY", "06-huluguan": "HEALTHY",
  "07-luoyang": "HEALTHY", "08-dongzhuo-chase": "HEALTHY", "09-banhe": "HEALTHY",
  "10-xuzhou": "HEALTHY", "11-xiaopei": "HEALTHY", "12-xiapi1": "HEALTHY",
  "13-yuanshu": "HEALTHY", "14-xiapi2": "HEALTHY", "15-xutian": "HEALTHY",
  "16-guandu-escape": "HEALTHY", "17-runan": "BRITTLE", "18-bowangpo": "HEALTHY",
  "19-xinye": "HEALTHY", "20-changbanpo": "HEALTHY", "21-changbanqiao": "HEALTHY",
  "22-hanjin": "HEALTHY", "23-jiangxia": "HEALTHY", "24-sanjiangkou": "HEALTHY",
  "25-wulin": "HEALTHY", "26-chibi": "HEALTHY", "27-huarongdao": "HEALTHY",
};

const cell = (result: Cell["result"], turns = 5, retreats = 0): Cell => ({ result, turns, retreats });

/** greedy/naive × [-2,0,2] 매트릭스 합성기(분류 단위테스트용). */
function matrix(g: [Cell, Cell, Cell], n: [Cell, Cell, Cell]): MatrixResult {
  return { greedy: { "-2": g[0], "0": g[1], "2": g[2] }, naive: { "-2": n[0], "0": n[1], "2": n[2] } };
}

describe("withLevelOffset (순수 — 플레이어 레벨만 이동)", () => {
  it("플레이어 유닛 레벨만 +offset, 적은 불변, [1,99] 클램프", () => {
    const stage = stages["05-sishuiguan"]!;
    const off = withLevelOffset(stage, 2);
    for (let i = 0; i < stage.units.length; i++) {
      const orig = stage.units[i]!;
      const got = off.units[i]!;
      if (orig.side === "player") {
        expect(got.level).toBe(Math.min(99, orig.level + 2));
      } else {
        expect(got.level).toBe(orig.level); // 적·우군 불변
      }
    }
  });

  it("offset 0이면 레벨 동일(원본 보존)", () => {
    const stage = stages["05-sishuiguan"]!;
    const off = withLevelOffset(stage, 0);
    expect(off.units.map((u) => u.level)).toEqual(stage.units.map((u) => u.level));
  });

  it("음수 오프셋도 최소 1로 클램프", () => {
    const stage = stages["05-sishuiguan"]!;
    const off = withLevelOffset(stage, -99);
    for (const u of off.units) if (u.side === "player") expect(u.level).toBe(1);
  });
});

describe("classify (6셀 → 1 라벨, 우선순위)", () => {
  it("greedy@0·greedy@+2 둘 다 패배면 IMPASSABLE(진짜 불가)", () => {
    const m = matrix(
      [cell("defeat"), cell("defeat"), cell("defeat")],
      [cell("defeat"), cell("defeat"), cell("defeat")],
    );
    expect(classify(m)).toBe("IMPASSABLE");
  });

  it("greedy@0 승·greedy@+2 패배는 BRITTLE(비단조 봇 아티팩트 — 17 여남)", () => {
    const m = matrix(
      [cell("defeat"), cell("victory", 18, 3), cell("defeat")],
      [cell("defeat"), cell("defeat"), cell("defeat")],
    );
    expect(classify(m)).toBe("BRITTLE");
  });

  it("greedy@0 승·greedy@+2 timeout도 BRITTLE", () => {
    const m = matrix(
      [cell("defeat"), cell("victory"), cell("timeout")],
      [cell("defeat"), cell("defeat"), cell("defeat")],
    );
    expect(classify(m)).toBe("BRITTLE");
  });

  it("greedy@0 패배·greedy@+2 승이면 HARD(오버레벨 필요)", () => {
    const m = matrix(
      [cell("defeat"), cell("defeat"), cell("victory")],
      [cell("defeat"), cell("defeat"), cell("defeat")],
    );
    expect(classify(m)).toBe("HARD");
  });

  it("naive@-2가 저턴·무퇴각 승이면 EASY", () => {
    const m = matrix(
      [cell("victory"), cell("victory"), cell("victory")],
      [cell("victory", 3, 0), cell("victory"), cell("victory")],
    );
    expect(classify(m)).toBe("EASY");
  });

  it("naive@-2 승이지만 턴이 많으면 EASY 아님(HEALTHY)", () => {
    const m = matrix(
      [cell("victory"), cell("victory"), cell("victory")],
      [cell("victory", 15, 0), cell("victory"), cell("victory")],
    );
    expect(classify(m)).toBe("HEALTHY");
  });

  it("greedy@0 승·timeout 0이고 trivial 아니면 HEALTHY", () => {
    const m = matrix(
      [cell("defeat"), cell("victory"), cell("victory")],
      [cell("defeat"), cell("victory", 12), cell("victory")],
    );
    expect(classify(m)).toBe("HEALTHY");
  });
});

describe("runBattle 옵션 (하위호환 + 정책/오프셋)", () => {
  it("기존 시그니처 runBattle(id, seed) 유지", () => {
    const r = runBattle("05-sishuiguan", 42);
    expect(["victory", "defeat", "timeout"]).toContain(r.result);
  });

  it("옵션 객체로 정책·레벨 오프셋 주입", () => {
    const r = runBattle("05-sishuiguan", { levelOffset: 2 });
    expect(["victory", "defeat", "timeout"]).toContain(r.result);
  });
});

describe("회귀 게이트 (§11-A — 전 스테이지 162런)", () => {
  const rows = buildRows(); // 27 × 6셀

  it("모든 스테이지가 BASELINE_LABELS와 일치(드리프트 감지)", () => {
    const got = Object.fromEntries(rows.map((r) => [r.stageId, r.label]));
    expect(got).toEqual(BASELINE_LABELS);
  });

  it("진짜 불가(IMPASSABLE) 스테이지 없음", () => {
    const impassable = rows.filter((r) => r.label === "IMPASSABLE").map((r) => r.stageId);
    expect(impassable).toEqual([]);
  });

  it("하드: 모든 스테이지 greedy@0 = victory & timeout 아님(베이스라인 회귀 catch)", () => {
    for (const r of rows) {
      const g0 = r.matrix.greedy["0"]!;
      expect(g0.result, `${r.stageId} greedy@0`).toBe("victory");
    }
  });
});
