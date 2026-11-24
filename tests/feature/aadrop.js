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
  // to and from Speed (Mick, Nov 24: "except when going from pages or scroll to speed") — the panel is rebuilt twice
  // within a few ms there, which used to land the drop before it could slide
  for(const [fromV,toV] of [['scroll','speed'],['speed','pages']]){
    await sleep(600); const a=await btn(M,fromV), z=await btn(M,toV);
    await pg.click(`${M} [data-v=${toV}]`); await sleep(170); const mm=await dropX(M); await sleep(900); const end=await dropX(M);
    const lo=Math.min(a[0],z[0]), hiR=Math.max(a[0]+a[1],z[0]+z[1]);
    ok(`${fromV} → ${toV}: mid-slide the drop is between them, not already there`, mm && JSON.stringify(mm)!==JSON.stringify(z) && mm[0]>=lo-2 && mm[0]+mm[1]<=hiR+2 && mm[1]>a[1]+10, [mm,a,z]);
    ok(`${fromV} → ${toV}: settles on ${toV}`, JSON.stringify(end)===JSON.stringify(await btn(M,toV)), end);
  }
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
  // theme swatches and font tiles: a ring slides between them (Mick, Nov 24: "still doesn't work right")
  await pg.evaluate(()=>$('#sheet .themes').scrollIntoView({block:'center'})); await sleep(900);
  const ring=sel=>pg.evaluate(s=>{ const d=document.querySelector(s+' .drop-ring'); if(!d) return null; const r=d.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.width)]; }, sel);
  const T='#sheet .themes', curT=await pg.evaluate(()=>S.theme), toT= curT==='black'?'white':'black';
  const t0=await ring(T); await pg.click(`${T} [data-v=${toT}]`); await sleep(170); const t1=await ring(T); await sleep(800); const t2=await ring(T);
  const tbT=await btn(T,toT);
  ok('theme: a ring stretches across mid-slide, then sits on the new swatch', t0 && t1 && t1[1]>t0[1]+20 && Math.abs(t2[0]-(tbT[0]-3))<=1, [t0,t1,t2,tbT]);
  const F='#sheet .fontrow', fs=await pg.evaluate(()=>[...document.querySelectorAll('#sheet .fontrow button')].map(b=>[b.dataset.v,b.getAttribute('aria-pressed')]));
  const toF=fs.find(x=>x[1]!=='true')[0];
  const f0=await ring(F); await pg.click(`${F} [data-v=${toF}]`); await sleep(170); const f1=await ring(F); await sleep(800); const f2=await ring(F); const fb=await btn(F,toF);
  ok('font: the ring slides to the new font', f0 && f1 && JSON.stringify(f2)===JSON.stringify(fb) && JSON.stringify(f1)!==JSON.stringify(f2), [f0,f1,f2,fb]);
  ok('no page errors', !errs.length, errs);
  console.log(fails?'FAIL '+fails:'ALL PASS'); await b.close();
})();
