/**
 * fx 텍스처 키 상수 + 이벤트→키 선택 (이벤트→키 매핑의 단일 진실).
 * 파일명(assets/fx/{key}.png)과 1:1. FxLayer와 textures.FX_FILES가 공유.
 */
export const FX = {
  slash: "slash",     // 참격 호 (평타·간접)
  flash: "flash",     // 흰 섬광 (평타·협공 임팩트)
  sparkle: "sparkle", // 대형 금빛 폭발 (회심·필살)
  coin: "coin",       // 코인팝 (격파, §12)
} as const;

export type FxKey = (typeof FX)[keyof typeof FX];

/** 임팩트 섬광 키 — 큰 타격(회심/필살)은 대형 금빛, 그 외 일반 섬광. */
export function pickFlashKey(big: boolean): FxKey {
  return big ? FX.sparkle : FX.flash;
}
