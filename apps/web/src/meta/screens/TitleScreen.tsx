"use client";
/**
 * 타이틀 화면 — §16 막간 셸 진입점.
 *
 * 수묵 톤 배경 + 로고 + "이어하기 / 새 게임" 메뉴.
 *  - 이어하기: clearedStages 또는 진행(roster/gold)이 있으면 활성 → /stages.
 *  - 새 게임: 클릭하면 metaStore.reset() → /stages.
 * 진행 유무 판단은 마운트 후(클라) 1회. SSR에서는 "새 게임"만 노출(이어하기 비활성)되어
 * 하이드레이션 불일치를 피한다.
 *
 * 청동/수묵 팔레트는 전투 HUD(frames.ts §1 — 청동기 문양 패널)와 톤을 맞춘다.
 * props 없음(라우트 셸이 직접 렌더). devLinks는 app/page.tsx 하단이 보존.
 */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import styles from "./TitleScreen.module.css";
import { earnedInventoryCount, getMeta, reset } from "../metaStore";
import { adLifecycle } from "../adProviders";
import { activeGame } from "../../game/data";

export function TitleScreen(): React.ReactElement {
  const router = useRouter();
  // 진행 유무는 클라에서만 확정(localStorage). 초기 false로 SSR/하이드레이션 일치.
  const [hasProgress, setHasProgress] = useState(false);
  useEffect(() => {
    // 포털 로딩 완료 신호(§13 — 타이틀 = 상호작용 가능 시점. stub이면 no-op, 내부 1회 가드).
    adLifecycle.loadingFinished();
    const m = getMeta();
    // 시작 장비는 로드 시 자동 지급되므로 진행으로 치지 않는다(빈 세이브 = 확인 없이 새 게임).
    const earned = earnedInventoryCount(m);
    const progressed =
      m.clearedStages.length > 0 ||
      m.gold > 0 ||
      Object.keys(m.rosterProgress).length > 0 ||
      earned > 0;
    setHasProgress(progressed);
  }, []);

  function onContinue(): void {
    router.push("/stages");
  }

  function onNewGame(): void {
    reset();
    setHasProgress(false);
    router.push("/stages");
  }

  return (
    <section className={styles.screen}>
      <div className={styles.topbar}>
        <span>THREE KINGDOMS</span>
        <Link className={styles.studio} href={`/studio-login?next=${encodeURIComponent(activeGame ? `/studio?project=${activeGame.projectId}` : "/studio")}`}>
          Studio 가기 <span aria-hidden="true">↗</span>
        </Link>
      </div>
      <div className={styles.content}>
        <header className={styles.hero}>
          <p className={styles.eyebrow}>삼국의 시대, 나의 이야기</p>
          <h1>삼국지</h1>
          <p className={styles.subtitle}>유비전</p>
          <div className={styles.divider} aria-hidden="true" />
          <p className={styles.description}>뜻을 함께할 장수들과<br />난세를 헤쳐 나가세요.</p>
        </header>
        <nav className={styles.menu} aria-label="게임 시작 메뉴">
          <p className={styles.menuHeading}>여정을 시작하세요</p>
          <MenuButton label="이어하기" onClick={onContinue} disabled={!hasProgress} primary={hasProgress} />
          <MenuButton label="새 게임" onClick={onNewGame} primary={!hasProgress} />
          <MenuButton label="이야기 읽기" onClick={() => router.push("/chronicle")} />
          <p className={styles.hint}>
            {hasProgress ? "새 게임을 시작하면 현재 진행이 초기화됩니다." : "진행한 내용은 이 기기에 자동으로 저장됩니다."}
          </p>
        </nav>
      </div>
      <footer className={styles.footer}>한 수의 선택으로 이어지는 영웅들의 이야기</footer>
    </section>
  );
}

function MenuButton({ label, onClick, disabled = false, primary = false }: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
}): React.ReactElement {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className={`${styles.menuButton} ${primary ? styles.primary : ""}`}>
      <span>{label}</span><span aria-hidden="true">→</span>
    </button>
  );
}
