# Battle voices

Human-recorded CC0 voices are enabled. Source: HaelDB, [Male Grunt/Yelling sounds](https://opengameart.org/content/male-gruntyelling-sounds), CC0-1.0 selected from the offered licenses. The source pack has four male vocalists; this first integration uses the six explicitly named `3grunt` recordings from one vocalist. These are nonverbal exertions, not Korean dialogue or character-exclusive acting. User listening review remains the quality gate.

Liu Bei uses 3grunt3 / 3grunt1, Guan Yu 3grunt4 / 3grunt2, and Zhang Fei 3grunt5 / 3grunt6 (attack / ultimate). Silence is trimmed and levels normalized to -20 LUFS / -3 dBTP, encoded mono 24 kHz MP3 at 64 kbps. Versioned `*-recorded-v1.mp3` names prevent cached rejected TTS playing. Source filenames, SHA-256 hashes, durations and license URL are recorded in `public/assets/audio/voices/recorded-v1-source.json`. Original ZIP/WAV files are preserved under `.studio/battle-voices/hael-db`.

The earlier Voicebox TTS samples were rejected and remain preserved as unreferenced files. `tools/generate-battle-voices.mjs` writes the old filenames and does not overwrite these recordings.

BattleRenderer plays a shout at a physical attack's start, including counters and misses, and uses the special clip for ultimates. A cooperating attacker can also shout at lower gain. At most two clips overlap; each character has an 800 ms cooldown. Playback uses the existing SFX/master mute and volume buses. Failed audio never blocks simulation, no RNG is consumed, and leaving the renderer stops active sources. The motion preview includes individual listening controls.
