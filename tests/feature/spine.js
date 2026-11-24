// Contents "Wheels" (style value 'spine'; Mick, Nov 24): picker wheels Book | Chapter | Verse in a Bible (Chapter |
// Page in a novel) that open on where you are, refill to the right when a wheel lands, and only move you on Go.
// A thin spine map stays on the left (beads, flags, the drop, a ring at the pick). Typed references in search.
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
  await pg.click('#tabs [data-tab=settings]'); await sleep(300);
  ok('not in app Settings', await pg.evaluate(()=>!document.querySelector('#v-settings [data-set=tocStyle]')));
  await pg.evaluate(()=>openDoc('shelf-kjv')); await sleep(1200);
  ok('no magnifying glass in the top bar', await pg.evaluate(()=>!document.getElementById('rSearch')));
  await pg.evaluate(()=>setChrome(true)); await pg.click('#rAa'); await sleep(500);
  await pg.click('#sheet details.aadet[data-k=text] summary'); await sleep(300);
  ok('Aa → More text options has Contents: List | Wheels', await pg.evaluate(()=>[...document.querySelectorAll('#sheet [data-set=tocStyle] button')].map(x=>x.textContent).join('|'))==='List|Wheels');
  await pg.click('#sheet [data-set=tocStyle] [data-v=spine]'); await sleep(200);
  ok('switch saves', await pg.evaluate(()=>S.tocStyle==='spine'));
  await pg.evaluate(()=>closeSheet()); await sleep(450);
  // start inside John 3, verse 2
  await pg.evaluate(()=>{ const c=R.meta.chapters.find(c=>c.t==='John 3'); goTo(c.i+40,true); R.meta.highlights=[{id:'h1',s:c.i+60,e:c.i+66,c:2,note:'a note'}]; touch(R.meta); }); await sleep(600);
  await pg.evaluate(()=>setChrome(true)); await pg.click('#rToc'); await sleep(900);
  const st=()=>pg.evaluate(()=>[document.querySelectorAll('.whc').length, $('.whgo .wg-t').textContent, [...document.querySelectorAll('.whi.on')].map(x=>x.textContent)]);
  let s0=await st();
  ok('three wheels open on where you are', s0[0]===3 && s0[2].join('|')==='John|3|2', s0);
  ok('Go names the pick', s0[1]==='Go to John 3:2', s0[1]);
  ok('spine map kept: drop, bead, ring', await pg.evaluate(()=>!!$('.sp-drop') && document.querySelectorAll('.sp-bead').length===1 && !!$('.wh-tgt')));
  await pg.screenshot({path:__E.SCRATCH+'wheels_open.png'});
  // flick the book wheel to the end: lands on Revelation, chapter and verse wheels refill
  const pos0=await pg.evaluate(()=>R.pos);
  await pg.evaluate(()=>{ const c=document.querySelectorAll('.whc')[0]; c.scrollTop=c.scrollHeight; }); await sleep(600);
  s0=await st();
  ok('book wheel lands on Revelation; others refill at 1:1', s0[2].join('|')==='Revelation|1|1' && s0[1]==='Go to Revelation 1:1', s0);
  ok('nothing moves before Go', await pg.evaluate(p=>R.pos===p && !$('#sheet').hidden, pos0));
  await pg.evaluate(()=>{ const c=document.querySelectorAll('.whc')[1]; c.scrollTop=21*40; }); await sleep(600);
  await pg.evaluate(()=>{ const c=document.querySelectorAll('.whc')[2]; c.scrollTop=2*40; }); await sleep(600);
  s0=await st();
  ok('chapter 22, verse 3', s0[1]==='Go to Revelation 22:3', s0);
  await pg.screenshot({path:__E.SCRATCH+'wheels_rev.png'});
  await pg.click('.whgo'); await sleep(900);
  ok('Go lands on Revelation 22:3', await pg.evaluate(()=>$('#sheet').hidden && currentChapter(R.pos).t==='Revelation 22' && R.words[R.pos]==='3'), await pg.evaluate(()=>[currentChapter(R.pos).t, R.words.slice(R.pos,R.pos+4).join(' ')]));
  // a touch flick on a wheel coasts with momentum (Mick, Nov 24: "drag and flick to scroll the wheels quickly")
  await pg.evaluate(()=>setChrome(true)); await pg.click('#rToc'); await sleep(900);
  { /* Safari applies touch-action from containers too: nothing around the wheels may say "none" (that smothered the flick) */
    const blocked=await pg.evaluate(()=>{ const out=[]; for(let e=$('.whc'); e; e=e.parentElement){ const t=getComputedStyle(e).touchAction; if(t==='none'||t==='pinch-zoom'||t==='manipulation'&&false) out.push((e.id||e.className)+':'+t); } return out; });
    ok('no "don\'t scroll" around the wheels (iPhone flick)', !blocked.length, blocked);
    const cdp=await ctx.newCDPSession(pg);
    const r=await pg.evaluate(()=>{ const c=document.querySelectorAll('.whc')[0], b=c.getBoundingClientRect(); return {x:b.left+b.width/2, y:b.top+b.height/2+60, top:c.scrollTop}; });
    const tp=(type,y)=>cdp.send('Input.dispatchTouchEvent',{type, touchPoints: type==='touchEnd'?[]:[{x:Math.round(r.x),y:Math.round(y)}]});
    const dir= r.top>400? 1 : -1;
    await tp('touchStart', r.y); for(let k=1;k<=8;k++){ await tp('touchMove', r.y+dir*k*18); await sleep(8); } await tp('touchEnd'); await sleep(1200);
    const after=await pg.evaluate(()=>document.querySelectorAll('.whc')[0].scrollTop);
    ok('a finger drag on the book wheel turns it', Math.abs(after-r.top)>=80, [r.top, after]);
    ok('it settles on a book in the band', after%40===0, after); }
  await pg.evaluate(()=>closeSheet()); await sleep(450);
  // drag the thin line on the left to run through the books
  await pg.evaluate(()=>setChrome(true)); await pg.click('#rToc'); await sleep(900);
  { const m=await pg.evaluate(()=>{ const b=$('.whmap').getBoundingClientRect(); return {x:b.left+20, top:b.top, h:b.height}; });
    await pg.mouse.move(m.x, m.top+20); await pg.mouse.down(); await sleep(60);
    const first=await pg.evaluate(()=>$('.whc .whi.on').textContent);
    await pg.mouse.move(m.x, m.top+m.h*0.55, {steps:6}); await sleep(80);
    const mid=await pg.evaluate(()=>$('.whc .whi.on').textContent);
    await pg.mouse.move(m.x, m.top+m.h-16, {steps:6}); await sleep(80);
    const last=await pg.evaluate(()=>$('.whc .whi.on').textContent);
    await pg.mouse.up(); await sleep(500);
    ok('dragging the left line runs the book wheel through the Bible', /Holy Bible|Genesis|Old Testament/.test(first) && mid!==first && last==='Revelation', [first, mid, last]);
    ok('wheels fill in after letting go (at your place, which is in Revelation)', /^Go to Revelation \d+:\d+$/.test((await st())[1]) && (await st())[0]===3, (await st())[1]); }
  await pg.evaluate(()=>closeSheet()); await sleep(450);
  // tapping a wheel item scrolls it to the band
  await pg.evaluate(()=>setChrome(true)); await pg.click('#rToc'); await sleep(900);
  await pg.evaluate(()=>{ const c=document.querySelectorAll('.whc')[1]; c.querySelector('.whi[data-x="19"]').click(); }); await sleep(900);
  ok('tap an item to pick it', (await st())[1]==='Go to Revelation 20:1', (await st())[1]);
  // bead card still works
  await pg.evaluate(()=>{ const c=document.querySelectorAll('.whc')[0]; c.scrollTop=0; }); await sleep(500);
  await pg.click('.sp-bead'); await sleep(250);
  ok('bead shows its highlight', await pg.evaluate(()=>!$('.sp-card').hidden && $('.sp-card').textContent.includes('a note')));
  await pg.click('.sp-card'); await sleep(200);
  // typed references
  await pg.evaluate(()=>setChrome(true)); await pg.click('#rToc'); await sleep(800);
  for(const [q,want] of [['jn 3:16','John 3:16'],['rev 22 3','Revelation 22:3'],['1 cor 13','1 Corinthians 13'],['ps 23','Psalm 23'],['jude','Jude'],['gen 1:1','Genesis 1:1']]){
    await pg.fill('#tocQ',q); await sleep(450);
    const r=await pg.evaluate(()=>{ const x=$('#tocOut .refgo'); return x? x.querySelector('.grow').textContent : null; });
    ok(`typed "${q}" offers ${want}`, r==='Go to '+want, r);
  }
  await pg.fill('#tocQ','jn 3:16'); await sleep(450); await pg.click('#tocOut .refgo'); await sleep(900);
  ok('typed reference goes there', await pg.evaluate(()=>currentChapter(R.pos).t==='John 3' && R.words[R.pos]==='16'));
  await pg.evaluate(()=>setChrome(true)); await pg.click('#rToc'); await sleep(700);
  await pg.fill('#tocQ',''); await sleep(500);
  ok('clearing search brings the wheels back', await pg.evaluate(()=>document.querySelectorAll('.whc').length===3));
  // Notes tab is the list
  await pg.click('#sheet [data-act=tab][data-t=hls]'); await sleep(300);
  ok('Notes tab still the list', await pg.evaluate(()=>!$('#spine') && document.querySelectorAll('#tocOut .hlrow').length===1));
  // a plain novel: Chapter | Page
  await pg.evaluate(()=>{ closeSheet(); closeReader(); }); await pg.evaluate(()=>openDoc('shelf-gatsby')); await sleep(900);
  await pg.evaluate(()=>setChrome(true)); await pg.click('#rToc'); await sleep(900);
  ok('novel: two wheels, chapter and page', await pg.evaluate(()=>document.querySelectorAll('.whc').length===2 && /^Page /.test($('.whc:nth-of-type(2) .whi.on, .whc + .whc .whi.on').textContent)));
  await pg.evaluate(()=>{ const c=document.querySelectorAll('.whc')[0]; const x=[...c.querySelectorAll('.whi')].findIndex(e=>e.textContent==='VI'); c.scrollTop=x*40; }); await sleep(600);
  await pg.evaluate(()=>{ const c=document.querySelectorAll('.whc')[1]; c.scrollTop=5*40; }); await sleep(600);
  const g=await st(); ok('Go names the chapter, page underneath', g[1]==='Go to VI' && /^Page \d/.test(await pg.evaluate(()=>$('.whgo .wg-s').textContent)), g);
  await pg.click('.whgo'); await sleep(900);
  ok('lands inside VI', await pg.evaluate(()=>currentChapter(R.pos).t==='VI'));
  // filter zooms in
  await pg.evaluate(()=>setChrome(true)); await pg.click('#rToc'); await sleep(700);
  await pg.selectOption('#tocScope','10'); await sleep(700);
  ok('filter limits the wheels to one chapter', await pg.evaluate(()=>{ const t=[...document.querySelectorAll('.whc')[0].querySelectorAll('.whi')].map(x=>x.textContent); return t.length>=1 && t[0]===R.meta.chapters[10].t || /^Page/.test(t[0]); }));
  // a book under a wrapper heading with numbered chapters (Mick, Nov 24: Imitation of Christ hard to read)
  const wst=()=>pg.evaluate(()=>[[...document.querySelectorAll('.whc')].map(c=>(c.querySelector('.whi.on')||{}).textContent), $('.whgo .wg-t').textContent, $('.whgo .wg-s').textContent]);
  await pg.evaluate(()=>{ closeSheet(); closeReader(); }); await pg.evaluate(()=>openDoc('shelf-imitation')); await sleep(1500);
  await pg.evaluate(()=>{ const c=R.meta.chapters.find(c=>c.t==='I'); goTo(c.i+30,true); }); await sleep(500);
  await pg.evaluate(()=>setChrome(true)); await pg.click('#rToc'); await sleep(1000);
  let w=await wst();
  ok('Imitation: wrapper skipped, two short wheels Book I | I', w[0].join('|')==='Book I|I', w[0]);
  ok('Imitation: Go gives the chapter’s real title', /^Go to I\. Of the imitation of Christ/.test(w[1]) && /^Book I · Page/.test(w[2]), w.slice(1));
  // dragging the left line moves every wheel and Go follows the exact page (Mick, Nov 24)
  { const m=await pg.evaluate(()=>{ const b=$('.whmap').getBoundingClientRect(); return {x:b.left+20, top:b.top, h:b.height}; });
    const seen=new Set(); await pg.mouse.move(m.x, m.top+m.h*0.3); await pg.mouse.down();
    for(let f=0.3; f<=0.62; f+=0.02){ await pg.mouse.move(m.x, m.top+m.h*f); await sleep(25); seen.add((await wst())[2]); }
    const w1=await wst(); const want=await pg.evaluate(()=>+$('.whgo').dataset.i);
    await pg.mouse.up(); await sleep(300);
    const book=w1[0][0], chap=w1[0][1];
    ok('line drag moves the chapter wheel too, not just the first', /^Book I/.test(book) && chap && chap!=='I', w1[0]);
    ok('Go follows the exact page under the thumb', seen.size>8 && /Page \d/.test(w1[2]), [seen.size, w1[2]]);
    const chk=await pg.evaluate(()=>{ const c=document.querySelectorAll('.whc')[1], e=c.querySelector('.whi.on'); return e&&e.textContent; });
    await pg.click('.whgo'); await sleep(900);
    ok('Go lands on that page, inside the chosen chapter', await pg.evaluate(([w,c])=>Math.abs(R.pos-w)<400 && currentChapter(R.pos).t===c, [want, chk]), await pg.evaluate(()=>[R.pos, currentChapter(R.pos).t]));
    await pg.evaluate(()=>setChrome(true)); await pg.click('#rToc'); await sleep(1000); }
  ok('front matter sits on the first wheel', await pg.evaluate(()=>[...document.querySelectorAll('.whc')[0].querySelectorAll('.whi')].some(x=>x.textContent==='Preface') && ![...document.querySelectorAll('.whc')[0].querySelectorAll('.whi')].some(x=>x.textContent==='The Imitation of Christ')));
  await pg.screenshot({path:__E.SCRATCH+'wheels_imitation.png'});
  await pg.evaluate(()=>{ closeSheet(); closeReader(); }); await pg.evaluate(()=>openDoc('shelf-miserables')); await sleep(1800);
  await pg.evaluate(()=>{ const c=R.meta.chapters.find(c=>c.t==='I: M. Myriel'); goTo(c.i+30,true); }); await sleep(500);
  await pg.evaluate(()=>setChrome(true)); await pg.click('#rToc'); await sleep(1000);
  w=await wst();
  ok('Les Misérables: Volume | Book | Chapter with short names', w[0].join('|')==='Volume I|Book I|I' && w[1]==='Go to I: M. Myriel' && w[2].startsWith('Volume I · Book I'), w);
  ok('no page errors', !errs.length, errs);
  console.log(fails?'FAIL '+fails:'ALL PASS'); await b.close();
})();
