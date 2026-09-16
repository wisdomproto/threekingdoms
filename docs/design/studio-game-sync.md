# Studio to local game

Studio's `게임 실행` saves the current editor, validates a complete campaign snapshot, and opens the regular title screen. The regular story, formation, battle and reward loop consumes that snapshot rather than sandbox data. Existing game progress is preserved; starting a new game remains an explicit title-screen action.

The active project is recorded under `.studio/game/`. New game visits synchronize the latest saved revision. A running game uses one immutable snapshot; edits never replace an active battle's rules. Invalid drafts remain saved in Studio but cannot replace the last valid game snapshot. The title reports a synchronization error. Suspended battles retain their snapshot revision for deterministic resume.

This is local development integration, not public deployment. Images use the existing shared local asset URLs. Source JSON and original project fields are not overwritten. Campaign compilation follows chapter entry and victory links, assembles story chains, and rejects loops, repeated battles and defeat branches that the regular game's retry flow cannot represent.
