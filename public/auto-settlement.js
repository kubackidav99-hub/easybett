let settlingGuest=false,settlementNote='';
async function checkSettlement(){
 if(typeof accountReady!=='undefined'&&!accountReady)return;
 if(typeof accountUser!=='undefined'&&accountUser){await pollAccount();return;}
 if(settlingGuest)return;const legs=S.bets.filter(b=>b.st==='open').flatMap(b=>b.legs);if(!legs.length)return;settlingGuest=true;const stateRef=S,generation=accountGeneration;
 try{let changed=false;for(let i=0;i<legs.length;i+=200){const r=await fetch('/api/results',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({legs:legs.slice(i,i+200)})});const data=await r.json();if(S!==stateRef||generation!==accountGeneration||accountUser)return;if(!r.ok)throw Error(data.error||'Brak wyników');settlementNote=data.errors?.length?'Wyniki chwilowo niedostępne. Kupony pozostają otwarte.':'';for(const b of S.bets){if(BetCore.settleBet(b,data.games,data.stats)){S.bal+=pay(b);changed=true;}}}if(changed)save();if(changed||view==='bets')render();}
 catch{settlementNote='Wyniki chwilowo niedostępne. Kupony pozostają otwarte.';if(view==='bets')render();}
 finally{settlingGuest=false;}
}
setTimeout(checkSettlement,1500);setInterval(checkSettlement,5*60*1000);
