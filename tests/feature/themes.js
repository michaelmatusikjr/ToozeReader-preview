// Themes, app-wide (Mick, Nov 25): user theme list in Settings, editable accents, max 5, night switch from his themes.
const __E=require('../env');
const { chromium } = require('playwright');
const PORT=process.env.TOOZ_PORT||8750;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let fails=0; const ok=(n,c,x)=>{ console.log((c?'PASS ':'FAIL ')+n+(x!==undefined?' '+JSON.stringify(x):'')); if(!c) fails++; };
(async()=>{
  const b=await chromium.launch({});
  const ctx=await b.newContext({viewport:{width:390,height:780}, serviceWorkers:'block', hasTouch:true, isMobile:true, deviceScaleFactor:1});
  await ctx.addInitScript(()=>{ window.__toozKeepSample=true; });
  await ctx.route(/cdnjs/,r=>r.fulfill({path:__E.NM+'jszip/dist/jszip.min.js',contentType:'application/javascript'}));
  await ctx.route(/fonts\.(googleapis|gstatic)/,r=>r.abort());
  const pg=await ctx.newPage(); const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  const url='http://localhost:'+PORT+'/';
  const css=(v)=>pg.evaluate(v=>getComputedStyle(document.documentElement).getPropertyValue(v).trim().toUpperCase(),v);
  // old settings with Gray selected migrate to a list with Gray in Paper's place
  await pg.goto(url); await sleep(800);
  await pg.evaluate(()=>{ localStorage.setItem('rf.settings',JSON.stringify({v:2,theme:'gray',nightTheme:'gray'})); });
  await pg.reload(); await sleep(900);
  let ids=await pg.evaluate(()=>S.themes.map(t=>t.id));
  ok('old gray migrates in Paper\'s place', JSON.stringify(ids)==='["white","gray","sepia","dark","black"]', ids);
  ok('gray stays current and dark', await pg.evaluate(()=>S.theme==='gray' && themeById('gray').dark && document.documentElement.dataset.theme==='dark'));
  // fresh defaults
  await pg.evaluate(()=>{ localStorage.setItem('rf.settings','{}'); }); await pg.reload(); await sleep(900);
  ids=await pg.evaluate(()=>S.themes.map(t=>t.id));
  ok('defaults are white, paper, sepia, dark, black', JSON.stringify(ids)==='["white","paper","sepia","dark","black"]', ids);
  // chrome follows the theme: Sepia gives a warm library
  await pg.evaluate(()=>{ S.theme='sepia'; saveSettings(); applyLook(); }); await sleep(100);
  ok('sepia chrome surface is the page colour', (await css('--surface'))==='#F1E4C9');
  await pg.evaluate(()=>{ showView('settings'); renderSettings(); }); await sleep(500);
  ok('5 theme cards, no 6th', await pg.evaluate(()=>document.querySelectorAll('#themeSet .tpick').length===5 && !$('#themeSet .tadd')));
  ok('current card is ringed', await pg.evaluate(()=>$('#themeSet .tpick[aria-pressed="true"]').dataset.tpick==='sepia'));
  // delete one, then + is offered; new theme starts as a copy of the current
  await pg.click('#themeSet [data-tedit="black"]'); await sleep(500);
  ok('editor sheet opens', await pg.evaluate(()=>!$('#sheet').hidden && !!$('#sheet .tprev')));
  await pg.click('#sheet [data-act="del"]'); await sleep(500);
  ok('deleted theme gone, sheet closed', await pg.evaluate(()=>S.themes.length===4 && $('#sheet').hidden));
  ok('+ card appears with fewer than 5', await pg.evaluate(()=>!!$('#themeSet .tadd')));
  await pg.click('#themeSet .tadd'); await sleep(500);
  const nu=await pg.evaluate(()=>({n:S.themes.length, cur:S.theme, last:S.themes[S.themes.length-1], sheet:!$('#sheet').hidden}));
  ok('new theme added, current, copy of sepia, editor open', nu.n===5 && nu.cur===nu.last.id && nu.last.bg==='#F1E4C9' && nu.sheet, nu);
  ok('+ gone at 5', await pg.evaluate(()=>!$('#themeSet .tadd')));
  // edit accent via a dot -> --accent changes live
  const before=await css('--accent');
  await pg.click('#sheet .trow[data-k="accent"] .tdot[data-v="#E0303F"]'); await sleep(200);
  const after=await css('--accent');
  ok('editing accent changes --accent', before!==after && after==='#E0303F', [before,after]);
  // page colour via native picker updates the app
  await pg.evaluate(()=>{ const i=$('#sheet input[data-tcolor="bg"]'); i.value='#102030'; i.dispatchEvent(new Event('input',{bubbles:true})); }); await sleep(200);
  ok('custom page colour applies app-wide and flips dark', (await css('--surface'))==='#102030' && await pg.evaluate(()=>document.documentElement.dataset.theme==='dark'));
  await pg.evaluate(()=>{ const i=$('#sheet input[data-tname]'); i.value='Night owl'; i.dispatchEvent(new Event('input',{bubbles:true})); }); await sleep(100);
  ok('rename shows on the card', await pg.evaluate(()=>S.themes[S.themes.length-1].label==='Night owl' && [...document.querySelectorAll('#themeSet .tname')].some(x=>x.textContent==='Night owl')));
  // shipped theme accent editable
  await pg.evaluate(()=>closeSheet()); await pg.click('#themeSet [data-tedit="white"]'); await sleep(500);
  await pg.click('#sheet .trow[data-k="accent"] .tdot[data-v="#139E9A"]'); await sleep(100);
  ok('shipped theme accent editable', await pg.evaluate(()=>S.themes.find(t=>t.id==='white').accent==='#139E9A'));
  await pg.evaluate(()=>closeSheet());
  // night theme list = user themes
  await pg.evaluate(()=>{ S.nightAuto=true; saveSettings(); refreshPanel(); }); await sleep(200);
  const night=await pg.evaluate(()=>[...document.querySelectorAll('#themeSet [data-set="nightTheme"] button')].map(x=>x.dataset.v));
  ok('night picker lists user themes', JSON.stringify(night)===JSON.stringify(await pg.evaluate(()=>S.themes.map(t=>t.id))), night);
  const ntId=await pg.evaluate(()=>{ const t=S.themes[S.themes.length-1]; S.nightTheme=t.id; S.nightFrom='00:00'; S.nightTo='23:59'; saveSettings(); return t.id; });
  ok('night switch uses his theme', await pg.evaluate(id=>effectiveTheme()===id, ntId));
  await pg.evaluate(()=>{ S.nightAuto=false; saveSettings(); });
  // Aa row built from user themes
  await pg.evaluate(async()=>{ await openDoc(LIB[0].id); }); await sleep(900);
  await pg.evaluate(()=>openPanel()); await sleep(500);
  ok('Aa theme row follows the list (+ Phone)', await pg.evaluate(()=>document.querySelectorAll('#sheet .themes button').length===S.themes.length+1));
  ok('no night controls in Aa', await pg.evaluate(()=>!$('#sheet [data-set="nightAuto"]')));
  await pg.evaluate(()=>{ closeSheet(); });
  await pg.evaluate(()=>{ closeReader(); showView('settings'); renderSettings(); }); await sleep(500);
  // delete the current theme falls back to first
  const curId=await pg.evaluate(()=>S.theme);
  await pg.click(`#themeSet [data-tedit="${curId}"]`); await sleep(500);
  await pg.click('#sheet [data-act="del"]'); await sleep(500);
  ok('deleting current falls back to first', await pg.evaluate(()=>S.theme===S.themes[0].id && S.themes.length===4));
  // survives reload and is in the backup
  const snap=await pg.evaluate(()=>JSON.stringify(S.themes));
  await pg.reload(); await sleep(900);
  ok('themes survive a reload', await pg.evaluate(()=>JSON.stringify(S.themes))===snap);
  ok('settings (the backup payload) carry themes', await pg.evaluate(()=>Array.isArray(JSON.parse(JSON.stringify(S)).themes) && 'themes' in DEFAULTS));
  // last theme cannot be deleted
  await pg.evaluate(()=>{ S.themes=S.themes.slice(0,1); S.theme=S.themes[0].id; saveSettings(); showView('settings'); renderSettings(); }); await sleep(200);
  await pg.click('#themeSet [data-tedit]'); await sleep(500);
  ok('last theme has no delete', await pg.evaluate(()=>!$('#sheet [data-act="del"]')));
  ok('no page errors', errs.length===0, errs);
  await b.close(); console.log(fails?('FAILED '+fails):'ALL PASS'); process.exit(fails?1:0);
})();
