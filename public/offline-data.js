(function(root){
'use strict';
function validateMatches(input){
 const list=Array.isArray(input)?input:input?.matches;
 if(!Array.isArray(list)||list.length>500)throw new Error('Wymagana lista matches (maksymalnie 500 meczów).');
 const ids=new Set(),str=(v,label)=>{if(typeof v!=='string'||!v.trim()||v.length>300)throw new Error('Niepoprawne pole: '+label);return v.trim();};
 return list.map((e,i)=>{
  if(!e||typeof e!=='object')throw new Error('Niepoprawny mecz '+(i+1));
  const id=e.id==null?'import'+Date.now()+i:str(String(e.id),'id');if(!/^[a-zA-Z0-9_-]+$/.test(id)||ids.has(id))throw new Error('Niepoprawny lub powtórzony id meczu.');ids.add(id);
  const h=str(e.h,'h'),a=str(e.a,'a');if(!Number.isFinite(Date.parse(e.t)))throw new Error('Niepoprawna data meczu.');
  if(!Array.isArray(e.mk)||e.mk.length>100)throw new Error('Wymagana lista mk (maksymalnie 100 rynków).');
  const titles=new Set();const mk=e.mk.map(k=>{
   if(!Array.isArray(k)||k.length<2)throw new Error('Niepoprawny rynek.');const title=str(k[0],'nazwa rynku');if(titles.has(title))throw new Error('Powtórzona nazwa rynku.');titles.add(title);
   if(!Array.isArray(k[1])||!k[1].length||k[1].length>200)throw new Error('Niepoprawna lista typów.');const picks=new Set();
   return [title,k[1].map(o=>{if(!Array.isArray(o))throw new Error('Niepoprawny typ.');const label=str(o[0],'opis typu');if(picks.has(label))throw new Error('Powtórzony typ.');picks.add(label);if(typeof o[1]!=='number'||!Number.isFinite(o[1])||o[1]<=1)throw new Error('Kurs musi być liczbą większą niż 1.');return[label,o[1],{t:'custom',marketId:title,book:'Import ręczny'}];})];
  });
  const preseason=e.preseason===true;return{id,h,a,t:new Date(e.t).toISOString(),mk,custom:true,manualSettlement:true,preseason,sportKey:preseason?'basketball_nba_preseason':'basketball_nba',book:'Import ręczny'};
 });
}
const api={validateMatches};if(typeof module!=='undefined')module.exports=api;else root.OfflineData=api;
})(typeof window==='undefined'?globalThis:window);
