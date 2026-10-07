(function(root){
 const tools=typeof module!=='undefined'?require('./market-tools'):root.MarketTools;
 const norm=tools.norm;
 function eventKey(s){const e=s.ev;if(e?.h&&e?.a&&e?.t){const t=Date.parse(e.t);return [norm(e.h),norm(e.a)].sort().join('|')+'|'+(Number.isFinite(t)?t:e.t);}return e?.id?'id:'+e.id:'manual:'+norm(s.match);}
 function info(s){return tools.infer({...s,mk:s.market||s.mk});}
 function conflict(a,b){
  if(eventKey(a)!==eventKey(b))return false;
  if(a.k&&a.k===b.k||a.meta?.quoteId&&a.meta.quoteId===b.meta?.quoteId)return true;
  const x=info(a),y=info(b);if(!x||!y)return true; // Unknown same-game markets cannot be classified safely.
  const outcome=t=>['ml','sp'].includes(t);
  if(outcome(x.t)&&outcome(y.t))return true;
  const total=t=>['tot','teamtot'].includes(t);
  if(total(x.t)&&total(y.t))return true;
  if(x.t==='prop'&&y.t==='prop')return norm(x.player)===norm(y.player);
  if(total(x.t)&&y.t==='prop')return y.stats.includes('pts');
  if(total(y.t)&&x.t==='prop')return x.stats.includes('pts');
  return false;
 }
 function compatible(slip){const result=[];for(const s of slip){for(let i=result.length-1;i>=0;i--)if(conflict(result[i],s))result.splice(i,1);result.push(s);}return result;}
 function duplicates(slip){return slip.some((s,i)=>slip.slice(0,i).some(t=>conflict(s,t)));}
 const api={eventKey,conflict,compatible,duplicates};if(typeof module!=='undefined')module.exports=api;else root.SlipTools=api;
})(typeof globalThis!=='undefined'?globalThis:this);
