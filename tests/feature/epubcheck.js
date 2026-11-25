/* ePub feature check: imports epubcheck3.epub (EPUB 3 nav), epubcheck2.epub (EPUB 2 NCX) and epubcheck_edge.epub
   (made by mk_epubcheck.py) and checks text, structure, contents, links and pictures, then opens each in Pages and Scroll. */
const __E=require('../env');
const { chromium } = require('playwright'); const fs=require('fs');
const PORT=process.env.TOOZ_PORT||8750;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let fails=0; const ok=(name,c,extra)=>{ if(!c) fails++; console.log((c?'PASS ':'FAIL ')+name+(c?'':'  '+JSON.stringify(extra))); };
(async()=>{
  const b=await chromium.launch({});
  const ctx=await b.newContext({viewport:{width:390,height:780}, serviceWorkers:'block', hasTouch:true, isMobile:true}); await ctx.addInitScript(()=>{window.__toozKeepSample=true});
  await ctx.route(/cdnjs/,r=>r.fulfill({path:__E.NM+'jszip/dist/jszip.min.js',contentType:'application/javascript'}));
  const pg=await ctx.newPage(); const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('http://localhost:'+PORT+'/'); await sleep(1200);
  const load=(f)=>pg.evaluate(async(b64)=>{
    const bin=Uint8Array.from(atob(b64),c=>c.charCodeAt(0)); const d=await parseFile(new File([bin],'x.epub'));
    const txt=(s,e)=>d.words.slice(s,e).join(' ');
    const blk=(re)=>d.blocks.filter(x=>re.test(txt(x.s,x.e)));
    return { title:d.title, chapters:d.chapters, text:d.words.join(' '), n:d.words.length,
      blocks:d.blocks.map(x=>({t:x.t,q:!!x.q,d:x.d||0,o:!!x.o,v:!!x.v,s:txt(x.s,x.e)})), notes:d.notes.map(([a,t])=>({w:d.words[a],at:txt(t,t+4)})),
      imgs:(d.images&&d.images.at||[]).map(a=>({i:a.i,alt:a.alt})), nfiles:d.images?d.images.files.length:0, font:d.font&&d.font.family,
      wordAt:(i)=>0 };
  }, fs.readFileSync(__E.FEAT+f).toString('base64'));
  const open=async(f,mode)=>{ await pg.evaluate(async([b64,mode])=>{ const bin=Uint8Array.from(atob(b64),c=>c.charCodeAt(0)); const d=await parseFile(new File([bin],'x.epub')); const m=await addDoc(d); S.mode=mode; saveSettings(); await openDoc(m.id); }, [fs.readFileSync(__E.FEAT+f).toString('base64'),mode]); await sleep(700);
    return pg.evaluate(()=>({figs:document.querySelectorAll('#v-reader figure img').length, words:[...Array(20).keys()].filter(i=>wordEl(i)).length})); };
  const has=(blocks,t,s)=>blocks.some(x=>x.t===t && x.s.includes(s));

  for(const [f,label] of [['epubcheck3.epub','EPUB3 nav'],['epubcheck2.epub','EPUB2 NCX']]){
    const d=await load(f); const T=d.text;
    ok(label+': title read', /^EpubCheck/.test(d.title), d.title);
    const names=d.chapters.map(c=>c.t);
    ok(label+': contents has nested levels', d.chapters.some(c=>c.d===0)&&d.chapters.some(c=>c.d===1)&&d.chapters.some(c=>c.d===2), d.chapters);
    const mid=d.chapters.find(c=>c.t==='Midpoint of one');
    ok(label+': contents entry that points mid-file lands on that paragraph', mid && d.text.split(' ').slice(mid.i,mid.i+2).join(' ')==='Marker paragraph', mid);
    ok(label+': contents lists the image-only chapter', names.includes('Image only'), names);
    ok(label+': headings h1-h6 kept', ['h1','h2','h3','h4','h5','h6'].every(t=>d.blocks.some(x=>x.t===t)), d.blocks.map(x=>x.t));
    ok(label+': lists (unordered, ordered, nested) keep every item', ['Unordered one','Nested unordered inner','Ordered first','Nested ordered inner'].every(s=>has(d.blocks,'li',s)));
    ok(label+': table text kept (caption and every cell)', ['Table caption zulu','Head A','Cell B1','Cell A2'].every(s=>T.includes(s)));
    ok(label+': blockquote kept as quote', d.blocks.some(x=>x.q&&x.s.includes('Blockquote charlie')));
    ok(label+': poetry lines kept in order', /Poem line one Poem line two Poem indented three Poem line four/.test(d.blocks.map(x=>x.s).join(' ')));
    ok(label+': pre block kept line by line', has(d.blocks,'pre','pre line two indented'));
    ok(label+': sub/sup, code, ruby base text, rtl and lang text kept', ['H 2 O','mc 2','code_sample()','漢字','مرحبا بالعالم','Bonjour le monde'].every(s=>T.includes(s)), T.slice(0,200));
    ok(label+': small caps and drop caps read as plain words', T.includes('Small Caps Words') && T.includes('Then a span drop cap') && T.includes('Dropcapped paragraph'));
    ok(label+': MathML is read as text in the sentence (x = 2)', T.includes('Math before x = 2 math after'), T.match(/Math before.{0,30}/));
    ok(label+': ordered lists keep their numbers (start, a/A, i/I, nested)', ['1. Ordered first','2. Ordered second','1. Nested ordered inner','3. Starts at three','4. Four with bullets','a. Lettered first','b. Lettered second','I. Roman one','II. Roman two'].every(s=>d.blocks.some(x=>x.t==='li'&&x.s.startsWith(s))), d.blocks.filter(x=>x.t==='li').map(x=>x.s));
    ok(label+': list nesting levels, bullets only on unordered', (()=>{ const g=s=>d.blocks.find(x=>x.s.includes(s)); return g('Nested unordered inner').d===1 && !g('Nested unordered inner').o && g('Unordered one').d===0 && g('Nested ordered inner').d===1 && g('Nested ordered inner').o && g('Bullet under four').d===1 && !g('Bullet under four').o && g('Ordered first').o; })());
    ok(label+': poetry indent levels (class i1 and margin-left style) and no first-line indent', (()=>{ const g=s=>d.blocks.find(x=>x.s.includes(s)); return g('Poem line one').d===0 && g('Poem indented three').d===1 && g('Poem styled five').d===2 && g('Poem line one').v && g('Poem styled five').v && !g('Plain paragraph after').v && !g('Plain paragraph after').d; })(), d.blocks.filter(x=>/Poem|Plain para/.test(x.s)));
    ok(label+': page-break markers add no stray words (fixed)', T.includes('Text break eight continues and nine too') && T.includes('Page seven continues'), T.match(/Text break.{0,40}/));
    ok(label+': footnote and endnote links resolve', d.notes.length===2 && /Footnote one body/.test(d.notes[0].at) && /Endnote two body/.test(d.notes[1].at), d.notes);
    ok(label+': back-link arrow is not read as a word (fixed)', !T.includes('↩') && T.includes('Footnote one body.'));
    ok(label+': pictures (png, jpg, svg file, inline svg, figure, cover, image-only chapter)', d.imgs.length===7 && d.nfiles===4 && d.imgs.some(a=>a.alt==='Cover'&&a.i===0) && d.imgs.some(a=>a.alt==='fig pic') && d.imgs.some(a=>a.alt==='only image'), d.imgs);
    ok(label+': figcaption kept', has(d.blocks,'cap','Figure caption yankee'));
    ok(label+': embedded font found', d.font==='BookFace', d.font);
    ok(label+': non-linear item is read at its place in the spine', T.includes('Appendix words NONLINEAR'));
    ok(label+': internal chapter links do not leave stray text', T.includes('See the table in chapter two and chapter two links.'));
  }
  const e=await load('epubcheck_edge.epub'); const T=e.text;
  ok('edge: files with spaces / %20 names import', T.includes('Second chapter words SECOND') && T.includes('Entity text here'), T.slice(0,80));
  ok('edge: entities (&nbsp; &mdash; &copy;) come out as characters', T.includes('here — with a dash © sign'));
  ok('edge: soft hyphens are removed from words (fixed)', T.includes('extraordinary') && !T.includes('­'));
  ok('edge: contents entry with a percent-encoded id lands on its heading (fixed)', (()=>{ const c=e.chapters.find(c=>c.t==='Unicode heading'); return c && T.split(' ').slice(c.i,c.i+2).join(' ')==='Unicode id'; })(), e.chapters);
  ok('edge: nav group heading without a link is kept, ahead of its entries (fixed)', (()=>{ const g=e.chapters.findIndex(c=>c.t==='Group heading'); return g>=0 && e.chapters[g+1].t==='One' && e.chapters[g].i===e.chapters[g+1].i && e.chapters[g].d===0 && e.chapters[g+1].d===1; })(), e.chapters);
  ok('edge: line break inside a title stays one title (fixed)', has(e.blocks,'h1','Part Break Title') && !e.blocks.some(x=>x.s==='Part'), e.blocks.map(x=>x.s));
  ok('edge: a last chapter that is only a picture keeps its contents entry (fixed)', e.chapters.some(c=>c.t==='Last picture') && e.imgs.some(a=>a.alt==='last pic'), e.chapters);
  ok('edge: nav in another folder with %20 paths resolves', e.chapters.find(c=>c.t==='Two') && e.chapters.find(c=>c.t==='Two').i>0);

  for(const f of ['epubcheck3.epub','epubcheck2.epub','epubcheck_edge.epub']) for(const mode of ['pages','scroll']){
    const r=await open(f,mode);
    ok(`${f} opens in ${mode} (words drawn, pictures shown)`, r.words>0 && r.figs>0, r);
  }
  ok('no page errors', errs.length===0, errs);
  console.log(fails?('FAILED '+fails):'ALL PASS'); await b.close(); process.exit(fails?1:0);
})();
