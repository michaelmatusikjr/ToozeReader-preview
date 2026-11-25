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
  for(const c of CHS[book]){ const vs=VERSES[book][c]; h+=`<p><b class="chapter-num" id="c${c}">${c}:1&#160;</b>${vs[0]}<sup class="crossref"><a href="notes.xhtml#cr${c}">a</a></sup>`;
    vs.slice(1).forEach((v,k)=>{ h+=` <b class="verse-num">${k+2}&#160;</b>${v}`; if(k===1) h+='</p><p>'; }); h+='</p>'; }
  return h+`<div class="footnotes"><p>1:1 Job 38:4–7; Ps. 33:6</p></div>`; }
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

async function epub(title, style, chapterNav){
  const z=new JSZip(); z.file('mimetype','application/epub+zip');
  z.file('META-INF/container.xml','<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>');
  const books=Object.keys(CHS); let man='<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>', spine='';
  for(const b of books){ man+=`<item id="${fid(b)}" href="${fid(b)}.xhtml" media-type="application/xhtml+xml"/>`; spine+=`<itemref idref="${fid(b)}"/>`;
    z.file(`OEBPS/${fid(b)}.xhtml`,`<?xml version="1.0" encoding="utf-8"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>${b}</title></head><body>${style(b)}</body></html>`); }
  const li=b=>`<li><a href="${fid(b)}.xhtml">${b}</a>${chapterNav?'<ol>'+CHS[b].map(c=>`<li><a href="${fid(b)}.xhtml#ch${c}">Chapter ${c}</a></li>`).join('')+'</ol>':''}</li>`;
  z.file('OEBPS/nav.xhtml',`<?xml version="1.0"?><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><body><nav epub:type="toc"><ol><li><a href="${fid('Genesis')}.xhtml">Old Testament</a><ol>${li('Genesis')}</ol></li><li><a href="${fid('John')}.xhtml">New Testament</a><ol>${li('John')}${li('1 Corinthians')}</ol></li></ol></nav></body></html>`);
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
  const cases=[['ESV Reference Bible', styleA, false], ['English Standard Version', styleB, false], ['The Holy Bible C', styleC, true]];
  for(const [title, style, nav] of cases){
    const bytes=await epub(title, style, nav);
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
  ok('ESV is shown as "ESV"', await pg.evaluate(()=>bibleAbbr({title:'ESV Reference Bible'})==='ESV'));
  // the shelf KJV keeps working the old way
  const kjv=await pg.evaluate(async()=>{ for(const m of LIB) if(!/^shelf-/.test(m.id)) m.lastRead=0; const m=LIB.find(m=>m.id==='shelf-kjv'); if(m.pending){ const ok=await fetchShelfBook(m); if(!ok) return 'no-net'; }
    const t=await Store.get('texts','shelf-kjv'); const a=findVerses(m,t,{book:'John',ord:'',c:3,v:16,x:0,y:0}); return a&&a.s>=0? versesHTML(t,a.s,a.e,a.vs).replace(/<[^>]+>/g,'') : null; });
  if(kjv==='no-net') console.log('SKIP shelf KJV (no network)'); else ok('shelf KJV still finds John 3:16', kjv && /God so loved/.test(kjv), kjv&&kjv.slice(0,60));
  ok('no page errors', !errs.length, errs);
  await b.close(); console.log(fails? fails+' FAILED' : 'ALL PASS'); process.exit(fails?1:0);
})();
