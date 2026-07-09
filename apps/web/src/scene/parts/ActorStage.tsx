"use client";
/**
 * ActorStage — 디에게틱 스테이지 씬(스펙 v2)의 배우 레이어. DOM/CSS 전용(Pixi 미사용).
 *
 * - 배우 = 절대 배치(left x%, top y%). 발끝을 앵커에 고정(translate(-50%,-100%)).
 * - z = y 오름차순(작을수록 뒤), 동률은 배열 순서(뒤가 앞).
 * - 등장/퇴장 = 상시 마운트 + opacity/translateX CSS transition(비가시 = 투명 + 측면 오프셋
 *   + pointerEvents none). 마운트/언마운트 방식 대신 — 재등장 시 슬라이드 복귀가 공짜.
 * - 스포트라이트 = speakingId 배우 밝기↑·scale 1.05·bob, 나머지는 어둡게.
 *   speakingId 미지정/미등장이면 아무도 강조하지 않음(no-op — 크래시 금지).
 * - 이미지 폴백 사다리 = ActorSprite(씬 포즈 → 초상 → CSS 실루엣). AssetImage 미사용.
 *
 * 위치가 parts/인 이유: scene/ 루트의 순수 헬퍼 actorStage.ts와 대소문자만 다른 이름이라
 * Windows(대소문자 무시 FS)에서 TS 모듈 해석이 충돌(TS1149) — 표현 조각 디렉터리로 격리.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import type { StageActor } from "@tk/data";
import { actorSpriteCandidates } from "../actorStage";
import { BRONZE_GOLD, PARCHMENT } from "./tokens";

/** 스프라이트 표시 높이(눈으로 튜닝 예정). scale은 이 위에 transform으로 곱한다. */
const SPRITE_HEIGHT = "clamp(140px, 32vh, 300px)";
/** 실루엣 폴백 박스 폭(높이는 SPRITE_HEIGHT 공유). */
const SILHOUETTE_WIDTH = "clamp(64px, 13vh, 124px)";

const KEYFRAMES = `
@keyframes tkActorBob { 0%, 100% { transform: translateY(0) } 50% { transform: translateY(-5px) } }
@keyframes tkActorEmoteIn { from { opacity: 0; transform: translate(-50%, 6px) scale(0.7) } to { opacity: 1; transform: translate(-50%, 0) scale(1) } }
`;

/**
 * 배우 스프라이트 — 폴백 체인 소유(씬 포즈 → 초상 → CSS 실루엣).
 * ⚠ onError 레이스 방어(레포 공통 함정): React가 핸들러를 붙이기 전에 빠른 404가 끝나면
 * onError를 놓친다 — 마운트 후 `complete && naturalWidth === 0`을 직접 감지(ItemIcon과 동형).
 */
function ActorSprite({ actor, flipped }: { actor: StageActor; flipped: boolean }): React.ReactElement {
  const candidates = useMemo(() => actorSpriteCandidates(actor), [actor]);
  const [ci, setCi] = useState(0);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    setCi(0); // 배우(에셋 키) 교체 시 사다리 처음부터 재시도
  }, [candidates]);

  useEffect(() => {
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth === 0) setCi((i) => i + 1);
  }, [ci, candidates]);

  if (ci >= candidates.length) {
    // 폴백 최종단: 어두운 라운드 박스 + 머리글자(초상 키 우선 — 한국어 이름 첫 글자).
    return (
      <div
        aria-label={actor.id}
        style={{
          width: SILHOUETTE_WIDTH,
          height: SPRITE_HEIGHT,
          borderRadius: "14px 14px 8px 8px",
          background: "linear-gradient(180deg, rgba(30,26,20,0.92) 0%, rgba(12,10,8,0.96) 100%)",
          border: `1px solid ${BRONZE_GOLD}44`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: PARCHMENT,
          fontSize: "clamp(28px, 6vh, 52px)",
          textShadow: "0 2px 6px rgba(0,0,0,0.8)",
        }}
      >
        {actor.portrait?.[0] ?? actor.id[0]}
      </div>
    );
  }

  return (
    <img
      ref={imgRef}
      src={candidates[ci]}
      alt={actor.id}
      draggable={false}
      onError={() => setCi((i) => i + 1)}
      style={{
        height: SPRITE_HEIGHT,
        width: "auto",
        display: "block",
        // facing="right"만 미러(그림자·말풍선은 뒤집지 않음 — img 한정).
        transform: flipped ? "scaleX(-1)" : undefined,
        filter: "drop-shadow(0 4px 10px rgba(0,0,0,0.45))",
      }}
    />
  );
}

export function ActorStage({
  actors,
  visibleIds,
  speakingId,
  emote,
}: {
  actors: readonly StageActor[];
  visibleIds: Set<string>;
  speakingId?: string;
  emote?: string;
}): React.ReactElement {
  // z-index = y 오름차순 랭크(동률은 배열 순서 — 뒤 원소가 앞).
  const zRank = useMemo(() => {
    const order = actors
      .map((a, i) => ({ id: a.id, y: a.y ?? 72, i }))
      .sort((p, q) => (p.y - q.y) || (p.i - q.i));
    const map = new Map<string, number>();
    order.forEach((o, rank) => map.set(o.id, rank + 1));
    return map;
  }, [actors]);

  const spotlightId = speakingId && visibleIds.has(speakingId) ? speakingId : undefined;

  return (
    <div aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
      <style>{KEYFRAMES}</style>
      {actors.map((actor) => {
        const visible = visibleIds.has(actor.id);
        const speaking = spotlightId === actor.id;
        const dimmed = spotlightId !== undefined && !speaking;
        const scale = (actor.scale ?? 1) * (speaking ? 1.05 : 1);
        // 퇴장/등장 슬라이드 방향 = 가까운 화면 가장자리 쪽(x 기준).
        const hideDx = actor.x < 50 ? -48 : 48;
        return (
          <div
            key={actor.id}
            style={{
              position: "absolute",
              left: `${actor.x}%`,
              top: `${actor.y ?? 72}%`,
              zIndex: zRank.get(actor.id) ?? 1,
              // 발끝 앵커 + 비가시 시 측면 오프셋(transition으로 슬라이드+페이드).
              transform: `translate(-50%, -100%)${visible ? "" : ` translateX(${hideDx}px)`}`,
              opacity: visible ? 1 : 0,
              transition: "transform 360ms ease-out, opacity 360ms ease-out",
              pointerEvents: "none",
            }}
          >
            {/* 발밑 그림자 — 앵커 고정, scale 무관(스케일 래퍼 바깥). */}
            <div
              style={{
                position: "absolute",
                bottom: -7,
                left: "50%",
                transform: "translateX(-50%)",
                width: 110,
                height: 24,
                borderRadius: "50%",
                background: "radial-gradient(ellipse at center, rgba(0,0,0,0.42) 0%, rgba(0,0,0,0) 68%)",
              }}
            />
            {/* 스케일·스포트라이트 래퍼(발끝 원점) */}
            <div
              style={{
                transform: `scale(${scale})`,
                transformOrigin: "bottom center",
                filter: `brightness(${speaking ? 1.06 : dimmed ? 0.72 : 1})`,
                transition: "transform 240ms ease-out, filter 240ms ease-out",
              }}
            >
              {/* bob은 별도 래퍼(인라인 transform과 keyframe 충돌 방지) */}
              <div style={{ position: "relative", animation: speaking ? "tkActorBob 1.6s ease-in-out infinite" : undefined }}>
                {speaking && emote && (
                  <div
                    style={{
                      position: "absolute",
                      bottom: "100%",
                      left: "50%",
                      transform: "translateX(-50%)",
                      marginBottom: 8,
                      padding: "2px 10px",
                      borderRadius: 12,
                      background: PARCHMENT,
                      border: `1px solid ${BRONZE_GOLD}`,
                      color: "#2a2118",
                      fontSize: 16,
                      fontWeight: 700,
                      lineHeight: "20px",
                      whiteSpace: "nowrap",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.5)",
                      animation: "tkActorEmoteIn 180ms ease-out both",
                    }}
                  >
                    {emote}
                  </div>
                )}
                <ActorSprite actor={actor} flipped={actor.facing === "right"} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
