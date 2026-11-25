// Scroll mode, a book with a very long section (Imitation's preface): sections above the screen must not be removed
// (or added) while a swipe is coasting — iPhone Safari ignores the scroll correction then and the page jumps
// thousands of pixels into blank text (Mick's screen recording, Nov 25). They're tidied once scrolling stops.
const __E=require('../env');
const { chromium } = require('playwright');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let fails=0; const ok=(n,c,x)=>{ console.log((c?'PASS ':'FAIL ')+n+(x!==undefined?' '+JSON.stringify(x):'')); if(!c) fails++; };
(async()=>{
  const b=await chromium.launch({});
  const ctx=await b.newContext({viewport:{width:390,height:844}, serviceWorkers:'block', hasTouch:true, isMobile:true, deviceScaleFactor:1});
  await ctx.addInitScript(()=>{window.__toozKeepSample=true; localStorage.setItem('rf.settings', JSON.stringify({mode:'scroll'}));});
  await ctx.route(/cdnjs/,r=>r.fulfill({path:__E.NM+'jszip/dist/jszip.min.js',contentType:'application/javascript'}));
  await ctx.route(/fonts\.(googleapis|gstatic)/,r=>r.abort());
  const pg=await ctx.newPage(); const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('http://localhost:'+(process.env.TOOZ_PORT||8750)+'/'); await sleep(1200);
  await pg.evaluate(()=>openDoc('shelf-imitation')); await sleep(1500);
  await pg.evaluate(()=>{ const c=R.meta.chapters.find(c=>c.t==='The Imitation of Christ'); goTo(c.i-150,true); }); await sleep(800);
  await pg.evaluate(()=>setChrome(false)); await sleep(300);
  const pre=await pg.evaluate(()=>scFlow.firstElementChild._k);
  // a long coasting swipe: scroll events keep coming, no finger down
  let removedWhileMoving=false, maxJump=0, maxKids=0;
  for(let k=0;k<24;k++){
    const r=await pg.evaluate(()=>{ const w=wordAtY(scView.getBoundingClientRect().top+300); const top0=wordEl(w).getBoundingClientRect().top, st0=scView.scrollTop; SC.userScrolled=true; SC.gestureAt=performance.now(); scView.scrollTop+=300; return {w, top0, st0, first:scFlow.firstElementChild._k}; });
    await sleep(50);
    const a=await pg.evaluate(w=>{ const e=wordEl(w); return {top:e? e.getBoundingClientRect().top : null, st:scView.scrollTop, first:scFlow.firstElementChild._k, kids:scFlow.children.length}; }, r.w);
    if(a.first!==r.first) removedWhileMoving=true; maxKids=Math.max(maxKids,a.kids);
    if(a.top!=null) maxJump=Math.max(maxJump, Math.abs((r.top0-a.top)-(a.st-r.st0)));
  }
  ok('nothing above the screen is removed while the swipe is still moving', !removedWhileMoving);
  ok('text moves exactly with the scroll (no jump)', maxJump<2, maxJump);
  await sleep(1300);
  const after=await pg.evaluate(()=>[scFlow.firstElementChild._k, scFlow.children.length]);
  ok('once it stops, the far sections are tidied away', maxKids>5 && after[1]<=5 && after[0]>pre, [pre, maxKids, after]);
  const w=await pg.evaluate(()=>scPos()); await sleep(300);
  ok('and the place on screen didn’t move when they were', await pg.evaluate(w=>Math.abs(scPos()-w)<3, w));
  // after a jump, if the page gets thrown away before the reader touches it (iPhone Safari dropping a scroll
  // correction; Mick, Nov 25: "Read it in context" for Heb. 1:7 showed Hebrews 6 cross references), it comes back
  const tgt=await pg.evaluate(async()=>{ const i=Math.floor(R.n*0.6); await goTo(i,true); await new Promise(r=>setTimeout(r,200)); scView.scrollTop+=6000; return i; });
  await sleep(2000);
  const back=await pg.evaluate(i=>{ const w=wordEl(i); return w? Math.round(w.getBoundingClientRect().top-scView.getBoundingClientRect().top) : null; }, tgt);
  const gap=await pg.evaluate(()=>scGap()); ok('a jump stays on its word even if the page is thrown away before you touch it', back!=null && Math.abs(back-gap)<20, [back,gap]);
  ok('no page errors', !errs.length, errs);
  console.log(fails?'FAIL '+fails:'ALL PASS'); await b.close();
})();
