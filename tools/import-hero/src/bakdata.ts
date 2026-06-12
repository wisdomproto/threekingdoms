import iconv from "iconv-lite";
import type { Commander, Item, InitialForce } from "@tk/data";

const SECTION_B = 0x0d00, ITEM_SIZE = 16, ITEM_COUNT = 63;
const SECTION_C = 0x1100, CMD_SIZE = 21, CMD_COUNT = 384;
const SECTION_D = 0x3080, FORCE_SIZE = 18;

const ITEM_CATEGORY = ["weapon", "treasure", "attackItem", "supplyItem", "horse", "book"] as const;

/** 원작 병종 코드(0x00~0x12) → unitClasses.json id (Task 3과 동일 순서) */
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
    const category = ITEM_CATEGORY[buf[o + 15]!];
    if (!name || !category) { itemByIndex.push(""); continue; }
    const id = name; // 아이템명은 63종 내 유일
    itemByIndex.push(id);
    items[id] = { id, name, category, power: buf[o + 13]!, bonusPercent: buf[o + 14]! };
  }

  // 장수 384 + 초기 편성 (1:1 인덱스)
  const commanders: Record<string, Commander> = {};
  const initialForces: Record<string, InitialForce> = {};
  const used = new Map<string, number>();
  for (let i = 0; i < CMD_COUNT; i++) {
    const o = SECTION_C + i * CMD_SIZE;
    const name = cp949(buf, o, 6);
    if (!name) continue; // 빈 슬롯
    const leadership = buf[o + 17]!, war = buf[o + 18]!, intelligence = buf[o + 19]!;
    if (leadership < 1 || leadership > 100 || war < 1 || war > 100 || intelligence < 1 || intelligence > 100) {
      console.warn(`skip out-of-range stats: #${i} ${name} (${leadership}/${war}/${intelligence})`);
      continue;
    }
    const n = (used.get(name) ?? 0) + 1;
    used.set(name, n);
    const id = n === 1 ? name : `${name}_${n}`; // 동명이인 처리
    commanders[id] = {
      id, name, leadership, war, intelligence,
      faceId: buf.readUInt16LE(o + 14),
    };

    const d = SECTION_D + i * FORCE_SIZE;
    const classId = CLASS_BY_CODE[buf[d + 7]!];
    if (!classId) continue;
    const slot = buf.subarray(d + 10, d + 18);
    const itemIds: string[] = [];
    for (const b of slot) if (b !== 0xff && itemByIndex[b]) itemIds.push(itemByIndex[b]!);
    initialForces[id] = {
      commanderId: id, faction: buf[d]!,
      troops: buf.readUInt16LE(d + 5), classId,
      level: buf.readUInt16LE(d + 8), items: itemIds,
    };
  }
  return { commanders, items, initialForces };
}
