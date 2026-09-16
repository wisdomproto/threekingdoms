"use client";
/** Display the complete authored line immediately; one tap advances one line. */
const reveal = () => {};

export function useDialogueText(text: string): { shown: string; done: boolean; reveal: () => void } {
  return { shown: text, done: true, reveal };
}
