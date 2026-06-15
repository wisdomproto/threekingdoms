"use client";
/** 타자기 훅 (캠페인 씬 — 막간 대사). text가 바뀌면 처음부터. reveal()로 즉시 전체. */
import { useEffect, useRef, useState } from "react";

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

  const reveal = () => {
    if (timer.current) clearInterval(timer.current);
    setCount(text.length);
  };

  return { shown: text.slice(0, count), done: count >= text.length, reveal };
}
