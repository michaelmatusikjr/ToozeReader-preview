// Bug (Nov 23, 2026): with the bars hidden, the bottom info line ("Page 2 of 491 · …") sat on top of the last line of
// text on iPhones, because the text area ended a fixed 46px up while the line sits 14px + home-indicator inset up.
// Checks Pages and Scroll with a simulated 34px inset: the text area must end above the info line.
const __E=require('../env');
const { chromium } = require('playwright');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const b=await chromium.launch({});
  const ctx=await b.newContext({viewport:{width:393,height:852}, serviceWorkers:'block', hasTouch:true, isMobile:true});
  await ctx.addInitScript(()=>{ window.__toozKeepSample=true; });
  const pg=await ctx.newPage(); const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('http://localhost:8750/'); await sleep(1500); await pg.evaluate(()=>closeSheet()); await sleep(300);
  await pg.addStyleTag({content:'#v-reader{--run-b:calc(14px + 34px)!important}'});   /* env() can't be faked; set what it feeds */
  let ok=true;
  for(const mode of ['pages','scroll']){
    await pg.evaluate(async(mode)=>{ S.mode=mode; S.focus=true; saveSettings(); await openDoc(LIB.find(x=>x.kind==='sample').id); setChrome(false); }, mode);
    await sleep(900);
    const r=await pg.evaluate(()=>{ const box=$(S.mode==='pages'?'#pgClip':'#scrollView').getBoundingClientRect(), f=$('#runFoot').getBoundingClientRect();
      return {overlay:$('#v-reader').classList.contains('overlay'), textBottom:box.bottom, footTop:f.top}; });
    const pass=r.overlay && r.textBottom<=r.footTop-4; ok=ok&&pass;
    console.log(pass?'PASS':'FAIL', mode, JSON.stringify(r));
    await pg.evaluate(()=>closeReader()); await sleep(300);
  }
  console.log(errs.length?'FAIL errors '+errs.join(' | '):'PASS no errors');
  await b.close(); process.exit(ok&&!errs.length?0:1);
})();
