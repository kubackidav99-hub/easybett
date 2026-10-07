const crypto=require('node:crypto'),fs=require('node:fs/promises'),path=require('node:path'),{promisify}=require('node:util');
const scrypt=promisify(crypto.scrypt),digest=s=>crypto.createHash('sha256').update(s).digest('hex');
const fresh=()=>({bal:1000,bets:[],custom:[],margin:0});
function validState(s){return s&&Number.isFinite(s.bal)&&s.bal>=0&&s.bal<=1e12&&Array.isArray(s.bets)&&s.bets.length<=10000&&(!s.custom||Array.isArray(s.custom))&&s.bets.every(b=>['open','won','lost','push'].includes(b.st)&&Number.isFinite(b.stake)&&b.stake>0&&Number.isFinite(b.odds)&&b.odds>1&&Array.isArray(b.legs));}
function createStore({PoolClass,url=process.env.DATABASE_URL,file=process.env.ACCOUNT_FILE||path.join(__dirname,'data/accounts.json')}={}){
 let pool,db={users:[],sessions:[]},chain=Promise.resolve();
 const ready=(async()=>{if(url){const Pool=PoolClass||require('pg').Pool;pool=new Pool({connectionString:url,max:5});await pool.query(`CREATE TABLE IF NOT EXISTS eb_users (id text PRIMARY KEY, email text UNIQUE NOT NULL, name text NOT NULL, password text NOT NULL, state jsonb NOT NULL, version integer NOT NULL DEFAULT 0); CREATE TABLE IF NOT EXISTS eb_sessions (token text PRIMARY KEY, user_id text NOT NULL REFERENCES eb_users(id), expires bigint NOT NULL);`);}else{if(process.env.RENDER)throw Error('Na Renderze wymagane jest DATABASE_URL.');try{db=JSON.parse(await fs.readFile(file,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}}})();
 ready.catch(()=>{});
 const disk=async()=>{await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file+'.tmp',JSON.stringify(db),{mode:0o600});await fs.rename(file+'.tmp',file);};
 const serial=fn=>{const p=chain.then(async()=>{await ready;return fn();});chain=p.catch(()=>{});return p;};
 return{
 async find(email){await ready;if(pool)return(await pool.query('SELECT * FROM eb_users WHERE email=$1',[email])).rows[0];return db.users.find(u=>u.email===email);},
 create(u){return serial(async()=>{if(pool){try{await pool.query('INSERT INTO eb_users(id,email,name,password,state) VALUES($1,$2,$3,$4,$5)',[u.id,u.email,u.name,u.password,u.state]);}catch(e){if(e.code==='23505')throw Object.assign(Error('Konto z tym adresem już istnieje.'),{status:409});throw e;}}else{if(db.users.some(x=>x.email===u.email))throw Object.assign(Error('Konto z tym adresem już istnieje.'),{status:409});db.users.push(u);await disk();}return u;});},
 session(token,id,expires){return serial(async()=>{if(pool){await pool.query('DELETE FROM eb_sessions WHERE expires<$1',[Date.now()]);await pool.query('INSERT INTO eb_sessions VALUES($1,$2,$3)',[digest(token),id,expires]);}else{db.sessions=db.sessions.filter(s=>s.expires>Date.now());db.sessions.push({token:digest(token),id,expires});await disk();}});},
 async user(token){await ready;if(!token)return null;if(pool)return(await pool.query('SELECT u.* FROM eb_users u JOIN eb_sessions s ON s.user_id=u.id WHERE s.token=$1 AND s.expires>$2',[digest(token),Date.now()])).rows[0];const s=db.sessions.find(s=>s.token===digest(token)&&s.expires>Date.now());return s?db.users.find(u=>u.id===s.id):null;},
 logout(token){return serial(async()=>{if(pool)await pool.query('DELETE FROM eb_sessions WHERE token=$1',[digest(token)]);else{db.sessions=db.sessions.filter(s=>s.token!==digest(token));await disk();}});},
 update(id,version,state){return serial(async()=>{if(pool){const r=await pool.query('UPDATE eb_users SET state=$1,version=version+1 WHERE id=$2 AND version=$3 RETURNING version',[state,id,version]);return r.rows[0]?.version??null;}const u=db.users.find(u=>u.id===id);if(!u||u.version!==version)return null;u.state=structuredClone(state);u.version++;await disk();return u.version;});},
 async pending(){await ready;if(pool)return(await pool.query(`SELECT id,state,version FROM eb_users WHERE state @> '{"bets":[{"st":"open"}]}'::jsonb`)).rows;return db.users.filter(u=>u.state.bets.some(b=>b.st==='open')).map(u=>structuredClone(u));},
 async close(){await chain;await pool?.end();}
 };
}
function createAccounts(store=createStore()){
 const limits=new Map();
 const pub=u=>({user:{email:u.email,name:u.name},state:u.state,version:u.version});
 async function body(req){let data='',size=0;for await(const chunk of req){size+=chunk.length;if(size>2e6)throw Object.assign(Error('Zbyt dużo danych.'),{status:413});data+=chunk;}try{return JSON.parse(data||'{}');}catch{throw Object.assign(Error('Niepoprawne dane.'),{status:400});}}
 async function handle(req,res,json){const route=new URL(req.url,'http://localhost').pathname;
 if(!route.startsWith('/api/account'))return false;
 try{
  if(req.method!=='GET'){const origin=req.headers.origin;if(origin&&origin!==`${req.headers['x-forwarded-proto']==='https'?'https':'http'}://${req.headers.host}`)return json(403,{error:'Niedozwolone źródło żądania.'}),true;if(!String(req.headers['content-type']||'').startsWith('application/json'))return json(415,{error:'Wymagany JSON.'}),true;}
  const token=req.headers.cookie?.split(';').map(x=>x.trim()).find(x=>x.startsWith('eb_session='))?.slice(11)||'';
  const secure=process.env.RENDER||process.env.COOKIE_SECURE==='1';
  const cookie=(t,age)=>res.setHeader('Set-Cookie',`eb_session=${t}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${secure?'; Secure':''}`);
  if(['/api/account/register','/api/account/login'].includes(route)&&req.method==='POST'){
   const ip=req.socket.remoteAddress;const now=Date.now();for(const [k,v]of limits)if(now-v.start>900000)limits.delete(k);const count=limits.get(ip)||{start:now,n:0};limits.set(ip,count);if(++count.n>30)return json(429,{error:'Za dużo prób. Spróbuj za 15 minut.'}),true;
   const b=await body(req),email=String(b.email||'').trim().toLowerCase(),password=String(b.password||'');if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254||password.length<10||password.length>128)return json(400,{error:'Podaj poprawny e-mail i hasło od 10 do 128 znaków.'}),true;
   let u;
   if(route.endsWith('/register')){const name=String(b.name||'').trim();if(name.length<2||name.length>40)return json(400,{error:'Nazwa musi mieć 2–40 znaków.'}),true;const salt=crypto.randomBytes(16).toString('hex'),hash=(await scrypt(password,salt,64)).toString('hex');u=await store.create({id:crypto.randomUUID(),email,name,password:salt+':'+hash,state:fresh(),version:0});}
   else{u=await store.find(email);const [salt,hash]=(u?.password||'0:'+Buffer.alloc(64).toString('hex')).split(':');const actual=await scrypt(password,salt,64);if(!u||!crypto.timingSafeEqual(actual,Buffer.from(hash,'hex')))return json(401,{error:'Niepoprawny e-mail lub hasło.'}),true;}
   const t=crypto.randomBytes(32).toString('hex');await store.session(t,u.id,Date.now()+30*864e5);cookie(t,30*86400);json(200,pub(u));return true;
  }
  const u=await store.user(token);if(!u)return json(401,{error:'Zaloguj się, aby zapisać postęp.'}),true;
  if(route==='/api/account/me'&&req.method==='GET')json(200,pub(u));
  else if(route==='/api/account/logout'&&req.method==='POST'){await store.logout(token);cookie('',0);json(200,{ok:true});}
  else if(route==='/api/account/state'&&req.method==='PUT'){const b=await body(req);if(!Number.isInteger(b.version)||!validState(b.state))json(400,{error:'Niepoprawny zapis postępu.'});else{const v=await store.update(u.id,b.version,b.state);if(v===null)json(409,{error:'Postęp zmienił się na innym urządzeniu. Wczytaj aktualny zapis.'});else json(200,{version:v});}}
  else json(404,{error:'Nieznana operacja konta.'});
 }catch(e){json(e.status||503,{error:e.status?e.message:'Zapis konta jest chwilowo niedostępny. Spróbuj ponownie.'});}return true;
 }
 return {handle,store};
}
module.exports={createAccounts,createStore,validState};
