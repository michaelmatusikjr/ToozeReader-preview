// One sheet for contents, bookmarks and notes (Nov 23, 2026): no separate notes button; Contents | Notes tabs;
// bookmarks sit in place between chapters; Both/Contents/Bookmarks switch; search (titles, bookmarks, text);
// section filter; notes search; the current chapter carries the drop.
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
  await pg.goto('http://localhost:'+(process.env.TOOZ_PORT||8750)+'/'); await sleep(1200);
  await pg.evaluate(()=>openDoc('shelf-gatsby')); await sleep(900);
  ok('no separate notes button', await pg.evaluate(()=>!document.getElementById('rNotes')));
  const ch=await pg.evaluate(()=>R.meta.chapters.map(c=>[c.t,c.i]));
  // two bookmarks: one inside chapter 2, one inside chapter 4
  await pg.evaluate(([a,b])=>{ R.meta.bookmarks=[{i:a,name:'',at:1},{i:b,name:'Party',at:2}]; R.meta.highlights=[{id:'h1',s:ch2(),e:ch2()+5,c:1,note:'green light'},{id:'h2',s:b+3,e:b+8,c:4,note:''}]; function ch2(){return a+2;} touch(R.meta); }, [ch[5][1]+40, ch[7][1]+40]);
  await pg.evaluate(()=>{ setChrome(true); }); await pg.click('#rToc'); await sleep(500);
  ok('tabs are Contents | Notes', await pg.evaluate(()=>[...document.querySelectorAll('#sheet .seg:not(.tocshow) button')].map(x=>x.textContent).join('|'))==='Contents|Notes');
  const order=await pg.evaluate(()=>[...document.querySelectorAll('#tocOut .li')].map(x=>x.classList.contains('bmli')?'BM':x.querySelector('.grow').textContent));
  const i1=order.indexOf('BM'), i2=order.lastIndexOf('BM');
  ok('bookmark 1 sits in its chapter (1)', order[i1-1]===ch[5][0], order.slice(0,6));
  ok('bookmark 2 sits in its chapter (2)', order[i2-1]===ch[7][0]);
  ok('bookmark names its chapter', (await pg.evaluate(()=>$('#tocOut .bmli .small').textContent)).includes('in '+ch[5][0]));
  ok('current chapter has the drop', await pg.evaluate(()=>getComputedStyle($('#sheet .li.on'),'::before').width==='6px'));
  await pg.screenshot({path:__E.SCRATCH+'sheet_both.png'});
  await pg.click('#sheet [data-act=show][data-s=marks]'); await sleep(300);
  ok('Bookmarks only', await pg.evaluate(()=>document.querySelectorAll('#tocOut .li').length===2 && document.querySelectorAll('#tocOut .bmli').length===2));
  await pg.click('#sheet [data-act=show][data-s=toc]'); await sleep(300);
  ok('Contents only', await pg.evaluate(()=>document.querySelectorAll('#tocOut .bmli').length===0 && document.querySelectorAll('#tocOut .li').length>3));
  await pg.click('#sheet [data-act=show][data-s=both]'); await sleep(300);
  // search: chapter titles + text hits
  await pg.fill('#tocQ','gatsby'); await sleep(500);
  const sr=await pg.evaluate(()=>[document.querySelectorAll('#tocOut .result').length, ($('#tocOut .tochd')||{}).textContent]);
  ok('search finds text in the book', sr[0]>5, sr);
  await pg.screenshot({path:__E.SCRATCH+'sheet_search.png'});
  await pg.click('#tocOut .result'); await sleep(700);
  ok('tapping a hit goes there and closes', await pg.evaluate(()=>$('#sheet').hidden));
  // filter to one chapter
  await pg.evaluate(()=>setChrome(true)); await pg.click('#rToc'); await sleep(400);
  ok('search text kept while the book is open', await pg.evaluate(()=>$('#tocQ').value==='gatsby'));
  await pg.selectOption('#tocScope', '2'); await sleep(400);
  const sc=await pg.evaluate(()=>{ const [lo,hi]=tocSpan(2); return [...document.querySelectorAll('#tocOut .result')].every(x=>+x.dataset.i>=lo&&+x.dataset.i<hi) && !!$('#sheet .tocscope'); });
  ok('filter limits hits to the chapter', sc);
  await pg.click('#sheet [data-act=unscope]'); await sleep(300);
  await pg.fill('#tocQ',''); await sleep(400);
  // notes tab: the Contents|Notes control stays the same element, so the drop slides across (Mick, Nov 24)
  await sleep(900);
  const tabsEl=await pg.evaluateHandle(()=>$('#tocTabs'));
  const x0=await pg.evaluate(()=>{ const d=$('#tocTabs .drop-seg'); return d? d.getBoundingClientRect().left : null; });
  await pg.click('#sheet [data-act=tab][data-t=hls]'); await sleep(170);
  const mid=await pg.evaluate(()=>{ const d=$('#tocTabs .drop-seg'); return d? [d.getBoundingClientRect().left, d.getBoundingClientRect().width, d.getAnimations().length] : null; });
  await pg.screenshot({path:__E.SCRATCH+'sheet_tabslide.png'});
  await sleep(500);
  const x1=await pg.evaluate(()=>$('#tocTabs .drop-seg').getBoundingClientRect().left);
  ok('tab control kept (not redrawn)', await pg.evaluate(t=>$('#tocTabs')===t, tabsEl));
  ok('drop slides from Contents to Notes', x0!=null && mid && mid[2]>0 && x1>x0+50 && mid[1]>(x1-x0), [x0,mid,x1]);
  ok('notes tab lists highlights', await pg.evaluate(()=>document.querySelectorAll('#tocOut .hlrow').length===2));
  await pg.screenshot({path:__E.SCRATCH+'sheet_notes.png'});
  await pg.fill('#hlQ','green'); await sleep(300);
  ok('notes search finds a note', await pg.evaluate(()=>document.querySelectorAll('#tocOut .hlrow').length===1));
  // the bookmark toast's "See all" lands on bookmarks
  await pg.evaluate(()=>{ closeSheet(); openToc('marks'); }); await sleep(500);
  ok('openToc(marks) shows bookmarks', await pg.evaluate(()=>$('#sheet [data-act=show][aria-pressed=true]').dataset.s==='marks'));
  await pg.click('#tocOut .bmli [data-act=rmbm]'); await sleep(300);
  ok('remove bookmark offers undo', await pg.evaluate(()=>R.meta.bookmarks.length===1 && !$('#toastAct').hidden));
  ok('no page errors', !errs.length, errs);
  console.log(fails?'FAIL '+fails:'ALL PASS'); await b.close();
})();
