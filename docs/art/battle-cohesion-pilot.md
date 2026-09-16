# Battle cohesion pilot — Zhuojun

Reference: actual gameplay camera, 1280 × 720 viewport, opening enemy dialogue.

- Apply a reversible saturation adjustment (-0.16) only to the Zhuojun painted ground. Source assets, object textures, character colors, terrain rules and camera scale remain intact.
- Shared unit presentation uses layered warm contact shadows rather than a solid black ellipse. Health bars are 84% of their former width, with 3px health and 2px special gauges in world coordinates.
- Shared desktop auxiliary controls use parchment surfaces with dark text and a 44px minimum height. Active controls retain their distinct bronze treatment.

Validation: web typecheck; eight existing low-health, sprite-clip and control-settings tests; actual battle rendering and dialogue advance; no browser error logs during the check.

Local comparisons: `.artifacts/cohesion/before.png` and `after.png`. Both show the same opening dialogue and camera position; idle animation frames can differ.

Remaining art issue: painted ground has fine, soft detail while character outlines are crisp and thick. This pilot improves presentation but does not replace the underlying art or claim a complete campaign art pass.
