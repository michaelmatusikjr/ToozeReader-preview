// Toasts (Mick, Nov 24): at the top, in the theme's colours, and can be flicked away (up or sideways).
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
  const show=(a)=>pg.evaluate(a=>{ let hit=0; window.__hit=0; toast('Bookmark deleted', a? {label:'Undo', fn:()=>{ window.__hit=1; }} : null, 8000); }, a);
  const box=()=>pg.evaluate(()=>{ const r=$('#toast').getBoundingClientRect(); return {x:r.left,y:r.top,w:r.width,h:r.height}; });
  const cols=()=>pg.evaluate(()=>{ const t=getComputedStyle($('#toast')), p=getComputedStyle(document.body); const probe=document.createElement('i'); probe.style.color='var(--surface)'; document.body.appendChild(probe); const sf=getComputedStyle(probe).color; probe.remove(); return [t.backgroundColor, sf, t.color]; });
  await show(false); await sleep(500);
  let bx=await box(); ok('toast sits at the top', bx.y<40, bx);
  let c=await cols(); ok('toast uses the theme surface colour (light)', c[0]===c[1], c);
  // flick up
  await pg.mouse.move(bx.x+bx.w/2, bx.y+bx.h/2); await pg.mouse.down(); await pg.mouse.move(bx.x+bx.w/2, bx.y-30,{steps:5}); await pg.mouse.up(); await sleep(400);
  ok('flick up dismisses', await pg.evaluate(()=>$('#toast').hidden));
  // a small drag springs back and stays
  await show(false); await sleep(500); bx=await box();
  await pg.mouse.move(bx.x+bx.w/2, bx.y+bx.h/2); await pg.mouse.down(); await pg.mouse.move(bx.x+bx.w/2+20, bx.y+bx.h/2-8,{steps:4}); await pg.mouse.up(); await sleep(400);
  ok('a small drag springs back', await pg.evaluate(()=>!$('#toast').hidden && $('#toast').style.transform===''));
  // sideways
  bx=await box(); await pg.mouse.move(bx.x+bx.w/2, bx.y+bx.h/2); await pg.mouse.down(); await pg.mouse.move(bx.x+bx.w/2+120, bx.y+bx.h/2,{steps:5}); await pg.mouse.up(); await sleep(400);
  ok('flick sideways dismisses', await pg.evaluate(()=>$('#toast').hidden));
  // the action still works
  await show(true); await sleep(500); await pg.click('#toastAct'); await sleep(200);
  ok('action button still works', await pg.evaluate(()=>window.__hit===1 && $('#toast').hidden));
  // dark theme
  await pg.evaluate(()=>{ S.theme='dark'; saveSettings(); applyLook(); }); await sleep(300);
  await show(false); await sleep(500); c=await cols();
  ok('toast follows a dark theme', c[0]===c[1] && c[0]!=='rgb(255, 255, 255)', c);
  await pg.screenshot({path:__E.SCRATCH+'toast_dark.png'});
  // in a book, it's at the top too
  await pg.evaluate(()=>{ S.theme='auto'; saveSettings(); applyLook(); openDoc('shelf-gatsby'); }); await sleep(900);
  await pg.evaluate(()=>setChrome(true)); await show(true); await sleep(500); bx=await box();
  ok('in a book with the controls showing, just below them (Mick, Nov 25: the controls push toasts down)', Math.abs(bx.y-(await pg.evaluate(()=>$('#rTop').getBoundingClientRect().bottom))-8)<=2, bx);
  await pg.evaluate(()=>setChrome(false)); await show(true); await sleep(500); bx=await box(); ok('controls hidden: at the top', bx.y<40, bx);
  await pg.screenshot({path:__E.SCRATCH+'toast_book.png'});
  await pg.evaluate(()=>{ S.theme='sepia'; saveSettings(); applyLook(); }); await sleep(300);
  await show(true); await sleep(500);
  const sp=await pg.evaluate(()=>{ const t=getComputedStyle($('#toast')), probe=document.createElement('i'); probe.style.color='var(--page-bg)'; document.body.appendChild(probe); const pb=getComputedStyle(probe).color; probe.remove(); return [t.backgroundColor,pb]; });
  ok('in a book the toast takes the page theme (sepia)', sp[0]===sp[1] && sp[0]!=='rgb(255, 255, 255)', sp);
  await pg.screenshot({path:__E.SCRATCH+'toast_sepia.png'});
  ok('no page errors', !errs.length, errs);
  console.log(fails?'FAIL '+fails:'ALL PASS'); await b.close();
})();
