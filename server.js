// Local application server. Superbet public offering reader; no paid odds API keys.
const http=require('http'),fs=require('fs'),path=require('path');
const root=path.join(__dirname,'public');
const {createScanner}=require('./superbet-source');const scanner=createScanner();
const {createAccounts}=require('./accounts');const accounts=createAccounts();
const {createResults}=require('./results-source'),{createSettlement}=require('./settlement');const results=createResults(),settlement=createSettlement(accounts.store,results);
const autoSettle=()=>settlement.start().catch(()=>{});
setInterval(autoSettle,5*60*1000).unref();
const server=http.createServer(async(req,res)=>{
 const json=(status,data)=>{res.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(data));};
 try{if(req.url.startsWith('/api/account/')&&process.env.NODE_ENV!=='test')autoSettle();if(await accounts.handle(req,res,json))return;const u=new URL(req.url,'http://localhost');
  if(u.pathname==='/api/superbet'){if(!['GET','POST'].includes(req.method))return json(405,{error:'GET lub POST'});return json(200,req.method==='POST'?scanner.start():scanner.snapshot());}
  if(u.pathname==='/api/results'){
   if(req.method!=='POST')return json(405,{error:'Użyj POST'});let body='',size=0;for await(const chunk of req){size+=chunk.length;if(size>2e6)return json(413,{error:'Za duże żądanie'});body+=chunk;}
   const data=JSON.parse(body);if(!Array.isArray(data.legs)||data.legs.length>200||data.legs.some(l=>!l||typeof l!=='object'))return json(400,{error:'Niepoprawne typy'});return json(200,await results.resolve(data.legs));
  }
  if(u.pathname.startsWith('/api/'))return json(410,{error:'Tryb bez API: kursy i wyniki wpisujesz ręcznie.'});
  if(!['GET','HEAD'].includes(req.method))return json(405,{error:'Użyj GET lub HEAD'});
  const name=decodeURIComponent(u.pathname),file=path.resolve(root,'.'+(name==='/'?'/index.html':name));
  if(!file.startsWith(root+path.sep))return json(403,{error:'Niedozwolona ścieżka'});
  fs.readFile(file,(e,data)=>{if(e)return json(404,{error:'Brak pliku'});
   const mime={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.svg':'image/svg+xml','.png':'image/png'}[path.extname(file)]||'application/octet-stream';res.writeHead(200,{'content-type':mime,'cache-control':'no-cache'});res.end(req.method==='HEAD'?undefined:data);
  });
 }catch{return json(400,{error:'Niepoprawne żądanie'});}
});
if(require.main===module)server.listen(process.env.PORT||3000,'0.0.0.0',()=>console.log('EasyBet: http://localhost:'+(process.env.PORT||3000)));
if(process.env.AUTOSCAN==='1'){autoSettle();scanner.start();setInterval(()=>scanner.start(),5*60*1000).unref();}
module.exports={server,scanner,accounts,results,settlement};
