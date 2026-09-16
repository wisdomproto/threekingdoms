"use client";
import { useState } from "react";
import { spriteCandidates } from "../pixi/spriteMap";
import { assetUrl } from "../assetUrl";

/** Reuse battle idle figures; missing named art falls back to the unit class. */
export function CommanderFigure({ commanderId, classId, tier = 1, name }: { commanderId: string; classId: string; tier?: number; name: string }) {
  const candidates = spriteCandidates(commanderId, classId, "player", tier);
  const [failed, setFailed] = useState<string[]>([]);
  const id = candidates.find(candidate => !failed.includes(candidate));
  if (!id) return <span role="img" aria-label={`${name} 캐릭터 이미지 없음`} style={{ color: "#668296", fontSize: 32 }}>♟</span>;
  return <img src={assetUrl(`/assets/sprites/${id.split("/").map(encodeURIComponent).join("/")}/front_idle.webp`)} alt={`${name} 전신`} onError={() => setFailed(old => [...old, id])} style={{ display: "block", width: "100%", height: "100%", objectFit: "contain", filter: "drop-shadow(0 3px 2px rgba(0,0,0,0.15))" }} />;
}
