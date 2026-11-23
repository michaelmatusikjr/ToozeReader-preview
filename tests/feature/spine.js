// The spine (contents style C, Nov 23, 2026): Settings switch; chapters as marks, highlights as beads, bookmarks as
// flags, the drop at your place; drag shows the chapter under the thumb big and jumps there on release (paused);
// releasing off the spine cancels; tapping a bead shows a card that goes there; search swaps to the result list;
// the filter zooms in; the magnifying glass is gone from the top bar.
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
  // Settings switch
  await pg.click('#tabs [data-tab=settings]'); await sleep(300);
  ok('Settings has Contents: List | Spine', await pg.evaluate(()=>[...document.querySelectorAll('#tocStyleSeg button')].map(x=>x.textContent).join('|'))==='List|Spine');
  await pg.click('#tocStyleSeg [data-v=spine]'); await sleep(200);
  ok('switch saves', await pg.evaluate(()=>S.tocStyle==='spine'));
  await pg.evaluate(()=>openDoc('shelf-gatsby')); await sleep(900);
  ok('no magnifying glass in the top bar', await pg.evaluate(()=>!document.getElementById('rSearch')));
  const ch=await pg.evaluate(()=>R.meta.chapters.map(c=>[c.t,c.i]));
  await pg.evaluate(([a,bb])=>{ goTo(a,true); R.meta.bookmarks=[{i:bb,name:'',at:1}]; R.meta.highlights=[{id:'h1',s:bb+200,e:bb+206,c:2,note:'a note'}]; touch(R.meta); }, [ch[8][1]+300, ch[11][1]+50]);
  await sleep(500);
  await pg.evaluate(()=>setChrome(true)); await pg.click('#rToc'); await sleep(600);
  const st=await pg.evaluate(()=>[!!$('#spine'), document.querySelectorAll('.sp-lab').length, document.querySelectorAll('.sp-bead').length, document.querySelectorAll('.sp-flag').length, !!$('.sp-drop'), !$('#sheet .tocshow')]);
  ok('spine drawn with labels, bead, flag, drop; no Both switch', st[0]&&st[1]>5&&st[2]===1&&st[3]===1&&st[4]&&st[5], st);
  await pg.screenshot({path:__E.SCRATCH+'spine_rest.png'});
  // drag: press at top, move to chapter VI's position, check lens, release -> goes there
  const box=await pg.evaluate(()=>{ const r=$('#spine').getBoundingClientRect(); return {x:r.left,y:r.top,w:r.width,h:r.height}; });
  const yOf=await pg.evaluate((i)=>{ const r=$('#spine').getBoundingClientRect(), H=r.height, U=H-36; return r.top+18+U*i/R.n; }, ch[10][1]+20);
  await pg.mouse.move(box.x+60, box.y+30); await pg.mouse.down(); await sleep(50);
  await pg.mouse.move(box.x+70, yOf, {steps:8}); await sleep(100);
  const lens=await pg.evaluate(()=>[$('.sp-l.on')&&$('.sp-l.on').firstChild.textContent, document.querySelectorAll('.sp-l').length, $('#spine').classList.contains('dragging')]);
  ok('chapter under the thumb shows big', lens[0]===ch[10][0] && lens[1]>=3 && lens[2], lens);
  await pg.screenshot({path:__E.SCRATCH+'spine_drag.png'});
  await pg.mouse.up(); await sleep(700);
  ok('release jumps to that chapter, paused', await pg.evaluate((i)=>$('#sheet').hidden && Math.abs(R.pos-i)<400 && !R.playing, ch[10][1]), await pg.evaluate(()=>R.pos));
  // cancel: release off the spine
  await pg.evaluate(()=>setChrome(true)); await pg.click('#rToc'); await sleep(600);
  const pos0=await pg.evaluate(()=>R.pos);
  await pg.mouse.move(box.x+60, box.y+100); await pg.mouse.down(); await pg.mouse.move(box.x+60, box.y+300,{steps:5}); await pg.mouse.move(box.x+60, box.y-120,{steps:5}); await pg.mouse.up(); await sleep(400);
  ok('releasing off the spine cancels', await pg.evaluate((p)=>!$('#sheet').hidden && R.pos===p, pos0));
  // bead card
  await pg.click('.sp-bead'); await sleep(250);
  ok('bead shows its highlight', await pg.evaluate(()=>!$('.sp-card').hidden && $('.sp-card').textContent.includes('a note')));
  await pg.screenshot({path:__E.SCRATCH+'spine_card.png'});
  await pg.click('.sp-card'); await sleep(600);
  ok('card goes to the highlight', await pg.evaluate(()=>$('#sheet').hidden && R.pos<=R.meta.highlights[0].s+5 && R.pos>R.meta.highlights[0].s-600));
  // search swaps to the result list and back
  await pg.evaluate(()=>setChrome(true)); await pg.click('#rToc'); await sleep(600);
  await pg.fill('#tocQ','gatsby'); await sleep(500);
  ok('search shows results', await pg.evaluate(()=>!$('#spine') && document.querySelectorAll('#tocOut .result').length>5));
  await pg.fill('#tocQ',''); await sleep(500);
  ok('clearing search brings the spine back', await pg.evaluate(()=>!!$('#spine') && document.querySelectorAll('.sp-lab').length>5));
  // filter zooms in
  await pg.selectOption('#tocScope','10'); await sleep(500);
  ok('filter zooms the spine to one chapter', await pg.evaluate(()=>!!$('#spine') && document.querySelectorAll('.sp-lab').length===1));
  await pg.click('#sheet [data-act=unscope]'); await sleep(300);
  // Notes tab is the list
  await pg.click('#sheet [data-act=tab][data-t=hls]'); await sleep(300);
  ok('Notes tab still the list', await pg.evaluate(()=>!$('#spine') && document.querySelectorAll('#tocOut .hlrow').length===1 && !$('#sheet').classList.contains('spine')));
  // Bible: dense chapters still readable
  await pg.evaluate(()=>{ closeSheet(); closeReader(); }); await pg.evaluate(()=>openDoc('shelf-kjv')); await sleep(1000);
  await pg.evaluate(()=>setChrome(true)); await pg.click('#rToc'); await sleep(700);
  const bl=await pg.evaluate(()=>{ const ys=[...document.querySelectorAll('.sp-lab')].map(x=>parseFloat(x.style.top)).sort((a,b)=>a-b); let mind=1e9; for(let k=1;k<ys.length;k++) mind=Math.min(mind,ys[k]-ys[k-1]); return [ys.length, mind]; });
  ok('Bible labels thinned, never overlapping', bl[0]>8 && bl[1]>=24, bl);
  await pg.screenshot({path:__E.SCRATCH+'spine_bible.png'});
  ok('no page errors', !errs.length, errs);
  console.log(fails?'FAIL '+fails:'ALL PASS'); await b.close();
})();
