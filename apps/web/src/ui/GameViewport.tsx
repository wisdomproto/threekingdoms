"use client";
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { GAME_WIDTH, GAME_HEIGHT, gameViewportScale } from "./gameViewportMath";
import styles from "./GameViewport.module.css";

export function GameViewport({ children }: { children: ReactNode }): React.ReactElement {
  const path = usePathname();
  const framed = path === "/battle" || path === "/scene" || path === "/prep";
  return framed ? <Frame>{children}</Frame> : <>{children}</>;
}

function Frame({ children }: { children: ReactNode }): React.ReactElement {
  const host = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);
  useLayoutEffect(() => {
    const el = host.current;
    if (!el) return;
    const measure = () => setScale(gameViewportScale(el.clientWidth, el.clientHeight));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return <div className={styles.shell}>
    <div className={styles.host} ref={host}>
      <div data-testid="game-viewport" className={styles.frame} style={{ width: GAME_WIDTH, height: GAME_HEIGHT,
        transform: `translate(-50%, -50%) scale(${scale})`, visibility: scale ? "visible" : "hidden" }}>
        {children}
      </div>
    </div>
    <p className={styles.rotate}>휴대폰을 가로로 돌리면 더 크게 즐길 수 있습니다.</p>
  </div>;
}
