import Link from "next/link";
import { assetUrl } from "../src/assetUrl";
import styles from "./home.module.css";

export const metadata = { title: "이야기 전장 · 스토리 전략 RPG", description: "삼국지부터 트로이까지. 이야기를 따라가고, 전투를 지휘하고, 나만의 MOD를 만드는 공간." };

const mods = [
  { id: "01", title: "삼국지 · 유비전", subtitle: "THREE KINGDOMS", description: "도원에서 시작된 작은 맹세. 유비와 동료들의 여정을 따라 난세의 전투를 지휘하세요.", image: "/assets/maps/zhuojun.webp", href: "/play/samgukji", tags: ["역사", "턴제 전략", "스토리 캠페인"], status: "플레이 가능" },
  { id: "02", title: "트로이", subtitle: "TROIA", description: "신들의 선택, 영웅들의 운명. 에게해를 건너 트로이 전쟁의 첫 무대에 발을 내디뎌 보세요.", image: "/assets/maps/troia-coast.webp", href: "/play/troia", tags: ["신화", "턴제 전략", "샘플 MOD"], status: "개발 중 · 체험판" },
];

export default function Home() {
  return <div className={styles.page}>
    <header className={styles.header}>
      <Link href="/" className={styles.brand}><span className={styles.seal} aria-hidden="true">戰</span><span>이야기 전장<small>STORY & TACTICS</small></span></Link>
      <nav aria-label="메인 메뉴"><a href="#mods">MOD 둘러보기</a><Link className={styles.studioLink} href="/studio-login">스튜디오 <span aria-hidden="true">↗</span></Link></nav>
    </header>
    <main>
      <section className={styles.hero}>
        <img className={styles.heroBackdrop} src={assetUrl("/assets/bg/battle_dawn.png")} alt="" />
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>한 편의 이야기, 당신의 한 수</p>
          <h1>읽던 이야기의<br />다음 장을 <em>플레이하다.</em></h1>
          <p className={styles.intro}>영웅들의 이야기를 따라가고, 결정적인 전투를 지휘하세요.<br className={styles.desktopBreak} /> 서로 다른 세계가 하나의 전략 RPG로 펼쳐집니다.</p>
          <a href="#mods" className={styles.primary}>플레이할 MOD 찾기 <span aria-hidden="true">↓</span></a>
          <p className={styles.heroNote}>설치 없이 브라우저에서 · 모바일 & PC</p>
        </div>
        <div className={styles.heroes} aria-label="삼국지의 유비, 관우, 장비">
          {["관우", "유비", "장비"].map((name, index) => <div className={`${styles.portrait} ${index === 1 ? styles.lead : ""}`} key={name}><img src={assetUrl(`/assets/ui/portraits/${name}.webp`)} alt={name} /><span>{name}</span></div>)}
          <p>서로 다른 영웅, 함께 쓰는 이야기.</p>
        </div>
      </section>
      <section id="mods" className={styles.mods} aria-labelledby="mods-title">
        <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>EXPLORE THE WORLDS</p><h2 id="mods-title">어떤 이야기로 떠날까요?</h2></div><p>MOD 하나가 하나의 게임입니다.</p></div>
        <div className={styles.cards}>{mods.map(mod => <article className={styles.card} key={mod.id}>
          <a href={mod.href} className={styles.cardArt} aria-label={`${mod.title} 플레이`}><img src={assetUrl(mod.image)} alt={`${mod.title} 전장 이미지`} loading="lazy" /><span className={styles.badge}>{mod.status}</span><span className={styles.artTitle}>{mod.subtitle}</span></a>
          <div className={styles.cardBody}><div className={styles.tags}>{mod.tags.map(tag => <span key={tag}>{tag}</span>)}</div><h3>{mod.title}</h3><p>{mod.description}</p><div className={styles.cardFooter}><span>MOD / {mod.id}</span><a href={mod.href}>플레이하기 <span aria-hidden="true">→</span></a></div></div>
        </article>)}</div>
      </section>
      <section className={styles.creator} aria-labelledby="creator-title"><div><p className={styles.eyebrow}>FOR CREATORS</p><h2 id="creator-title">다음 이야기는<br />당신의 세계로.</h2><p>장면을 쓰고, 장수를 배치하고, 전투를 만드세요.<br />스튜디오에서 나만의 MOD를 이어갈 수 있습니다.</p></div><div className={styles.creatorAside}><ol><li><span>01</span> 이야기와 장면 구성</li><li><span>02</span> 캐릭터와 전투 편집</li><li><span>03</span> 플레이하며 완성하기</li></ol><Link href="/studio-login">스튜디오 열기 <span aria-hidden="true">↗</span></Link><small>제작자 비밀번호가 필요합니다.</small></div></section>
    </main>
    <footer className={styles.footer}><span>이야기 전장 <small>STORY & TACTICS</small></span><p>이야기를 만나고, 전장을 만들다.</p><Link href="/studio-login">스튜디오 ↗</Link></footer>
  </div>;
}
