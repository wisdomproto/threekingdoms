# Campaign QA — 2026-09-16

## Verified

- Initial full workspace suite: 1,409 tests passed, 9 importer tests skipped; workspace typecheck passed.
- Campaign asset audit: 27 stages, 108 map scenes, 839 dialogue lines, 31 motion actors; no reference errors.
- Headless balance matrix: 27 stages × 2 policies × 3 level offsets; all 27 classified HEALTHY. This is a bot regression gate, not proof of human difficulty or campaign progression balance.
- Browser: synchronized campaign revision 22 loaded; story reader displayed chapter text and all 27 entries.
- Browser: first-stage opening, market, tavern, oath scenes rendered; scene skipping reached formation. Existing campaign progress was not reset.
- Browser: sandbox battle rendered units, progressed through automatic combat, and reached victory/results at turn 6 (S, 96 points).

## Fixes

- Scene keyboard handling now ignores child controls and held-key repeats, preventing a skip/choice keyboard action from also advancing the scene underneath.
- Terrain image loading now stops after resolver disposal. Rapid scene changes previously let pending image requests bake textures against a destroyed Pixi renderer (`resolution` on null).
- Added two lifecycle regression tests, including disposal while an image request is pending.

## Final checks and boundaries

- Web typecheck passed after changes.
- Web suite after changes: 830 passed, 1 failed. The failure is the concurrently edited Troy story test: missing `troia-paris` actor in its motion library. No Troy files were changed by this QA pass.
- Focused lifecycle, campaign-event timing and suspended-battle tests passed.
- Save/resume and event timing were covered by automated tests, not a complete manual save/resume campaign run.
- This pass is not a manual playthrough of all 27 battles or a visual audit of every pose and story line. Asset-reference validity does not establish visual quality.
- No commit, push, deployment or asset upload was performed.

Local detailed logs and the balance matrix are in `.studio/campaign-audit-*.log` and `.studio/campaign-balance-audit.json` (ignored scratch outputs).

## Pre-push follow-up

- Desktop battle commands now follow the selected unit; the bottom dock only shows character information. Coarse-pointer devices retain the bottom controls.
- Placement and HUD tests: 36 passed. Browser checked character selection, action menu and strategy icons.
- Full workspace tests and typecheck passed before committing this follow-up; web tests: 831 passed. The earlier concurrent Troy actor failure no longer reproduces in the working tree.
- Commit scope excludes concurrent Troy changes and local portrait asset imports.
