"use client";
import { useId } from "react";

/** Original jewel-and-bronze command art, rendered as vectors at HUD scale. */
export function StrategyIcon({ name, category }: { name: string; category: string }): React.ReactElement {
  const uid = useId().replace(/:/g, "");
  const kind = name === "조언" ? "counsel" : name === "기합" ? "spirit" : /헌책/.test(name) ? "scroll" : /분기|고무|기합|패기|고양|환성/.test(name) ? "rally" : /견고|강진/.test(name) ? "shield" : /각성|명상|회귀/.test(name) ? "spirit" : category;
  const colors: Record<string, [string, string]> = {
    fire: ["#ff661c", "#650e1f"], water: ["#32d6ff", "#122d78"], wind: ["#9beec2", "#15514f"],
    earth: ["#ffc65a", "#633713"], debuff: ["#cc7bff", "#421354"], heal: ["#8afa85", "#174a2c"],
    counsel: ["#62ece0", "#155e68"], scroll: ["#74d9ff", "#26396d"], rally: ["#ffac37", "#8c2530"], shield: ["#7baaff", "#243870"],
    spirit: ["#d6a4ff", "#473680"], weather: ["#c5e9ff", "#426684"], special: ["#fff49b", "#803616"],
  };
  const [light, dark] = colors[kind] ?? ["#fff49b", "#803616"];
  const paths: Record<string, string> = {
    fire: "M31 8C34 20 20 22 25 32C26 25 34 23 37 16C39 27 49 35 41 44C32 54 17 47 18 36C10 23 26 22 31 8Z",
    water: "M33 9C29 20 15 29 19 40C23 53 45 52 46 37C46 27 36 18 33 9ZM22 38Q31 46 41 34",
    wind: "M12 24Q28 10 47 22Q56 32 32 32H19M13 36H39Q52 36 44 43Q33 51 23 43M21 17Q31 12 42 17",
    earth: "M12 43L20 25L29 29L36 15L46 30L52 45L33 50Z M20 25L25 41L12 43M36 15L36 38L52 45M25 41L36 38L33 50",
    debuff: "M13 32Q31 11 51 32Q32 50 13 32ZM32 23A9 9 0 1 0 32 41A9 9 0 1 0 32 23M32 27V36M17 15L23 20M47 15L41 20",
    heal: "M28 14H37V27H49V36H37V49H28V36H15V27H28ZM13 44L9 48M48 14L53 9",
    counsel: "M13 15H50V39H30L20 49V39H13ZM21 23H42M21 30H36",
    scroll: "M18 14Q29 10 43 15L41 44Q30 39 18 44ZM18 14H13V44H18M43 15H48V45H41M23 23H37M23 29H35M23 35H33",
    rally: "M20 52V12M21 15Q31 9 46 15L40 24L46 34Q31 28 21 34M13 44L9 39M46 44L51 38",
    shield: "M32 11L48 18V32Q47 44 32 52Q17 44 16 32V18ZM32 18V43M22 28H42",
    spirit: "M32 10L37 25L51 31L37 37L32 52L26 37L12 31L26 25ZM16 15L20 19M46 44L50 48",
    weather: "M21 17A9 9 0 1 0 21 35A9 9 0 1 0 21 17M19 41Q9 32 24 29Q30 16 39 30Q55 27 51 41ZM23 47L21 52M37 47L35 52",
    special: "M32 10L39 24L54 27L43 38L46 53L32 45L18 53L21 38L10 27L25 24Z",
  };
  return <svg viewBox="0 0 64 64" aria-hidden="true" style={{ width: 42, height: 42, flexShrink: 0 }}>
    <defs>
      <radialGradient id={`${uid}bg`}><stop stopColor={light}/><stop offset="1" stopColor={dark}/></radialGradient>
      <linearGradient id={`${uid}gold`} x2="0" y2="1"><stop stopColor="#fff3b4"/><stop offset=".5" stopColor="#99702d"/><stop offset="1" stopColor="#edcd73"/></linearGradient>
      <linearGradient id={`${uid}ink`} x2="0" y2="1"><stop stopColor="#fffde0"/><stop offset="1" stopColor={light}/></linearGradient>
    </defs>
    <rect x="2" y="2" width="60" height="60" rx="10" fill={`url(#${uid}gold)`}/>
    <rect x="5" y="5" width="54" height="54" rx="7" fill={`url(#${uid}bg)`} stroke="#1f192b" strokeWidth="2"/>
    <path d="M8 48 50 8M16 56 56 16M8 34 34 8" stroke={light} opacity=".25" strokeWidth="3"/>
    <circle cx="32" cy="32" r="23" fill="none" stroke="#fff0b9" opacity=".25"/>
    <path d={paths[kind] ?? paths.special} fill={["wind", "scroll", "shield", "weather", "debuff"].includes(kind) ? "none" : `url(#${uid}ink)`} stroke="#261630" strokeWidth="5" strokeLinejoin="round" opacity=".6"/>
    <path d={paths[kind] ?? paths.special} fill={["wind", "scroll", "shield", "weather", "debuff"].includes(kind) ? "none" : `url(#${uid}ink)`} stroke="#fff3c8" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"/>
    <path d="m8 8 3 3-3 3-3-3Zm48 42 2 3 3 2-3 2-2 3-2-3-3-2 3-2Z" fill="#fff7c9"/>
  </svg>;
}
