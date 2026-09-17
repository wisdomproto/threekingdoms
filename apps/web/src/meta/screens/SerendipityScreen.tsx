"use client";
/** Treasure draw screen. Animation never changes the persisted reward. */
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { gameData } from "../../game/data";
import { itemEffectText as effectSummary } from "../itemEffectText";
import { getSerendipity, getSerendipityPity, pullSerendipity, pullSerendipityFree } from "../metaStore";
import { PULL_COST, PITY_CAP, pickFlavor, isSerendipityTreasure } from "../serendipity";
import type { SerendipityReward } from "../serendipity";
import styles from "./Collection.module.css";
import gameStyles from "./Serendipity.module.css";
import { treasureGrade } from "../treasureGrade";
import { ItemIcon } from "../../ui/ItemIcon";
import { Pachinko } from "./Pachinko";
import { preloadPachinkoAudio, startPachinkoAudio, playPachinkoReward } from "./pachinkoAudio";
import { RewardedAdButton } from "../RewardedAdButton";

/** 보상 → 표시 텍스트. gold=금액, item=아이템명(없으면 id). */
function rewardLabel(reward: SerendipityReward): string {
  if (reward.kind === "gold") return `자금 +${reward.amount} 金`;
  return gameData.items[reward.itemId]?.name ?? reward.itemId;
}

/** 기연 보물 효과 한 줄(reveal 보조 설명). 소모품/자금은 빈 문자열. */
function rewardSub(reward: SerendipityReward): string {
  if (reward.kind !== "item") return "";
  const it = gameData.items[reward.itemId];
  if (!it) return "";
  if (it.category === "treasure") return effectSummary(it.effects);
  if (it.category === "supplyItem") return "보급품";
  if (it.category === "attackItem") return "공격 소모품";
  return "";
}

interface PullView {
  flavor: string;
  reward: SerendipityReward;
  rare: boolean;
  /** false면 플레이버만(보상 카드 아직 가림), true면 보상 공개. */
  revealed: boolean;
}

export function SerendipityScreen(): React.ReactElement {
  const [points, setPoints] = useState(0);
  const [pity, setPity] = useState(0);
  const [view, setView] = useState<PullView | null>(null);
  const [preview, setPreview] = useState(false);
  const [gradeFilter, setGradeFilter] = useState("fine");
  const animationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const animating = useRef(false);
  const stopAudio = useRef<(() => void) | null>(null);
  const rewardGrade = useRef<ReturnType<typeof treasureGrade>["grade"] | null>(null);
  useEffect(() => {
    void preloadPachinkoAudio().catch(() => {});
    const chest = new Image(); chest.src = "/ui/serendipity/chest.webp";
    return () => { if (animationTimer.current) clearTimeout(animationTimer.current); stopAudio.current?.(); };
  }, []);
  const reveal = () => {
    if (animationTimer.current) clearTimeout(animationTimer.current);
    animationTimer.current = null;
    animating.current = false;
    stopAudio.current?.();
    if (rewardGrade.current !== null) stopAudio.current = playPachinkoReward(rewardGrade.current);
    rewardGrade.current = null;
    setPreview(false);
    setView(v => v ? { ...v, revealed: true } : v);
  };
  // SSR/하이드레이션 일치 — 마운트 후 1회 로드.
  useEffect(() => {
    setPoints(getSerendipity());
    setPity(getSerendipityPity());
  }, []);

  const canPull = points >= PULL_COST;
  const toPity = Math.max(0, PITY_CAP - pity); // 천장까지 남은 횟수

  // 뽑기 결과 → 연출(플레이버 가림 → 보상 공개) + 표시값 갱신. 유료/광고 무료 뽑기 공용.
  const present = (result: { reward: SerendipityReward; wasRare: boolean }) => {
    animating.current = true;
    stopAudio.current?.();
    rewardGrade.current = result.reward.kind === "item" ? treasureGrade(gameData.items[result.reward.itemId]?.effects).grade : "common";
    stopAudio.current = startPachinkoAudio();
    setPoints(getSerendipity());
    setPity(getSerendipityPity());
    setView({ flavor: pickFlavor(Math.random()), reward: result.reward, rare: result.wasRare, revealed: false });
    animationTimer.current = setTimeout(reveal, matchMedia("(prefers-reduced-motion: reduce)").matches ? 100 : 2900);
  };

  const onPull = () => {
    if (animating.current) return;
    const result = pullSerendipity(() => Math.random());
    if (!result) return; // 포인트 부족(버튼 비활성과 이중 가드) — 차감/적립은 이미 영속됨.
    present(result);
  };

  // §13 리워드 광고 "기연 뽑기 +1회" — 광고 완주 시 포인트 없이 1회 뽑기(무손실 opt-in).
  const onAdPull = () => {
    present(pullSerendipityFree(() => Math.random()));
  };

  const waiting = preview || (!!view && !view.revealed);
  const previewAnimation = () => {
    if (animating.current) return;
    animating.current = true;
    stopAudio.current?.();
    rewardGrade.current = gradeFilter as ReturnType<typeof treasureGrade>["grade"];
    stopAudio.current = startPachinkoAudio();
    setPreview(true);
    animationTimer.current = setTimeout(reveal, matchMedia("(prefers-reduced-motion: reduce)").matches ? 100 : 2900);
  };
  return <main className={`${styles.shell} ${gameStyles.shell}`}><div className={`${styles.frame} ${gameStyles.frame}`}>
    <header className={styles.header}><Link href="/stages">← 전장 선택</Link><h1>보물 뽑기</h1><small>전투의 보상, 새로운 발견</small></header>
    <div className={`${styles.body} ${gameStyles.body}`}><div className={gameStyles.layout}>
      <section className={gameStyles.encounter} aria-label="보물 뽑기">
        <div className={gameStyles.balance}><span>뽑기 포인트 <strong>{points}점</strong></span><span>보물 확정까지 <strong>{toPity}회</strong></span></div>
        <div className={gameStyles.stage} aria-live="polite">
          {waiting && <Pachinko active onSkip={reveal}/>}
          {!preview && (view ? <><p>{view.flavor}</p>{view.revealed && <div className={`${styles.reward} ${gameStyles.rewardCard}`} data-grade={view.reward.kind === "item" ? treasureGrade(gameData.items[view.reward.itemId]?.effects).grade : "common"}>
            {view.reward.kind==='item' ? <ItemIcon itemId={view.reward.itemId} category={gameData.items[view.reward.itemId]?.category} size={80}/> : <span className={styles.symbol} aria-hidden="true">金</span>}
            {view.rare && <span>뽑기 전용 보물 발견</span>}<strong>{rewardLabel(view.reward)}</strong><span>{rewardSub(view.reward)}</span>{view.reward.kind === "item" && gameData.items[view.reward.itemId]?.category === "treasure" && <><b style={{color:treasureGrade(gameData.items[view.reward.itemId]?.effects).color}}>{treasureGrade(gameData.items[view.reward.itemId]?.effects).label}</b><span>{treasureGrade(gameData.items[view.reward.itemId]?.effects).recommendation}</span></>}
          </div>}</> : <><Pachinko/><h2>당신의 다음 보물은?</h2><p>당신의 여정에 어떤 보물이 기다릴까요?</p></>)}
        </div>
        <button className={styles.primary} onClick={onPull} disabled={!canPull || waiting}>{waiting ? '선물을 확인하는 중…' : `1회 뽑기 · ${PULL_COST}점`}</button>
        <div className={styles.filters}><button onClick={previewAnimation} disabled={waiting}>연출 미리보기 · 포인트 사용 없음</button></div>
        {!canPull && <p>뽑기 포인트가 {Math.max(0,PULL_COST-points)}점 더 필요합니다. 전투 완료 보상으로 포인트를 모으세요.</p>}
        {!waiting && <div className={styles.ad}><RewardedAdButton placement="qiyuan_extra" label="광고 보고 보상 1회 받기" onReward={onAdPull}/></div>}
      </section>
      <aside className={gameStyles.rewards}><h2>획득 가능한 보물</h2><p>등급별 보물 · 효과 미리보기</p><details><summary>이용 방법 · 확률 보기</summary>
        <ul><li>전투 첫 승리: 등급에 따라 1~5점</li><li>완료한 전투 재도전: 1점</li><li>보상 1회: 뽑기 포인트 {PULL_COST}점 사용</li></ul>
        <h2>보물 확정까지 {toPity}회</h2><p>일반 보상은 자금과 소모품입니다. 보물 확률은 8%이며, 보물 없이 9회 받으면 다음에는 보물이 확정됩니다.</p>
        <p>보물 안에서 일반 40% · 고급 35% · 희귀 20% · 전설 5%. 보물 확정은 등급을 보장하지 않습니다.</p></details><div className={gameStyles.gradeFilters}>{[["common","일반"],["fine","고급"],["rare","희귀"],["legendary","전설"]].map(([id,label])=><button key={id} aria-pressed={gradeFilter===id} onClick={()=>setGradeFilter(id!)}>{label}</button>)}</div><div className={gameStyles.treasures}>{Object.values(gameData.items).filter(item=>isSerendipityTreasure(item.id) && treasureGrade(item.effects).grade===gradeFilter).map(item=><div key={item.id} data-grade={treasureGrade(item.effects).grade}><ItemIcon itemId={item.id} category={item.category} size={56} style={{border:`2px solid ${treasureGrade(item.effects).color}`,boxShadow:`0 0 12px ${treasureGrade(item.effects).color}33`}}/><span className={gameStyles.grade} style={{color:treasureGrade(item.effects).color}}>{treasureGrade(item.effects).label}</span><strong>{item.name}</strong><span>{effectSummary(item.effects)}</span><small>{treasureGrade(item.effects).recommendation}</small></div>)}</div>
        <p>선택한 등급의 보상음은 왼쪽 연출 미리보기에서 들을 수 있습니다.</p><p>전투에서 얻는 고유 보물과는 별개의 보상입니다.</p>
      </aside>
    </div></div>
  </div></main>;
}
