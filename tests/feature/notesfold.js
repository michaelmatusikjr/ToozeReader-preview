const { chromium } = require('playwright');
const PORT=process.env.TOOZ_PORT||8750;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const ok=(n,c,x)=>console.log((c?'PASS ':'FAIL ')+n+(x!==undefined?' '+JSON.stringify(x):''));
(async()=>{
  const b=await chromium.launch({});
  const pg=await (await b.newContext({viewport:{width:393,height:852},serviceWorkers:'block',hasTouch:true,isMobile:true})).newPage();
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('http://localhost:'+PORT+'/'); await sleep(1500);
  /* three books, each with highlights; book 2 has a note */
  await pg.evaluate(async()=>{
    closeSheet();
    for(let k=1;k<=3;k++){
      const id='nf'+k, words=('Alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu nu xi omicron pi rho sigma tau upsilon '+'word '.repeat(60)).trim().split(' ');
      await Store.put('texts',{id, words, ends:[], blocks:[], wf:[]});
      const m={id, title:'Fold Book '+k, author:'', kind:'txt', count:words.length, lastRead:1000-k, added:k, pos:0, chapters:[],
        highlights:[{id:'h'+k+'a', s:0, e:2, c:1, note:'', at:10}, {id:'h'+k+'b', s:5, e:7, c:2, note:k===2?'Remember the quokka':'', at:20}],
        bookmarks:[{i:3,name:'Intro '+k,at:5}]};
      LIB.push(m); touch(m);
    }
    NOTESEG='hl'; NQ=''; showView('words'); renderNotes();
  });
  await sleep(1200);
  const st=()=>pg.evaluate(()=>[...document.querySelectorAll('#notesHl .nfold')].map(x=>({o:x.classList.contains('open'), t:x.querySelector('b').textContent, h:x.querySelector('.nbody').getBoundingClientRect().height, last:(x.querySelector('.nlast')||{}).textContent, small:x.querySelector('.small').textContent})));
  let s=await st();
  ok('three folded rows', s.length===3 && s.every(x=>!x.o && x.h===0), s);
  ok('counts and latest line', /2 highlights/.test(s[0].small) && /1 note/.test(s[1].small) && s[1].last==='Remember the quokka' && s[0].last==='zeta eta theta', s.map(x=>[x.small,x.last]));
  ok('most recently read first', s[0].t==='Fold Book 1' && s[2].t==='Fold Book 3');
  ok('search field shown with 2+ books', await pg.evaluate(()=>!$('#notesQ').hidden));
  await pg.evaluate(()=>document.querySelector('#notesHl .nfold .nsum').click()); await sleep(500);
  s=await st(); ok('tap unfolds', s[0].o && s[0].h>40 && !s[1].o, s.map(x=>[x.o,x.h]));
  ok('Copy/Export inside the unfolded part', await pg.evaluate(()=>!!document.querySelector('#notesHl .nfold.open .nbody [data-copy]') && !!document.querySelector('#notesHl .nfold.open .nbody [data-exp]')));
  await pg.evaluate(()=>document.querySelector('#notesHl .nfold .nsum').click()); await sleep(500);
  s=await st(); ok('tap again folds', !s[0].o && s[0].h===0, s.map(x=>[x.o,x.h]));
  /* search finds a note in a folded book and unfolds it */
  await pg.fill('#notesQ','QUOKKA'); await sleep(600);
  s=await st(); ok('search shows only the matching book, unfolded', s.length===1 && s[0].t==='Fold Book 2' && s[0].o && s[0].h>20, s);
  ok('match is marked, only matching rows shown', await pg.evaluate(()=>document.querySelectorAll('#notesHl .nbody mark').length===1 && document.querySelectorAll('#notesHl .nbody .hlrow').length===1));
  await pg.fill('#notesQ','zzzz'); await sleep(500);
  ok('empty result message', await pg.evaluate(()=>/Nothing matches “zzzz”/.test($('#notesHl').textContent)));
  await pg.fill('#notesQ',''); await sleep(600);
  s=await st(); ok('clearing refolds', s.length===3 && s.every(x=>!x.o && x.h===0), s);
  /* book title match shows the whole book */
  await pg.fill('#notesQ','fold book 3'); await sleep(500);
  s=await st(); ok('title search matches a book', s.length===1 && s[0].t==='Fold Book 3' && s[0].o);
  await pg.fill('#notesQ',''); await sleep(400);
  /* bookmarks segment folds too */
  await pg.evaluate(()=>{ NOTESEG='bm'; renderNotes(); }); await sleep(600);
  ok('bookmarks folded per book', await pg.evaluate(()=>document.querySelectorAll('#notesBm .nfold').length===3 && !document.querySelector('#notesBm .nfold.open')));
  await pg.evaluate(()=>document.querySelector('#notesBm .nfold .nsum').click()); await sleep(500);
  ok('bookmark row visible once unfolded', await pg.evaluate(()=>document.querySelector('#notesBm .nfold.open .swrow').getBoundingClientRect().height>20));
  ok('no page errors', !errs.length, errs); await b.close();
})();
