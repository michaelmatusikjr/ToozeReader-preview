// Review fixes for 2026.11.25.18: contents-page lists get no numbers; a list number never leaks past its list;
// a starter book re-downloaded with a different word count keeps its notes on the same words; Paper + night Gray
// both survive the theme migration.
const __E=require('../env');
const { chromium } = require('playwright');
const PORT=process.env.TOOZ_PORT||8750;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let fails=0; const ok=(n,c,x)=>{ console.log((c?'PASS ':'FAIL ')+n+(x!==undefined?' '+JSON.stringify(x):'')); if(!c) fails++; };
(async()=>{
  const b=await chromium.launch({});
  const ctx=await b.newContext({viewport:{width:390,height:780}, serviceWorkers:'block'});
  await ctx.addInitScript(()=>{ window.__toozKeepSample=true; });
  await ctx.route(/fonts\.(googleapis|gstatic)/,r=>r.abort());
  const pg=await ctx.newPage(); const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  const url='http://localhost:'+PORT+'/';
  await pg.goto(url); await sleep(900);
  const words=await pg.evaluate(()=>{ const h='<nav><ol><li><a href="#a">Genesis</a></li><li><a href="#b">Exodus</a></li></ol></nav><ol style="list-style:none"><li>Plain</li></ol><ol><li><img src="x.png"></li></ol><p>Text here</p><ol><li>One</li><li>Two</li></ol>';
    const d=new DOMParser().parseFromString(h,'text/html'); const c=newCtx(true); walkHTML(d.body,c,''); return c.words; });
  ok('contents page and list-style:none lists get no numbers', words.slice(0,3).join(' ')==='Genesis Exodus Plain', words);
  ok('a number never leaks onto the next paragraph', words.includes('Text') && words[words.indexOf('Text')-1]!=='1.', words);
  ok('ordinary numbered lists still numbered', /1\. One 2\. Two/.test(words.join(' ')), words);
  const mv=await pg.evaluate(()=>{
    const old='In the beginning God created the heaven and the earth . And the earth was without form and void'.split(' ');
    const nw=['Page','8',...old.slice(0,9),'extra','words',...old.slice(9)];
    const id='t-anc'; LS.set('pos.'+id,{pos:12,t:0,fin:false});
    const meta={id, pos:12, highlights:[{s:3,e:5,c:1}], bookmarks:[{i:13,name:'x'}], reAnc:{n:old.length, a:{}}};
    for(const i of [3,5,12,13]) meta.reAnc.a[i]=old.slice(i,i+6).join(' ');
    moveToAnchors(meta,nw);
    return {hs:nw[meta.highlights[0].s], he:nw[meta.highlights[0].e], b:nw[meta.bookmarks[0].i], p:nw[meta.pos], lp:nw[LS.get('pos.'+id).pos], gone:!('reAnc' in meta)}; });
  ok('re-download: notes and place stay on the same words', mv.hs==='God'&&mv.he==='the'&&mv.b==='earth'&&mv.p==='the'&&mv.lp==='the'&&mv.gone, mv);
  await pg.evaluate(()=>{ localStorage.setItem('rf.settings',JSON.stringify({v:2,theme:'paper',nightTheme:'gray'})); }); await pg.reload(); await sleep(900);
  const th=await pg.evaluate(()=>({ids:S.themes.map(t=>t.id), theme:S.theme, night:S.nightTheme}));
  ok('Paper in use + night Gray: both kept', th.ids.includes('paper')&&th.ids.includes('gray')&&th.theme==='paper'&&th.night==='gray', th);
  ok('no page errors', !errs.length, errs);
  await b.close(); console.log(fails?fails+' FAILED':'ALL PASS'); process.exit(fails?1:0);
})();
