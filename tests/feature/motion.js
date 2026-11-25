/* Subtle motion with a job: stats bars grow in, library cards collapse when a book goes, bookmark button, goal glow.
   Run: TOOZ_PORT=8754 node tests/feature/motion.js */
const __E=require('../env');
const { chromium } = require('playwright');
const PORT=process.env.TOOZ_PORT||8750, URL='http://localhost:'+PORT+'/';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let fails=0; const ok=(c,msg)=>{ console.log((c?'PASS ':'FAIL ')+msg); if(!c) fails++; };

const seed=()=>{   /* a week of reading: 0,5,10,20,30,15,40 minutes, goal 30 */
  const st={}; const mins=[0,5,10,20,30,15,40];
  mins.forEach((m,n)=>{ const d=new Date(); d.setDate(d.getDate()-(6-n)); if(m) st[dayKey(d)]={ms:m*60000, words:m*200}; });
  LS.set('stats',st); S.goalMins=30; saveSettings(); LS.set('goalGlow','');
};
const heights=()=>[...document.querySelectorAll('.bars .b i')].map(i=>Math.round(100*i.getBoundingClientRect().height/i.parentElement.getBoundingClientRect().height));

(async()=>{
  const b=await chromium.launch({});
  for(const reduce of [false,true]){
    const ctx=await b.newContext({viewport:{width:393,height:852}, serviceWorkers:'block', hasTouch:true, isMobile:true, reducedMotion:reduce?'reduce':'no-preference'});
    await ctx.addInitScript(()=>{ window.__toozKeepSample=true; });
    const pg=await ctx.newPage(); const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
    await pg.goto(URL); await sleep(1200); await pg.evaluate(()=>closeSheet());
    await pg.evaluate(seed);
    const tag=reduce?'reduced motion: ':'';

    /* stats bars */
    const first=await pg.evaluate(`(()=>{ showView('stats'); return {h:(${heights.toString()})(), goal:document.querySelector('.goalbar i').getBoundingClientRect().width}; })()`);
    const end=[2,13,25,50,75,38,85];   /* % of the column; the tallest is held to 85 by the label above it, the empty day keeps its 2px */
    if(reduce){
      ok(first.h.every((v,n)=>Math.abs(v-end[n])<=3), tag+'bars are at final height immediately '+first.h);
    } else {
      ok(first.h.every(v=>v===0), tag+'bars start at height 0 '+first.h);
      ok(first.goal===0, tag+'goal bar starts empty');
      await pg.evaluate(()=>document.querySelector('.bars').scrollIntoView({block:'center'}));
      await sleep(1300);
      const fin=await pg.evaluate(`(${heights.toString()})()`);
      ok(fin.every((v,n)=>Math.abs(v-end[n])<=3), tag+'bars end at the right height '+fin);
      const em=await pg.evaluate(()=>[...document.querySelectorAll('.bars .b em')].map(e=>getComputedStyle(e).opacity));
      ok(em.every(o=>o==='1'), tag+'labels faded in');
      /* tapping a goal chip grows from the old heights, not from zero */
      await pg.evaluate(()=>{ document.querySelector('[data-goal="60"]').click(); });
      const mid=await pg.evaluate(`(${heights.toString()})()`);
      ok(mid[6]>20, tag+'chip re-render starts from the old heights '+mid);
      await sleep(900);
      const fin2=await pg.evaluate(`(${heights.toString()})()`);
      ok(fin2[6]===67 || Math.abs(fin2[6]-67)<=3, tag+'chip re-render lands on new heights '+fin2);
    }

    /* goal glow: once per day, only when motion is allowed */
    await pg.evaluate(()=>{ const st=LS.get('stats',{}); st[dayKey()]={ms:40*60000,words:100}; LS.set('stats',st); S.goalMins=30; saveSettings(); LS.set('goalGlow',''); showView('library'); showView('stats'); document.querySelector('.goalbar').scrollIntoView({block:'center'}); });
    await sleep(1100);
    const glowSet=await pg.evaluate(()=>LS.get('goalGlow','')===dayKey());
    ok(glowSet===!reduce, tag+'goal glow '+(reduce?'skipped':'played and remembered for today'));

    /* library: deleting a book collapses its card first */
    await pg.evaluate(async()=>{ showView('library'); const m=await addDoc({title:'Leaving Book', kind:'paste', ...fromPlainText('Some words here. '.repeat(40))}); window.__lid=m.id; renderLibrary(); });
    await sleep(300);
    await pg.click(`[data-more="${await pg.evaluate(()=>window.__lid)}"]`); await sleep(500);
    await pg.click('#sheet [data-act=askdel]'); await sleep(300);
    await pg.click('#sheet [data-act=del]');
    await sleep(120);
    const midCard=await pg.evaluate(()=>{ const c=document.querySelector(`.doc[data-open="${window.__lid}"]`); return c?{h:c.getBoundingClientRect().height, op:getComputedStyle(c).opacity}:null; });
    if(reduce) ok(true, tag+'(card may vanish at once)');
    else ok(midCard && midCard.h>0 && +midCard.op<1, tag+'card is mid-collapse after 120 ms '+JSON.stringify(midCard));
    await sleep(600);
    const gone=await pg.evaluate(()=>!document.querySelector(`.doc[data-open="${window.__lid}"]`) && !LIB.some(x=>x.id===window.__lid));
    ok(gone, tag+'card and book are gone after the collapse');

    /* bookmark button still toggles */
    await pg.evaluate(async()=>{ S.mode='pages'; saveSettings(); await openDoc(LIB.find(x=>x.kind==='sample').id); setChrome(true); });
    await sleep(900);
    await pg.evaluate(()=>$('#rMark').click()); await sleep(350);
    ok(await pg.evaluate(()=>(R.meta.bookmarks||[]).length===1 && $('#rMark').classList.contains('on')), tag+'#rMark adds a bookmark');
    await pg.evaluate(()=>$('#rMark').click()); await sleep(350);
    ok(await pg.evaluate(()=>(R.meta.bookmarks||[]).length===0 && !$('#rMark').classList.contains('on')), tag+'#rMark removes it');

    ok(errs.length===0, tag+'no page errors '+errs.join('|'));
    await ctx.close();
  }
  await b.close();
  console.log(fails?'FAILED '+fails:'ALL PASS'); process.exit(fails?1:0);
})();
