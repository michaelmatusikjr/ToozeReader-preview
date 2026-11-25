// Mick, Nov 25: an ESV Reference Bible EPUB he added said it "didn't have" passages a book linked to. Commercial
// Bibles list only the books in their contents and mark chapters/verses with styled numbers, not superscripts.
// Three made-up Bibles built the ways real ones are; each must find Genesis 2:2, John 3:16 and 1 Corinthians 13:4–5.
const __E=require('../env');
const { chromium } = require('playwright');
const JSZip=require(__E.NM+'jszip');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let fails=0; const ok=(n,c,x)=>{ console.log((c?'PASS ':'FAIL ')+n+(x!==undefined?' '+JSON.stringify(x):'')); if(!c) fails++; };

const VERSES={ // book -> chapter -> verse texts (verse 1 first)
  Genesis:{1:['In the beginning, God created the heavens and the earth.','The earth was without form and void.','And God said, “Let there be light,” and there was light.'],
           2:['Thus the heavens and the earth were finished.','And on the seventh day God finished his work that he had done.','So God blessed the seventh day and made it holy.']},
  John:{1:['In the beginning was the Word.','He was in the beginning with God.'],
        3:['Now there was a man of the Pharisees named Nicodemus.','This man came to Jesus by night.','Jesus answered him, “Truly, truly.”','Nicodemus said to him, “How can a man be born?”','Jesus answered, “Unless one is born of water.”','That which is born of the flesh is flesh.','Do not marvel that I said to you.','The wind blows where it wishes.','Nicodemus said to him, “How can these things be?”','Jesus answered him, “Are you the teacher of Israel?”','Truly, truly, I say to you, we speak of what we know.','If I have told you earthly things.','No one has ascended into heaven.','And as Moses lifted up the serpent.','That whoever believes in him may have eternal life.','For God so loved the world, that he gave his only Son.','For God did not send his Son into the world to condemn the world.']},
  '1 Corinthians':{13:['If I speak in the tongues of men and of angels.','And if I have prophetic powers.','If I give away all I have.','Love is patient and kind; love does not envy or boast.','or rude. It does not insist on its own way.','it does not rejoice at wrongdoing.']}
};
const CHS={Genesis:[1,2], John:[1,2,3], '1 Corinthians':[1,2,3,4,5,6,7,8,9,10,11,12,13]};
for(const b in CHS) for(const c of CHS[b]) if(!VERSES[b][c]) VERSES[b][c]=['First','Second','Third','Fourth'].map(n=>`${n} filler verse of this chapter.`);
const fid=b=>b.replace(/\s/g,'').toLowerCase();

// style A: Crossway-like — "2:1" bold chapter markers, bold verse numbers with a no-break space, cross-reference letters
function styleA(book){ let h=`<h1>${book}</h1><h2>A Section Heading</h2>`;
  for(const c of CHS[book]){ const vs=VERSES[book][c]; h+=`<p><b class="chapter-num" id="c${c}">${c}:1&#160;</b>${vs[0]}<sup class="crossref"><a href="#cr-${fid(book)}-${c}">a</a></sup>`;
    vs.slice(1).forEach((v,k)=>{ h+=` <b class="verse-num">${k+2}&#160;</b>${v}`; if(k===1) h+='</p><p>'; }); h+='</p>'; }
  return h+`<div class="crossrefs">${CHS[book].map(c=>`<p id="cr-${fid(book)}-${c}"><a href="#c${c}">a</a> ${c}:1 Job 38:4–7; Gen. 2:2; John 1:1–3; 3:16; 1 Cor. 13:4 b ${c}:2 Ps. 33:6</p>`).join('')}</div>`; }
// style S: like A but with real superscript verse numbers (the app then treats it as a Bible proper)
function styleS(book){ return styleA(book).replace(/<b class="verse-num">(\d+)&#160;<\/b>/g,'<sup class="v">$1</sup>&#160;'); }
// style E (Mick's screenshot, Nov 25): verse numbers and cross-reference letters raised only by the stylesheet, verse
// numbers stuck to the next word ("17And"), cross references in their own file at the end
const E_CSS='.vn{font-weight:bold;font-size:.7em;vertical-align:super} a.cf{font-size:.7em;vertical-align:super;color:#888} .cn{font-weight:bold;font-size:2em}';
let XR='';
function styleE(book){ let h=`<h1>${book}</h1>`;
  for(const c of CHS[book]){ const vs=VERSES[book][c]; const id=`${fid(book)}-${c}`;
    h+=`<h2>Heading ${c}</h2><p><span class="cn">${c}</span> <a class="cf" href="crossrefs.xhtml#x-${id}">h</a>${vs[0]}`;
    vs.slice(1).forEach((v,k)=>{ h+=` <span class="vn">${k+2}</span>${v}`; if(k===1) h+='</p><p>'; }); h+='</p>';
    XR+=`<p id="x-${id}"><a class="cf" href="${fid(book)}.xhtml">h</a> ${c}:1 Job 38:4–7; John 3:16; 1 Cor. 13:4–5</p>`; }
  return h; }
// style R (built like Mick's real Crossway ESV, checked against his file Nov 25): each book opens with a grid of chapter
// numbers; a chapter's first paragraph starts with its section title, the book name and chapter number, all bold;
// verse 1 unnumbered; verse numbers and cross-reference letters raised by the stylesheet; every cross-reference
// entry is a span (several per paragraph), all stored at the very end of the Bible
const R_CSS='span.verse-num{font-weight:bold;font-size:75%;vertical-align:super} span.crossref{font-size:75%;vertical-align:super;font-style:italic} b{font-weight:bold}';
let XRR='';
function styleR(book){ let h=`<h1>${book}</h1><p>${CHS[book].join(' ')}</p>`;
  if(book==='Genesis') h=`<h1>Preferences</h1><p id="crossrefs-pref">Display cross-references: [<span class="crossrefs-show"><a href="#crossrefs-pref" onclick="crossrefs.show(true); return false;">Yes</a></span>] [<span class="crossrefs-hide"><a href="#crossrefs-pref" onclick="crossrefs.hide(true); return false;">No</a></span>]</p><p id="woc-pref">Words of Christ: [<span><a href="#woc-pref" onclick="redletter.show(true); return false;">Red</a></span>] [<span><a href="#woc-pref" onclick="redletter.hide(true); return false;">Black</a></span>]</p>`+h;
  for(const c of CHS[book]){ const vs=VERSES[book][c]; const id=`${fid(book)}-${c}`;
    h+=`<p class="normal"><b>Heading ${c}</b> <b>${book.toUpperCase()}</b> <b>${c}</b> <span class="crossref"><a class="pop-link" href="crossrefs.xhtml#rr-${id}.a">a</a></span>${vs[0]} <span class="crossref"><a class="pop-link" href="crossrefs.xhtml#rr-${id}.b">b</a></span>`;
    vs.slice(1).forEach((v,k)=>{ h+=` <span class="verse-num"><a class="pop-link">${k+2}</a></span>${k+2===16&&book==='John'?'<span class="woc">'+v+'</span>':v}`; if(k===1) h+='</p><p class="normal">'; }); h+='</p>';
    XRR+=`<p class="crossref"><span id="rr-${id}.a"><a href="${fid(book)}.xhtml">${c}:1</a> <a href="${fid(book)}.xhtml">a</a> <a href="x">ver. 2</a>; [ch. <a href="x">3:16</a>; Rev. 1:4, 8; 1 Cor. 13:4–5]</span> <span id="rr-${id}.b"><a href="${fid(book)}.xhtml">${c}:1</a> b Gen. 1:1</span></p>`; }
  return h; }
// style B: big drop-cap chapter number, no verse 1, verse numbers in plain spans stuck to the next word
function styleB(book){ let h=`<h1>${book}</h1>`;
  for(const c of CHS[book]){ const vs=VERSES[book][c]; h+=`<h3>Heading ${c}</h3><p><span class="chapter-num">${c}</span> ${vs[0]}`;
    vs.slice(1).forEach((v,k)=>{ h+=` <span class="vn">${k+2}</span>${v}`; if(k===2) h+='</p><p>'; }); h+='</p>'; }
  return h; }
// style C: contents lists "Chapter N" under each book; verse 1 unnumbered; verse numbers in spans with a space
function styleC(book){ let h=`<h1>${book}</h1>`;
  for(const c of CHS[book]){ const vs=VERSES[book][c]; h+=`<h2 id="ch${c}">Chapter ${c}</h2><p>${vs[0]}`;
    vs.slice(1).forEach((v,k)=>{ h+=` <span class="v">${k+2}</span> ${v}`; }); h+='</p>'; }
  return h; }

let s2;
async function epub(title, style, chapterNav, extra){
  const z=new JSZip(); z.file('mimetype','application/epub+zip');
  z.file('META-INF/container.xml','<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>');
  const books=Object.keys(CHS); let man='<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>', spine='';
  for(const b of books){ man+=`<item id="${fid(b)}" href="${fid(b)}.xhtml" media-type="application/xhtml+xml"/>`; spine+=`<itemref idref="${fid(b)}"/>`;
    z.file(`OEBPS/${fid(b)}.xhtml`,`<?xml version="1.0" encoding="utf-8"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>${b}</title>${extra?'<link rel="stylesheet" href="esv.css"/>':''}</head><body>${style(b)}</body></html>`); }
  const li=b=>`<li><a href="${fid(b)}.xhtml">${b}</a>${chapterNav?'<ol>'+CHS[b].map(c=>`<li><a href="${fid(b)}.xhtml#ch${c}">Chapter ${c}</a></li>`).join('')+'</ol>':''}</li>`;
  z.file('OEBPS/nav.xhtml',`<?xml version="1.0"?><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><body><nav epub:type="toc"><ol><li><a href="${fid('Genesis')}.xhtml">Old Testament</a><ol>${li('Genesis')}</ol></li><li><a href="${fid('John')}.xhtml">New Testament</a><ol>${li('John')}${li('1 Corinthians')}</ol></li></ol></nav></body></html>`);
  if(extra){ man+=`<item id="css" href="esv.css" media-type="text/css"/><item id="xr" href="crossrefs.xhtml" media-type="application/xhtml+xml"/>`; spine+='<itemref idref="xr"/>';
    z.file('OEBPS/esv.css', extra.css); z.file('OEBPS/crossrefs.xhtml', `<?xml version="1.0" encoding="utf-8"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>Cross References</title><link rel="stylesheet" href="esv.css"/></head><body><h1>Cross References</h1>${extra.xr}</body></html>`);
    s2=1; }
  z.file('OEBPS/content.opf',`<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>${title}</dc:title><dc:language>en</dc:language><dc:identifier id="id">${fid(title)}</dc:identifier></metadata><manifest>${man}</manifest><spine>${spine}</spine></package>`);
  return [...await z.generateAsync({type:'uint8array'})];
}

(async()=>{
  const b=await chromium.launch({});
  const ctx=await b.newContext({viewport:{width:390,height:780}, serviceWorkers:'block', hasTouch:true, isMobile:true, deviceScaleFactor:1});
  await ctx.route(/cdnjs/,r=>r.fulfill({path:__E.NM+'jszip/dist/jszip.min.js',contentType:'application/javascript'}));
  await ctx.route(/fonts\.(googleapis|gstatic)/,r=>r.abort());
  const pg=await ctx.newPage(); const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('http://localhost:8750/'); await sleep(1200);
  const cases=[['ESV Bible R', styleR, false, 'R'], ['ESV Bible', styleE, false, true], ['ESV Reference Bible', styleA, false], ['ESV Sup Bible', styleS, false], ['English Standard Version', styleB, false], ['The Holy Bible C', styleC, true]];
  for(const [title, style, nav, ex] of cases){
    if(ex===true){ XR=''; for(const b in CHS) styleE(b); }
    if(ex==='R'){ XRR=''; for(const b in CHS) styleR(b); }
    const bytes=await epub(title, style, nav, ex==='R'? {css:R_CSS, xr:XRR} : ex? {css:E_CSS, xr:XR} : null);
    const res=await pg.evaluate(async({bytes,title})=>{
      const d=await parseFile(new File([new Uint8Array(bytes)], title+'.epub')); const m=await addDoc(d); m.lastRead=Date.now()+1e6;
      const pick=pickBible(); const t=await Store.get('texts',m.id); R.bible=null; R.bibleCache=null;
      const peek=r=>{ const a=findVerses(m,t,r); if(!a||a.s<0) return a? 'chapter only' : null; return versesHTML(t,a.s,a.e,a.vs).replace(/<[^>]+>/g,'|'); };
      return { picked: pick&&pick.id===m.id, abbr: bibleAbbr(m),
        gen: peek({book:'Genesis',ord:'',c:2,v:2,x:0,y:0}),
        jn: peek({book:'John',ord:'',c:3,v:16,x:0,y:0}),
        cor: peek({book:'Corinthians',ord:'1',c:13,v:4,x:5,y:0}),
        gen1: peek({book:'Genesis',ord:'',c:1,v:1,x:0,y:0}),
        miss: peek({book:'John',ord:'',c:21,v:1,x:0,y:0}) };
    }, {bytes, title});
    ok(title+': chosen as the Bible', res.picked);
    ok(title+': Genesis 2:2', res.gen && res.gen.includes('seventh day God finished') && !res.gen.includes('So God blessed'), res.gen);
    ok(title+': John 3:16', res.jn && res.jn.includes('For God so loved') && !res.jn.includes('did not send'), res.jn);
    ok(title+': 1 Corinthians 13:4–5', res.cor && res.cor.includes('Love is patient') && res.cor.includes('insist on its own') && !res.cor.includes('rejoice at'), res.cor);
    ok(title+': Genesis 1:1 (the first verse, often unnumbered)', res.gen1 && res.gen1.includes('In the beginning, God created') && !res.gen1.includes('without form'), res.gen1);
    ok(title+': a chapter it doesn’t have is still "not in this Bible"', res.miss===null, res.miss);
    await pg.evaluate(async()=>{ for(const m of LIB.filter(m=>!/^shelf-/.test(m.id))) m.lastRead=0; });
  }
  // cross references (Mick, Nov 25: "can't tap the references"): the note card's references can be tapped for the verses
  const xr=await pg.evaluate(async()=>{ const m=LIB.find(m=>m.title==='ESV Reference Bible'); m.lastRead=Date.now()+2e6; await openDoc(m.id); await new Promise(r=>setTimeout(r,600));
    const c=R.meta.chapters.find(c=>/Genesis/.test(c.t)); const n=[...R.notes.keys()].filter(i=>i>=c.i).sort((a,b)=>a-b)[0]; openFootnote(n); await new Promise(r=>setTimeout(r,500));
    const bs=[...document.querySelectorAll('#sheet .nref')].map(b=>b.textContent);
    const marked=scanRefs().map(i=>R.words[i]);
    return {bs, marked}; });
  ok('note card: each reference can be tapped', JSON.stringify(xr.bs)===JSON.stringify(['Job 38:4–7','Gen. 2:2','John 1:1–3','3:16','1 Cor. 13:4','Ps. 33:6']), xr.bs);
  ok('the note’s own verse numbers ("b 1:2") aren’t taken for a reference', !xr.marked.includes('1:2'), xr.marked);
  await pg.click('#sheet .nref:nth-of-type(4)'); await sleep(900);
  const pk=await pg.evaluate(()=>({t:$('#sheetTitle')? $('#sheetTitle').textContent : (document.querySelector('#sheet h2,#sheet .sheet-title')||{}).textContent, p:(document.querySelector('#sheet .peek')||{}).textContent}));
  ok('tapping one shows the verses ("3:16" after John means John 3:16)', pk.p && /For God so loved/.test(pk.p), pk);
  await pg.click('#sheet [data-act=ctx]'); await sleep(1200);
  ok('Read it in context goes there in the same Bible', await pg.evaluate(()=>{ const v=findVerses(R.meta,R.text,{book:'John',ord:'',c:3,v:16,x:0,y:0}); return v && Math.abs(R.pos-v.i)<3; }), await pg.evaluate(()=>[R.pos, R.words[R.pos]]));
  // with real superscript verses the cross-reference section is still marked, the verse text is not
  const sup=await pg.evaluate(async()=>{ const m=LIB.find(m=>m.title==='ESV Sup Bible'); await openDoc(m.id); await new Promise(r=>setTimeout(r,600)); R.refFor=null;
    const ix=scanRefs(); return {bible:hasVerses(), words:ix.map(i=>R.words[i]).slice(0,6), inVerse:ix.some(i=>versesIn(blockOf(i).s,blockOf(i).e).length)};
    function blockOf(i){ return R.blocks.find(b=>i>=b.s&&i<b.e); } });
  ok('superscript Bible: treated as a Bible, cross-reference section still tappable', sup.bible && sup.words.includes('Job') && !sup.inVerse, sup);
  // style R: the cross-reference card for John 1:1 "a" shows only that entry, titled with the verse; same-book and
  // same-chapter references and "Rev. 1:4, 8" are tappable; they open John's verses even though the notes sit at the end
  const rr=await pg.evaluate(async()=>{ const m=LIB.find(m=>m.title==='ESV Bible R'); m.lastRead=Date.now()+3e6; await openDoc(m.id); await new Promise(r=>setTimeout(r,600));
    const c=R.meta.chapters.find(c=>c.t==='John'); const n=[...R.notes.keys()].filter(i=>i>=c.i).sort((a,b)=>a-b)[0]; openFootnote(n); await new Promise(r=>setTimeout(r,500));
    return {title:(document.querySelector('#sheet h2')||{}).textContent, card:$('#sheet .quote').innerText, bs:[...document.querySelectorAll('#sheet .nref')].map(b=>b.textContent)}; });
  ok('ESV-like: card shows one entry, titled with the verse', rr.title==='John 1:1' && !/Gen\. 1:1/.test(rr.card), rr);
  ok('ESV-like: "ver. 2", "ch. 3:16", "Rev. 1:4, 8", "1 Cor. 13:4–5" all tappable', JSON.stringify(rr.bs)===JSON.stringify(['ver. 2','ch. 3:16','Rev. 1:4','8','1 Cor. 13:4–5']), rr.bs);
  const tapR=async t=>{ await pg.evaluate(t=>[...document.querySelectorAll('#sheet .nref')].find(b=>b.textContent===t).click(), t); await sleep(800);
    const o=await pg.evaluate(()=>({h:(document.querySelector('#sheet h2')||{}).textContent, p:(document.querySelector('#sheet .peek')||{}).textContent||''})); await pg.evaluate(()=>closeSheet()); return o; };
  const reopen=async()=>{ await sleep(600); await pg.evaluate(async()=>{ const c=R.meta.chapters.find(c=>c.t==='John'); const n=[...R.notes.keys()].filter(i=>i>=c.i).sort((a,b)=>a-b)[0]; openFootnote(n); await new Promise(r=>setTimeout(r,700)); }); };
  let o=await tapR('ver. 2'); ok('ver. 2 → John 1:2', /^John 1:2/.test(o.h) && /He was in the beginning/.test(o.p), o);
  await reopen(); o=await tapR('ch. 3:16'); ok('ch. 3:16 → John 3:16', /^John 3:16/.test(o.h) && /For God so loved/.test(o.p), o);
  await reopen(); o=await tapR('8'); ok('"8" after Rev. 1:4 → Revelation 1:8', /^Revelation 1:8/.test(o.h), o);
  // the book's own Preferences links work (Mick, Nov 25: "the preferences don't work")
  const pf=await pg.evaluate(async()=>{ const c=R.meta.chapters.find(c=>c.t==='Preferences')||{i:0}; await goTo(c.i,true); await new Promise(r=>setTimeout(r,500));
    const pa=[...document.querySelectorAll('#v-reader w.pa')].map(w=>[w.textContent.trim(), R.acts.get(idxOf(w)), w.classList.contains('on'), w.classList.contains('n')]);
    const no=[...document.querySelectorAll('#v-reader w.pa')].find(w=>R.acts.get(idxOf(w))==='crossrefs.hide'); tapBookPref(idxOf(no)); await new Promise(r=>setTimeout(r,400));
    const blk=[...document.querySelectorAll('#v-reader w.pa')].find(w=>R.acts.get(idxOf(w))==='redletter.hide'); tapBookPref(idxOf(blk)); await new Promise(r=>setTimeout(r,600));
    const j=R.meta.chapters.find(c=>c.t==='John'); await goTo(j.i+40,true); await new Promise(r=>setTimeout(r,600));
    const xr=[...document.querySelectorAll('#v-reader w.xr')], woc=[...document.querySelectorAll('#v-reader w.woc')];
    return {pa, bp:R.meta.bp, xrShown:xr.filter(w=>w.offsetParent!==null).length, xrAll:xr.length, wocRed:woc.some(w=>getComputedStyle(w).color!==getComputedStyle(w.parentNode).color), wocAll:woc.length}; });
  ok('preference links are recognised (not notes), with the current choice marked', pf.pa.length===4 && pf.pa.every(p=>!p[3]) && pf.pa.filter(p=>p[2]).map(p=>p[0]).join()==='[Yes],[Red]', pf.pa);
  ok('tapping [No] hides the cross-reference letters, [Black] the red letters, for this book', pf.bp && pf.bp.xr===false && pf.bp.woc===false && pf.xrAll>0 && pf.xrShown===0 && pf.wocAll>0 && !pf.wocRed, pf);
  // a copy added before .14 (no marks or switch list, "No" taken for a note link) is repaired on open
  const old=await pg.evaluate(async()=>{ const m=LIB.find(m=>m.title==='ESV Bible R'); m.bp=null; const t=await Store.get('texts',m.id); delete t.acts; delete t.marks;
    const no=t.words.findIndex(w=>/^\[?No\]?$/.test(w)); t.wf[no]|=F_N; t.notes=(t.notes||[]).concat([[no, no-3]]); await Store.put('texts',t);
    await openDoc(LIB[0].id); await openDoc(m.id); await new Promise(r=>setTimeout(r,400));
    const ok1=R.acts && R.acts.get(no)==='crossrefs.hide' && !R.notes.has(no) && !(R.wf[no]&F_N);
    tapBookPref(no); return {ok1, bp:R.meta.bp, xr:!!(R.mk && R.mk.some(x=>x&2))}; });
  ok('an ESV added with an older version: its switches are found and work without adding it again', old.ok1 && old.bp && old.bp.xr===false && old.xr, old);
  // style E: the letter in the verse is a cross-reference link; its note's references can be tapped
  const ex=await pg.evaluate(async()=>{ const m=LIB.find(m=>m.title==='ESV Bible'); await openDoc(m.id); await new Promise(r=>setTimeout(r,600));
    const k=R.words.findIndex((w,i)=>w==='17'); const raised=k>=0 && !!(R.wf[k]&F_P) && /^For\b/.test(R.words[k+1]||'');
    const c=R.meta.chapters.find(c=>/John/.test(c.t)); const n=[...R.notes.keys()].filter(i=>i>=c.i).sort((a,b)=>a-b)[0];
    const isLetter=n!=null && R.words[n]==='h'; openFootnote(n); await new Promise(r=>setTimeout(r,500));
    return {raised, bible:hasVerses(), isLetter, bs:[...document.querySelectorAll('#sheet .nref')].map(b=>b.textContent)}; });
  ok('stylesheet-raised verse numbers are split off and raised ("17And" → 17 And)', ex.raised, ex);
  ok('…so the ESV counts as a Bible', ex.bible);
  ok('the raised letter "h" is a cross-reference link', ex.isLetter, ex);
  ok('its note lists tappable references', JSON.stringify(ex.bs)===JSON.stringify(['Job 38:4–7','John 3:16','1 Cor. 13:4–5']), ex.bs);
  await pg.click('#sheet .nref:nth-of-type(2)'); await sleep(900);
  ok('tapping John 3:16 shows the verse', await pg.evaluate(()=>/For God so loved/.test((document.querySelector('#sheet .peek')||{}).textContent||'')));
  await pg.evaluate(()=>closeSheet());
  ok('ESV is shown as "ESV"', await pg.evaluate(()=>bibleAbbr({title:'ESV Reference Bible'})==='ESV'));
  // the shelf KJV keeps working the old way
  const kjv=await pg.evaluate(async()=>{ for(const m of LIB) if(!/^shelf-/.test(m.id)) m.lastRead=0; const m=LIB.find(m=>m.id==='shelf-kjv'); if(m.pending){ const ok=await fetchShelfBook(m); if(!ok) return 'no-net'; }
    const t=await Store.get('texts','shelf-kjv'); const a=findVerses(m,t,{book:'John',ord:'',c:3,v:16,x:0,y:0}); return a&&a.s>=0? versesHTML(t,a.s,a.e,a.vs).replace(/<[^>]+>/g,'') : null; });
  if(kjv==='no-net') console.log('SKIP shelf KJV (no network)'); else ok('shelf KJV still finds John 3:16', kjv && /God so loved/.test(kjv), kjv&&kjv.slice(0,60));
  ok('no page errors', !errs.length, errs);
  await b.close(); console.log(fails? fails+' FAILED' : 'ALL PASS'); process.exit(fails?1:0);
})();
