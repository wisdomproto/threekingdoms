"use client";
/**
 * Minimap (조조전 sosoden-battle-ux-analysis §1·§2: 우상단 상시 미니맵 — 아군/적 색점).
 * 격자 지형을 다운샘플 틴트로 그리고 그 위에 유닛 점을 찍는다. canvas 직접 드로(rAF 무관) —
 * settled 기반 vm.units가 바뀔 때만 다시 그린다. 정보 전용(pointerEvents none).
 */
import { useEffect, useRef } from "react";
import type { BattleMap } from "@tk/data";
import type { UnitVM } from "../viewmodel";
import type { MinimapViewport } from "../store";
import { MINIMAP_FRAME } from "./frames";

/** 지형 id → 미니맵 색 (export_layout 팔레트의 채도 낮춘 버전) */
const TERRAIN_COLOR: Record<string, string> = {
  plain: "#b9a86a",
  grass: "#93b06a",
  forest: "#4f6e46",
  mountain: "#8a7a5e",
  waste: "#b0a079",
  river: "#5f93c4",
  bridge: "#9a7b54",
  wall: "#5a5a62",
  gate: "#7a6a52",
  barracks: "#b08a6a",
  depot: "#b89a6a",
  village: "#c9a06a",
  fort: "#9a8a78",
  cliff: "#6e6258",
};
const DEFAULT_COLOR = "#8a8270";

const BOX_W = 144; // 캔버스 논리 폭(px)

export function Minimap({
  map,
  units,
  selectedId,
  viewport,
}: {
  map: BattleMap;
  units: UnitVM[];
  selectedId: string | null;
  /** 카메라 가시영역(타일 좌표) — 흰 뷰포트 박스(§6). 미설정이면 미표시 */
  viewport?: MinimapViewport | null;
}): React.ReactElement {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const boxH = Math.max(40, Math.round((BOX_W * map.height) / map.width));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = typeof window !== "undefined" ? Math.min(window.devicePixelRatio || 1, 2) : 1;
    canvas.width = BOX_W * dpr;
    canvas.height = boxH * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, BOX_W, boxH);

    const cw = BOX_W / map.width;
    const ch = boxH / map.height;

    // 지형 틴트
    for (let y = 0; y < map.height; y++) {
      const row = map.tiles[y] ?? "";
      for (let x = 0; x < map.width; x++) {
        const id = map.tileLegend[row[x] ?? ""] ?? "plain";
        ctx.fillStyle = TERRAIN_COLOR[id] ?? DEFAULT_COLOR;
        ctx.fillRect(x * cw, y * ch, Math.ceil(cw), Math.ceil(ch));
      }
    }
    // 살짝 어둡게 깔아 점 대비 ↑
    ctx.fillStyle = "rgba(10,12,15,0.25)";
    ctx.fillRect(0, 0, BOX_W, boxH);

    // 유닛 점
    const r = Math.max(2, Math.min(cw, ch) * 1.6);
    for (const u of units) {
      if (u.retreated) continue;
      const px = (u.x + 0.5) * cw;
      const py = (u.y + 0.5) * ch;
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      // 아군 파랑 / 우군(ally) 주황 / 적 빨강 (Tier 2-1 피아식별)
      ctx.fillStyle = u.side === "player" ? "#4da3ff" : u.side === "ally" ? "#ffa53d" : "#ff6b6b";
      ctx.fill();
      if (u.id === selectedId) {
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = "#ffffff";
        ctx.stroke();
      }
    }

    // 카메라 뷰포트 박스 (§6 "흰 뷰포트 박스") — 맵 경계로 클램프
    if (viewport) {
      const x0 = Math.max(0, viewport.x) * cw;
      const y0 = Math.max(0, viewport.y) * ch;
      const x1 = Math.min(map.width, viewport.x + viewport.w) * cw;
      const y1 = Math.min(map.height, viewport.y + viewport.h) * ch;
      if (x1 > x0 && y1 > y0) {
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = "rgba(255, 255, 255, 0.92)";
        ctx.strokeRect(x0 + 0.5, y0 + 0.5, x1 - x0 - 1, y1 - y0 - 1);
      }
    }
  }, [map, units, selectedId, boxH, viewport]);

  return (
    <div
      style={{
        width: BOX_W,
        // 청동 코너 프레임(border-image) — 4모서리만, 변 사이는 투명
        ...MINIMAP_FRAME,
        background: "rgba(15, 18, 22, 0.82)",
        backgroundClip: "padding-box",
        pointerEvents: "none",
        userSelect: "none",
      }}
    >
      <canvas ref={canvasRef} style={{ width: BOX_W, height: boxH, display: "block", borderRadius: 2 }} />
    </div>
  );
}
