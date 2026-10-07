const test=require('node:test'),assert=require('node:assert/strict');
const {validateMatches}=require('../public/offline-data');
const fixture=()=>({matches:[{id:'nba1',h:'Boston Celtics',a:'New York Knicks',t:'2030-10-07T20:00:00Z',mk:[['PRA 35.5 – Player',[['Powyżej 35.5',2.1]]]]}]});
test('imports any named NBA market and keeps Preseason separate',()=>{const j=fixture();j.matches[0].preseason=true;const [e]=validateMatches(j);assert.equal(e.preseason,true);assert.equal(e.manualSettlement,true);assert.equal(e.mk[0][1][0][2].marketId,'PRA 35.5 – Player');assert.equal(e.mk[0][1][0][1],2.1);assert.equal(e.sportKey,'basketball_nba_preseason');});
test('invalid imports are rejected before anything is saved',()=>{for(const change of [j=>j.matches[0].mk[0][1][0][1]=1,j=>j.matches[0].t='bad',j=>j.matches.push(j.matches[0]),j=>j.matches[0].mk[0][1].push(['Powyżej 35.5',3]),j=>j.matches[0].mk='wrong']){const j=fixture();change(j);assert.throws(()=>validateMatches(j));}});
test('matches without main markets are valid for adding only player props',()=>{const j=fixture();j.matches[0].mk=[];assert.deepEqual(validateMatches(j)[0].mk,[]);});
