const test=require('node:test'),assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const {createAccounts,createStore}=require('../accounts');
test('accounts: secure sessions, isolation, progress across devices/restart, conflicts and logout',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'easybet-')),file=path.join(dir,'accounts.json');let store=createStore({url:'',file}),api=createAccounts(store);
 const server=http.createServer(async(req,res)=>{const json=(code,data)=>{res.writeHead(code,{'content-type':'application/json'});res.end(JSON.stringify(data));};await api.handle(req,res,json);});await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 const call=async(route,method='GET',data,token='',headers={})=>{const r=await fetch(base+'/api/account/'+route,{method,headers:{'content-type':'application/json',cookie:token,...headers},...(data?{body:JSON.stringify(data)}:{})});return{status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0],header:r.headers.get('set-cookie')};};
 try{
 assert.equal((await call('me')).status,401);
 assert.equal((await call('register','POST',{name:'David',email:'bad',password:'123'})).status,400);
 const reg=await call('register','POST',{name:'David',email:'david@example.com',password:'secret-pass-123'});assert.equal(reg.status,200);assert.match(reg.header,/HttpOnly; SameSite=Lax/);assert.equal(reg.data.state.bal,1000);assert.ok(!('password' in reg.data));
 assert.equal((await call('register','POST',{name:'David',email:'david@example.com',password:'secret-pass-123'})).status,409);
 assert.equal((await call('login','POST',{email:'david@example.com',password:'wrong-pass-123'})).status,401);
 const phone=await call('login','POST',{email:'david@example.com',password:'secret-pass-123'});assert.equal(phone.status,200);
 const other=await call('register','POST',{name:'Other',email:'other@example.com',password:'secret-pass-123'});
 const state={bal:900,bets:[{id:1,stake:100,odds:2.2,st:'open',legs:[{label:'Powyżej 235.5'}]}],custom:[]};
 assert.equal((await call('state','PUT',{version:0,state},reg.cookie,{origin:'https://evil.example'})).status,403);
 assert.equal((await call('state','PUT',{version:0,state},reg.cookie)).data.version,1);
 assert.equal((await call('me','GET',null,phone.cookie)).data.state.bets[0].stake,100);
 assert.equal((await call('state','PUT',{version:0,state:{...state,bal:777}},phone.cookie)).status,409);
 assert.equal((await call('me','GET',null,other.cookie)).data.state.bets.length,0);
 await store.close();store=createStore({url:'',file});api=createAccounts(store);
 assert.equal((await call('me','GET',null,phone.cookie)).data.state.bal,900);
 assert.equal((await call('state','PUT',{version:1,state:{...state,bal:-1}},phone.cookie)).status,400);
 assert.equal((await call('logout','POST',{},phone.cookie)).status,200);assert.equal((await call('me','GET',null,phone.cookie)).status,401);
 assert.equal((await call('me','GET',null,reg.cookie)).status,200);
 const raw=await fs.readFile(file,'utf8');assert.ok(!raw.includes('secret-pass-123'));assert.ok(!raw.includes(reg.cookie.slice(11)));
 }finally{await store.close();await new Promise(r=>server.close(r));await fs.rm(dir,{recursive:true,force:true});}
});
