"use client";
/**
 * CommanderPortrait — 부모 박스를 100% 채우는 장수 초상(cover, 상단 정렬).
 * 파일 없으면 이니셜 폴백(§5 임의 placeholder + 드롭인 업그레이드 규약).
 * 편성 카드/상세 히어로/출진 슬롯 칩이 공유 — 크기는 부모가 결정한다.
 */
import { useEffect, useRef, useState } from "react";
import { assetUrl } from "../assetUrl";

export function CommanderPortrait({
  commanderId,
  name,
}: {
  commanderId: string;
  /** 폴백 이니셜·alt용 표시 이름(미지정 시 commanderId) */
  name?: string;
}): React.ReactElement {
  const label = name ?? commanderId;
  const [failed, setFailed] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  useEffect(() => {
    setFailed(false);
    // onError가 React 핸들러 부착 전에 끝난 404 감지(ItemIcon과 동일 레이스 대응)
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth === 0) setFailed(true);
  }, [commanderId]);
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: "linear-gradient(to bottom, #2a2014, #171208)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      {!failed ? (
        <img
          ref={imgRef}
          src={assetUrl(`/assets/ui/portraits/${encodeURIComponent(commanderId)}.webp`)}
          alt={label}
          onError={() => setFailed(true)}
          style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top", display: "block" }}
        />
      ) : (
        <span style={{ fontSize: "min(9vw, 34px)", fontWeight: 900, color: "#8a6a28" }}>
          {label.charAt(0)}
        </span>
      )}
    </div>
  );
}
