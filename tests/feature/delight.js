// Nov 24 batch (Mick: "do all of them"): where you were (ghost drop), scripture peek, exact citations, today's reading
// as a small circle in the reader, the return toast after a link into another book, and opening straight into the book you were reading.
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
  const ghost=()=>pg.evaluate(()=>{ const g=$('#dropGhost'); if(!g||g.hidden) return null; const r=g.getBoundingClientRect(); return {x:Math.round(r.left), w:Math.round(r.width), away:g.classList.contains('away')}; });

  // ---- where you were ----
  await pg.evaluate(()=>openDoc('shelf-gatsby')); await sleep(900);
  ok('no ghost before any jump, and the old back pill is gone', !(await ghost()) && await pg.evaluate(()=>!document.getElementById('backPill')));
  const from=await pg.evaluate(()=>R.pos);
  await pg.evaluate(()=>{ const c=R.meta.chapters.find(c=>c.t==='VI'); goTo(c.i,true); }); await sleep(700);
  let g=await ghost(); ok('a jump leaves a hollow drop at the spot you left', g && !g.away, g);
  await pg.screenshot({path:__E.SCRATCH+'ghost_up.png'});
  await pg.click('#dropGhost'); await sleep(800);
  ok('tapping it flows back', await pg.evaluate(f=>Math.abs(R.pos-f)<5, from), await pg.evaluate(()=>R.pos));
  g=await ghost(); ok('…and it now waits at chapter VI, to go forth again', g && await pg.evaluate(()=>{ const c=R.meta.chapters.find(c=>c.t==='VI'); return Math.abs(R.backPos-c.i)<5; }));
  await pg.evaluate(()=>setChrome(false)); await sleep(400);
  const gb=await ghost(); ok('with the controls hidden it rides the bottom line', gb && await pg.evaluate(()=>{ const r=$('#dropGhost').getBoundingClientRect(); return r.top>innerHeight-40; }));
  await pg.screenshot({path:__E.SCRATCH+'ghost_base.png'});

  // ---- today's reading: a small circle in the reader, only with a goal (Mick, Nov 25) ----
  await pg.evaluate(()=>{ const st={}; st[dayKey()]={ms:5*60000, words:1000}; LS.set('stats',st); S.goalMins=0; updateToday(); setChrome(false); });
  await sleep(300);
  ok('no goal: no circle', await pg.evaluate(()=>$('#goalRing').hidden));
  ok('the tab bar drop is plain again (no gauge)', await pg.evaluate(()=>!document.querySelector('#dropHit') && !document.querySelector('.drop-ripple')));
  await pg.evaluate(()=>{ S.goalMins=10; saveSettings(); updateToday(); }); await sleep(300);
  ok('with a goal: a circle half full, only with the controls hidden', await pg.evaluate(()=>{ const g=$('#goalRing'); return !g.hidden && getComputedStyle(g).opacity==='1' && g.style.getPropertyValue('--p')==='0.500'; }));
  await pg.click('#goalRing'); await sleep(300);
  const pop=await pg.evaluate(()=>{ const x=document.querySelector('.goalpop'); return x&&x.innerText; });
  ok('tapping it: "5 minutes read today" / "Goal 10 minutes"', pop==='5 minutes read today\nGoal 10 minutes', pop);
  ok('the popup stays on screen', await pg.evaluate(()=>{ const r=document.querySelector('.goalpop').getBoundingClientRect(); return r.left>=0 && r.right<=innerWidth && r.top>=0; }));
  await pg.screenshot({path:__E.SCRATCH+'goal_ring.png'});
  await pg.evaluate(()=>setChrome(true)); await sleep(300);
  ok('hidden while the controls are up', await pg.evaluate(()=>getComputedStyle($('#goalRing')).opacity==='0'));
  await pg.evaluate(()=>{ recordStats(6*60000, 1200); }); await sleep(200);
  ok('meeting the goal fills it', await pg.evaluate(()=>$('#goalRing').style.getPropertyValue('--p')==='1.000'));
  await pg.evaluate(()=>closeReader()); await sleep(400);

  // ---- scripture peek ----
  await pg.evaluate(()=>openDoc('shelf-pursuit')); await sleep(1200);
  const k=await pg.evaluate(()=>{ const ri=scanRefs(); const k=ri.find(i=>refName(R.refMap.get(i))==='Psalm 63:8'); goTo(k,true); return k; }); await sleep(700);
  await pg.evaluate(()=>setChrome(false)); await sleep(300);
  ok('references get the dotted mark', await pg.evaluate(k=>{ const w=[...document.querySelectorAll('w.sref')]; return w.length>0; }, k));
  await pg.evaluate(k=>{ const w=[...document.querySelectorAll('w.sref')].find(x=>idxOf(x)===k); w.scrollIntoView({block:'center'}); }, k); await sleep(200);
  const box=await pg.evaluate(k=>{ const w=[...document.querySelectorAll('w.sref')].find(x=>idxOf(x)===k); const r=w.getBoundingClientRect(); return {x:r.left+r.width/2, y:r.top+r.height/2}; }, k);
  await pg.mouse.click(box.x, box.y); await sleep(2500);
  const peek=await pg.evaluate(()=>[!$('#sheet').hidden && $('#sheet h2').textContent, ($('#sheet .peek')||{}).textContent]);
  ok('tapping a reference shows the verse from the Bible', peek[0]==='Psalm 63:8 · KJV' && /My soul followeth hard after thee/.test(peek[1]||''), peek);
  await pg.screenshot({path:__E.SCRATCH+'peek.png'});
  await pg.click('#sheet [data-act=ctx]'); await sleep(2000);
  ok('Read it in context opens the Bible at that verse', await pg.evaluate(()=>R.meta.id==='shelf-kjv' && currentChapter(R.pos).t==='Psalm 63' && R.words[R.pos]==='8'), await pg.evaluate(()=>[R.meta.id, currentChapter(R.pos).t, R.words[R.pos]]));
  ok('no hollow drop for another book…', !(await ghost()));
  const rt=await pg.evaluate(()=>[!$('#toast').hidden, $('#toastMsg').textContent]);
  ok('…instead a toast: "Return to The Pursuit of God"', rt[0] && rt[1]==='Return to The Pursuit of God', rt);
  await pg.screenshot({path:__E.SCRATCH+'return_toast.png'});
  await sleep(6000);
  ok('it stays (not a 3-second toast)', await pg.evaluate(()=>!$('#toast').hidden && $('#toastMsg').textContent.startsWith('Return to')));
  await pg.evaluate(()=>toast('Bookmarked')); await sleep(3800);
  ok('another message comes and goes, then it’s back', await pg.evaluate(()=>!$('#toast').hidden && $('#toastMsg').textContent.startsWith('Return to')));
  await pg.click('#toastMsg'); await sleep(2000);
  ok('tapping it takes you back', await pg.evaluate(k=>R.meta.id==='shelf-pursuit' && Math.abs(R.pos-k)<30 && $('#toast').hidden, k), await pg.evaluate(()=>[R.meta.id,R.pos]));
  // leaving the Bible ends it; flicking it away ends it
  await pg.evaluate(async k=>{ R.refFor=null; await openRefPeek(k); }, k); await sleep(1500); await pg.click('#sheet [data-act=ctx]'); await sleep(2000);
  await pg.evaluate(()=>closeReader()); await sleep(500);
  ok('navigating away from the Bible ends it', await pg.evaluate(()=>$('#toast').hidden || !$('#toastMsg').textContent.startsWith('Return to')));
  await pg.evaluate(()=>openDoc('shelf-pursuit')); await sleep(1200);
  await pg.evaluate(async k=>{ R.refFor=null; await openRefPeek(k); }, k); await sleep(1500); await pg.click('#sheet [data-act=ctx]'); await sleep(2000);
  { const bx=await pg.evaluate(()=>{ const r=$('#toast').getBoundingClientRect(); return {x:r.left+r.width/2, y:r.top+r.height/2}; });
    await pg.mouse.move(bx.x,bx.y); await pg.mouse.down(); await pg.mouse.move(bx.x,bx.y-40,{steps:5}); await pg.mouse.up(); await sleep(500); }
  ok('flicking it away ends it', await pg.evaluate(()=>$('#toast').hidden && RT.back===null));
  await pg.evaluate(()=>toast('Bookmarked')); await sleep(3800);
  ok('…and it doesn’t come back', await pg.evaluate(()=>$('#toast').hidden));
  ok('it would end by itself after ten minutes', await pg.evaluate(async()=>{ RT.back={id:'shelf-pursuit',pos:0}; RT.inId=R.meta.id; RT.t=Date.now()-600000+300; showReturnToast(); await new Promise(r=>setTimeout(r,1500)); return $('#toast').hidden && RT.back===null; }));
  await pg.evaluate(()=>closeReader()); await pg.evaluate(()=>openDoc('shelf-pursuit')); await sleep(1200);
  ok('no marks inside a Bible itself', await pg.evaluate(async()=>{ await openDoc('shelf-kjv'); return scanRefs().length===0; }));
  // ranges and the ordinal books
  ok('ranges and "1 Cor." parse', await pg.evaluate(()=>{ R.refFor=null; const save=[R.words,R.n,R.wf,R.meta.chapters]; R.words=['See','1','Cor.','13:4–7;','and','Ps.','23:1.']; R.n=7; R.wf=null; R.meta={...R.meta, id:'x', chapters:[]}; R.vFor=null; const ri=scanRefs(); const out=ri.map(i=>refName(R.refMap.get(i))); [R.words,R.n,R.wf]=save; R.refFor=null; R.vFor=null; return [...new Set(out)].join('|'); })==='1 Corinthians 13:4–7|Psalm 23:1');

  // ---- exact citations ----
  const cit=await pg.evaluate(async()=>{ await openDoc('shelf-kjv'); const c=R.meta.chapters.find(c=>c.t==='John 3'); const vs=[]; for(let k=c.i;k<c.i+2000;k++) if(R.wf&&(R.wf[k]&F_P)&&/^\d+$/.test(R.words[k])) vs.push([+R.words[k],k]); const v16=vs.find(v=>v[0]===16)[1], v18=vs.find(v=>v[0]===18)[1];
    const one=citation(v16+1, v16+5), rng=citation(v16, v18+3);
    await openDoc('shelf-imitation'); const ch=R.meta.chapters.find(c=>c.t==='XII'); const im=citation(ch.i+20);
    return [one, rng, im]; });
  ok('Bible: "John 3:16 (KJV)"', cit[0]==='John 3:16 (KJV)', cit[0]);
  ok('Bible range: "John 3:16–18 (KJV)"', cit[1]==='John 3:16–18 (KJV)', cit[1]);
  ok('a book: author, title, part and chapter', cit[2]==='Thomas à Kempis, The Imitation of Christ, Book I, ch. XII', cit[2]);

  // ---- open straight into your book ----
  await pg.evaluate(async()=>{ await openDoc('shelf-imitation'); const c=R.meta.chapters.find(c=>c.t==='XII'); goTo(c.i+50); }); await sleep(800);
  const before=await pg.evaluate(()=>[R.meta.id, R.pos]);
  await pg.evaluate(()=>{ saveProgress(true); }); await sleep(300);
  await pg.reload(); await sleep(2500);
  ok('relaunching opens the book you were in, at your page', await pg.evaluate(b=>!$('#v-reader').hidden && R.meta && R.meta.id===b[0] && Math.abs(R.pos-b[1])<300, before), await pg.evaluate(()=>[!$('#v-reader').hidden, R.meta&&R.meta.id, R.pos]));
  await pg.evaluate(()=>closeReader()); await sleep(400); await pg.reload(); await sleep(2000);
  ok('after going back to the library, relaunching opens the library', await pg.evaluate(()=>$('#v-reader').hidden && !$('#v-library').hidden));
  ok('no page errors', !errs.length, errs);
  console.log(fails?'FAIL '+fails:'ALL PASS'); await b.close();
})();
