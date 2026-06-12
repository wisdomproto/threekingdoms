import iconv from "iconv-lite";
import type { Commander, Item, InitialForce } from "@tk/data";

const SECTION_B = 0x0d00, ITEM_SIZE = 16, ITEM_COUNT = 63;
const SECTION_C = 0x1100, CMD_SIZE = 21, CMD_COUNT = 384;
const SECTION_D = 0x3080, FORCE_SIZE = 18;

// Fix M-1: 레코드 내 필드 오프셋 상수 (레퍼런스 §2와 교차 검증 가능)
const ITEM_OFF_POWER = 13, ITEM_OFF_BONUS = 14, ITEM_OFF_CATEGORY = 15;
const CMD_OFF_FACE = 14, CMD_OFF_LEADERSHIP = 17, CMD_OFF_WAR = 18, CMD_OFF_INT = 19;
const FORCE_OFF_FACTION = 0, FORCE_OFF_TROOPS = 5, FORCE_OFF_CLASS = 7, FORCE_OFF_LEVEL = 8, FORCE_OFF_ITEMS = 10;

const ITEM_CATEGORY = ["weapon", "treasure", "attackItem", "supplyItem", "horse", "book"] as const;

/** 원작 병종 코드(0x00~0x12) → unitClasses.json id (Task 3과 동일 순서)
 * // 0x04 crossbowman·0x0B outlaw·0x11 civilian은 BAKDATA 초기 편성에 미등장 (챕터 전용/NPC)
 */
export const CLASS_BY_CODE = [
  "footman", "pikeman", "chariot", "archer", "crossbowman", "catapult",
  "lightCavalry", "heavyCavalry", "guardCavalry", "bandit", "brigand", "outlaw",
  "band", "beastUnit", "brawler", "sorcerer", "tribesman", "civilian", "transport",
] as const;

function cp949(buf: Buffer, start: number, len: number): string {
  const raw = buf.subarray(start, start + len);
  const end = raw.indexOf(0);
  return iconv.decode(end >= 0 ? raw.subarray(0, end) : raw, "cp949").trim();
}

export interface BakdataResult {
  commanders: Record<string, Commander>;
  items: Record<string, Item>;
  initialForces: Record<string, InitialForce>;
}

export function parseBakdata(buf: Buffer): BakdataResult {
  // 아이템 63종 (인덱스 순서 = 세이브의 아이템 번호)
  const itemByIndex: string[] = [];
  const items: Record<string, Item> = {};
  for (let i = 0; i < ITEM_COUNT; i++) {
    const o = SECTION_B + i * ITEM_SIZE;
    const name = cp949(buf, o, 13);
    const category = ITEM_CATEGORY[buf[o + ITEM_OFF_CATEGORY]!];
    if (!name || !category) { itemByIndex.push(""); continue; }
    const id = name; // 아이템명은 63종 내 유일
    itemByIndex.push(id);
    items[id] = { id, name, category, power: buf[o + ITEM_OFF_POWER]!, bonusPercent: buf[o + ITEM_OFF_BONUS]! };
  }

  // 장수 384 + 초기 편성 (1:1 인덱스)
  const commanders: Record<string, Commander> = {};
  const initialForces: Record<string, InitialForce> = {};
  const used = new Map<string, number>();
  for (let i = 0; i < CMD_COUNT; i++) {
    const o = SECTION_C + i * CMD_SIZE;
    const rawName = cp949(buf, o, 6);
    if (!rawName) continue; // 빈 슬롯
    // Fix I-2: 미공개 슬롯(？？？)은 안전한 ASCII id로 정규화
    const name = /^？+$/.test(rawName) ? "unknown" : rawName;
    const leadership = buf[o + CMD_OFF_LEADERSHIP]!, war = buf[o + CMD_OFF_WAR]!, intelligence = buf[o + CMD_OFF_INT]!;
    if (leadership < 1 || leadership > 100 || war < 1 || war > 100 || intelligence < 1 || intelligence > 100) {
      console.warn(`skip out-of-range stats: #${i} ${name} (${leadership}/${war}/${intelligence})`);
      continue;
    }
    const n = (used.get(name) ?? 0) + 1;
    used.set(name, n);
    const id = n === 1 ? name : `${name}_${n}`; // 동명이인/미공개슬롯 처리
    commanders[id] = {
      id, name, leadership, war, intelligence,
      faceId: buf.readUInt16LE(o + CMD_OFF_FACE),
    };

    const d = SECTION_D + i * FORCE_SIZE;
    // Fix I-1: troops=0인 미등록 슬롯은 skip — 엔진 divide-by-zero 방지
    const troops = buf.readUInt16LE(d + FORCE_OFF_TROOPS);
    if (troops === 0) {
      console.warn(`skip zero-troops force: ${id} (faction 0x${buf[d + FORCE_OFF_FACTION]!.toString(16)})`);
      continue;
    }
    const classId = CLASS_BY_CODE[buf[d + FORCE_OFF_CLASS]!];
    if (!classId) continue;
    const slot = buf.subarray(d + FORCE_OFF_ITEMS, d + FORCE_OFF_ITEMS + 8);
    const itemIds: string[] = [];
    for (const b of slot) if (b !== 0xff && itemByIndex[b]) itemIds.push(itemByIndex[b]!);
    initialForces[id] = {
      commanderId: id, faction: buf[d + FORCE_OFF_FACTION]!,
      troops, classId,
      level: buf.readUInt16LE(d + FORCE_OFF_LEVEL), items: itemIds,
    };
  }
  return { commanders, items, initialForces };
}
