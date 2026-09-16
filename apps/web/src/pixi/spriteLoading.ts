/** Load every character's standing image before filling animation clips. */
export async function loadSpriteQueue<T extends { pose: string }>(jobs: readonly T[], load: (job: T) => Promise<unknown>, concurrency = 8): Promise<void> {
  const standing = (job: T) => /^(front|back)_idle$/.test(job.pose);
  for (const batch of [jobs.filter(standing), jobs.filter(job => !standing(job))]) {
    let next = 0;
    await Promise.all(Array.from({ length: Math.min(Math.max(1, concurrency), batch.length) }, async () => {
      while (next < batch.length) {
        const job = batch[next++]!;
        try { await load(job); } catch { /* One missing frame must not prevent other characters from loading. */ }
      }
    }));
  }
}
