import type { CSSProperties } from "react";

// Match the inline battle HUD so the information panel arrives with its controls.
const styles: Record<string, CSSProperties> = {
  dock: { position: "absolute", bottom: 8, left: 12, width: 330, maxWidth: "calc(100% - 24px)", display: "flex", flexDirection: "column", gap: 3, color: "#f4ead0", pointerEvents: "none", zIndex: 5 },
  info: { display: "flex", alignItems: "center", gap: 8, boxSizing: "border-box", padding: "5px 8px", background: "linear-gradient(90deg,#201e19eb,#201e19bf)", borderBottom: "2px solid #ad9153", borderRadius: 4, pointerEvents: "auto" },
  summary: { flex: 1, minWidth: 0 },
  heading: { display: "flex", gap: 8, alignItems: "baseline", marginBottom: 2, whiteSpace: "nowrap", fontSize: 12 },
  meter: { display: "flex", alignItems: "center", gap: 5, margin: "2px 0", fontSize: 10 },
  detailButton: { minWidth: 44, minHeight: 44, padding: 0, border: 0, background: "none", color: "#ead49c", fontSize: 11, cursor: "pointer" },
  hint: { order: -1, fontSize: 11, color: "#fff0cd", textShadow: "0 1px 3px #000,0 0 4px #000", marginBottom: 3 },
  details: { position: "absolute", bottom: "calc(100% + 8px)", left: 0, width: 330, maxHeight: "calc(100vh - 150px)", overflowY: "auto", background: "#242016f5", borderRadius: 8, pointerEvents: "auto" },
};
export default styles;
