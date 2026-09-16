import { useState } from "react";
import { assetUrl } from "../assetUrl";

type Data = Record<string, unknown>;
const object = (value: unknown): value is Data => !!value && typeof value === "object" && !Array.isArray(value);
function PreviewImage({ path, label, portrait = false }: { path: string; label: string; portrait?: boolean }) {
  const [failed, setFailed] = useState(false);
  return failed ? <div className="studio-preview-missing">{label} 파일을 찾을 수 없습니다.<small>{path}</small></div>
    : <img className={portrait ? "studio-preview-portrait" : "studio-preview-image"} src={assetUrl(path)} alt={label} onError={() => setFailed(true)} loading="lazy" />;
}

/** Static authoring preview; no playback, audio, or project mutation. */
export default function StoryPreview({ part }: { part: Data }) {
  const [selected, setSelected] = useState(0);
  if (part.kind === "comic") {
    const pages = Array.isArray(part.pages) ? part.pages.filter(object) : [];
    return <div className="studio-story-preview"><strong>만화 이미지 미리보기</strong>{pages.map((page, i) => typeof page.image === "string" && <figure key={`${i}:${page.image}`}><PreviewImage path={`/assets/comics/${page.image}.webp`} label={`만화 ${i + 1}페이지`} /><figcaption>{i + 1}페이지</figcaption></figure>)}</div>;
  }
  if (part.kind === "map" || typeof part.map === "string") return <div className="studio-story-preview"><strong>캐릭터 이동 장면</strong>{typeof part.map === "string" && <PreviewImage key={part.map} path={`/assets/maps/${part.map}.webp`} label="장면 맵 배경" />}<p className="studio-note">장면 상세 편집에서 캐릭터를 배치하고 이동·대사·카메라를 설정하세요.</p></div>;
  const lines = Array.isArray(part.lines) ? part.lines.filter(object) : [];
  const index = Math.min(selected, Math.max(0, lines.length - 1));
  const line = lines[index];
  let bg = typeof part.bg === "string" ? part.bg : "";
  for (const entry of lines.slice(0, index + 1)) if (typeof entry.bg === "string" && entry.bg) bg = entry.bg;
  const portrait = line?.speaker && typeof line.portraitId === "string" ? line.portraitId : "";
  return <div className="studio-story-preview">
    <div className="studio-section-title"><strong>장면 미리보기</strong>{lines.length > 0 && <label>미리볼 대사<select value={index} onChange={event => setSelected(Number(event.target.value))}>{lines.map((entry, i) => <option key={i} value={i}>{i + 1}. {String(entry.speaker || "내레이션")} · {String(entry.text ?? "").slice(0, 35)}</option>)}</select></label>}</div>
    <div className="studio-preview-stage">
      {bg ? <PreviewImage key={bg} path={`/assets/scenes/${bg}.webp`} label="이야기 배경" /> : <div className="studio-preview-missing">배경 이미지를 지정해 주세요.</div>}
      {line && <div className="studio-preview-dialogue">{portrait && <PreviewImage key={portrait} path={`/assets/ui/portraits/${portrait}.webp`} label={String(line.speaker)} portrait />}<div><strong>{String(line.speaker || "내레이션")}</strong><p>{String(line.text ?? "") || "대사를 입력해 주세요."}</p></div></div>}
    </div>
    <p className="studio-note">선택한 대사의 배경 전환과 초상화를 반영합니다. 편집한 내용은 바로 표시됩니다.</p>
  </div>;
}
