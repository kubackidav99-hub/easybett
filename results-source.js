const {findGame}=require('./public/core');const {teamKey}=require('./public/market-tools');
const BASE='https://site.api.espn.com/apis/site/v2/sports/basketball/nba/';
const number=v=>v!==null&&v!==undefined&&String(v).trim()!==''&&/^\d+(?:\.\d+)?$/.test(String(v))?Number(v):null;
function gameFrom(event){const c=event.competitions?.[0],h=c?.competitors?.find(x=>x.homeAway==='home'),a=c?.competitors?.find(x=>x.homeAway==='away');if(!h||!a||![1,2,3].includes(Number(event.season?.type)))return null;const type=c.status?.type||event.status?.type;return{id:String(event.id),h:h.team.displayName,a:a.team.displayName,t:event.date||c.date,date:(event.date||c.date||'').slice(0,10),seasonType:Number(event.season?.type)===1?'preseason':'regular',final:type?.completed===true&&/^STATUS_FINAL/.test(type.name||''),hs:number(h.score),vs:number(a.score),periods:(h.linescores||[]).map((p,i)=>({period:p.period||i+1,hs:number(p.value??p.displayValue),vs:number(a.linescores?.[i]?.value??a.linescores?.[i]?.displayValue)})),source:'ESPN'};}
function playerStats(summary,id){if(String(summary.header?.id)!==String(id))return[];const out=[];
 for(const team of summary.boxscore?.players||[])for(const group of team.statistics||[])for(const p of group.athletes||[]){const names=group.names||group.labels||[],value=label=>{const i=names.indexOf(label);return i<0?null:number(p.stats?.[i]);};const made=label=>{const i=names.indexOf(label);const v=i<0?null:p.stats?.[i];return /^\d+-\d+$/.test(v||'')?Number(v.split('-')[0]):null;};out.push({gameId:String(id),player:p.athlete?.displayName,didNotPlay:p.didNotPlay===true,pts:value('PTS'),reb:value('REB'),ast:value('AST'),stl:value('STL'),blk:value('BLK'),tov:value('TO'),fg3m:made('3PT')});}
 return out;
}
function createResults({fetcher=fetch,ttl=300000}={}){
 const cache=new Map();
 async function get(route){const previous=cache.get(route);if(previous&&Date.now()-previous.time<ttl)return previous.promise;const promise=(async()=>{const r=await fetcher(BASE+route,{signal:AbortSignal.timeout(20000),headers:{accept:'application/json'}});if(!r.ok)throw Error('Źródło wyników: HTTP '+r.status);return r.json();})();cache.set(route,{time:Date.now(),promise});promise.catch(()=>cache.delete(route));if(cache.size>300)cache.delete(cache.keys().next().value);return promise;}
 async function resolve(legs){const events=[...new Map(legs.filter(l=>l.ev&&['basketball_nba','basketball_nba_preseason'].includes(l.ev.sport||'basketball_nba')&&Number.isFinite(Date.parse(l.ev.t))&&Date.parse(l.ev.t)<Date.now()).map(l=>[JSON.stringify(l.ev),l.ev])).values()],games=new Map(),stats=[],errors=[];
 const dates=new Set();for(const e of events){dates.add(new Date(e.t).toLocaleDateString('en-CA',{timeZone:'America/New_York'}).replaceAll('-',''));dates.add(new Date(e.t).toISOString().slice(0,10).replaceAll('-',''));}
 for(const date of dates){try{const j=await get('scoreboard?dates='+date+'&limit=100');for(const e of j.events||[]){const g=gameFrom(e);if(g)games.set(g.id,g);}}catch(e){errors.push(e.message);}}
 const matched=new Map();for(const ev of events){const g=findGame(ev,[...games.values()]);if(g?.final)matched.set(g.id,g);}
 for(const [id,g]of matched){try{const summary=await get('summary?event='+id),detail=gameFrom({id:summary.header?.id,season:summary.header?.season,competitions:summary.header?.competitions});if(detail?.final&&detail.id===id&&teamKey(detail.h)===teamKey(g.h)&&teamKey(detail.a)===teamKey(g.a)&&detail.hs===g.hs&&detail.vs===g.vs)stats.push(...playerStats(summary,id));else errors.push('Boxscore nie potwierdza końcowego wyniku; propsy czekają.');}catch(e){errors.push(e.message);}}
 return{games:[...matched.values()],stats,errors:[...new Set(errors)],checkedAt:new Date().toISOString()};
 }
 return{resolve};
}
module.exports={createResults,gameFrom,playerStats};
