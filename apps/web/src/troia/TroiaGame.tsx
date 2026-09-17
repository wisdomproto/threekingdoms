"use client";
import { useEffect, useState } from "react";
import { ScenarioSceneSchema } from "@tk/data";
import BattleScreen from "../battle/BattleScreen";
import { ScenePlayer } from "../scene/ScenePlayer";
import { content, context } from "./content";
import { InstallGameButton } from "../pwa/InstallGameButton";
import styles from "./TroiaGame.module.css";
import { playBgm } from "../audio";

const setup = { ctx: context, seed: content.seed, sharedItems: [], localAssets: true };
const scenes = {
  intro: ScenarioSceneSchema.parse(content.stage.scenario?.intro),
  victory: ScenarioSceneSchema.parse(content.stage.scenario?.outro),
  defeat: ScenarioSceneSchema.parse(content.stage.scenario?.outroDefeat),
};
/** A chapter launcher only. Battle UI, Pixi renderer, rules and scenes are shared. */
export default function TroiaGame() {
  const [phase, setPhase] = useState<"title" | "intro" | "battle" | "victory" | "defeat">("title");
  const [run, setRun] = useState(0);
  useEffect(() => { document.title = "TROIA · 낯선 해안"; }, []);
  useEffect(() => { playBgm(phase === "battle" ? "battle" : phase === "title" ? "title" : "scene"); }, [phase]);
  function start(intro: boolean) { setRun(n => n + 1); setPhase(intro ? "intro" : "battle"); }
  if (phase === "battle") return <BattleScreen key={run} setup={setup} onComplete={setPhase} onExit={() => setPhase("title")} />;
  if (phase !== "title") return <ScenePlayer key={`${phase}:${run}`} scene={scenes[phase]} title="트로이 · 낯선 해안" onComplete={() => setPhase(phase === "intro" ? "battle" : "title")} />;
  return <main className={styles.launcher}>
    <header><strong>TROIA</strong><InstallGameButton /><span>CHAPTER 01 · 인간들의 전쟁</span></header>
    <section>
      <p className={styles.eyebrow}>THE FIRST LANDING</p>
      <h1>낯선 해안</h1>
      <p>누군가에게는 영광으로 향하는 첫발.<br/>누군가에게는 집을 떠나야 하는 마지막 아침.</p>
      <div className={styles.actions}><button onClick={() => start(true)}>이야기 시작</button><button onClick={() => start(false)}>바로 전투</button></div>
      <p className={styles.note}>4명의 상륙대 · {content.stage.turnLimit}턴 안에 봉화대 확보<br/>이동 · 공격 · 협공 · 책략 · 필살</p>
    </section>
  </main>;
}
