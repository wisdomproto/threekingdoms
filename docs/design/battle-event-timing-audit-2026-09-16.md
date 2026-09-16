# Campaign battle-event timing audit — 2026-09-16

## Scope

Reviewed all 27 stages for authored event/dialogue timing, reinforcement references, and post-battle fire exposition. This is a source-data and automated runtime audit, not a manual playthrough of every stage. Long-form story expansion remains separate.

## Changes

- Six scripted hazards now use `scriptFired(scriptId)` dialogue edges; all 31 reinforcement groups have `reinforcementArrived(reinforcementId)` cues.
- Dialogue observes settled engine state, so effects resolve before their dialogue appears. Repeated snapshots and resumed already-played cues do not repeat.
- Interactive battle stores hold both player auto-battle and AI phase drivers while the dialogue queue is open. The gate is acquired synchronously at event drain, before another action can commit; reading the queue releases it. Headless simulation is unchanged. Tests compare the resumed result with the same seeded uninterrupted battle.
- Bowangpo: moved Zhuge Liang’s fire explanation from Xiahou Dun’s retreat to ignition. Aftermath no longer requires a fire that may not have triggered before an early victory.
- Chibi: removed the duplicate turn-based fire reaction; the fire reaction follows ignition, while the allied arrival cue follows reinforcement arrival.
- Added missing conditional ambush/reinforcement announcements, including the pursuit forests and rear guards.
- Yingchuan: no local fire hazard is authored. Its turn-four cue now describes the allied attack in the surrounding battle rather than claiming local flames just appeared. No new damage mechanic was invented.
- Changbanpo: turn-four warning describes approaching pursuers; actual turn-eight arrivals use the arrival edge.
- Editor supports selecting both new conditions, validates references, and preserves them in save round trips.
- Existing combat triggers, damage, movement costs and combat balance are unchanged. Forest terrain remains traversable with movement cost; individual tree images do not define collision.

## Stage inventory

| Stage | Hazard cues | Reinforcement cues | Remaining timed dialogue |
|---|---:|---:|---|
| 01-zhuojun | 0 | 0 | 3 |
| 02-yingchuan | 0 | 0 | 4 |
| 03-guangzong | 0 | 1 | — |
| 04-zhangjue | 0 | 1 | — |
| 05-sishuiguan | 0 | 0 | 3 |
| 06-huluguan | 0 | 1 | — |
| 07-luoyang | 1 | 1 | — |
| 08-dongzhuo-chase | 0 | 2 | 8 |
| 09-banhe | 0 | 1 | — |
| 10-xuzhou | 0 | 1 | — |
| 11-xiaopei | 0 | 2 | — |
| 12-xiapi1 | 0 | 1 | — |
| 13-yuanshu | 0 | 0 | 5 |
| 14-xiapi2 | 1 | 2 | — |
| 15-xutian | 0 | 1 | — |
| 16-guandu-escape | 0 | 2 | — |
| 17-runan | 0 | 1 | — |
| 18-bowangpo | 1 | 2 | — |
| 19-xinye | 0 | 1 | — |
| 20-changbanpo | 0 | 1 | 4 |
| 21-changbanqiao | 1 | 1 | 4 |
| 22-hanjin | 0 | 2 | — |
| 23-jiangxia | 0 | 1 | — |
| 24-sanjiangkou | 0 | 1 | 5 |
| 25-wulin | 1 | 2 | — |
| 26-chibi | 1 | 2 | — |
| 27-huarongdao | 0 | 1 | — |

## Validation

- Final full suite: 1,404 passed, 9 skipped, including seven engine-to-dialogue integration cases and three pause/resume cases. Log: `.studio/event-timing-tests-final.log`.
- Workspace typecheck passed; web typecheck repeated after the integration test addition.
- Report card: all 27 stages HEALTHY, unchanged.
- Active Studio project synchronized from revision 18 to 19, updating 24 battle dialogue records and Bowangpo outro only. Backup: `.studio/event-timing-project-before.json`.
- Browser: a single press of “전장으로” shows the pending state and enters Bowangpo without a second press. This verifies the new feedback/transition path, not a reproduced diagnosis of the original three-click report.
