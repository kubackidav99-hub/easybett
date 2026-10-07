const {parseOffer}=require('./superbet-parser');
const OFFER='https://production-superbet-offer-pl.freetls.fastly.net/v3/pl-PL';
const LEAGUES=[{preseason:false,tournaments:[164,83781]},{preseason:true,tournaments:[2176]}];
// Anonymous read-only requests to the public website offering service. No browser or login.
async function createSession(){return{page:{fetcher:fetch},close:async()=>{}};}
async function request(context,params){
 const url=new URL(OFFER+'/events');for(const [k,v] of Object.entries(params))url.searchParams.set(k,String(v));
 const response=await context.fetcher(url,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(30000)});
 if(!response.ok)throw Object.assign(new Error('Superbet: HTTP '+response.status),{stop:[401,403,429].includes(response.status)});
 const data=await response.json();if(!Array.isArray(data.events))throw new Error('Nieznana struktura oferty Superbet.');return data.events;
}
async function listEvents(context,league){
 const start=new Date();start.setUTCMinutes(0,0,0);const end=new Date(start.getTime()+180*864e5);
 const rows=await request(context,{startDate:start.toISOString(),endDate:end.toISOString(),index:'active-prematch',sports:4,tournaments:league.tournaments.join(','),includeOnly:'fixture,markets'});
 const found=new Map();for(const row of rows){const f=row.fixture;if(!f||f.sport_id!==4||!league.tournaments.includes(f.tournament_id))continue;
  const teams=f.event_name?.split('·');if(teams?.length!==2||!Number.isFinite(Date.parse(f.utc_date)))throw new Error('Nieznana nazwa lub data meczu Superbet.');
  if(Date.parse(f.utc_date)<=Date.now())continue;
  const event={id:'sb'+row.event_id,offerId:row.event_id,h:teams[0].trim(),a:teams[1].trim(),t:f.utc_date,preseason:league.preseason};found.set(event.id,event);
 }return [...found.values()];
}
async function eventMarkets(context,event){
 const rows=await request(context,{events:event.offerId,includeOnly:'fixture,markets'}),row=rows.find(r=>r.event_id===event.offerId);
 if(!row)throw new Error('Mecz nie jest już dostępny w ofercie.');
 const updatedAt=new Date().toISOString(),mk=parseOffer(row,updatedAt);if(!mk.length)throw new Error('Brak aktywnych kursów.');
 return{...event,mk,book:'Superbet',source:'superbet',sportKey:event.preseason?'basketball_nba_preseason':'basketball_nba',manualSettlement:true,updatedAt};
}
function createScanner({sessionFactory=createSession,list=listEvents,read=eventMarkets,leagues=LEAGUES,ttl=300000}={}){
 let job={status:'idle',events:[],errors:[],total:0,completed:0,revision:0},running;
 const snapshot=()=>JSON.parse(JSON.stringify(job));
 function start(){if(running||job.finishedAt&&Date.now()-Date.parse(job.startedAt)<ttl)return snapshot();job={status:'running',startedAt:new Date().toISOString(),events:[],errors:[],total:0,completed:0,revision:0};running=run().finally(()=>running=null);return snapshot();}
 async function run(){let session;
  try{session=await sessionFactory();const queue=[];
   for(const league of leagues){try{queue.push(...await list(session.page,league));}catch(e){job.errors.push({scope:league.preseason?'Preseason':'NBA',message:e.message});if(e.stop)throw e;}}
   job.total=queue.length;
   for(const e of queue){try{job.events.push(await read(session.page,e));job.revision++;}catch(error){job.errors.push({scope:e.h+' – '+e.a,message:error.message});if(error.stop)throw error;}finally{job.completed++;}}
   job.status=job.errors.length?'partial':'done';
  }catch(e){job.errors.push({scope:'Oferta Superbet',message:e.message});job.status='stopped';}
  finally{await session?.close().catch(()=>{});job.finishedAt=new Date().toISOString();}
 }
 return{start,snapshot,waitForIdle:async()=>{await running;return snapshot()}};
}
module.exports={createScanner,listEvents,eventMarkets,LEAGUES,request};
