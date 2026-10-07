const MONTHS=['sty','lut','mar','kwi','maj','cze','lip','sie','wrz','paź','lis','gru'];
function warsawDate(text,now=new Date()){
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Warsaw',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now).filter(p=>p.type!=='literal').map(p=>[p.type,+p.value]));
 const tm=text.match(/(\d{1,2}):(\d{2})/);if(!tm)throw new Error('Nieznana godzina: '+text);
 let y=parts.year,m=parts.month,d=parts.day;
 if(/jutro/i.test(text)){const n=new Date(Date.UTC(y,m-1,d+1));y=n.getUTCFullYear();m=n.getUTCMonth()+1;d=n.getUTCDate();}
 else if(!/dzisiaj/i.test(text)){const x=text.toLowerCase().match(/(\d{1,2})\.\s*([a-ząćęłńóśźż]+)/);if(!x)throw new Error('Nieznana data: '+text);d=+x[1];m=MONTHS.findIndex(v=>x[2].startsWith(v))+1;if(!m)throw new Error('Nieznany miesiąc');if(m<parts.month-6)y++;}
 const target=Date.UTC(y,m-1,d,+tm[1],+tm[2]);let utc=target;
 for(let i=0;i<3;i++){const offset=new Intl.DateTimeFormat('en',{timeZone:'Europe/Warsaw',timeZoneName:'longOffset'}).formatToParts(new Date(utc)).find(p=>p.type==='timeZoneName').value.match(/GMT([+-])(\d{2}):(\d{2})/);const minutes=offset?(+offset[2]*60+ +offset[3])*(offset[1]==='+'?1:-1):0;utc=target-minutes*60000;}
 return new Date(utc).toISOString();
}
function parseQuotes(rows,stamp=new Date().toISOString()){
 const groups=new Map(),seen=new Set();
 for(const r of rows){if(r.disabled||!/,\s*active\s*$/i.test(r.label))continue;
  const x=r.label.match(/^(.*?),\s*(.*),\s*współczynnik\s*([\d.,]+),\s*active\s*$/i);if(!x)continue;
  const odds=Number(x[3].replace(',','.'));if(!Number.isFinite(odds)||odds<=1)continue;
  const name=x[1].trim(),pick=x[2].trim(),id=r.id||r.label;if(seen.has(id))continue;seen.add(id);
  // Preserve separate lines and players even if a source uses one market header.
  const over=pick.match(/(?:powyżej|poniżej)\s*([+-]?\d+(?:[.,]\d+)?)/i),hc=/handicap/i.test(name)?pick.match(/\(([+-]?\d+(?:[.,]\d+)?)\)/):null;
  const line=over?over[1]:hc?String(Math.abs(Number(hc[1].replace(',','.')))):'';
  const player=/zawodnik|punkty zawodnika|zbiórki|asysty|trójki|przechwyty|bloki/i.test(name)?pick.replace(/(?:powyżej|poniżej).*$/i,'').trim():'';
  const key=[r.marketId||name,line,player].join('|'),title=name+(player?' · '+player:'')+(line?' · '+line:'');
  if(!groups.has(key))groups.set(key,[title,[]]);groups.get(key)[1].push([pick,odds,{t:'custom',marketId:key,book:'Superbet',bookKey:'superbet',quoteId:id,updatedAt:stamp}]);
 }
 return [...groups.values()];
}
function parseOffer(event,stamp=new Date().toISOString()){
 const groups=new Map(),seen=new Set();
 for(const market of event.markets||[]){for(const odd of market.odds||[]){
  if(odd.status!==1||odd.display!==true||!Number.isFinite(odd.price)||odd.price<=1||!odd.uuid||seen.has(odd.uuid))continue;
  const meta=odd.metadata||{},label=meta.info||meta.name;if(!label||!market.name)continue;seen.add(odd.uuid);
  const line=meta.market_line_uuid||meta.market_line_code||'',key=market.id+'|'+line;
  if(!groups.has(key))groups.set(key,[market.name,[]]);
  groups.get(key)[1].push([label,odd.price,{t:'custom',marketId:key,book:'Superbet',bookKey:'superbet',quoteId:odd.uuid,updatedAt:stamp}]);
 }}return [...groups.values()];
}
module.exports={warsawDate,parseQuotes,parseOffer};
