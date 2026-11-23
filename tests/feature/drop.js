/* The drop (src/k_blob.js): foundation on the tab bar, progress base in the reader, flowing segmented controls. */
const __E=require('../env');
const { chromium } = require('playwright');
const S=__E.SCRATCH;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let fails=0; const ok=(c,m)=>{ console.log((c?'PASS ':'FAIL ')+m); if(!c) fails++; };
async function run(reduce){
  const b=await chromium.launch({});
  const ctx=await b.newContext({viewport:{width:393,height:852}, deviceScaleFactor:2, serviceWorkers:'block', hasTouch:true, isMobile:true, reducedMotion:reduce?'reduce':'no-preference'});
  await ctx.addInitScript(()=>{ window.__toozKeepSample=true; });
  const pg=await ctx.newPage(); const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('http://localhost:8750/'); await sleep(1800); await pg.evaluate(()=>closeSheet()); await sleep(300);
  const tag=reduce?'[reduce] ':'';
  const dropBox=()=>pg.evaluate(()=>{ const r=document.getElementById('drop').getBoundingClientRect(); return {cx:r.left+r.width/2, top:r.top, w:r.width, h:r.height, op:+getComputedStyle(document.getElementById('drop')).opacity}; });
  const tabBox=t=>pg.evaluate(t=>{ const r=document.querySelector('#tabs button[data-tab="'+t+'"]').getBoundingClientRect(); return {cx:r.left+r.width/2, top:document.getElementById('tabs').getBoundingClientRect().top}; },t);
  /* resting under the Library tab, visible, 3px tall */
  let d=await dropBox(), t=await tabBox('library');
  ok(Math.abs(d.cx-t.cx)<2 && d.op>.9 && Math.abs(d.h-3)<.6, tag+'drop rests under the Library tab ('+Math.round(d.cx)+' vs '+Math.round(t.cx)+', opacity '+d.op+')');
  /* flows to Settings */
  await pg.click('#tabs button[data-tab="settings"]'); await sleep(900);
  d=await dropBox(); t=await tabBox('settings');
  ok(Math.abs(d.cx-t.cx)<2 && d.op>.9, tag+'drop moved under the Settings tab');
  /* no animation left running at rest (costs nothing) */
  ok(await pg.evaluate(()=>document.getAnimations().filter(a=>a.playState==='running'&&a.effect&&a.effect.target&&(a.effect.target.id==='drop'||a.effect.target.classList.contains('drop-seg'))).length===0), tag+'nothing animating at rest');
  /* segmented controls: the fill sits exactly on the pressed segment */
  await sleep(500);
  const geo=()=>pg.evaluate(()=>{ const g=document.querySelector('#infoSeg'); const p=g.querySelector('button[aria-pressed="true"]'); const d=g.querySelector('.drop-seg'); if(!d) return null; const a=p.getBoundingClientRect(), c=d.getBoundingClientRect(); return {on:g.classList.contains('lq-on'), dl:Math.abs(a.left-c.left), dw:Math.abs(a.width-c.width), dh:Math.abs(a.height-c.height), label:p.textContent}; });
  let g=await geo();
  ok(g && g.on && g.dl<1.5 && g.dw<1.5 && g.dh<1.5, tag+'segment fill matches the pressed segment ('+(g&&g.label)+')');
  /* change it: the drop follows, the pressed attribute follows */
  await pg.evaluate(()=>{ document.querySelector('#infoSeg').scrollIntoView({block:'center'}); }); await sleep(300);
  await pg.click('#infoSeg button[data-v="2"]'); await sleep(900);
  g=await geo();
  ok(g && g.label==='Location' && g.dl<1.5 && g.dw<1.5, tag+'segment fill flowed to the new choice ('+(g&&g.label)+')');
  /* leaving and coming back to Settings re-draws it; it must be in place at once, with no flash of an empty segment */
  await pg.click('#tabs button[data-tab="library"]'); await sleep(300);
  await pg.click('#tabs button[data-tab="settings"]'); await sleep(60);
  const early=await pg.evaluate(()=>{ const g=document.querySelector('#infoSeg'); return g&&g.classList.contains('lq-on'); });
  ok(early, tag+'a redrawn segment group is filled immediately');
  /* reader: chrome off -> the drop becomes the progress line on the bottom edge */
  await pg.click('#tabs button[data-tab="library"]'); await sleep(300);
  await pg.evaluate(async()=>{ S.mode='pages'; saveSettings(); await openDoc(LIB.find(x=>x.kind==='sample').id); });
  await sleep(1200);
  await pg.evaluate(()=>{ setChrome(true); }); await sleep(700);
  ok((await dropBox()).op<.1, tag+'drop hidden while the reader controls are showing');
  await pg.evaluate(()=>{ goTo(Math.floor(R.n/2), true); setChrome(false); }); await sleep(1200);
  d=await dropBox();
  ok(d.op>.9 && d.top>=852-4 && Math.abs(d.w/393-0.5)<.12, tag+'with controls hidden the drop is the progress line at the bottom (width '+Math.round(d.w)+'px of 393, opacity '+d.op+')');
  await pg.screenshot({path:S+'drop_reader'+(reduce?'_rm':'')+'.png', clip:{x:0,y:760,width:393,height:92}});
  /* back to the library: it returns under the tab */
  await pg.evaluate(()=>closeReader()); await sleep(1300);
  d=await dropBox(); t=await tabBox('library');
  ok(Math.abs(d.cx-t.cx)<2 && d.op>.9 && Math.abs(d.top-(t.top-1))<2, tag+'drop returned to the tab bar after closing the book');
  ok(errs.length===0, tag+'no page errors '+JSON.stringify(errs));
  await b.close();
}
(async()=>{ await run(false); await run(true); console.log(fails?'FAILURES: '+fails:'ALL PASS'); process.exit(fails?1:0); })();
