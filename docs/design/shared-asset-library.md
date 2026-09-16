# Shared authoring asset library

Assets are workspace-wide, while appearance bindings belong to each project. Importing creates a new immutable library entry; selecting an entry never overwrites an existing game's images or audio. Project `assetBindings` maps original runtime asset paths to library paths and travels with exported project JSON and compiled game snapshots. Files remain in `public/assets` and use the existing asset publishing pipeline.

The library indexes existing maps, scenery, portraits, items, effects, audio and character sprite bundles. A skin is a directory of named frames, not a rig or a character's combat statistics. Bundle replacement requires all original frame names. Effect sheets must preserve their existing frame layout. New uploads are append-only; replacing an assignment affects only the selected project. Existing global image replacement remains a separate advanced operation.

This is a local workspace library shared by all MODs, not an account/cloud marketplace. Project JSON references assets; moving projects to another computer requires copying/publishing the referenced asset files as well.


UI: Studio header → 공용 에셋. Context buttons on character portraits/skins and map/item/object/effect image panels save the current editor before opening the matching slot. Returning restores the previous editing area and scenario selection. Filters combine category, name/tags, built-in assets, assets linked by the current project, and the project that imported an asset. Existing Troia sample portraits/background are indexed separately.

Validation: workspace tests passed; web 828 tests. Asset-library tests cover append-only uploads, project provenance, file-path rejection, skin prefix resolution, project switching and compiled snapshot preservation. Browser checks cover category/search/source-project filtering, portrait previews and audio controls. No existing project appearance assignments were changed during implementation.
