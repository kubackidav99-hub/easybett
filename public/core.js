(function(root){
'use strict';
const tools=typeof module!=='undefined'?require('./market-tools'):root.MarketTools;
const norm=tools.norm;
function findGame(ev,games){
 const day=t=>{const d=new Date(t);return Number.isFinite(+d)?d.toISOString().slice(0,10):'';};
 if(!Number.isFinite(Date.parse(ev.t)))return null;
 const dates=new Set([day(ev.t),new Date(ev.t).toLocaleDateString('en-CA',{timeZone:'America/New_York'})]);
 const candidates=games.filter(g=>[g.h,g.a].some(t=>tools.teamKey(t)===tools.teamKey(ev.h))&&[g.h,g.a].some(t=>tools.teamKey(t)===tools.teamKey(ev.a))&&tools.teamKey(ev.h)!==tools.teamKey(ev.a)&&!!ev.preseason===(g.seasonType==='preseason')&&(g.t?Math.abs(Date.parse(g.t)-Date.parse(ev.t))<=6*3600000:dates.has(String(g.date||'').slice(0,10))));
 return candidates.length===1?candidates[0]:null;
}
function legResult(l,games,stats){
 const m=tools.infer(l);if(!m||!l.ev)return null;
 if(l.ev.sport&&!['basketball_nba','basketball_nba_preseason'].includes(l.ev.sport))return null;
 const g=findGame(l.ev,games);if(!g||!g.final||!Number.isFinite(g.hs)||!Number.isFinite(g.vs)||g.hs===g.vs)return null;
 let hs=g.hs,vs=g.vs;const period=m.scope||'full';
 if(period!=='full'){const ids=period==='reg'?[1,2,3,4]:period==='h1'?[1,2]:period==='h2'?[3,4]:/^q[1-4]$/.test(period)?[Number(period[1])]:null;if(!ids||!g.periods)return null;const parts=ids.map(i=>g.periods.find(p=>p.period===i));if(parts.some(p=>!p||!Number.isFinite(p.hs)||!Number.isFinite(p.vs)))return null;hs=parts.reduce((s,p)=>s+p.hs,0);vs=parts.reduce((s,p)=>s+p.vs,0);}
 let d;
 if(m.t==='prop'){
  const ps=stats.filter(p=>p.gameId===g.id&&norm(p.player)===norm(m.player));const keys=m.stats||[m.stat];if(!Array.isArray(keys)||!keys.length)return null;
  if(ps.length!==1||ps[0].didNotPlay||keys.some(k=>!Number.isFinite(ps[0][k]))||!Number.isFinite(m.pt)||!['over','under'].includes(m.side))return null;
  const val=keys.reduce((s,k)=>s+ps[0][k],0);d=m.side==='over'?val-m.pt:m.pt-val;
 }else if(m.t==='tot'||m.t==='teamtot'){
  if(!Number.isFinite(m.pt)||!['over','under'].includes(m.side))return null;let val=hs+vs;
  if(m.t==='teamtot'){if(![g.h,g.a].some(t=>tools.teamKey(t)===tools.teamKey(m.team)))return null;val=tools.teamKey(m.team)===tools.teamKey(g.h)?hs:vs;}
  d=m.side==='over'?val-m.pt:m.pt-val;
 }else{
  if(m.draw)return hs===vs?'won':'lost';
  if(![g.h,g.a].some(t=>tools.teamKey(t)===tools.teamKey(m.team)))return null;
  d=tools.teamKey(m.team)===tools.teamKey(g.h)?hs-vs:vs-hs;
  if(m.t==='sp'){if(!Number.isFinite(m.pt))return null;d+=m.pt;}else if(m.t!=='ml')return null;
  if(m.threeWay&&d===0)return 'lost';
 }
 return d>0?'won':d<0?'lost':'push';
}
function settleBet(b,games,stats){
 if(b.st!=='open'||!b.legs.length)return false;
 const r=b.legs.map(l=>legResult(l,games,stats));
 if(r.includes('lost'))b.st='lost';
 else if(r.includes(null))return false;
 else{const wins=b.legs.filter((l,i)=>r[i]==='won');b.st=wins.length?'won':'push';b.odds=wins.reduce((s,l)=>s*l.odds,1);}
 b.legResults=r;b.autoSettled=true;b.settledAt=new Date().toISOString();return true;
}
const api={findGame,legResult,settleBet};
if(typeof module!=='undefined')module.exports=api;else root.BetCore=api;
})(typeof globalThis!=='undefined'?globalThis:this);
