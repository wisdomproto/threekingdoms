# Mobile battle readability

User direction: preserve a shared landscape composition on mobile and desktop, with readable tactical cells and a translucent command dock.

- Keep logical coordinates at 800 × 450; render the canvas at displayed size × device pixel ratio, within a 16-megapixel allocation budget. CSS scaling must not upscale an 800-pixel backing canvas on desktop.
- Limit the default camera zoom to show at least eleven tile rows. Selection framing may zoom out to 0.75, but must not keep shrinking characters just to fit a cavalry unit's entire movement range. Larger ranges remain pannable.
- Draw a separate inset border and light fill on every reachable tile. Preserve distinct move, attack, strategy and item colors.
- Show the objective briefing at battle start, then make it accessible through the pause menu. Keep objective location navigation in that menu.
- Keep menu, auto-battle and speed controls directly accessible. Sound controls belong in the pause menu.
- Use a translucent bottom dock with existing original equipment illustrations and strategy icons, plus text labels. Preserve minimum action target heights.

Narrative reference clarification: the user chose Romance of the Three Kingdoms and Lee Mun-yol's adaptation, not Records of the Three Kingdoms, as the story basis. Do not present details from the historical record as if confirmed in either novel.

## Preparation and results follow the same frame

- `/prep` uses the same 800 × 450 logical frame as battles and scenes. Text, images, and controls scale together on mobile and desktop.
- Formation and shop retain side-by-side details. Only overflowing lists/details scroll; sortie actions stay visible.
- Victory rewards use a compact, scrollable card with a nonshrinking action footer. Optional reward ads cannot push the next-story button below the frame.
- Tapping an attackable enemy after moving follows the same attack confirmation path as the Attack menu.
- Reference inspected: original user video `qvSF_J5TtsE`, 3:30 stage hub and 3:50 commander/equipment effects view. This is not a claim that every menu was visible in that clip.
