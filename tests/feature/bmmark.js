const { chromium } = require('playwright');
const PORT=process.env.TOOZ_PORT||8750;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const ok=(n,c,x)=>console.log((c?'PASS ':'FAIL ')+n+(x!==undefined?' '+JSON.stringify(x):''));
(async()=>{
  const b=await chromium.launch({});
  const ctx=await b.newContext({viewport:{width:393,height:852},serviceWorkers:'block',hasTouch:true,isMobile:true});
  await ctx.addInitScript(()=>{window.__toozKeepSample=true});
  const pg=await ctx.newPage();
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('http://localhost:'+PORT+'/'); await sleep(1500);
  await pg.evaluate(async()=>{ closeSheet(); const d=LIB.find(x=>x.kind==='sample'); d.bookmarks=[{i:10,name:'First',at:1}]; touch(d); await openDoc(d.id); await goTo(10,true); });
  await sleep(1000);
  ok('plain bookmark shows the normal icon', await pg.evaluate(()=>R.meta.bookmarks.length===1 && !document.querySelector('#rMark svg.bmi')));
  /* open the sheet from a Contents row */
  await pg.evaluate(()=>{ R.tocStyle='list'; S.tocStyle='list'; openToc(); }); await sleep(600);
  await pg.evaluate(()=>{ const t=document.querySelector('#sheet [data-act="show"][data-s="marks"]'); if(t) t.click(); }); await sleep(300);
  ok('Contents row has a tappable icon', await pg.evaluate(()=>!!document.querySelector('#sheet .bmli .bmic')));
  await pg.evaluate(()=>document.querySelector('#sheet .bmli .bmic').click()); await sleep(700);
  ok('sheet opens with one-character field focused', await pg.evaluate(()=>document.activeElement&&document.activeElement.id==='bmCh'));
  await pg.keyboard.type('a'); await pg.keyboard.type('★'); await sleep(200);
  ok('second character replaces the first', await pg.evaluate(()=>$('#bmCh').value==='★' && R.meta.bookmarks[0].ch==='★'), await pg.evaluate(()=>$('#bmCh').value));
  await pg.evaluate(()=>document.querySelector('#bmDots .swatch[data-c="#E0303F"]').click()); await sleep(200);
  ok('colour stored as hex', await pg.evaluate(()=>R.meta.bookmarks[0].c==='#E0303F'));
  ok('preview shows colour and character', await pg.evaluate(()=>{ const s=document.querySelector('#bmPrev svg'); return s && s.querySelector('path').style.fill && /★/.test(s.textContent); }));
  /* the reader's own button */
  ok('#rMark shows colour and character', await pg.evaluate(()=>{ const m=$('#rMark'); const p=m.querySelector('svg.bmi path'); return m.classList.contains('on') && p && p.getAttribute('style').includes('#E0303F') && /★/.test(m.textContent); }));
  /* Contents row after reopening */
  await pg.evaluate(()=>{ closeSheet(); openToc(); }); await sleep(500);
  await pg.evaluate(()=>{ const t=document.querySelector('#sheet [data-act="show"][data-s="marks"]'); if(t) t.click(); }); await sleep(300);
  ok('Contents row icon shows colour and character', await pg.evaluate(()=>{ const s=document.querySelector('#sheet .bmli .bmic svg.bmi'); return s && s.querySelector('path').getAttribute('style').includes('#E0303F') && /★/.test(s.textContent); }));
  /* spine flag */
  await pg.evaluate(()=>{ closeSheet(); S.tocStyle='spine'; R.tocShowNow='both'; openToc(); }); await sleep(900);
  ok('spine flag shows colour and character', await pg.evaluate(()=>{ const f=document.querySelector('.sp-flag svg.bmi'); return !!f && f.querySelector('path').getAttribute('style').includes('#E0303F') && /★/.test(f.textContent); }));
  /* Notes tab */
  await pg.evaluate(()=>{ closeSheet(); S.tocStyle='list'; NOTESEG='bm'; showView('words'); renderNotes(); }); await sleep(900);
  ok('Notes tab row shows colour and character', await pg.evaluate(()=>{ const s=document.querySelector('#notesBm .bmic svg.bmi'); return !!s && s.querySelector('path').getAttribute('style').includes('#E0303F') && /★/.test(s.textContent); }));
  /* edit from the Notes tab: remove the colour */
  await pg.evaluate(()=>{ const f=document.querySelector('#notesBm .nsum'); if(f && !document.querySelector('#notesBm .nfold.open')) f.click(); }); await sleep(500);
  await pg.evaluate(()=>document.querySelector('#notesBm .bmic').click()); await sleep(600);
  await pg.evaluate(()=>document.querySelector('#bmDots .swatch.none').click()); await sleep(300);
  ok('"none" clears the colour, keeps the character', await pg.evaluate(()=>{ const m=LIB.find(x=>x.kind==='sample').bookmarks[0]; return m.c===undefined && m.ch==='★'; }));
  await pg.evaluate(()=>document.querySelector('#bmDots .swatch[data-c="#3478F6"]').click()); await sleep(300);
  /* survives reload */
  await sleep(500); await pg.reload(); await sleep(2000);
  ok('survives reload', await pg.evaluate(()=>{ const m=LIB.find(x=>x.kind==='sample').bookmarks[0]; return m.ch==='★' && m.c==='#3478F6' && m.name==='First'; }));
  /* the Bookmarked toast offers Mark */
  await pg.evaluate(async()=>{ const d=LIB.find(x=>x.kind==='sample'); await openDoc(d.id); await goTo(200,true); }); await sleep(800);
  await pg.evaluate(()=>$('#rMark').click()); await sleep(400);
  ok('toast action is Mark', await pg.evaluate(()=>$('#toastAct').textContent==='Mark'));
  await pg.evaluate(()=>$('#toastAct').click()); await sleep(600);
  ok('Mark opens the same sheet', await pg.evaluate(()=>!!$('#bmCh') && !$('#sheet').hidden));
  ok('no page errors', !errs.length, errs); await b.close();
})();
