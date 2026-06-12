/** LS11 해제 — 코에이 표준 압축 (영걸전~조조전 공용).
 *  알고리즘 출처: tools/hero-extract/ls11_extract.py (검증 완료) ← github.com/yinchuan/LSReader */
class BitReader {
  private bytePos: number;
  private bitQueue = 0;
  private bitLen = 0;
  constructor(private d: Uint8Array, start: number) { this.bytePos = start; }
  getBits(n: number): number {
    let ret = 0;
    for (let i = 0; i < n; i++) {
      if (this.bitLen === 0) {
        if (this.bytePos >= this.d.length) throw new Error("LS11: unexpected end of input");
        this.bitQueue = this.d[this.bytePos]!;
        this.bytePos += 1;
        this.bitLen = 8;
      }
      ret = (ret << 1) | ((this.bitQueue & 0x80) >>> 7);
      this.bitQueue = (this.bitQueue << 1) & 0xff;
      this.bitLen -= 1;
    }
    return ret;
  }
  getCode(): number {
    let code1 = 0;
    let n = 0;
    for (;;) {
      const bit = this.getBits(1);
      code1 = (code1 << 1) | bit;
      n += 1;
      if (bit === 0) break;
    }
    return code1 + this.getBits(n);
  }
}

function decompressChunk(data: Uint8Array, offset: number, origSize: number, dic: Uint8Array): Uint8Array {
  const br = new BitReader(data, offset);
  const out = new Uint8Array(origSize);
  let len = 0;
  while (len < origSize) {
    const code = br.getCode();
    if (code < 0x100) {
      out[len++] = dic[code]!;
    } else {
      const moveBack = code - 0x100;
      if (moveBack === 0 || moveBack > len) {
        throw new Error(`LS11: invalid back-reference ${moveBack} at output ${len}`);
      }
      const copies = br.getCode() + 3;
      for (let i = 0; i < copies && len < origSize; i++) {
        out[len] = out[len - moveBack]!;
        len++;
      }
    }
  }
  return out;
}

export function ls11Extract(buf: Uint8Array): Uint8Array[] {
  if (buf.length < 0x110) throw new Error(`LS11: buffer too small (${buf.length} bytes)`);
  const magic = String.fromCharCode(buf[0]!, buf[1]!, buf[2]!, buf[3]!);
  if (magic !== "LS11" && magic !== "Ls11") throw new Error(`not LS11: ${magic}`);
  const dic = buf.subarray(0x10, 0x110);
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const out: Uint8Array[] = [];
  for (let pos = 0x110; ; pos += 12) {
    const comp = view.getUint32(pos, false);  // big-endian
    if (comp === 0) break;
    const orig = view.getUint32(pos + 4, false);
    const off = view.getUint32(pos + 8, false);
    out.push(comp === orig ? buf.subarray(off, off + orig) : decompressChunk(buf, off, orig, dic));
  }
  return out;
}
