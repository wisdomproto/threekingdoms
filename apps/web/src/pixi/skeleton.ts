/**
 * skeleton — 자체 컷아웃(강체) 리그의 **순수 계산 계층** (Pixi 무의존, CLAUDE.md §3 "Pixi 무균 지대").
 *
 * 배경(§4): "수작업 프레임 애니메이션 금지 / 포즈 전환 + 트윈 / 유닛 = 시퀀스 재생기".
 * 풀 Spine(메시 변형·IK)이 아니라 **강체 컷아웃** — 본은 affine(x,y,rot,scale)만, 메시 변형 없음.
 * 무기 슬롯 실시간 교체(§13 BM)를 위해 슬롯-어태치먼트를 분리한다.
 *
 * 이 파일은 tools/rig-editor.html 이 export 하는 스켈레톤 JSON을 소비해
 * (클립, t) → 슬롯별 최종 변환(world transform + 그릴 이미지)을 **결정론적으로** 산출한다.
 * Pixi import 금지 — vitest node 환경에서 검증된다(렌더는 SkeletonView가 담당, 이 결과만 소비).
 *
 * 결정론: 같은 (skeleton, clip, t) 입력 → 항상 같은 출력. 난수·시계 의존 없음.
 * 배속/히트스톱은 호출측(UnitView)이 t를 어떻게 진행시키느냐의 문제 — 이 계층은 t에 대해 순수.
 */

/** 본 — 부모 상대 셋업 변환(affine). parent=null이면 루트(스켈레톤 원점 기준). */
export interface SkeletonBone {
  name: string;
  parent: string | null;
  /** 셋업 포즈(부모 상대). 각도는 **도(degree)**, CCW 양수. */
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
}

/** 슬롯 — 한 본에 붙는 그리기 단위. z로 그리기 순서(작을수록 뒤). */
export interface SkeletonSlot {
  name: string;
  bone: string;
  /** 현재 표시할 어태치먼트 이름(없으면 미표시). 무기 슬롯은 setActiveAttachment로 교체. */
  attachment: string | null;
  z: number;
}

/** 어태치먼트 — 슬롯에 붙는 이미지 + 본 상대 오프셋. width/height는 픽셀(앵커=중심). */
export interface SkeletonAttachment {
  name: string;
  /** 이미지 식별자(파일명 또는 data URI 키). SkeletonView가 텍스처로 해석. */
  image: string;
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  width: number;
  height: number;
}

/** 키프레임 — 본 셋업에 **가산**되는 애니메이션 델타(부모 상대). curve는 MVP에서 linear 고정. */
export interface Keyframe {
  time: number; // 초(seconds), clip 시작 0
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
}

export type ClipName = "idle" | "move" | "attack" | "hit";

/** 클립 — boneName → 키프레임 트랙. duration(초) 동안 보간/루프. */
export interface Clip {
  duration: number;
  /** 본별 키프레임 트랙(시간 오름차순). 트랙 없는 본은 셋업 포즈 유지. */
  timelines: Record<string, Keyframe[]>;
  /** idle/move는 루프, attack/hit는 1회(호출측이 t를 0..1로 클램프). 기본 추론은 isLooping(). */
  loop?: boolean;
}

export interface Skeleton {
  /** 스키마 버전 — 이후 curve/메시 확장 시 마이그레이션 분기점. */
  version: 1;
  name: string;
  bones: SkeletonBone[];
  slots: SkeletonSlot[];
  /** slotName → (attachmentName → attachment). 한 슬롯이 여러 어태치먼트(무기 교체)를 가질 수 있다. */
  attachments: Record<string, Record<string, SkeletonAttachment>>;
  clips: Partial<Record<ClipName, Clip>>;
}

/** 2D affine 행렬 (a,b,c,d,tx,ty) — Pixi Matrix와 동형. world 변환 결과 운반용. */
export interface Mat {
  a: number;
  b: number;
  c: number;
  d: number;
  tx: number;
  ty: number;
}

/** 한 슬롯의 최종 그리기 명세 — SkeletonView가 그대로 스프라이트에 적용. */
export interface PosedSlot {
  slot: string;
  image: string;
  /** 어태치먼트 오프셋까지 합성된 world 행렬. 스프라이트 앵커=(0.5,0.5) 기준. */
  world: Mat;
  z: number;
  width: number;
  height: number;
}

/** 본 로컬 변환(셋업 + 애니메이션 델타 합성 결과). */
interface BoneLocal {
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
}

const DEG2RAD = Math.PI / 180;

const IDENTITY: Mat = { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 };

/** 로컬 affine(x,y,rot°,sx,sy) → 행렬. */
export function localToMat(x: number, y: number, rotationDeg: number, scaleX: number, scaleY: number): Mat {
  const r = rotationDeg * DEG2RAD;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  return {
    a: cos * scaleX,
    b: sin * scaleX,
    c: -sin * scaleY,
    d: cos * scaleY,
    tx: x,
    ty: y,
  };
}

/** 행렬 곱 parent ∘ child (parent를 먼저 적용하는 좌표계 합성). */
export function mulMat(p: Mat, c: Mat): Mat {
  return {
    a: p.a * c.a + p.c * c.b,
    b: p.b * c.a + p.d * c.b,
    c: p.a * c.c + p.c * c.d,
    d: p.b * c.c + p.d * c.d,
    tx: p.a * c.tx + p.c * c.ty + p.tx,
    ty: p.b * c.tx + p.d * c.ty + p.ty,
  };
}

/** idle/move = 루프, attack/hit = 1회. clip.loop가 명시되면 우선. */
export function isLooping(name: ClipName, clip: Clip): boolean {
  if (typeof clip.loop === "boolean") return clip.loop;
  return name === "idle" || name === "move";
}

/** 트랙을 시간 time(초)에서 선형 보간. 트랙 밖은 끝 키프레임으로 클램프. */
function sampleTrack(track: Keyframe[], time: number): Keyframe {
  if (track.length === 0) {
    return { time, x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 };
  }
  const first = track[0]!;
  if (time <= first.time) return first;
  const last = track[track.length - 1]!;
  if (time >= last.time) return last;
  // 이진 탐색 대신 선형(트랙당 키프레임 소수 — MVP) — 결정론·단순성 우선.
  for (let i = 1; i < track.length; i++) {
    const k1 = track[i]!;
    if (time <= k1.time) {
      const k0 = track[i - 1]!;
      const span = k1.time - k0.time;
      const u = span > 0 ? (time - k0.time) / span : 0;
      return {
        time,
        x: k0.x + (k1.x - k0.x) * u,
        y: k0.y + (k1.y - k0.y) * u,
        rotation: k0.rotation + (k1.rotation - k0.rotation) * u,
        scaleX: k0.scaleX + (k1.scaleX - k0.scaleX) * u,
        scaleY: k0.scaleY + (k1.scaleY - k0.scaleY) * u,
      };
    }
  }
  return last;
}

/**
 * clip을 진행도 t(0..1)에서 샘플 → 각 본의 로컬 변환(셋업 + 델타) 맵.
 * 델타 합성: 위치는 가산, 회전은 가산(도), 스케일은 곱(키프레임 scale=1이 중립).
 */
function sampleBoneLocals(skeleton: Skeleton, clip: Clip, t: number): Map<string, BoneLocal> {
  const time = clamp01(t) * clip.duration;
  const locals = new Map<string, BoneLocal>();
  for (const bone of skeleton.bones) {
    const track = clip.timelines[bone.name];
    if (track && track.length > 0) {
      const kf = sampleTrack(track, time);
      locals.set(bone.name, {
        x: bone.x + kf.x,
        y: bone.y + kf.y,
        rotation: bone.rotation + kf.rotation,
        scaleX: bone.scaleX * kf.scaleX,
        scaleY: bone.scaleY * kf.scaleY,
      });
    } else {
      locals.set(bone.name, {
        x: bone.x,
        y: bone.y,
        rotation: bone.rotation,
        scaleX: bone.scaleX,
        scaleY: bone.scaleY,
      });
    }
  }
  return locals;
}

function clamp01(t: number): number {
  return t < 0 ? 0 : t > 1 ? 1 : t;
}

/**
 * 본 world 행렬 계산 — 부모를 먼저 해석하는 위상 순서로 누적.
 * bones 배열이 부모→자식 순이 아닐 수 있으므로 메모이즈 재귀로 안전하게 해석한다.
 * 사이클(잘못된 데이터)은 방문 표시로 끊어 IDENTITY로 폴백(무한 루프 방지).
 */
export function computeBoneWorlds(skeleton: Skeleton, clip: Clip, t: number): Map<string, Mat> {
  const locals = sampleBoneLocals(skeleton, clip, t);
  const byName = new Map(skeleton.bones.map((b) => [b.name, b]));
  const worlds = new Map<string, Mat>();
  const visiting = new Set<string>();

  const resolve = (name: string): Mat => {
    const cached = worlds.get(name);
    if (cached) return cached;
    if (visiting.has(name)) return IDENTITY; // 사이클 차단
    visiting.add(name);

    const bone = byName.get(name);
    const local = locals.get(name);
    if (!bone || !local) {
      visiting.delete(name);
      worlds.set(name, IDENTITY);
      return IDENTITY;
    }
    const localMat = localToMat(local.x, local.y, local.rotation, local.scaleX, local.scaleY);
    const world = bone.parent ? mulMat(resolve(bone.parent), localMat) : localMat;
    visiting.delete(name);
    worlds.set(name, world);
    return world;
  };

  for (const b of skeleton.bones) resolve(b.name);
  return worlds;
}

/**
 * 핵심 진입점 — (skeleton, clipName, t, overrides?) → z 오름차순 PosedSlot[].
 * @param t 진행도 0..1 (호출측이 시간/배속을 t로 정규화). attack/hit는 0..1, idle/move는 위상.
 * @param attachmentOverride slotName → attachmentName (무기 슬롯 실시간 교체). 미지정 슬롯은 기본 attachment.
 * @returns 그릴 슬롯만(어태치먼트 있는). z 오름차순 정렬(뒤→앞). 결정론적.
 */
export function poseSkeleton(
  skeleton: Skeleton,
  clipName: ClipName,
  t: number,
  attachmentOverride?: Record<string, string | null>,
): PosedSlot[] {
  const clip = skeleton.clips[clipName];
  // 클립 없으면 idle, idle도 없으면 셋업 포즈(빈 클립 0초)로 폴백 — 절대 throw 안 함(렌더 견고성).
  const effective: Clip = clip ?? skeleton.clips.idle ?? { duration: 0, timelines: {} };
  const worlds = computeBoneWorlds(skeleton, effective, t);

  const posed: PosedSlot[] = [];
  for (const slot of skeleton.slots) {
    const override = attachmentOverride ? attachmentOverride[slot.name] : undefined;
    const attachmentName = override !== undefined ? override : slot.attachment;
    if (!attachmentName) continue; // 미표시 슬롯

    const slotAttachments = skeleton.attachments[slot.name];
    const att = slotAttachments?.[attachmentName];
    if (!att) continue; // 어태치먼트 미정의 — 조용히 스킵(데이터 견고성)

    const boneWorld = worlds.get(slot.bone) ?? IDENTITY;
    const attMat = localToMat(att.x, att.y, att.rotation, att.scaleX, att.scaleY);
    posed.push({
      slot: slot.name,
      image: att.image,
      world: mulMat(boneWorld, attMat),
      z: slot.z,
      width: att.width,
      height: att.height,
    });
  }

  posed.sort((a, b) => a.z - b.z);
  return posed;
}

/** 스켈레톤 JSON 런타임 검증(에디터 export·외부 입력 방어). 통과 시 Skeleton, 실패 시 null. */
export function isSkeleton(obj: unknown): obj is Skeleton {
  if (!obj || typeof obj !== "object") return false;
  const s = obj as Partial<Skeleton>;
  if (s.version !== 1) return false;
  if (!Array.isArray(s.bones) || !Array.isArray(s.slots)) return false;
  if (!s.attachments || typeof s.attachments !== "object") return false;
  if (!s.clips || typeof s.clips !== "object") return false;
  for (const b of s.bones) {
    if (typeof b?.name !== "string") return false;
  }
  for (const sl of s.slots) {
    if (typeof sl?.name !== "string" || typeof sl?.bone !== "string") return false;
  }
  return true;
}
