const test=require('node:test'),assert=require('node:assert/strict');
const {server}=require('../server');
test('offline server serves the application and never requests remote APIs',async()=>{
 const realFetch=global.fetch;let calls=0;global.fetch=()=>{calls++;throw new Error('Remote request forbidden');};
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{const base='http://127.0.0.1:'+server.address().port;
  assert.equal((await realFetch(base+'/')).status,200);assert.equal((await realFetch(base+'/offline-data.js')).status,200);
  for(const p of ['odds','props','value-scan','preseason-odds','players']){const r=await realFetch(base+'/api/'+p);assert.equal(r.status,410);assert.match((await r.json()).error,/Tryb bez API/);}
  assert.equal((await realFetch(base+'/api/results')).status,405);assert.equal((await realFetch(base+'/api/results',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({legs:[]})})).status,200);assert.equal(calls,0);
 }finally{global.fetch=realFetch;await new Promise(r=>server.close(r));}
});
