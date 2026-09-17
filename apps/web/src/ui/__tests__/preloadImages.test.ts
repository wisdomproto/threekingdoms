import { afterEach, describe, expect, it, vi } from "vitest";
import { preloadImage, sceneImageUrls } from "../preloadImages";

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("scene image preparation", () => {
  it("collects later backgrounds and choice portraits once", () => {
    const urls = sceneImageUrls({bg:"opening", lines:[{bg:"meeting",portraitId:"hero"},{choice:{options:[{react:[{portraitId:"hero"},{portraitId:"guest"}]}]}}],pages:[{image:"page-one"}]});
    expect(urls).toHaveLength(5);
    expect(urls.some(x=>x.endsWith('/scenes/meeting.webp'))).toBe(true);
    expect(urls.some(x=>x.endsWith('/portraits/guest.webp'))).toBe(true);
  });
  it("waits for decoding and shares concurrent requests", async () => {
    let decodeDone!: () => void;
    const images: FakeImage[] = [];
    class FakeImage {
      onload: null | (()=>void) = null;
      onerror: null | (()=>void) = null;
      src = "";
      constructor() { images.push(this); }
      decode() { return new Promise<void>(resolve=>{decodeDone=resolve;}); }
    }
    vi.stubGlobal('Image', FakeImage);
    const first=preloadImage('/decode-test.webp');
    expect(preloadImage('/decode-test.webp')).toBe(first);
    let ready=false; void first.then(()=>{ready=true;});
    images[0]!.onload!();
    await Promise.resolve(); expect(ready).toBe(false);
    decodeDone(); await first; expect(ready).toBe(true);
    expect(images).toHaveLength(1);
  });
  it("evicts failures so retry performs a new load", async () => {
    const images: FakeImage[]=[];
    class FakeImage { onload=null; onerror: null | (()=>void)=null; src=''; constructor(){images.push(this);} }
    vi.stubGlobal('Image',FakeImage);
    const first=preloadImage('/retry-test.webp'); const failure=expect(first).rejects.toThrow('unavailable');
    images[0]!.onerror!(); await failure;
    const second=preloadImage('/retry-test.webp'); const retryFailure=expect(second).rejects.toThrow();
    expect(images).toHaveLength(2); images[1]!.onerror!(); await retryFailure;
  });
  it("a stalled image fails without starting the player", async () => {
    vi.useFakeTimers();
    vi.stubGlobal('Image',class { onload=null; onerror=null; src=''; });
    const pending=preloadImage('/stall-test.webp'); const failure=expect(pending).rejects.toThrow('timed out');
    await vi.advanceTimersByTimeAsync(30000); await failure;
  });
});
