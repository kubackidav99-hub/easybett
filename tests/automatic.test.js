const test=require('node:test'),assert=require('node:assert/strict'),tools=require('../public/market-tools'),core=require('../public/core'),{createResults}=require('../results-source'),{apply,createSettlement}=require('../settlement'),{createStore}=require('../accounts'),{newDb}=require('pg-mem');
const sb=require('./fixtures/espn-scoreboard.json'),summary=require('./fixtures/espn-summary.json');
const ev={h:'Indiana Pacers',a:'Minnesota Timberwolves',t:'2025-10-08T00:00:00Z',preseason:true,sport:'basketball_nba_preseason'};
const leg=(mk,label,odds=2)=>({ev,meta:{t:'custom'},mk,label,odds});
function source(){let calls=0;return{service:createResults({fetcher:async url=>{calls++;return{ok:true,json:async()=>url.includes('summary')?summary:sb};}}),count:()=>calls};}
test('compact handicap labels and signed pairs keep source selection indices',()=>{
 const mk=[['Handicap (z dogrywką) · 1.5',[[ev.h+' wygra mecz przy uwzględnieniu podanego Handicapu (-1.5) (z dogrywką)',2],[ev.a+' wygra mecz przy uwzględnieniu podanego Handicapu (1.5) (z dogrywką)',1.8],[ev.h+' wygra mecz przy uwzględnieniu podanego Handicapu (1.5) (z dogrywką)',1.9],[ev.a+' wygra mecz przy uwzględnieniu podanego Handicapu (-1.5) (z dogrywką)',2.1]]]];const layout=tools.layout({...ev,mk});assert.equal(layout.length,1);assert.deepEqual(layout[0].rows.map(r=>r.map(x=>x.j)),[[0,1],[2,3]]);assert.equal(tools.compact(mk[0][1][0][0],mk[0][0],ev),'Indiana Pacers -1,5');
});
test('ESPN final OT fixture: swapped team order, totals, signed handicap, quarters, halves, regulation and props',async()=>{
 const {service,count}=source(),data=await service.resolve([leg('Zwycięzca (z dogrywką)',ev.h+' wygra mecz (z dogrywką)')]);assert.equal(data.games[0].hs,134);assert.equal(data.games[0].vs,135);assert.equal(data.stats[0].pts,14);
 const result=(mk,label)=>core.legResult(leg(mk,label),data.games,data.stats);
 assert.equal(result('Zwycięzca (z dogrywką)',ev.h+' wygra mecz (z dogrywką)'),'won');
 assert.equal(result('Handicap (z dogrywką)',ev.h+' wygra mecz przy uwzględnieniu podanego Handicapu (-1.5) (z dogrywką)'),'lost');
 assert.equal(result('Handicap (z dogrywką)',ev.a+' wygra mecz przy uwzględnieniu podanego Handicapu (+1.5) (z dogrywką)'),'won');
 assert.equal(result('Liczba punktów (z dogrywką)','Powyżej 268.5 punktów'),'won');
 assert.equal(result('Liczba punktów (bez dogrywki)','Powyżej 248 punktów'),'push');
 assert.equal(result('Mecz','Remis'),'won');assert.equal(result('Mecz',ev.h),'lost');
 assert.equal(result('Liczba punktów 1. kwarta','Powyżej 65.5'),'won');
 assert.equal(result('Zwycięzca 1. połowa',ev.h),'won');
 assert.equal(result('Punkty zawodnika (z dogrywką)','Pascal Siakam Powyżej 13.5'),'won');
 assert.equal(result('Punkty + zbiórki + asysty zawodnika','Pascal Siakam Powyżej 20'),'push');
 assert.equal(result('Trójki zawodnika','Pascal Siakam Powyżej 2.5'),'won');
 assert.equal(result('Własny zakład','Pascal Siakam Tak'),null);
 assert.equal(result('Zwycięzca i suma punktów',ev.h+' Powyżej 240.5'),null);
 assert.equal(core.legResult({...leg('Zwycięzca (z dogrywką)',ev.h),ev:{...ev,preseason:false}},data.games,data.stats),null);
 assert.equal(core.legResult(leg('Punkty zawodnika','Pascal Siakam Powyżej 13.5'),data.games,data.stats.map(x=>({...x,didNotPlay:true}))),null);
 await service.resolve([leg('Zwycięzca (z dogrywką)',ev.h)]);assert.equal(count(),3,'two dates and one boxscore are cached');
});
test('missing, live and ambiguous results remain open; AKO void legs and repeated checks pay once',async()=>{
 const {service}=source(),data=await service.resolve([leg('Zwycięzca (z dogrywką)',ev.h)]),b={id:1,st:'open',stake:100,odds:4,legs:[leg('Zwycięzca (z dogrywką)',ev.h),leg('Liczba punktów (z dogrywką)','Powyżej 269')]};
 assert.equal(core.legResult(b.legs[0],data.games.map(g=>({...g,final:false})),data.stats),null);
 assert.equal(core.legResult(b.legs[0],[...data.games,...data.games],data.stats),null);
 const settled=apply({bal:900,bets:[b]},data);assert.equal(settled.count,1);assert.equal(settled.state.bal,1100);assert.equal(settled.state.bets[0].odds,2);assert.equal(apply(settled.state,data).count,0);assert.equal(apply(settled.state,data).state.bal,1100);
 const fail=createResults({fetcher:async()=>{throw Error('offline')}});const missing=await fail.resolve(b.legs);assert.ok(missing.errors.length);assert.equal(apply({bal:900,bets:[b]},missing).count,0);
});
test('server auto-settlement persists account balance and version with PostgreSQL adapter',async()=>{
 const store=createStore({url:'postgres://fixture',PoolClass:newDb().adapters.createPg().Pool}),{service}=source();try{const b={id:1,st:'open',stake:100,odds:2,legs:[leg('Zwycięzca (z dogrywką)',ev.h)]};await store.create({id:'u',email:'auto@example.com',name:'Auto',password:'hash',version:0,state:{bal:900,bets:[b]}});assert.equal((await store.pending()).length,1);const worker=createSettlement(store,service);assert.equal(await worker.start(),1);assert.equal((await store.find('auto@example.com')).state.bal,1100);assert.equal((await store.pending()).length,0);assert.equal(await worker.start(),0);assert.equal((await store.find('auto@example.com')).version,1);}finally{await store.close();}
});
