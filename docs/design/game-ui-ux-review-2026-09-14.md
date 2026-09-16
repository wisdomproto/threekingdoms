# Game UI/UX review — 2026-09-14

## Scope and method

Reviewed the running preparation screen for `05-sishuiguan`, formation selection, equipment entry points, shop list and product detail, and stage selection. Inspected desktop screenshots, a 390×844 CSS viewport, DOM measurements, and corresponding source. The current save showed 0 gold and no cleared stages; the preparation route was opened directly for review. No purchases, equipment changes, ads, battle completions, or save resets were performed. This is a review, not a redesign implementation. Purchase success, populated inventories, and battle HUD usability were not tested in this pass.

## Assessment

The portraits, parchment panels, bronze palette, and prominent red sortie action provide a coherent historical identity. The formation/shop tabs are understandable, and the shared consumable inventory explanation is useful. However, decorative scale outweighs decision-making information. The interface needs clearer selection semantics, compact mobile composition, equipment comparison, and more readable secondary text before it feels comfortable for new players.

## Findings, in priority order

### P1 — The displayed army does not explain what will actually deploy

The header shows `0 / 4`, all four slots are empty, but `출정` remains enabled. The footer only says `기본`. This is intentional fallback behavior, not an empty-army engine bug: `SortieBar.tsx` permits default deployment and the sortie adapter uses authored units. The problem is that the player cannot see the default army they are approving.

Show the actual default roster as selected on entry, or use an explicit `기본 부대 4명으로 출정` action with its roster visible. Keep the displayed count, slot contents, and actual deployment consistent. Do not simply disable the button without preserving the existing default-deployment feature.

### P1 — Formation requires excessive scrolling on mobile

At a 390×844 CSS viewport, six roster cards produced approximately 3,396px document height. Sample cards measured about 438–448px high. The grid uses `minmax(190px, 1fr)`, leaving one portrait-heavy card per row at this width. The sortie bar sits after the board rather than remaining visible; it also falls below the initial desktop viewport with six cards.

Use compact roster rows or smaller cards on phones; keep portrait-led detail in a separate panel. Keep a compact selected-count/primary-action bar visible with safe-area clearance. Put the selected roster within immediate reach, without making the full roster and full detail compete for height.

### P1 — Inspecting a character can unexpectedly change the army

An unselected card click deploys and focuses it; clicking the already focused deployed card removes it. When slots are full, the same gesture only focuses. This was reproduced with Liu Bei: the second click changed the count from 1 back to 0. Existing comments record an earlier desire for repeat-click removal, so the interaction should not be silently changed without acknowledging that preference.

Make deployment/removal explicit in the card or detail panel. If repeat-click removal is retained as a shortcut, provide a visible instruction and a clear separate detail target. Allow equipment inspection/preparation without first requiring deployment; currently empty equipment controls are disabled until the unit is selected for sortie.

### P2 — The shop lacks comparison and purchase context

The list presents `칠성검 +10% / 300金` and `삼첨도 +10% / 250金`. Detail clarifies `부대 공격력 +10%`, but does not compare against the selected unit's equipped weapon or explain which unit benefits. Consumables show `회복 30/60` without naming the recovered resource in that summary. Players must already know the rules to judge value.

Present effect targets directly in the list, show inventory counts consistently, and show a selected unit's current item and resulting change. Provide an equipment-selection path after a purchase where appropriate. Review successful purchases separately before asserting that purchase feedback is sufficient.

### P2 — Chapter context is inconsistent

The preparation screen says `2장 편성` for Sishui Gate, while the shop says `1장 상점`. `PrepShell.tsx` always supplies `gameData.shops.ch1`, although the unlock filter receives the current chapter. This confirms a title/catalog-context mismatch; it does not by itself establish that all later chapter stock is wrong.

If one merchant catalog is intentionally shared, call it `도구 상점` and display the current chapter consistently. Otherwise select the intended chapter catalog explicitly.

### P2 — Small controls and muted text weaken readability

The mobile sort buttons measured approximately 30.75×38px with 10.5px text; formation/shop tabs were 39px high. These are below the repository guide's minimum 44×44 touch target. Equipment help, secondary stats, shop effect summaries, and stage-selection navigation are visually faint or small. Locked stage names become very hard to read due to the subdued presentation.

Reserve the decorative serif treatment for headings and character names. Use readable body text for numbers, item effects, and help; increase touch areas independently of visual ornament. Keep locked stage names readable and indicate lock state through a clear icon/message instead of strongly dimming all information.

### P2 — Product dialogs do not take keyboard focus

After opening the product dialog, focus remained on the underlying `칠성검 상세 보기` button. The dialog declares `aria-modal`, but its component has no focus-management or Escape handler. This makes keyboard navigation and dismissal less predictable.

Use a shared dialog implementation that moves focus inside, contains keyboard navigation, supports Escape, and returns focus to the invoking button. Also review the nested remove button inside a sortie-slot button as a semantic/accessibility issue.

## Suggested implementation sequence

1. Make the visible deployment match the actual army; clarify card selection/removal.
2. Compact mobile formation and keep the sortie summary/action visible.
3. Add item comparison, explicit effect labels, and consistent shop chapter naming.
4. Apply a shared typography, touch-target, and dialog-accessibility pass.

Keep the existing art direction. The first pass should improve information hierarchy and interaction clarity before commissioning more frames or replacing portraits. Recheck with a fresh player completing “choose four units → inspect equipment → compare a healing item → deploy,” including a phone-size viewport and keyboard navigation.

## User-selected video reference: battle formation at 03:33

Source: https://www.youtube.com/watch?v=qvSF_J5TtsE&t=213s — “[삼국지조조전온라인] 유비전 1.장세평의 부탁(탁현 도적 토벌전)” by 안훈영. The user explicitly selected 03:33. Viewed the paused frame at that exact player timestamp, not just a thumbnail or transcript.

Observed: a compact multi-column roster on the left, sortie count 3/4 at its top, selected units marked with colored frames and ordering numbers, filter/level controls, and a fixed right-side selected-unit detail panel. The right panel combines a large portrait, numeric combat stats, and equipment slots. The bottom groups 전체취소, 자동 배치, and 출진. These are observations about the visible layout; a paused video frame does not establish the exact click/selection semantics.

This reference directly sharpens the formation recommendation: use small roster entries for comparing many units, reserve the large portrait for the selected unit, display deployment state and order directly on entries, and keep preparation actions together and visible. Our current large-portrait roster should become denser on desktop and compact on mobile. An auto-deploy action would provide a clear beginner entry point. Keep readable text/touch targets rather than copying the reference's very small labels or numerous resource counters.

Other sampled portions of the playlist showed story and battlefield presentation. The playlist contains 41 entries; its title list was inspected, but all videos were not watched. No shop purchasing/comparison flow has yet been verified from this reference. The shop findings above remain observations of our application and proposed improvements, not claims about Cao Cao Online's implementation.

## Approved implementation
Implement the referenced compact roster, large selected-unit detail, persistent sortie controls, and explicit auto-deploy action. Initialize the preparation screen with a visible available roster (authored unit order first, then roster order). Empty selection must not silently deploy another army. Preserve repeat-click removal with visible guidance and a separate detail action. Do not alter engine fallback semantics or inventory persistence. Mobile uses compact entries and the existing detail sheet.

## Implemented and revised from live user feedback

The user rejected both the initial ornamental palette and the charcoal revision, then explicitly requested the source video's palette and full-body character roster. The final direction supersedes the earlier light/charcoal iterations: dark brown surfaces, brass accents, red selected entries, green level text, and a red sortie action. The roster uses existing battle idle figures (named art with class fallback), level and name only; detailed stats/equipment remain on the right on desktop and in the existing sheet on mobile. There is no repeated detail button. Selected entries display deployment order; the previous focused-card repeat-click removal remains available.

Added automatic formation: available authored allies first, then available roster order, capped at authored player slot count. Entry displays that actual selection. Clearing the roster disables sortie in preparation; engine fallback behavior is unchanged. Automatic selection preserves roster experience and equipment and does not modify inventory. The selected roster and actions remain visible outside the scrolling content. Mobile uses three compact columns; buttons meet at least 44px height. Shop title is now 도구 상점. The detail panel labels computed combat stats correctly as 공격력/방어력/정신력.

Validation: web tests 759 passed, including capacity/order/equipment preservation tests for automatic formation. Typecheck passed. Browser checks covered default 4/4 selection, clear→disabled sortie, automatic refill, shop-tab selection retention, compact mobile layout, on-screen sortie action, and successful loading of all six visible character figures. No purchases, equipment writes, or campaign completions were made during visual QA. Shop comparisons and the previously identified dialog accessibility work remain outside this implementation.
Final production build passed. The user accepted the full-body character roster and reference-based brown/brass/red palette; preserve this direction for subsequent work.
