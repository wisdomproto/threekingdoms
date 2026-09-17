/** CSS layout size is not the canvas backing resolution, especially inside a scaled game frame. */
export function renderDensity(width: number, height: number, displayedWidth: number, dpr: number): number {
  if (width <= 0 || height <= 0) return 1;
  const scale = displayedWidth > 0 ? displayedWidth / width : 1;
  return Math.max(0.25, Math.min(scale * Math.max(1, dpr || 1), Math.sqrt(16_777_216 / (width * height)), 8192 / Math.max(width, height)));
}

export function elementRenderDensity(parent: HTMLElement): number {
  return renderDensity(parent.clientWidth, parent.clientHeight, parent.getBoundingClientRect().width, window.devicePixelRatio);
}

/** Observe logical layout and CSS scaling. Resizing never changes camera/input coordinates. */
export function observeRenderSurface(parent: HTMLElement, resize: (width: number, height: number, resolution: number) => void): { disconnect(): void } {
  let frame = 0;
  let last = "";
  const update = () => {
    const width = parent.clientWidth, height = parent.clientHeight;
    if (!width || !height) return;
    const resolution = elementRenderDensity(parent);
    const key = `${width}:${height}:${resolution}`;
    if (last === key) return;
    last = key;
    resize(width, height, resolution);
  };
  const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(update); };
  const observer = new ResizeObserver(schedule);
  observer.observe(parent);
  const viewport = parent.closest('[data-testid="game-viewport"]');
  const transformObserver = new MutationObserver(schedule);
  if (viewport) transformObserver.observe(viewport, { attributes: true, attributeFilter: ["style"] });
  window.addEventListener("resize", schedule);
  schedule();
  return { disconnect() { cancelAnimationFrame(frame); observer.disconnect(); transformObserver.disconnect(); window.removeEventListener("resize", schedule); } };
}
