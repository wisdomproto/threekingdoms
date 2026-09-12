"use client";
/** 타자기 훅 (캠페인 씬 — 막간 대사). text가 바뀌면 처음부터. reveal()로 즉시 전체. */
import { useCallback, useEffect, useRef, useState } from "react";

export function useTypewriter(text: string, speed = 28): { shown: string; done: boolean; reveal: () => void } {
  const [count, setCount] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setCount(0);
    if (timer.current) clearInterval(timer.current);
    timer.current = setInterval(() => {
      setCount((c) => {
        if (c >= text.length) {
          if (timer.current) clearInterval(timer.current);
          return c;
        }
        return c + 1;
      });
    }, speed);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [text, speed]);

  // useCallback: 소비자(useComicProgression)의 advance 가 reveal 을 deps 로 가져 매 렌더 타이머가 재설정되지 않게
  const reveal = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    setCount(text.length);
  }, [text]);

  return { shown: text.slice(0, count), done: count >= text.length, reveal };
}
