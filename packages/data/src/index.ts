import { z } from "zod";
import {
  TerrainSchema, UnitClassSchema, CombatConfigSchema,
  CommanderSchema, ItemSchema, InitialForceSchema, BattleMapSchema, StageSchema, StrategySchema,
  RosterEntrySchema, ShopSchema,
  type Terrain, type UnitClass, type CombatConfig,
  type Commander, type Item, type InitialForce, type BattleMap, type Stage, type Strategy,
  type RosterEntry, type Shop,
} from "./schemas";
import terrainsJson from "../json/terrains.json";
import unitClassesJson from "../json/unitClasses.json";
import combatJson from "../json/combat.json";
import commandersJson from "../json/commanders.json";
import itemsJson from "../json/items.json";
import strategiesJson from "../json/strategies.json";
import initialForcesJson from "../json/initialForces.json";
import rostersJson from "../json/rosters.json";
import shopCh1Json from "../json/shops/ch1.json";
// ── 맵 (27스테이지, 챕터 순) ───────────────────────────────────────────────
import zhuojunJson from "../json/maps/zhuojun.json";
import yingchuanJson from "../json/maps/yingchuan.json";
import guangzongJson from "../json/maps/guangzong.json";
import zhangjueJson from "../json/maps/zhangjue.json";
import sishuiguanJson from "../json/maps/sishuiguan.json";
import huluguanJson from "../json/maps/huluguan.json";
import luoyangJson from "../json/maps/luoyang.json";
import dongzhuoChaseJson from "../json/maps/dongzhuo-chase.json";
import banheJson from "../json/maps/banhe.json";
import xuzhouJson from "../json/maps/xuzhou.json";
import xiaopeiJson from "../json/maps/xiaopei.json";
import xiapi1Json from "../json/maps/xiapi1.json";
import yuanshuJson from "../json/maps/yuanshu.json";
import xiapi2Json from "../json/maps/xiapi2.json";
import xutianJson from "../json/maps/xutian.json";
import guanduEscapeJson from "../json/maps/guandu-escape.json";
import runanJson from "../json/maps/runan.json";
import bowangpoJson from "../json/maps/bowangpo.json";
import xinyeJson from "../json/maps/xinye.json";
import changbanpoJson from "../json/maps/changbanpo.json";
import changbanqiaoJson from "../json/maps/changbanqiao.json";
import hanjinJson from "../json/maps/hanjin.json";
import jiangxiaJson from "../json/maps/jiangxia.json";
import sanjiangkouJson from "../json/maps/sanjiangkou.json";
import wulinJson from "../json/maps/wulin.json";
import chibiJson from "../json/maps/chibi.json";
import huarongdaoJson from "../json/maps/huarongdao.json";
// ── 스테이지 (27, 챕터 순) ─────────────────────────────────────────────────
import stage01Json from "../json/stages/01-zhuojun.json";
import stage02Json from "../json/stages/02-yingchuan.json";
import stage03Json from "../json/stages/03-guangzong.json";
import stage04Json from "../json/stages/04-zhangjue.json";
import stage05Json from "../json/stages/05-sishuiguan.json";
import stage06Json from "../json/stages/06-huluguan.json";
import stage07Json from "../json/stages/07-luoyang.json";
import stage08Json from "../json/stages/08-dongzhuo-chase.json";
import stage09Json from "../json/stages/09-banhe.json";
import stage10Json from "../json/stages/10-xuzhou.json";
import stage11Json from "../json/stages/11-xiaopei.json";
import stage12Json from "../json/stages/12-xiapi1.json";
import stage13Json from "../json/stages/13-yuanshu.json";
import stage14Json from "../json/stages/14-xiapi2.json";
import stage15Json from "../json/stages/15-xutian.json";
import stage16Json from "../json/stages/16-guandu-escape.json";
import stage17Json from "../json/stages/17-runan.json";
import stage18Json from "../json/stages/18-bowangpo.json";
import stage19Json from "../json/stages/19-xinye.json";
import stage20Json from "../json/stages/20-changbanpo.json";
import stage21Json from "../json/stages/21-changbanqiao.json";
import stage22Json from "../json/stages/22-hanjin.json";
import stage23Json from "../json/stages/23-jiangxia.json";
import stage24Json from "../json/stages/24-sanjiangkou.json";
import stage25Json from "../json/stages/25-wulin.json";
import stage26Json from "../json/stages/26-chibi.json";
import stage27Json from "../json/stages/27-huarongdao.json";

export * from "./schemas";

function loadJson<T>(schema: { safeParse: (d: unknown) => { success: true; data: T } | { success: false; error: { message: string } } }, data: unknown, filename: string): T {
  const result = schema.safeParse(data);
  if (!result.success) throw new Error(`[${filename}] 스키마 검증 실패:\n${result.error.message}`);
  return result.data;
}

export interface GameData {
  terrains: Record<string, Terrain>;
  unitClasses: Record<string, UnitClass>;
  combat: CombatConfig;
  commanders: Record<string, Commander>;
  items: Record<string, Item>;
  strategies: Record<string, Strategy>;
  initialForces: Record<string, InitialForce>;
  rosters: Record<string, RosterEntry>;
  shops: Record<string, Shop>;
  maps: Record<string, BattleMap>;
  stages: Record<string, Stage>;
}

/** import 시점에 전부 검증 — 잘못된 JSON은 여기서 즉시 터진다. */
export const gameData: GameData = {
  terrains: loadJson(z.record(TerrainSchema), terrainsJson, "terrains.json"),
  unitClasses: loadJson(z.record(UnitClassSchema), unitClassesJson, "unitClasses.json"),
  combat: loadJson(CombatConfigSchema, combatJson, "combat.json"),
  commanders: loadJson(z.record(CommanderSchema), commandersJson, "commanders.json"),
  items: loadJson(z.record(ItemSchema), itemsJson, "items.json"),
  strategies: loadJson(z.record(StrategySchema), strategiesJson, "strategies.json"),
  initialForces: loadJson(z.record(InitialForceSchema), initialForcesJson, "initialForces.json"),
  rosters: loadJson(z.record(RosterEntrySchema), rostersJson, "rosters.json"),
  shops: {
    ch1: loadJson(ShopSchema, shopCh1Json, "shops/ch1.json"),
  },
  maps: {
    zhuojun: loadJson(BattleMapSchema, zhuojunJson, "maps/zhuojun.json"),
    yingchuan: loadJson(BattleMapSchema, yingchuanJson, "maps/yingchuan.json"),
    guangzong: loadJson(BattleMapSchema, guangzongJson, "maps/guangzong.json"),
    zhangjue: loadJson(BattleMapSchema, zhangjueJson, "maps/zhangjue.json"),
    sishuiguan: loadJson(BattleMapSchema, sishuiguanJson, "maps/sishuiguan.json"),
    huluguan: loadJson(BattleMapSchema, huluguanJson, "maps/huluguan.json"),
    luoyang: loadJson(BattleMapSchema, luoyangJson, "maps/luoyang.json"),
    "dongzhuo-chase": loadJson(BattleMapSchema, dongzhuoChaseJson, "maps/dongzhuo-chase.json"),
    banhe: loadJson(BattleMapSchema, banheJson, "maps/banhe.json"),
    xuzhou: loadJson(BattleMapSchema, xuzhouJson, "maps/xuzhou.json"),
    xiaopei: loadJson(BattleMapSchema, xiaopeiJson, "maps/xiaopei.json"),
    xiapi1: loadJson(BattleMapSchema, xiapi1Json, "maps/xiapi1.json"),
    yuanshu: loadJson(BattleMapSchema, yuanshuJson, "maps/yuanshu.json"),
    xiapi2: loadJson(BattleMapSchema, xiapi2Json, "maps/xiapi2.json"),
    xutian: loadJson(BattleMapSchema, xutianJson, "maps/xutian.json"),
    "guandu-escape": loadJson(BattleMapSchema, guanduEscapeJson, "maps/guandu-escape.json"),
    runan: loadJson(BattleMapSchema, runanJson, "maps/runan.json"),
    bowangpo: loadJson(BattleMapSchema, bowangpoJson, "maps/bowangpo.json"),
    xinye: loadJson(BattleMapSchema, xinyeJson, "maps/xinye.json"),
    changbanpo: loadJson(BattleMapSchema, changbanpoJson, "maps/changbanpo.json"),
    changbanqiao: loadJson(BattleMapSchema, changbanqiaoJson, "maps/changbanqiao.json"),
    hanjin: loadJson(BattleMapSchema, hanjinJson, "maps/hanjin.json"),
    jiangxia: loadJson(BattleMapSchema, jiangxiaJson, "maps/jiangxia.json"),
    sanjiangkou: loadJson(BattleMapSchema, sanjiangkouJson, "maps/sanjiangkou.json"),
    wulin: loadJson(BattleMapSchema, wulinJson, "maps/wulin.json"),
    chibi: loadJson(BattleMapSchema, chibiJson, "maps/chibi.json"),
    huarongdao: loadJson(BattleMapSchema, huarongdaoJson, "maps/huarongdao.json"),
  },
  stages: {
    "01-zhuojun": loadJson(StageSchema, stage01Json, "stages/01-zhuojun.json"),
    "02-yingchuan": loadJson(StageSchema, stage02Json, "stages/02-yingchuan.json"),
    "03-guangzong": loadJson(StageSchema, stage03Json, "stages/03-guangzong.json"),
    "04-zhangjue": loadJson(StageSchema, stage04Json, "stages/04-zhangjue.json"),
    "05-sishuiguan": loadJson(StageSchema, stage05Json, "stages/05-sishuiguan.json"),
    "06-huluguan": loadJson(StageSchema, stage06Json, "stages/06-huluguan.json"),
    "07-luoyang": loadJson(StageSchema, stage07Json, "stages/07-luoyang.json"),
    "08-dongzhuo-chase": loadJson(StageSchema, stage08Json, "stages/08-dongzhuo-chase.json"),
    "09-banhe": loadJson(StageSchema, stage09Json, "stages/09-banhe.json"),
    "10-xuzhou": loadJson(StageSchema, stage10Json, "stages/10-xuzhou.json"),
    "11-xiaopei": loadJson(StageSchema, stage11Json, "stages/11-xiaopei.json"),
    "12-xiapi1": loadJson(StageSchema, stage12Json, "stages/12-xiapi1.json"),
    "13-yuanshu": loadJson(StageSchema, stage13Json, "stages/13-yuanshu.json"),
    "14-xiapi2": loadJson(StageSchema, stage14Json, "stages/14-xiapi2.json"),
    "15-xutian": loadJson(StageSchema, stage15Json, "stages/15-xutian.json"),
    "16-guandu-escape": loadJson(StageSchema, stage16Json, "stages/16-guandu-escape.json"),
    "17-runan": loadJson(StageSchema, stage17Json, "stages/17-runan.json"),
    "18-bowangpo": loadJson(StageSchema, stage18Json, "stages/18-bowangpo.json"),
    "19-xinye": loadJson(StageSchema, stage19Json, "stages/19-xinye.json"),
    "20-changbanpo": loadJson(StageSchema, stage20Json, "stages/20-changbanpo.json"),
    "21-changbanqiao": loadJson(StageSchema, stage21Json, "stages/21-changbanqiao.json"),
    "22-hanjin": loadJson(StageSchema, stage22Json, "stages/22-hanjin.json"),
    "23-jiangxia": loadJson(StageSchema, stage23Json, "stages/23-jiangxia.json"),
    "24-sanjiangkou": loadJson(StageSchema, stage24Json, "stages/24-sanjiangkou.json"),
    "25-wulin": loadJson(StageSchema, stage25Json, "stages/25-wulin.json"),
    "26-chibi": loadJson(StageSchema, stage26Json, "stages/26-chibi.json"),
    "27-huarongdao": loadJson(StageSchema, stage27Json, "stages/27-huarongdao.json"),
  },
};

/** Convenience shorthand — same object as gameData.stages */
export const stages: Record<string, Stage> = gameData.stages;
