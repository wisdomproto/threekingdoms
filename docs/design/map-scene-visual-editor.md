# Visual map scene editor

The Studio story detail editor now edits existing `MapScene` parts directly. New parts can be added beside VN and comic parts without writing JSON. This retains the current `Stage.scenario` contract; it does not convert story scenes to battle events.

- Initial placement and line selection are distinct modes. Dragging an actor in initial placement changes `units[].cell`; dragging at a line updates that actor's `move` command in that line.
- Entry, exit, movement, facing and pose use existing runtime actions. Their execution order is exit, move, enter, face, pose. Line order is editable.
- Dialogue, bubbles and existing flavor choices can be edited. Actor removal cleans action and bubble references while retaining spoken text. The last actor cannot be removed through the visual controls.
- Map and sprite catalogs provide background and actor previews. Studio map resources override repository maps. Save/undo/history remain owned by the existing editor bridge.
- Local playback is explicitly a placement sequence preview using authored destination cells and representative motion frames. It does not simulate pathfinding, frame animation, props, or choice reactions. The game preview button uses the existing snapshot player for actual playback of the story slot.
- Optional `MapScene.camera.zoom` is a 0.5–4 multiplier over map fit; `camera.focus` fixes the center to a cell. Without zoom, the player frames actors at approximately 20% of viewport height, bounded by map fit and a 2.4x fit cap. Without focus, it follows moving/speaking actors and nearby visible actors. No map-name-specific camera behavior remains.
- Whole-map and enlarged editing views are display preferences, independent of saved game camera settings.

Reference review: the previously downloaded user-provided `qvSF_J5TtsE` video, approximately 00:50–02:30, places conversation participants in a compact area with large dialogue portraits. This inspired actor-focused framing, not copied artwork or exact measured camera values.

Validation includes original opening scene edits, action reference cleanup, camera schema acceptance and legacy round-trip tests. The full test suite and typecheck passed. Initial browser navigation returned `net::ERR_BLOCKED_BY_CLIENT`; a direct HTTP check also found a development-server 500. Restarting that server restored HTTP 200 and browser navigation. Browser checks then covered opening the embedded scene editor, selecting a dialogue beat and an actor, enlarged view, PNG background fallback, transparent actor preview, and the actual street scene's actor-focused camera. End-to-end drag/save/reopen remains unverified.
