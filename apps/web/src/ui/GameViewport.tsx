"use client";
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { gameViewportLayout } from "./gameViewportMath";
import styles from "./GameViewport.module.css";
import { LandscapeGate } from "./LandscapeGate";

export function GameViewport({ children }: { children: ReactNode }): React.ReactElement {
  const path = usePathname();
  const framed = path === "/battle" || path === "/scene" || path === "/prep";
  const game = framed || path === "/stages" || path === "/troia" || path.startsWith("/play/");
  const content = framed ? <Frame>{children}</Frame> : <>{children}</>;
  return game ? <LandscapeGate>{content}</LandscapeGate> : content;
}

function Frame({ children }: { children: ReactNode }): React.ReactElement {
  const host = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState(() => gameViewportLayout(0, 0, false));
  useLayoutEffect(() => {
    const el = host.current;
    if (!el) return;
    const touch = matchMedia("(pointer: coarse)");
    const measure = () => setLayout(gameViewportLayout(el.clientWidth, el.clientHeight, touch.matches));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    touch.addEventListener("change", measure);
    return () => { observer.disconnect(); touch.removeEventListener("change", measure); };
  }, []);
  return <div className={styles.shell}>
    <div className={styles.host} ref={host}>
      <div data-testid="game-viewport" className={styles.frame} style={{ width: layout.width, height: layout.height,
        transform: `translate(-50%, -50%) scale(${layout.scale})`, visibility: layout.scale ? "visible" : "hidden" }}>
        {children}
      </div>
    </div>
  </div>;
}
