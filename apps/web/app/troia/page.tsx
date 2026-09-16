'use client';
import dynamic from 'next/dynamic';
const Game=dynamic(()=>import('../../src/troia/TroiaGame'),{ssr:false,loading:()=> <main style={{background:'#12272b',color:'#efdfbf',padding:48,minHeight:'100vh'}}>트로이 해안으로 향하는 중…</main>});
export default function TroiaPage(){return <Game/>;}
