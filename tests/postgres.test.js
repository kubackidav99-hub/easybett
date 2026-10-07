const test=require('node:test'),assert=require('node:assert/strict'),{newDb}=require('pg-mem'),{createStore}=require('../accounts');
test('PostgreSQL adapter: schema, sessions, user isolation and atomic optimistic updates (pg-mem)',async()=>{
 const db=newDb(),store=createStore({url:'postgres://fixture',PoolClass:db.adapters.createPg().Pool});
 try{const user={id:'u1',email:'one@example.com',name:'One',password:'hashed',state:{bal:1000,bets:[]},version:0};await store.create(user);await store.create({...user,id:'u2',email:'two@example.com'});
 assert.equal((await store.find(user.email)).name,'One');await store.session('token','u1',Date.now()+100000);await store.session('expired','u2',Date.now()-10000);assert.equal((await store.user('token')).email,user.email);assert.equal(await store.user('expired'),undefined);
 const results=await Promise.all([store.update('u1',0,{bal:900,bets:[]}),store.update('u1',0,{bal:800,bets:[]})]);assert.deepEqual(results,[1,null]);assert.equal((await store.user('token')).state.bal,900);assert.equal((await store.find('two@example.com')).state.bal,1000);assert.equal(await store.update('u1',1,{bal:1100,bets:[]}),2);assert.equal((await store.user('token')).version,2);await store.logout('token');assert.equal(await store.user('token'),undefined);
 await assert.rejects(store.create({...user,id:'dup'}),/już istnieje/);
 }finally{await store.close();}
});
