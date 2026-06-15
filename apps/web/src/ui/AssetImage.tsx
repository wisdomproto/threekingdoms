"use client";
/**
 * AssetImage (캠페인 루프 W1) — 임의 placeholder + 드롭-인 업그레이드.
 *
 * 실제 파일이 경로에 있으면 그대로 표시하고, 없으면(404/onError) **라벨 placeholder**로 폴백한다.
 * "모든 에셋은 생성 출력물·재생성 가능"(§2-7) — 길중이 경로 규약에 파일을 넣으면 새로고침 시 자동 반영.
 *  - kind="portrait": 진영색 테두리 박스 + 이름 이니셜(초상 미보유 시).
 *  - kind="bg": 수묵 톤 그라데이션 + 라벨(씬 배경 미보유 시).
 * 필요한 이미지 목록은 에셋 매니페스트(docs/reference/asset-manifest.md)가 안내.
 */
import { useEffect, useState } from "react";

const INK = "#1a1714";
const INK_DEEP = "#0d0b09";
const BRONZE_GOLD = "#cdab6e";
const PARCHMENT = "#e8dcc0";

const SIDE_COLOR: Record<string, string> = {
  player: "#4da3ff",
  ally: "#ffa53d",
  enemy: "#ff6b6b",
};

export function AssetImage({
  src,
  kind,
  label,
  side,
  alt,
  style,
}: {
  /** 이미지 경로(없거나 로드 실패 시 placeholder). */
  src?: string;
  kind: "portrait" | "bg";
  /** placeholder에 표시할 이름/설명. */
  label: string;
  /** portrait 진영색(선택). */
  side?: string;
  alt?: string;
  style?: React.CSSProperties;
}): React.ReactElement {
  const [failed, setFailed] = useState(false);
  // src가 바뀌면 로드 재시도.
  useEffect(() => setFailed(false), [src]);

  if (src && !failed) {
    return (
      <img
        src={src}
        alt={alt ?? label}
        onError={() => setFailed(true)}
        style={{ objectFit: "cover", display: "block", width: "100%", height: "100%", ...style }}
      />
    );
  }

  if (kind === "bg") {
    return (
      <div
        aria-label={alt ?? label}
        style={{
          width: "100%",
          height: "100%",
          background: `radial-gradient(120% 90% at 50% 20%, ${INK} 0%, ${INK_DEEP} 85%)`,
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "center",
          ...style,
        }}
      >
        <span
          style={{
            color: "#4a4338",
            fontSize: 13,
            letterSpacing: "0.2em",
            padding: "0 0 18%",
            fontFamily: '"Noto Serif KR", serif',
            opacity: 0.8,
          }}
        >
          〔 {label} 〕
        </span>
      </div>
    );
  }

  // portrait placeholder — 진영색 테두리 + 이니셜.
  const color = (side && SIDE_COLOR[side]) || BRONZE_GOLD;
  return (
    <div
      aria-label={alt ?? label}
      style={{
        width: "100%",
        height: "100%",
        borderRadius: 6,
        border: `1.5px solid ${color}`,
        background: "rgba(0,0,0,0.35)",
        color,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "min(48px, 56%)",
        fontWeight: 800,
        fontFamily: '"Noto Serif KR", serif',
        ...style,
      }}
    >
      {label.slice(0, 1) || "?"}
    </div>
  );
}

export { PARCHMENT, BRONZE_GOLD, INK, INK_DEEP };
