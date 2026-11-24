// The spine (contents style C, Nov 23, 2026): Settings switch; chapters as marks, highlights as beads, bookmarks as
// flags, the drop at your place; drag shows the chapter under the thumb big and jumps there on release (paused);
// releasing off the spine cancels; tapping a bead shows a card that goes there; search swaps to the result list;
// the filter zooms in; the magnifying glass is gone from the top bar.
const __E=require('../env');
const { chromium } = require('playwright');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const slow=async(pg,x,y0,y1,stepPx=2,ms=28)=>{ const n=Math.max(1,Math.round(Math.abs(y1-y0)/stepPx)); for(let k=1;k<=n;k++){ await pg.mouse.move(x, y0+(y1-y0)*k/n); await sleep(ms); } };
let fails=0; const ok=(n,c,x)=>{ console.log((c?'PASS ':'FAIL ')+n+(x!==undefined?' '+JSON.stringify(x):'')); if(!c) fails++; };
(async()=>{
  const b=await chromium.launch({});
  const ctx=await b.newContext({viewport:{width:390,height:780}, serviceWorkers:'block', hasTouch:true, isMobile:true, deviceScaleFactor:1});
  await ctx.addInitScript(()=>{window.__toozKeepSample=true});
  await ctx.route(/cdnjs/,r=>r.fulfill({path:__E.NM+'jszip/dist/jszip.min.js',contentType:'application/javascript'}));
  await ctx.route(/fonts\.(googleapis|gstatic)/,r=>r.abort());
  const pg=await ctx.newPage(); const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('http://localhost:8750/'); await sleep(1200);
  // the switch lives in the reader's Aa panel (Mick, Nov 24), not app Settings
  await pg.click('#tabs [data-tab=settings]'); await sleep(300);
  ok('not in app Settings', await pg.evaluate(()=>!document.querySelector('#v-settings [data-set=tocStyle]')));
  await pg.evaluate(()=>openDoc('shelf-gatsby')); await sleep(900);
  await pg.evaluate(()=>setChrome(true)); await pg.click('#rAa'); await sleep(500);
  await pg.click('#sheet details.aadet[data-k=text] summary'); await sleep(300);
  ok('Aa → More text options has Contents: List | Spine', await pg.evaluate(()=>[...document.querySelectorAll('#sheet [data-set=tocStyle] button')].map(x=>x.textContent).join('|'))==='List|Spine');
  await pg.click('#sheet [data-set=tocStyle] [data-v=spine]'); await sleep(200);
  ok('switch saves', await pg.evaluate(()=>S.tocStyle==='spine'));
  await pg.evaluate(()=>closeSheet()); await sleep(450);
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
  await pg.mouse.move(box.x+60, yOf); await pg.mouse.down(); await sleep(50);
  await pg.mouse.move(box.x+62, yOf+1); await sleep(100);
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
  // step sideways (Mick, Nov 24): slide to Revelation at the bottom, step right -> Revelation 22, slide up -> ~12
  const bb=await pg.evaluate(()=>{ const r=$('#spine').getBoundingClientRect(); return {x:r.left,y:r.top,w:r.width,h:r.height}; });
  const lensTxt=()=>pg.evaluate(()=>{ const o=$('.sp-l.on'); return o? o.firstChild.textContent : null; });
  await pg.mouse.move(bb.x+58, bb.y+bb.h/2); await pg.mouse.down(); await pg.mouse.move(bb.x+58, bb.y+bb.h-18, {steps:8}); await sleep(80);
  ok('bottom of the line is Revelation', (await lensTxt())==='Revelation', await lensTxt());
  ok('book shows its chapter count', await pg.evaluate(()=>$('.sp-l.on small').textContent==='22 chapters'));
  await pg.mouse.move(bb.x+90, bb.y+bb.h-22, {steps:4}); await pg.mouse.move(bb.x+150, bb.y+bb.h-20, {steps:4}); await sleep(120);
  ok('step right unrolls Revelation’s chapters', await pg.evaluate(()=>!!$('.sp-inner') && $('.sp-chip').textContent==='Revelation'));
  ok('thumb is already on Revelation 22', (await lensTxt())==='Revelation 22', await lensTxt());
  await pg.screenshot({path:__E.SCRATCH+'spine_step22.png'});
  { let yy=bb.y+bb.h-20; for(let k=0;k<400 && (await lensTxt())!=='Revelation 12';k++){ yy-=2; await pg.mouse.move(bb.x+150, yy); await sleep(28); } }
  ok('slide up to Revelation 12', (await lensTxt())==='Revelation 12', await lensTxt());
  await pg.screenshot({path:__E.SCRATCH+'spine_step12.png'});
  await pg.mouse.up(); await sleep(800);
  ok('release lands on Revelation 12', await pg.evaluate(()=>$('#sheet').hidden && currentChapter(R.pos).t==='Revelation 12'), await pg.evaluate(()=>currentChapter(R.pos).t));
  // step back left returns to the books; further right is finer
  await pg.evaluate(()=>setChrome(true)); await pg.click('#rToc'); await sleep(700);
  await pg.mouse.move(bb.x+58, bb.y+bb.h/2); await pg.mouse.down(); await pg.mouse.move(bb.x+90, bb.y+bb.h/2,{steps:3}); await pg.mouse.move(bb.x+150, bb.y+bb.h/2,{steps:3}); await sleep(80);
  const psIn=await pg.evaluate(()=>$('.sp-chip')&&$('.sp-chip').textContent);
  const mk=()=>pg.evaluate(()=>parseFloat($('.sp-imark').style.top));
  let a0=await mk(); await slow(pg,bb.x+160,bb.y+bb.h/2,bb.y+bb.h/2+40); const near=(await mk())-a0;
  await pg.mouse.move(bb.x+300, bb.y+bb.h/2+40,{steps:6}); await sleep(60);
  a0=await mk(); await slow(pg,bb.x+300,bb.y+bb.h/2+40,bb.y+bb.h/2+80); const far=(await mk())-a0;
  ok('far right moves a quarter as fast', near>0 && Math.abs(near/far-4)<1, [psIn, near, far]);
  await pg.mouse.move(bb.x+60, bb.y+bb.h/2,{steps:8}); await sleep(80);
  ok('step back left returns to the books', await pg.evaluate(()=>!$('.sp-inner') && !$('#spine').classList.contains('inner')) && !/\d$/.test(await lensTxt()||'1'), await lensTxt());
  await pg.mouse.move(bb.x+58, bb.y-200); await pg.mouse.up(); await sleep(300);
  // Jude (Mick, Nov 24: too sensitive): slow movement is about a fingertip per book
  await pg.evaluate(()=>closeSheet()); await sleep(450); await pg.evaluate(()=>setChrome(true)); await pg.click('#rToc'); await sleep(700);
  await pg.mouse.move(bb.x+58, bb.y+bb.h-12); await pg.mouse.down(); await sleep(40);
  ok('bottom touch starts on Revelation', (await lensTxt())==='Revelation', await lensTxt());
  await slow(pg,bb.x+58,bb.y+bb.h-12,bb.y+bb.h-28);
  const j1=await lensTxt(); await slow(pg,bb.x+58,bb.y+bb.h-28,bb.y+bb.h-32); const j2=await lensTxt();
  ok('a slow fingertip up lands on Jude and holds it', j1==='Jude' && j2==='Jude', [j1,j2]);
  ok('a dot on the line marks the pick', await pg.evaluate(()=>getComputedStyle($('.sp-omark')).display==='block'));
  await pg.screenshot({path:__E.SCRATCH+'spine_jude.png'});
  await pg.mouse.up(); await sleep(800);
  ok('lands in Jude', await pg.evaluate(()=>/^Jude/.test(currentChapter(R.pos).t)), await pg.evaluate(()=>currentChapter(R.pos).t));
  // no jump at the ends (Mick, Nov 24): sliding steadily to the bottom never skips more than a couple of books per move
  await pg.evaluate(()=>setChrome(true)); await pg.click('#rToc'); await sleep(700);
  { const names=await pg.evaluate(()=>R.meta.chapters.filter(c=>(c.d||0)<=1).map(c=>c.t));
    await pg.mouse.move(bb.x+58, bb.y+bb.h*0.3); await pg.mouse.down(); await sleep(30);
    let prev=names.indexOf(await lensTxt()), maxStep=0;
    for(let yy=bb.y+bb.h*0.3; yy<=bb.y+bb.h-4; yy+=4){ await pg.mouse.move(bb.x+58, yy); await sleep(16); const k=names.indexOf(await lensTxt()); maxStep=Math.max(maxStep, Math.abs(k-prev)); prev=k; }
    ok('steady slide reaches Revelation at the bottom without a jump', (await lensTxt())==='Revelation' && maxStep<=3, maxStep);
    await pg.mouse.move(bb.x+58, bb.y-200); await pg.mouse.up(); await sleep(300); await pg.evaluate(()=>closeSheet()); await sleep(450); }
  // a quick swipe still crosses the whole book
  await pg.evaluate(()=>setChrome(true)); await pg.click('#rToc'); await sleep(700);
  await pg.mouse.move(bb.x+58, bb.y+bb.h-60); await pg.mouse.down(); await pg.mouse.move(bb.x+58, bb.y+40,{steps:6}); await sleep(30);
  const sw=await lensTxt(); ok('a quick swipe up reaches the early books', [await pg.evaluate(()=>R.meta.chapters[0].t),'Genesis','Exodus','Leviticus','Numbers','Deuteronomy','Joshua','Judges','Ruth'].includes(sw), sw);
  await pg.mouse.move(bb.x+58, bb.y-200); await pg.mouse.up(); await sleep(300);
  // a plain novel: step into a chapter -> its pages
  await pg.evaluate(()=>{ closeSheet(); closeReader(); }); await pg.evaluate(()=>openDoc('shelf-gatsby')); await sleep(900);
  await pg.evaluate(()=>setChrome(true)); await pg.click('#rToc'); await sleep(700);
  const gb=await pg.evaluate(()=>{ const r=$('#spine').getBoundingClientRect(); const c=R.meta.chapters.find(c=>c.t==='VI'); const [a,b]=[c.i,R.meta.chapters.find(c=>c.t==='VII').i]; return {x:r.left,y:r.top,h:r.height, yv:r.top+18+(r.height-36)*((a+b)/2)/R.n, a, b}; });
  await pg.mouse.move(gb.x+58, gb.yv); await pg.mouse.down(); await pg.mouse.move(gb.x+90, gb.yv,{steps:3}); await pg.mouse.move(gb.x+150, gb.yv,{steps:3}); await sleep(100);
  const pgl=await lensTxt();
  ok('novel chapter steps into pages', /^Page \d/.test(pgl||'') && await pg.evaluate(()=>$('.sp-l.on small').textContent==='VI'), pgl);
  await pg.screenshot({path:__E.SCRATCH+'spine_pages.png'});
  await pg.mouse.up(); await sleep(800);
  ok('lands inside that chapter', await pg.evaluate(g=>R.pos>=g.a-300 && R.pos<g.b, gb), await pg.evaluate(()=>R.pos));
  ok('no page errors', !errs.length, errs);
  console.log(fails?'FAIL '+fails:'ALL PASS'); await b.close();
})();
