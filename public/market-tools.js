(function(root){
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f.'’\-\s]/g,'').toLowerCase();
const teamKey=s=>{const n=norm(s);return ({laclippers:'losangelesclippers',lalakers:'losangeleslakers'})[n]||n;};
const num=s=>Number(String(s).replace(',','.'));
function teamIn(text,ev){const n=norm(text);return [ev?.h,ev?.a].filter(Boolean).find(t=>n.startsWith(norm(t)))||null;}
function handicap(text){const m=String(text).match(/(?:Handicap\s*)?\(([+-]?\d+(?:[.,]\d+)?)\)/i);return m?num(m[1]):null;}
function compact(text,title,ev){
 const team=teamIn(text,ev),hc=/handicap/i.test(title)?handicap(text):null;
 if(team&&hc!==null)return team+' '+(hc>=0?'+':'')+String(hc).replace('.',',');
 const over=String(text).match(/(Powyżej|Poniżej)\s*([+-]?\d+(?:[.,]\d+)?)/i);if(over)return over[1]+' '+over[2].replace('.',',');
 if(team&&/zwycięzca|^mecz(?:\s|$)/i.test(title))return team;
 return text;
}
function scope(title){const q=title.match(/([1-4])\.?\s*kwart/i),h=title.match(/([12])\.?\s*połow/i);if(q)return 'q'+q[1];if(h)return 'h'+h[1];if(/kwart|połow|przerwa|dogrywka jako|kolejn|czas|minut|dokład|przedział|różnic|najwięcej|obie|każd|podwój|triple|double/i.test(title))return null;return /bez dogryw|regulaminow|^mecz\s*$/i.test(title)?'reg':'full';}
function infer(leg){
 if(!leg)return null;const old=leg.meta;if(old&&old.t!=='custom')return old;
 if(!leg.ev||typeof leg.mk!=='string'||typeof leg.label!=='string')return null;
 const title=leg.mk.replace(/ · [+-]?\d+(?:[.,]\d+)?$/,''),pick=leg.label,period=scope(title);if(!period||/zwycięzca.*\s+i\s|wygrywa.*\s+i\s|handicap.*\s+i\s|podwójna|parzyst|dokład|przedział|zakład łącz|różnic/i.test(title))return null;
 const team=teamIn(pick,leg.ev),over=pick.match(/(?:Powyżej|Poniżej)\s*([+-]?\d+(?:[.,]\d+)?)/i),side=/powyżej/i.test(pick)?'over':'under';
 if(/zawodnik|zbiórk|asyst|trójk|przechwyt|blok|PRA|punkty\s*\+|rzuty za 3/i.test(title)||title.includes(' – ')){
  if(!over||period!=='full'||/bez dogryw/i.test(title))return null;
  const stats=[];if(/punkt|PRA/i.test(title))stats.push('pts');if(/zbiórk|PRA/i.test(title))stats.push('reb');if(/asyst|PRA/i.test(title))stats.push('ast');if(/trójk|rzuty za 3/i.test(title))stats.push('fg3m');if(/przechwyt/i.test(title))stats.push('stl');if(/blok/i.test(title))stats.push('blk');if(/strat/i.test(title))stats.push('tov');
  if(!stats.length||/dokład|przedział|łącznie obu|kwart|połow/i.test(title))return null;
  let player=pick.slice(0,over.index).trim().replace(/[–—:\-]\s*$/,'').trim();if(!player)player=leg.mk.match(/ – ([^·]+)(?: ·|$)/)?.[1]?.trim()||leg.mk.split(' · ')[1];if(!player||/^(powyżej|poniżej|\d)/i.test(player)||teamIn(player,leg.ev))return null;
  return{t:'prop',player,stats,pt:num(over[1]),side,scope:period};
 }
 if(/handicap/i.test(title)&&team){const pt=handicap(pick);return pt===null||/3.?drog|europejsk|azjatyck/i.test(title)?null:{t:'sp',team,pt,scope:period};}
 if(over&&/punkt|suma/i.test(title)){const named=[leg.ev.h,leg.ev.a].find(t=>norm(title).includes(norm(t)));if(/zawodnik/i.test(title))return null;return{t:named?'teamtot':'tot',team:named,pt:num(over[1]),side,scope:period};}
 if(/^zwycięzca|^mecz$|^wynik meczu$/i.test(title)){const draw=/remis/i.test(pick);return team||draw?{t:'ml',team,draw,threeWay:!/^zwycięzca/i.test(title),scope:period}:null;}
 return null;
}
function layout(event){const groups=new Map();event.mk.forEach((market,i)=>{const name=market[0].replace(/ · [+-]?\d+(?:[.,]\d+)?$/,'').replace(/^Liczba punktów/,'Suma punktów');if(!groups.has(name))groups.set(name,new Map());const rows=groups.get(name);market[1].forEach((o,j)=>{const team=teamIn(o[0],event),hc=/handicap/i.test(name)?handicap(o[0]):null;const over=o[0].match(/(?:powyżej|poniżej)\s*([+-]?\d+(?:[.,]\d+)?)/i);const line=hc!==null&&team?(teamKey(team)===teamKey(event.h)?hc:-hc):over?num(over[1]):market[0].match(/ · ([+-]?\d+(?:[.,]\d+)?)$/)?.[1]||'';const key=String(line);if(!rows.has(key))rows.set(key,[]);rows.get(key).push({o,i,j});});});return [...groups].map(([name,rows])=>({name,rows:[...rows].sort(([a],[b])=>num(a)-num(b)).map(([,v])=>v.sort((a,b)=>/handicap/i.test(name)?Number(teamKey(teamIn(b.o[0],event))===teamKey(event.h))-Number(teamKey(teamIn(a.o[0],event))===teamKey(event.h)):Number(/powyżej/i.test(b.o[0]))-Number(/powyżej/i.test(a.o[0]))))}));}
const api={norm,teamKey,compact,infer,layout};if(typeof module!=='undefined')module.exports=api;else root.MarketTools=api;
})(typeof globalThis!=='undefined'?globalThis:this);
