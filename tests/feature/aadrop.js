// The drop in the reading options (Aa) panel (Mick, Nov 24): switching mode rebuilds the panel, and the drop must
// still slide from the old choice to the new one (not appear in place); a control in a fold slides on its first tap.
const __E=require('../env');
const { chromium } = require('playwright');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let fails=0; const ok=(n,c,x)=>{ console.log((c?'PASS ':'FAIL ')+n+(x!==undefined?' '+JSON.stringify(x):'')); if(!c) fails++; };
(async()=>{
  const b=await chromium.launch({});
  const ctx=await b.newContext({viewport:{width:390,height:780}, serviceWorkers:'block', hasTouch:true, isMobile:true, deviceScaleFactor:1});
  await ctx.addInitScript(()=>{window.__toozKeepSample=true});
  await ctx.route(/cdnjs/,r=>r.fulfill({path:__E.NM+'jszip/dist/jszip.min.js',contentType:'application/javascript'}));
  await ctx.route(/fonts\.(googleapis|gstatic)/,r=>r.abort());
  const pg=await ctx.newPage(); const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('http://localhost:8750/'); await sleep(1200);
  await pg.evaluate(()=>openDoc('shelf-gatsby')); await sleep(900);
  await pg.evaluate(()=>setChrome(true)); await pg.click('#rAa'); await sleep(1400);
  const dropX=sel=>pg.evaluate(s=>{ const d=document.querySelector(s+' .drop-seg'); if(!d) return null; const r=d.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.width)]; }, sel);
  const btn=(sel,v)=>pg.evaluate(([s,v])=>{ const r=document.querySelector(`${s} [data-v=${v}]`).getBoundingClientRect(); return [Math.round(r.left), Math.round(r.width)]; }, [sel,v]);
  const M='#sheet [data-set=mode]';
  const pages=await btn(M,'pages'), scroll=await btn(M,'scroll');
  ok('drop starts on Pages', JSON.stringify(await dropX(M))===JSON.stringify(pages), await dropX(M));
  await pg.click(M+' [data-v=scroll]'); await sleep(170);
  const mid=await dropX(M);
  ok('switching mode: mid-slide the drop stretches across Pages and Scroll', mid && mid[0]<scroll[0]-5 && mid[0]+mid[1]>scroll[0]+10, [mid, pages, scroll]);
  await pg.screenshot({path:__E.SCRATCH+'aa_mode_mid.png'});
  await sleep(900);
  ok('settles on Scroll', JSON.stringify(await dropX(M))===JSON.stringify(await btn(M,'scroll')), await dropX(M));
  // a fold: scroll a control into view and tap it
  await pg.click('#sheet details.aadet[data-k=text] summary'); await sleep(300);
  const G='#sheet [data-set=margin]';
  await pg.evaluate(s=>document.querySelector(s).scrollIntoView({block:'center'}), G); await sleep(150);
  const cur=await pg.evaluate(()=>S.margin), to=cur==='wide'?'narrow':'wide';
  await pg.click(`${G} [data-v=${to}]`); await sleep(170);
  const m2=await dropX(G), tb=await btn(G,to);
  ok('fold control: the tap slides (mid-slide not yet at the target)', m2 && (m2[0]!==tb[0] || m2[1]!==tb[1]), [m2,tb]);
  await sleep(700);
  ok('fold control settles on the new choice', JSON.stringify(await dropX(G))===JSON.stringify(await btn(G,to)));
  ok('no page errors', !errs.length, errs);
  console.log(fails?'FAIL '+fails:'ALL PASS'); await b.close();
})();
