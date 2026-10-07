const {test}=require('node:test'),assert=require('node:assert/strict');
const {legResult,settleBet}=require('../public/core');
const ev={h:'Boston Celtics',a:'New York Knicks',t:'2026-10-07T23:00:00Z',preseason:false};
const g={id:1,h:ev.h,a:ev.a,date:'2026-10-07',seasonType:'regular',hs:110,vs:100,final:true};
const leg=meta=>({meta,ev,odds:2});
test('dates, season and final status protect settlement',()=>{const l=leg({t:'ml',team:ev.h});assert.equal(legResult(l,[g],[]),'won');for(const change of [{date:'2026-10-06'},{seasonType:'preseason'},{final:false},{hs:null}])assert.equal(legResult(l,[{...g,...change}],[]),null);assert.equal(legResult(l,[g,{...g,id:2}],[]),null)});
test('winner, spread, total and player stats including pushes',()=>{assert.equal(legResult(leg({t:'ml',team:ev.a}),[g],[]),'lost');assert.equal(legResult(leg({t:'sp',team:ev.h,pt:-10}),[g],[]),'push');assert.equal(legResult(leg({t:'tot',side:'over',pt:210}),[g],[]),'push');const l=leg({t:'prop',player:'Jayson Tatum',stat:'pts',side:'over',pt:20.5});assert.equal(legResult(l,[g],[]),null);assert.equal(legResult(l,[g],[{gameId:1,player:'Jayson Tatum',pts:21}]),'won')});
test('AKO removes pushed leg, waits on unknown and settles only once',()=>{const win=leg({t:'ml',team:ev.h}),push=leg({t:'tot',side:'over',pt:210});const b={st:'open',legs:[win,push],odds:4};assert.equal(settleBet(b,[g],[]),true);assert.equal(b.st,'won');assert.equal(b.odds,2);assert.equal(settleBet(b,[g],[]),false);const waiting={st:'open',legs:[win,{odds:3}],odds:6};assert.equal(settleBet(waiting,[g],[]),false);const lost={st:'open',legs:[leg({t:'ml',team:ev.a}),{odds:3}],odds:6};assert.equal(settleBet(lost,[g],[]),true);assert.equal(lost.st,'lost')});

test('old non-NBA coupons cannot settle against NBA results',()=>{const l=leg({t:'ml',team:ev.h});l.ev={...ev,sport:'soccer_epl'};assert.equal(legResult(l,[g],[]),null)});
