
/* ====================================================================
   Reader. One position (R.pos, a word index) is shared by every mode:
   Pages (paginated), Scroll (continuous, optional auto-scroll), Speed (one word at a time).
   ==================================================================== */
const R={ meta:null, text:null, words:[], ends:new Set(), n:0, pos:0, wf:null, blocks:[], notes:new Map(), breaks:new Set(), SEC:[], mode:null,
  playing:false, timer:null, t0:0, runWords:0, lastNav:true, wake:null, lastSave:0, imgUrls:[], imgList:[], imgAt:new Map(), imgBefore:new Map(), imgAfter:new Map(), imgEnd:[],
  bookFamily:null, backPos:null, chrome:true, sIdx:null, lastSearch:'' };
const el={ wl:$('#wl'), wp:$('#wp'), wr:$('#wr'), word:$('#word'), stage:$('#stage'), ctx:$('#context'), scrub:$('#scrub'), pos:$('#posLabel'), left:$('#leftLabel'), play:$('#playBtn') };
const pgView=$('#pagesView'), pgFlow=$('#pgFlow'), scView=$('#scrollView'), scFlow=$('#scFlow');
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));

/* ---------- speed-reading engine (one word at a time) ---------- */
/*@@OLD:885-910@@*/
/*@@OLD:912-1022@@*/
/*@@OLD:1023-1057@@*/
/*@@OLD:1058-1080@@*/
/*@@OLD:1082-1102@@*/
/*@@OLD:1104-1113@@*/
/* speed */
/*@@OLD:1124-1127@@*/

/* after dragging the faded background text in Speed mode, rebuild it around the word under the guide line */
function speedBrowseRebuild(){
  if(!R.spans || R.winA==null) return; const line=$('#scrollLine'); if(!line) return;
  const y=line.getBoundingClientRect().top; let best=null, bd=1e9;
  for(const s of R.spans){ const r=s.getBoundingClientRect(); const d=Math.abs((r.top+r.bottom)/2-y); if(d<bd){ bd=d; best=s; } }
  if(!best) return; const w=+best.dataset.i;
  if(w>R.winA+150 && w<R.winB-150) return;
  const keep=R.pos; R.pos=w; buildScrollText(); R.pos=keep;
  const box=$('#scrollText'); box.querySelectorAll('.cur').forEach(x=>x.classList.remove('cur'));
  const c=(keep>=R.winA&&keep<R.winB)?R.spans[keep-R.winA]:null; if(c){ c.classList.add('cur'); } R.curSpan=c||null;
}
/* adaptive pacing: a little slower on long sentences and long or unusual words, a little faster on easy stretches */
let diffCache={s:-1,e:-1,f:1};
function difficulty(i){
  if(!S.adaptive || i<0 || i>=R.n) return 1;
  if(!(i>=diffCache.s && i<=diffCache.e)){
    const s=sentStart(i), e=sentEndIdx(i); const len=e-s+1;
    let chars=0; for(let k=s;k<=e;k++) chars+=R.words[k].replace(/[^\p{L}\p{N}]/gu,'').length;
    const avg=chars/Math.max(1,len);
    let f=1; if(len>30) f+=0.12; else if(len>20) f+=0.06; else if(len<8) f-=0.05;
    if(avg>5.6) f+=0.08; else if(avg<4.2) f-=0.07;
    diffCache={s,e,f};
  }
  const core=(R.words[i]||'').replace(/[^\p{L}\p{N}]/gu,'');
  let w=0; if(core.length>=12) w=0.2; else if(core.length>=9) w=0.08; else if(core.length<=3) w=-0.05;
  if(/\d/.test(core)) w+=0.1;
  return clamp(diffCache.f+w, 0.82, 1.35);
}

/* ---------- book structure helpers ---------- */
function blockAt(i){ const B=R.blocks; let lo=0, hi=B.length-1; while(lo<=hi){ const m=(lo+hi)>>1; if(B[m].e<=i) lo=m+1; else if(B[m].s>i) hi=m-1; else return m; } return Math.min(Math.max(0,lo),B.length-1); }
function secAt(i){ const A=R.SEC; let lo=0, hi=A.length-1; while(lo<hi){ const m=(lo+hi+1)>>1; if(A[m][0]<=i) lo=m; else hi=m-1; } return lo; }
const MAXSEC=6000, TARGETSEC=3500, MINSEC=800;
function buildSections(){
  const n=R.n, B=R.blocks; const starts=new Set([0]);
  const snap=(i)=>B.length? B[blockAt(i)].s : i;
  for(const s of (R.text.secs||[])) if(s>0&&s<n) starts.add(snap(s));
  for(const c of (R.meta.chapters||[])) if((c.d||0)===0 && c.i>0 && c.i<n) starts.add(snap(c.i));
  const arr=[...starts].sort((a,b)=>a-b); const out=[];
  for(let k=0;k<arr.length;k++){
    let a=arr[k]; const b=k+1<arr.length?arr[k+1]:n; if(b<=a) continue;
    while(b-a>MAXSEC){ const bi=blockAt(a+TARGETSEC); let cut=B[bi].s; if(cut<=a+MINSEC) cut=B[bi].e; if(cut>=b||cut<=a) break; out.push([a,cut]); a=cut; }
    out.push([a,b]);
  }
  R.SEC=out.length?out:[[0,n]];
}
const glued=(k)=>!!(R.wf && (R.wf[k]&F_GLUE));
/* Speed mode and dashes: a dash standing alone joins the word before it; "this—that" shows as "this—" then "that"; both pause like a comma */
const DASH_TOK=/^(?:[—–]+|-{2,})['"”’»)\]]*$/;
const isDashTok=(k)=>DASH_TOK.test(R.words[k]||'');
function dashParts(k){
  const w=R.words[k]; if(!w || !/[^—–-](?:[—–]+|-{2,})[^—–-]/.test(w)) return null;
  const p=w.match(/.*?(?:[—–]+|-{2,})|.+$/g).filter(Boolean);
  if(p.length>1 && /^(?:[—–]+|-{2,})$/.test(p[0])){ p[1]=p[0]+p[1]; p.shift(); }
  return p.length>1? p : null;
}
function speedText(s,e,first){ let t=''; for(let k=s;k<=e&&k<R.n;k++){ if(k>s && !glued(k) && !isDashTok(k)) t+=' '; t+= (k===s&&first!=null)? first : R.words[k]; } return t; }
/* hyphenated words get a little longer on screen */
function hyphenSlow(w){ const n=(w.match(/\p{L}-(?=\p{L})/gu)||[]).length; return n? Math.min(.8, .35+.15*(n-1)) : 0; }
function textOf(s,e){ let t=''; for(let k=s;k<=e&&k<R.n;k++){ if(k>s && !(R.wf && (R.wf[k]&F_GLUE))) t+=' '; t+=R.words[k]; } return t.replace(/(?:[—–]|-{2,})$/,''); }   /* a highlight ends before a trailing dash */

/* ---------- rendering a section as book text ---------- */
function figHTML(idx){ const a=R.imgList[idx]; const src=R.imgUrls[a.f]; if(!src) return ''; return `<figure data-img="${idx}"><img src="${src}" alt="${esc(a.alt||'Illustration')}"></figure>`; }
function wsHTML(w){
  const m=w.match(/^([^\p{L}\p{N}]*)([\p{L}\p{N}][\p{L}\p{N}'’\-]*)([\s\S]*)$/u); if(!m) return esc(w);
  const core=m[2]; const k=core.length<=3?1:core.length<=5?2:Math.ceil(core.length*0.42);
  return esc(m[1])+'<b class="ws">'+esc(core.slice(0,k))+'</b>'+esc(core.slice(k)+m[3]);
}
function blockHTML(blk,s,e,cont){
  const t=blk.t; const tag=/^h[1-6]$/.test(t)?t:'p';
  let cls=(cont?'cont ':'')+(t==='li'?'bli':t==='pre'?'pre':t==='cap'?'cap':''); /* 'bli', not 'li': that class styles the app's menu rows */ if(blk.q) cls+=(cls?' ':'')+'bq'; if(blk.g) cls+=(cls?' ':'')+'gap'; if(blk.l && tag!=='p') cls+=(cls?' ':'')+'hl';
  let h='<'+tag+(cls?' class="'+cls+'"':'')+'>';
  const wf=R.wf, W=R.words, ws=S.wordStart && t!=='pre';
  for(let k=s;k<e;k++){
    const f=wf?(wf[k]|0):0; let c='';
    if(f){ if(f&F_I)c+=' i'; if(f&F_B)c+=' b'; if(f&F_C)c+=' c'; if(f&F_U)c+=' u'; if(f&F_N)c+=' n'; else { if(f&F_P)c+=' p'; if(f&F_S)c+=' s'; } }
    if(R.back && R.back.has(k) && !(f&F_N)) c+=' nb';
    const mk=R.mk? R.mk[k] : 0; if(mk){ if(mk&1)c+=' woc'; if(mk&2)c+=' xr'; if(mk&4)c+=' fnm'; if(mk&8)c+=' vn'; }
    if(R.acts && R.acts.has(k)) c+=' pa'+(prefOn(R.acts.get(k))?' on':'');
    const sp=(k<e-1 && !(wf && (wf[k+1]&F_GLUE)))?' ':'';
    /* a dash at the end of a word sits just outside the word, so a highlight can stop before it */
    const dm=(f&(F_C|F_N|F_P|F_S))?null:/^(.*[^—–\-\s])((?:[—–]|-{2,})["”’)\]]*)$/.exec(W[k]);
    const core=dm?dm[1]:W[k];
    h+=(c?'<w class="'+c.slice(1)+'">':'<w>')+(ws&&!(f&(F_C|F_N|F_P|F_S))?wsHTML(core):esc(core))+(dm?'':sp)+'</w>'+(dm?'<wd'+(c?' class="'+c.slice(1)+'"':'')+'>'+esc(dm[2])+sp+'</wd>':'');
  }
  return h+'</'+tag+'>';
}
/* ---------- Scroll mode: the "previously read" tear (Nov 16) ----------
   When the reader leaves (even briefly) in Scroll mode, the first word of the topmost line in view is saved; the text
   is then drawn torn apart just before it, with "Previously read" in the gap, and the gap is centred on return. */
let SEC_TEAR=false;   /* true while drawing Scroll mode's sections */
function tearEdge(seed, top){
  /* a ragged paper edge: page colour above (top page) or below (bottom page), with a strip of torn fibres along it */
  let x=seed*9301+49297; const rnd=()=>((x=(x*9301+49297)%233280)/233280);
  const N=72, pts=[]; let drift=0;
  for(let k=0;k<=N;k++){ drift+= (rnd()-0.5)*3; drift*=0.85; pts.push([k*400/N, 11+drift+Math.sin(k*0.3+seed)*2.4+(rnd()-0.5)*3.6]); }
  const line=(dy,j)=>pts.map(([px,py],k)=>`${k?'L':'M'}${px.toFixed(1)},${(top? py+dy+(rnd()-0.5)*j : 24-py-dy-(rnd()-0.5)*j).toFixed(1)}`).join(' ');
  const pg= top? `${line(0,0)} L400,0 L0,0 Z` : `${line(0,0)} L400,24 L0,24 Z`;
  const fib= top? `${line(4.2,2.6)} L400,0 L0,0 Z` : `${line(4.2,2.6)} L400,24 L0,24 Z`;
  return `<svg class="te ${top?'te-top':'te-bot'}" viewBox="0 0 400 24" preserveAspectRatio="none" aria-hidden="true"><path class="fib" d="${fib}"/><path class="pg" d="${pg}"/></svg>`;
}
function tearHTML(t){
  const up='<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path d="M12 5v14M6 11l6-6 6 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  return `<div class="tear" data-tear="${t}" role="note" aria-label="Previously read: everything above">${tearEdge(t%997+3,true)}<div class="tear-mid">${up}<span>Previously read</span>${up}</div>${tearEdge(t%991+7,false)}</div>`;
}
function sectionHTML(k){
  const [a,b]=R.SEC[k]; const B=R.blocks; let h='';
  const tear= SEC_TEAR && R.tear!=null && R.tear>a && R.tear<b ? R.tear : -1;
  for(let bi=blockAt(a); bi<B.length && B[bi].s<b; bi++){
    const blk=B[bi]; if(blk.e<=a) continue;
    const bef=R.imgBefore.get(bi); if(bef && blk.s>=a) h+=bef.map(figHTML).join('');
    if(R.breaks.has(blk.s) && blk.s>a) h+='<hr class="brk">';
    const s0=Math.max(blk.s,a), e0=Math.min(blk.e,b);
    if(tear>=0 && tear===s0) h+=tearHTML(tear)+blockHTML(blk, s0, e0);
    else if(tear>s0 && tear<e0) h+=blockHTML(blk, s0, tear)+tearHTML(tear)+blockHTML(blk, tear, e0, true);   /* the paragraph carries on below the tear */
    else h+=blockHTML(blk, s0, e0);
    const aft=R.imgAfter.get(bi); if(aft && blk.e<=b) h+=aft.map(figHTML).join('');
  }
  if(b>=R.n && R.imgEnd.length) h+=R.imgEnd.map(figHTML).join('');
  return `<div class="sec" data-k="${k}">${h}</div>`;
}
async function decodeImgs(sec){
  const imgs=[...sec.getElementsByTagName('img')]; if(!imgs.length) return;
  await Promise.race([ Promise.all(imgs.map(im=>im.decode?im.decode().catch(()=>{}):Promise.resolve())), sleep(2500) ]);
}
/* builds section k and puts it in container; 'prepend' keeps the reader's place by adjusting scrollEl */
async function renderSec(container, k, where, scrollEl){
  const tmp=document.createElement('div'); SEC_TEAR=(container===scFlow); try{ tmp.innerHTML=sectionHTML(k); } finally{ SEC_TEAR=false; }
  const sec=tmp.firstElementChild;
  sec._k=k; sec._a=R.SEC[k][0]; sec._b=R.SEC[k][1]; sec._ws=sec.getElementsByTagName('w');
  decorate(sec);
  await decodeImgs(sec);
  if(where==='replace') container.replaceChildren(sec);
  else if(where==='append') container.appendChild(sec);
  else { const h0=scrollEl.scrollHeight, t0=scrollEl.scrollTop; container.insertBefore(sec, container.firstElementChild); scrollEl.scrollTop=t0+(scrollEl.scrollHeight-h0); }
  return sec;
}
function hostEl(){ return R.mode==='pages'?pgFlow : R.mode==='scroll'?scFlow : null; }
function wordEl(i){ const h=hostEl(); if(!h) return null; for(const sec of h.children){ if(i>=sec._a && i<sec._b) return sec._ws[i-sec._a]||null; } return null; }
function idxOf(node){ const w=node&&node.closest?node.closest('w'):null; if(!w) return null; const sec=w.closest('.sec'); if(!sec||!sec._ws) return null; const k=Array.prototype.indexOf.call(sec._ws, w); return k<0?null:sec._a+k; }
/* the dash shown after a word: highlighted only when the highlight carries on past it */
function dashOf(w){ const d=w&&w.nextElementSibling; return d&&d.tagName==='WD'?d:null; }
function decorate(sec){
  sec.querySelectorAll('w.hl1,w.hl2,w.hl3,w.hl4,w.hn,wd.hl1,wd.hl2,wd.hl3,wd.hl4,wd.hn,wd.tsel,w.flash,wd.flash').forEach(x=>x.classList.remove('hl1','hl2','hl3','hl4','hn','tsel','flash'));
  const a=sec._a, b=sec._b;
  for(const h of (R.meta.highlights||[])){
    if(h.e<a || h.s>=b) continue;
    for(let k=Math.max(h.s,a); k<=Math.min(h.e,b-1); k++){ const w=sec._ws[k-a]; if(w){ w.classList.add('hl'+h.c); if(h.note) w.classList.add('hn'); const d=k<h.e&&dashOf(w); if(d){ d.classList.add('hl'+h.c); if(h.note) d.classList.add('hn'); } } }
  }
  if(R.meta){ const ri=scanRefs(); if(ri.length){ let lo=0, hi=ri.length; while(lo<hi){ const m=(lo+hi)>>1; if(ri[m]<a) lo=m+1; else hi=m; }
    for(let q=lo;q<ri.length&&ri[q]<b;q++){ const w=sec._ws[ri[q]-a]; if(w) w.classList.add('sref'); } } }
  if(R.flash && R.flash.e>a && R.flash.s<b) for(let k=Math.max(R.flash.s,a); k<Math.min(R.flash.e,b); k++){ const w=sec._ws[k-a]; if(w){ w.classList.add('flash'); const d=dashOf(w); if(d) d.classList.add('flash'); } }
  if(TTS.on && TTS.cur>=a && TTS.cur<b){ const w=sec._ws[TTS.cur-a]; if(w) w.classList.add('tts'); }
  if(TTS.pick!=null && TTS.pick>=a && TTS.pick<b){ const w=sec._ws[TTS.pick-a]; if(w) w.classList.add('ttspick'); }
  if(typeof TS!=='undefined' && TS.on) for(let k=Math.max(TS.a,a); k<=Math.min(TS.b,b-1); k++){ const w=sec._ws[k-a]; if(w){ w.classList.add('tsel'); const d=k<TS.b&&dashOf(w); if(d) d.classList.add('tsel'); } }
}
function redecorate(){ const h=hostEl(); if(h) for(const sec of h.children) if(sec._ws) decorate(sec); }

/* ---------- Pages mode ---------- */
const P={k:-1, page:0, pages:1, g:null, busy:false, rangeEnd:0};
function pgGeom(){
  const W=pgView.clientWidth, H=pgView.clientHeight; const mx=marginPx(W);
  const two=S.twoCol && W>H*1.1 && W>=640;
  /* the text block is centred; the Margins setting alone decides how wide it is */
  const gap= two ? Math.max(36, Math.round(mx*1.2)) : mx*2;
  const inner=Math.max(120, W-2*mx); const cw= two? (inner-gap)/2 : inner;
  return {W,H,mx,gap,inner,cw,two,colsPer:two?2:1,stride:inner+gap,left:Math.round((W-inner)/2)};
}
function pgApplyGeom(){
  const g=pgGeom(); P.g=g;
  const clip=$('#pgClip'); clip.style.left=g.left+'px'; clip.style.width=g.inner+'px';
  for(const f of [pgFlow, $('#pgMeasure')]){ f.style.width=g.inner+'px'; f.style.columnCount=g.two?'2':'1'; f.style.columnGap=g.gap+'px'; }
  document.documentElement.style.setProperty('--pageH', clip.clientHeight+'px');
  pcSync();
}
/* whole-book page numbers: each section's page count is measured in the background for the current
   text settings; sections not measured yet are estimated from the ones that are */
const PC={sig:'', counts:[], token:0, fontGen:0};
function pcSync(){
  const g=P.g; const sig=[R.meta.id,R.SEC.length,g.W,g.H,g.two,S.size,S.lineH,S.margin,S.para,S.justify,S.hyphen,S.boldText,S.wordStart,S.font,R.bookFamily,S.focus,PC.fontGen].join('|');
  if(sig===PC.sig && PC.counts.length===R.SEC.length) return;
  PC.sig=sig; PC.counts=new Array(R.SEC.length).fill(0); pcRun();
}
async function pcRun(){
  const tok=++PC.token; const m=$('#pgMeasure'); const g=P.g; const here=secAt(R.pos);
  await sleep(250);
  const order=[...R.SEC.keys()].sort((a,b)=>Math.abs(a-here)-Math.abs(b-here));
  let t=performance.now(), n=0;
  for(const k of order){
    if(tok!==PC.token || R.mode!=='pages') return;
    if(PC.counts[k]) continue;
    m.innerHTML=sectionHTML(k);
    const imgs=[...m.getElementsByTagName('img')];
    if(imgs.length){ await Promise.race([Promise.all(imgs.map(im=>im.decode?im.decode().catch(()=>{}):0)), sleep(800)]); if(tok!==PC.token || R.mode!=='pages') return; }
    const cols=Math.max(1,Math.round((m.scrollWidth+g.gap)/(g.cw+g.gap)));
    if(!PC.counts[k]) PC.counts[k]=Math.max(1,Math.ceil(cols/g.colsPer));
    if(performance.now()-t>10){ m.innerHTML=''; await sleep(40); t=performance.now(); if(++n%6===0 && tok===PC.token) updateChrome(); }
  }
  m.innerHTML=''; if(tok===PC.token) updateChrome();
}
function bookPages(){
  const c=PC.counts; let kw=0, kp=0;
  for(let k=0;k<R.SEC.length;k++) if(c[k]){ kw+=R.SEC[k][1]-R.SEC[k][0]; kp+=c[k]; }
  const wpp=kp? kw/kp : 280; let before=0, total=0;
  for(let k=0;k<R.SEC.length;k++){ const n=c[k]||Math.max(1,Math.round((R.SEC[k][1]-R.SEC[k][0])/wpp)); if(k<P.k) before+=n; total+=n; }
  return {page:before+P.page+1, total};
}
function pgMeasure(){ const g=P.g; const cols=Math.max(1,Math.round((pgFlow.scrollWidth+g.gap)/(g.cw+g.gap))); const sec=pgFlow.firstElementChild; P.cols=sec?Math.min(cols, Math.max(1,sec.getClientRects().length)):cols; /* columns the text really fills */ P.pages=Math.max(1,Math.ceil(cols/g.colsPer)); if(P.k>=0) PC.counts[P.k]=P.pages; }
function pgPageOfEl(w){
  if(!w) return 0; const fr=pgFlow.getBoundingClientRect(); const rr=w.getClientRects(); const r=rr.length?rr[0]:w.getBoundingClientRect();
  return clamp(Math.floor((r.left-fr.left+2)/P.g.stride),0,P.pages-1); /* both rects move together, so the shift cancels out */
}
function pgFirstWord(page){
  const sec=pgFlow.firstElementChild; if(!sec||!sec._ws.length) return sec?sec._a:0;
  const ws=sec._ws; let lo=0, hi=ws.length-1, ans=ws.length-1;
  if(page<=0) return sec._a;
  while(lo<=hi){ const m=(lo+hi)>>1; if(pgPageOfEl(ws[m])>=page){ ans=m; hi=m-1; } else lo=m+1; }
  return sec._a+ans;
}
async function pgLoad(k){
  pgFlow.style.columnCount=P.g.two?'2':'1';
  await renderSec(pgFlow,k,'replace'); P.k=k; pgMeasure();
  /* in the two-page layout, a chapter that fills only one column is set across the full width instead of sitting on the left */
  if(P.g.two && P.cols===1) pgFlow.style.columnCount='1';
}
const pgShift=()=>0;
function pgSet(page, anim){
  P.page=clamp(page,0,P.pages-1);
  const slide = anim && S.turn==='slide';
  pgFlow.classList.toggle('anim-slide', slide);
  pgFlow.style.transform=`translateX(${-P.page*P.g.stride+pgShift()}px)`;
  P.topWord = P.page>0 ? pgFirstWord(P.page) : (pgFlow.firstElementChild ? pgFlow.firstElementChild._a : R.pos);
  P.rangeEnd = P.page<P.pages-1 ? pgFirstWord(P.page+1) : (pgFlow.firstElementChild?pgFlow.firstElementChild._b:R.n);
}
async function pgShow(i){
  const k=secAt(i);
  if(P.k!==k || !pgFlow.firstElementChild) await pgLoad(k);
  let p=pgPageOfEl(wordEl(i)); while(p>0 && pgFirstWord(p-1)===i) p--; /* a picture-only page belongs before its word */
  pgSet(p, false);
  R.pos=i; updateChrome();
}
async function pgFade(fn){
  if(S.turn==='none'){ await fn(); return; }
  pgFlow.classList.add('fade'); await sleep(130); await fn(); pgFlow.classList.remove('fade');
}
async function pgTurn(d){
  if(P.busy || R.mode!=='pages') return; R.anchor=null;
  if(!TS.edge) selClear();
  if(d>0 && S.focus && R.chrome){ setChrome(false); return; } /* the bars cover the page edge; reveal it before turning */
  if(d>0){
    if(P.page<P.pages-1){ if(S.turn==='fade') await pgFade(()=>pgSet(P.page+1,false)); else pgSet(P.page+1,true); }
    else if(P.k<R.SEC.length-1){ P.busy=true; try{ await pgFade(async()=>{ await pgLoad(P.k+1); pgSet(0,false); }); } finally{ P.busy=false; } }
    else { R.meta.finished=true; saveProgress(true); toast('You’ve reached the end of “'+R.meta.title+'”'); return; }
  } else {
    if(P.page>0){ if(S.turn==='fade') await pgFade(()=>pgSet(P.page-1,false)); else pgSet(P.page-1,true); }
    else if(P.k>0){ P.busy=true; try{ await pgFade(async()=>{ await pgLoad(P.k-1); pgSet(P.pages-1,false); }); } finally{ P.busy=false; } }
    else return;
  }
  R.pos=pgFirstWord(P.page); afterMove(); if(S.focus) setChrome(false);
  if(TTS.on) ttsRestart();
}
let pgPt=null;
pgView.addEventListener('pointerdown',e=>{ if(e.button>0) return; pgPt={x:e.clientX,y:e.clientY,t:performance.now()}; });
pgView.addEventListener('pointercancel',()=>{ pgPt=null; });
pgView.addEventListener('pointerup',e=>{
  const p=pgPt; pgPt=null; if(!p) return;
  const dx=e.clientX-p.x, dy=e.clientY-p.y, dt=performance.now()-p.t;
  if(hasSelection() || performance.now()-(TS.clearedAt||0)<600) return;
  if(Math.abs(dx)>45 && Math.abs(dx)>Math.abs(dy)*1.3 && dt<900){ pgTurn(dx<0?1:-1); return; }
  if(Math.abs(dx)<12 && Math.abs(dy)<12 && dt<450) readerTap(e);
});

/* ---------- Scroll mode (+ auto-scroll) ---------- */
const SC={busy:false, auto:false, wasAuto:false, raf:0, last:0, acc:0, pxps:0, mT:0, pauseUntil:0, t0:0, passed:new WeakSet(), ticking:false, lastSave:0, lastClock:0};
function scTopOf(w){ return w.getBoundingClientRect().top - scView.getBoundingClientRect().top + scView.scrollTop; }
async function scShow(i){
  SC.busy=true; SC.userScrolled=false; /* the place stays exactly on word i until the reader scrolls */
  try{
    scFlow.replaceChildren(); await renderSec(scFlow, secAt(i), 'append');
    const w=wordEl(i); scView.scrollTop=w?Math.max(0, scTopOf(w)-scGap()):0;
  } finally{ SC.busy=false; }
  await scEnsure();
  if(R.tearCenter){ R.tearCenter=false; tearCenterNow(); await scEnsure(); tearCenterNow(); }
  else scSettle(i);
  R.pos=i; updateChrome();
}
/* After a jump, text is still being added and trimmed around the spot, and fonts may finish loading; iPhone Safari can
   drop a scroll correction, sliding the page thousands of lines away (Mick, Nov 25: "Read it in context" for Heb. 1:7
   showed Hebrews 6 cross references). Until the reader touches the page, keep word i where it was put. */
/* how far below the top a jump lands: clear of the "‹ Back to …" toast when it's showing */
function scGap(){ const t=$('#toast'); if(t.hidden || !t.dataset.back) return 10; const top=parseFloat(t.style.top)||12;   /* where it settles, not mid-slide */
  return Math.max(10, Math.round(top+t.offsetHeight-scView.getBoundingClientRect().top+12)); }
function scSettle(i){
  const tok=SC.settle=(SC.settle||0)+1;
  for(const ms of [120, 400, 900, 1600, 2600]) setTimeout(async()=>{
    if(SC.settle!==tok || R.mode!=='scroll' || SC.userScrolled || SC.auto || SC.busy || R.pos!==i || $('#v-reader').hidden) return;
    const w=wordEl(i); if(!w){ SC.settle=0; await scShow(i); return; }
    const d=scTopOf(w)-scGap()-scView.scrollTop; if(Math.abs(d)>24) scView.scrollTop+=d;
  }, ms);
}
/* put the middle of the tear in the middle of the screen */
function tearCenterNow(){
  const t=scFlow.querySelector('.tear'); if(!t) return;
  const r=t.getBoundingClientRect(), v=scView.getBoundingClientRect();
  scView.scrollTop+= (r.top+r.height/2)-(v.top+v.height/2);
}
/* leaving the book or the app: the first line in view is where reading picks up, so the tear goes just before it */
function tearMark(){
  if(R.mode!=='scroll' || !R.meta || scView.hidden) return;
  if(TTS.on) return;   /* reading aloud carries on in the background; the place moves by itself */
  const v=scView.getBoundingClientRect(), old=scFlow.querySelector('.tear');
  if(old){ const r=old.getBoundingClientRect(); if(r.bottom>v.top+8 && r.top<v.bottom-8){ R.tearShow=true; return; } }   /* still on screen: it stays put */
  const t=scPos();
  if(t>0 && t<R.n){ R.tear=t; LS.set('tear.'+R.meta.id, t); R.tearShow=true; }
}
function tearShowOnReturn(){
  if(!R.tearShow) return; R.tearShow=false;
  if(R.mode!=='scroll' || !R.meta || R.tear==null || TTS.on || SC.auto) return;
  R.tearCenter=true; scShow(R.tear);
}
async function scEnsure(){
  if(SC.busy) return; SC.busy=true;
  try{
    const vh=scView.clientHeight||600;
    for(let guard=0; guard<4; guard++){
      const first=scFlow.firstElementChild, last=scFlow.lastElementChild; if(!first) break;
      if(scView.scrollTop+vh*2.5>scView.scrollHeight && last._k<R.SEC.length-1){ await renderSec(scFlow,last._k+1,'append'); continue; }
      /* adding above also needs a scroll correction: not while a swipe is coasting (unless we've run out of text above) */
      const coasting=!SC.auto && !SC.touching && performance.now()-(SC.scrollAt||0)<700;
      if(scView.scrollTop<vh*1.5 && first._k>0 && (!coasting || scView.scrollTop<40)){ await renderSec(scFlow,first._k-1,'prepend',scView); continue; }
      break;
    }
    /* trim far-away sections. Never above the screen while the page is moving: iPhone Safari ignores the scroll
       correction during a coasting swipe, so removing a big section above (a long preface) would throw the page
       thousands of pixels ahead into text not drawn yet (Mick's Nov 25 recording). Those wait until it stops. */
    const moving= !SC.auto && (SC.touching || performance.now()-(SC.scrollAt||0)<700);   /* auto-scroll isn't a coasting swipe */
    while(scFlow.children.length>5){
      const cur=secAt(R.pos), first=scFlow.firstElementChild, last=scFlow.lastElementChild;
      if(cur-first._k > last._k-cur){ if(moving) break; const h0=scView.scrollHeight, t0=scView.scrollTop; first.remove(); scView.scrollTop=t0-(h0-scView.scrollHeight); }
      else last.remove();
    }
  } finally{ SC.busy=false; }
}
/* the word at a given screen height */
function wordAtY(y){
  for(const sec of scFlow.children){
    const r=sec.getBoundingClientRect(); if(r.bottom<y) continue;
    const ws=sec._ws; if(!ws.length) return sec._a;
    let lo=0, hi=ws.length-1, ans=hi;
    while(lo<=hi){ const m=(lo+hi)>>1; const rr=ws[m].getBoundingClientRect(); if(rr.bottom>y){ ans=m; hi=m-1; } else lo=m+1; }
    return sec._a+ans;
  }
  const last=scFlow.lastElementChild; return last?Math.max(last._a,last._b-1):R.pos;
}
function scPos(){ return wordAtY(scView.getBoundingClientRect().top+6); }
scView.addEventListener('scroll',()=>{
  SC.scrollAt=performance.now(); clearTimeout(SC.tidyT); SC.tidyT=setTimeout(()=>{ if(R.mode==='scroll' && !SC.touching) scEnsure(); }, 800);   /* tidy up once it has stopped */
  if(SC.ticking || R.mode!=='scroll') return; SC.ticking=true;
  requestAnimationFrame(async()=>{
    SC.ticking=false; if(R.mode!=='scroll') return;
    if(!SC.busy) await scEnsure();
    /* only the reader's own scrolling (or auto-scroll) moves the place; text reflowing after a rotation or a settings change doesn't */
    if(SC.auto || (R.anchor==null && SC.userScrolled && (SC.touching || performance.now()-(SC.gestureAt||0)<2500))) R.pos=scPos();
    updateChrome();
    const now=performance.now();
    if(now-SC.lastSave>2500){ SC.lastSave=now; saveProgress(); }
    if(now-SC.lastClock>3000){ SC.lastClock=now; noteProgress(); }
    if(S.focus && !SC.auto && R.chrome && SC.userScrolled && performance.now()-(SC.stopT||0)>500) setChrome(false);
  });
},{passive:true});
let scPt=null;
scView.addEventListener('pointerdown',e=>{ SC.wasAuto=SC.auto; if(SC.auto) asStop(); scPt={x:e.clientX,y:e.clientY,t:performance.now()}; if(e.pointerType==='mouse'){ SC.userScrolled=true; SC.gestureAt=performance.now(); R.anchor=null; } });
scView.addEventListener('pointerup',e=>{
  const p=scPt; scPt=null; if(!p) return;
  if(hasSelection() || performance.now()-(TS.clearedAt||0)<600) return;
  if(Math.abs(e.clientX-p.x)<12 && Math.abs(e.clientY-p.y)<12 && performance.now()-p.t<450) readerTap(e);
});
scView.addEventListener('touchstart',()=>{ SC.touching=true; },{passive:true});
scView.addEventListener('touchmove',()=>{ SC.userScrolled=true; SC.gestureAt=performance.now(); R.anchor=null; },{passive:true});
scView.addEventListener('touchend',()=>{ SC.touching=false; if(SC.userScrolled) SC.gestureAt=performance.now(); clearTimeout(SC.tidyT); SC.tidyT=setTimeout(()=>{ if(R.mode==='scroll' && !SC.touching && performance.now()-(SC.scrollAt||0)>700) scEnsure(); }, 800); },{passive:true});
scView.addEventListener('touchcancel',()=>{ SC.touching=false; },{passive:true});
scView.addEventListener('wheel',()=>{ SC.userScrolled=true; SC.gestureAt=performance.now(); R.anchor=null; },{passive:true});
scView.addEventListener('keydown',()=>{ SC.userScrolled=true; SC.gestureAt=performance.now(); R.anchor=null; });
function asUI(){
  const bar=$('#asBar'); bar.hidden=!(R.mode==='scroll' && S.autoScroll && !TTS.mode); $('#rAs').hidden=R.mode!=='scroll';
  $('#asPlay').innerHTML=SC.auto?ICON.pause:ICON.play; $('#asPlay').setAttribute('aria-label',SC.auto?'Pause auto-scroll':'Start auto-scroll');
  $('#asWpm').value=S.scrollWpm; $('#asLabel').innerHTML=`${S.scrollWpm} <small>wpm</small>`;
}
function asStart(){ R.anchor=null; if(TTS.mode) ttsModeOff();
  if(R.mode!=='scroll') return;
  selClear(); SC.auto=true; SC.t0=performance.now(); SC.last=SC.t0; SC.acc=0; SC.mT=0; SC.pauseUntil=0; SC.passed=new WeakSet();
  const lineY=asLineY(); scFlow.querySelectorAll('figure,h1,h2,h3,h4').forEach(x=>{ if(x.getBoundingClientRect().top<lineY+4) SC.passed.add(x); });
  resetClock(); requestWake(); asUI(); if(S.focus) setChrome(false);
  cancelAnimationFrame(SC.raf); SC.raf=requestAnimationFrame(asLoop);
}
function asStop(keepChrome){
  if(!SC.auto) return; SC.auto=false; SC.stopT=performance.now(); cancelAnimationFrame(SC.raf); releaseWake(); asUI(); noteProgress(); saveProgress(true);
  if(!keepChrome) setChrome(true);
}
function asLineY(){ const r=scView.getBoundingClientRect(); return r.top+r.height*0.33; }
function asLoop(now){
  if(!SC.auto) return;
  const dt=Math.min(0.1,(now-SC.last)/1000); SC.last=now;
  if(now-SC.mT>450) asMeasure(now);
  if(now>=SC.pauseUntil){
    SC.acc+=SC.pxps*dt; const whole=Math.floor(SC.acc);
    if(whole>=1){ const before=scView.scrollTop; scView.scrollTop=before+whole; SC.acc-=whole;
      if(scView.scrollTop===before && scFlow.lastElementChild && scFlow.lastElementChild._k>=R.SEC.length-1){ asStop(); toast('You’ve reached the end of “'+R.meta.title+'”'); R.meta.finished=true; saveProgress(true); return; } }
  }
  SC.raf=requestAnimationFrame(asLoop);
}
function asMeasure(now){
  SC.mT=now; const lineY=asLineY(); const i=wordAtY(lineY);
  const tops=[]; for(let k=Math.max(0,i-30); k<Math.min(R.n,i+30); k++){ const w=wordEl(k); if(w){ const r=w.getClientRects(); if(r.length) tops.push(r[0].top); } }
  let lines=0, prev=-1e9, first=null, lastT=null;
  tops.sort((a,b)=>a-b).forEach(t=>{ if(t-prev>4){ lines++; if(first===null) first=t; lastT=t; } prev=t; });
  const lh=parseFloat(getComputedStyle(scFlow).fontSize)*S.lineH;
  const lineH=lines>1? (lastT-first)/(lines-1) : lh;
  const wpl=tops.length/Math.max(1,lines);
  const pxPerWord=Math.max(1,Math.min(lineH, lineH/Math.max(1,wpl)));
  let wpm=S.scrollWpm;
  if(S.asRamp){ const s=(now-SC.t0)/1000; if(s<5) wpm*=0.6+0.4*s/5; }
  wpm/=difficulty(i);
  SC.pxps=wpm/60*pxPerWord;
  if(S.asPauses){
    for(const x of scFlow.querySelectorAll('figure,h1,h2,h3,h4')){
      if(SC.passed.has(x)) continue; const t=x.getBoundingClientRect().top;
      if(t<lineY){ SC.passed.add(x); if(t>lineY-scView.clientHeight*0.6) SC.pauseUntil=now+(x.tagName==='FIGURE'?3000:1800); }
    }
  }
}
$('#asPlay').onclick=()=>{ SC.auto?asStop():asStart(); };
$('#asWpm').addEventListener('input',e=>{ S.scrollWpm=+e.target.value; saveSettings(); asUI(); });
$('#asDown').onclick=()=>{ S.scrollWpm=clamp(S.scrollWpm-10,60,700); saveSettings(); asUI(); };
$('#asUp').onclick=()=>{ S.scrollWpm=clamp(S.scrollWpm+10,60,700); saveSettings(); asUI(); };

/* ---------- taps on the page ---------- */
function hasSelection(){ if(TS.on) return true; const s=getSelection(); return !!(s && !s.isCollapsed && s.toString().trim()); }
function readerTap(e){
  const t=e.target;
  if(TTS.mode){ const w=t.closest&&t.closest('w'); const i=w?idxOf(w):null; if(i!=null && !(R.wf && (R.wf[i]&F_N))){ ttsPickWord(i); return; } }
  const fig=t.closest&&t.closest('figure');
  if(fig){
    let mid=true;
    if(R.mode==='pages'){ const r=pgView.getBoundingClientRect(); const x=(e.clientX-r.left)/r.width; mid = S.tapZones==='anywhere' ? false : (x>=0.27 && x<=0.73); if(S.tapZones==='anywhere' && x>=0.3 && x<=0.7 && (e.clientY-r.top)/r.height>0.25 && (e.clientY-r.top)/r.height<0.75) mid=true; }
    if(mid){ showImage(R.imgList[+fig.dataset.img]); return; }
  }
  const w=t.closest&&t.closest('w');
  if(w && w.classList.contains('nb')){ goTo(R.back.get(idxOf(w)), true); return; }
  if(w && w.classList.contains('pa')){ tapBookPref(idxOf(w)); return; }
  if(w && w.classList.contains('n')){ openFootnote(idxOf(w)); return; }
  if(w && w.classList.contains('sref')){ openRefPeek(idxOf(w)); return; }
  if(w && /\bhl[1-4]\b/.test(w.className)){ const h=hlAt(idxOf(w)); if(h){ openHlMenu(h); return; } }
  if(R.mode==='pages'){
    const r=pgView.getBoundingClientRect(); const x=(e.clientX-r.left)/r.width, y=(e.clientY-r.top)/r.height;
    if(S.tapZones==='anywhere'){ if(y<0.12) toggleChrome(); else if(x<0.3) pgTurn(-1); else pgTurn(1); }
    else { if(x<0.27) pgTurn(-1); else if(x>0.73) pgTurn(1); else toggleChrome(); }
  } else if(R.mode==='scroll'){
    /* a tap pauses auto-scroll; after that taps only show or hide the controls. Play restarts it. */
    if(S.autoScroll){ if(SC.wasAuto) setChrome(true); else toggleChrome(); }
    else toggleChrome();
  }
}
/* picture viewer: the one place zooming is allowed. Pinch, double-tap or scroll-wheel to zoom, drag to move. */
function showImage(a){
  if(!a || $('#imgOverlay')) return;
  const ov=document.createElement('div'); ov.id='imgOverlay';
  ov.innerHTML=`<img src="${R.imgUrls[a.f]}" alt="${esc(a.alt||'Illustration')}" draggable="false"><button class="icon-btn" id="imgClose" type="button" aria-label="Close picture">${ICON.close}</button><div id="imgHint">Pinch or double-tap to zoom</div>`;
  const img=ov.firstElementChild; const opened=performance.now();
  let sc=1, tx=0, ty=0, st=null, moved=false, lastTap=0, tapT=null; const pts=new Map();
  const apply=(ease)=>{ img.classList.toggle('ease',!!ease); img.style.transform=`translate(${tx}px,${ty}px) scale(${sc})`; };
  const limit=()=>{ const mx=Math.max(0,(img.offsetWidth*sc-ov.clientWidth)/2), my=Math.max(0,(img.offsetHeight*sc-ov.clientHeight)/2); tx=clamp(tx,-mx,mx); ty=clamp(ty,-my,my); };
  const close=()=>{ clearTimeout(tapT); ov.remove(); };
  const begin=()=>{ const p=[...pts.values()]; st={sc,tx,ty, x:p[0].x, y:p[0].y, d:p.length>1?Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y):0, mx:p.length>1?(p[0].x+p[1].x)/2:p[0].x, my:p.length>1?(p[0].y+p[1].y)/2:p[0].y}; };
  /* zoom so the point under the finger stays put */
  const zoomAt=(nsc,cx,cy)=>{ const ox=cx-ov.clientWidth/2, oy=cy-ov.clientHeight/2; const k=nsc/sc; tx=ox-(ox-tx)*k; ty=oy-(oy-ty)*k; sc=nsc; if(sc<=1.01){ sc=1; tx=0; ty=0; } limit(); };
  ov.addEventListener('pointerdown',e=>{ if(e.target.closest('#imgClose')) return; try{ ov.setPointerCapture(e.pointerId); }catch(_){} pts.set(e.pointerId,{x:e.clientX,y:e.clientY}); if(pts.size===1) moved=false; else moved=true; begin(); });
  ov.addEventListener('pointermove',e=>{
    if(!pts.has(e.pointerId)||!st) return; pts.set(e.pointerId,{x:e.clientX,y:e.clientY}); const p=[...pts.values()];
    if(p.length>=2){ const d=Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y), mx=(p[0].x+p[1].x)/2, my=(p[0].y+p[1].y)/2; sc=st.sc; tx=st.tx+(mx-st.mx); ty=st.ty+(my-st.my); zoomAt(clamp(st.sc*d/Math.max(1,st.d),1,6), mx, my); moved=true; apply(); }
    else{ const dx=p[0].x-st.x, dy=p[0].y-st.y; if(Math.abs(dx)+Math.abs(dy)>8) moved=true; if(sc>1){ tx=st.tx+dx; ty=st.ty+dy; limit(); apply(); } }
  });
  const up=e=>{
    if(!pts.has(e.pointerId)) return; pts.delete(e.pointerId);
    if(pts.size){ begin(); return; }
    st=null; if(moved || e.type==='pointercancel' || performance.now()-opened<420) return;
    const now=performance.now();
    if(now-lastTap<320){ clearTimeout(tapT); lastTap=0; if(sc>1){ sc=1; tx=0; ty=0; } else zoomAt(2.5, e.clientX, e.clientY); apply(true); }
    else{ lastTap=now; tapT=setTimeout(()=>{ if(sc===1) close(); },330); }
  };
  ov.addEventListener('pointerup',up); ov.addEventListener('pointercancel',up);
  ov.addEventListener('wheel',e=>{ e.preventDefault(); zoomAt(clamp(sc*(e.deltaY<0?1.15:0.87),1,6), e.clientX, e.clientY); apply(); },{passive:false});
  ov.querySelector('#imgClose').onclick=close;
  document.body.appendChild(ov);
}
/* everywhere else, pinch and double-tap zoom are off */
for(const t of ['gesturestart','gesturechange','gestureend']) document.addEventListener(t,e=>e.preventDefault(),{passive:false});
document.addEventListener('touchmove',e=>{ if(e.touches.length>1) e.preventDefault(); },{passive:false});

/* ---------- moving around ---------- */
function setChrome(on){ if(TTS.mode) on=true; /* the audio controls stay on screen in voice mode */ R.chrome=on; $('#v-reader').classList.toggle('chrome-off',!on); if(!on) goalRing();
  if(on && R.backPos!=null && !R.backGone && $('#toast').hidden) showBackToast(); placeToast(); }
/* the daily-goal circle: how much of today's goal is read; nothing at all without a goal */
function goalRing(){ const g=$('#goalRing'); if(!g) return; const goal=(S.goalMins||0)*60000; g.hidden=!goal||!R.meta; if(g.hidden) return; const f=Math.min(1,todayMs()/goal); g.style.setProperty('--p', f.toFixed(3)); }
$('#goalRing').addEventListener('click',e=>{
  e.stopPropagation(); const goal=S.goalMins||0; if(!goal) return;
  const m=Math.round(todayMs()/60000), r=$('#goalRing').getBoundingClientRect(), pl=n=>n===1?'minute':'minutes';
  document.querySelectorAll('.goalpop').forEach(x=>x.remove());
  const b=document.createElement('div'); b.className='goalpop'; b.innerHTML=`<b>${m} ${pl(m)} read today</b><br><span>Goal ${goal} ${pl(goal)}</span>`;
  b.style.left=(r.right+4)+'px'; b.style.top=(r.top-10)+'px'; document.body.appendChild(b);
  b.animate([{opacity:0,transform:'translate(-100%,-85%)'},{opacity:1,transform:'translate(-100%,-100%)'}],{duration:200,easing:'cubic-bezier(.2,.8,.2,1)'});
  setTimeout(()=>{ const a=b.animate([{opacity:1},{opacity:0}],{duration:300}); a.onfinish=()=>b.remove(); }, 3000);
  if(todayMs()>=goal*60000) Drop.celebrate();   /* goal already met: the drop celebrates again */
});
function toggleChrome(){ setChrome(!R.chrome); }
function stopActivity(){ if(R.playing) pause(); if(SC.auto) asStop(true); if(TTS.on) ttsStop(); }
/* ---------- where you were: after a jump, a hollow drop waits on the progress line at the spot you left;
   tap it and you flow back (and it moves to where you'd jumped to, so you can go back and forth).
   Across books (a scripture peek) it waits at the start of the line and takes you back to the other book.
   It fades away after a few minutes of not being needed. ---------- */
function setBack(prev){ R.backPos=prev; R.backGone=false; showBackToast(); }
/* a toast at the top: "‹ Back to Genesis". It stays until it's swiped away; after 3 minutes it tucks itself away and
   comes back the next time the controls are shown (Mick, Nov 25: replaces the hollow drop on the progress line) */
function backLabel(){ const c=currentChapter(R.backPos); return c? c.t : placeLabel(R.backPos); }
function showBackToast(){
  if(R.backPos==null || R.backGone || !R.meta) return;
  toast('', {label:'‹ Back to '+backLabel(), fn:ghostBack}, 0); $('#toast').dataset.back='1';
  clearTimeout(R.backT); R.backT=setTimeout(()=>{ const t=$('#toast'); if(t.dataset.back) t.hidden=true; }, 180000);
}
function clearBack(){ R.backPos=null; clearTimeout(R.backT); const t=$('#toast'); if(t.dataset.back){ t.hidden=true; delete t.dataset.back; } }
async function ghostBack(){ const p=R.backPos; if(p==null) return; clearFlash(); await goTo(p,true); clearBack(); }
/* the verses a reference took you to stay tinted until you go back or leave the book */
function clearFlash(){ if(R.flash){ R.flash=null; redecorate(); } }
/* a link into another book (a scripture peek → the Bible): the back arrow becomes "‹ <book you came from>", like the
   iPhone's own "◀ Safari" after a jump between apps. With the controls hidden the same link sits at the top left
   of the page. It lasts until you leave that book or ten minutes pass; tap it to go back (Mick, Nov 25). */
const RT={back:null, inId:null, t:0, timer:0};
function showReturnLink(){
  if(!RT.back || !R.meta || R.meta.id!==RT.inId) return;
  const m=LIB.find(x=>x.id===RT.back.id); if(!m){ RT.back=null; return; }
  const c=$('#rCrumb'), v=$('#v-reader'), was=!c.hidden;
  c.innerHTML=ICON.back+`<span>${esc(m.title)}</span>`; c.setAttribute('aria-label','Return to '+m.title); c.hidden=false;
  if(!was){ v.classList.add('crumbing'); if(R.mode!=='speed') R.anchor=R.pos; relayoutSoon(); }   /* the text moves down a line, keeping the exact spot you jumped to */
  clearTimeout(RT.timer); RT.timer=setTimeout(endReturnLink, Math.max(1000, RT.t+600000-Date.now()));   /* ten minutes at most */
}
function endReturnLink(leaving){
  clearTimeout(RT.timer); RT.back=null; RT.inId=null;
  const c=$('#rCrumb'), v=$('#v-reader'); if(c.hidden) return;
  c.hidden=true; v.classList.remove('crumbing'); if(!leaving && R.meta){ holdPlace(); relayoutSoon(); }
}
async function returnBack(){ const to=RT.back; if(!to) return; endReturnLink(true); if(await openDoc(to.id)!==false) goTo(to.pos); }
$('#rCrumb').addEventListener('click',e=>{ e.stopPropagation(); returnBack(); });
/* go to a spot in another book; remember this one so the return toast can bring you back */
async function jumpDoc(id, pos){
  const from= R.meta? {id:R.meta.id, pos:R.pos} : null;
  if(!R.meta || id!==R.meta.id){ if(await openDoc(id)===false) return false; if(from) R.returnTo=R.returnTo||'library'; }
  await goTo(typeof pos==='function'? pos() : pos, true);
  if(from && from.id!==R.meta.id){ clearBack(); RT.back=from; RT.inId=R.meta.id; RT.t=Date.now(); showReturnLink(); }
  return true;
}
/* Endnotes: the number in front of each note leads back to where it was cited.
   R.backTo: a link inside a note that points at its reference (the book's own back-link). R.back: a plain note number. */
function buildBacklinks(){
  R.back=new Map(); R.backTo=new Map();
  const norm=w=>String(w||'').replace(/[\[\]().:,]/g,'');
  /* only a link that points backwards (from the notes to the text) is a back-link; the note numbers in the text keep opening the note */
  for(const [ref,t] of R.notes){ if(t<ref && (R.notes.has(t) || (R.wf && (R.wf[t]&F_N)))) R.backTo.set(ref,t); }
  for(const [ref,t] of R.notes){
    if(R.backTo.has(ref) || t<=ref) continue;
    const num=norm(R.words[ref]); if(!num) continue;
    for(let k=t;k<Math.min(R.n,t+3);k++){ if(R.wf && (R.wf[k]&F_N)) break; if(norm(R.words[k])===num){ if(!R.back.has(k)) R.back.set(k,ref); break; } }
  }
}
async function goTo(i, jump){
  if(!R.meta || !R.mode) return;
  R.anchor=null;
  const prev=R.pos; stopActivity(); selClear();
  R.pos=clamp(i|0,0,R.n-1); R.lastNav=true;
  if(R.meta.finished&&R.pos<R.n-1) R.meta.finished=false;
  if(jump && Math.abs(prev-R.pos)>30) setBack(prev);
  if(jump) setChrome(true);
  await MODES[R.mode].show(R.pos);
  saveProgress(true); resetClock(); updateChrome();
}
function afterMove(){ const now=performance.now(); if(now-R.lastSave>1500) saveProgress(); noteProgress(); updateChrome(); }
const MODES={
  pages:{
    async enter(){ pgView.hidden=false; pgApplyGeom(); P.k=-1; await pgShow(R.pos); },
    leave(){ PC.token++; $('#pgMeasure').innerHTML=''; pgView.hidden=true; pgFlow.replaceChildren(); P.k=-1; },
    show:(i)=>pgShow(i),
    async relayout(){ /* keep the top-left word until a page is turned, so repeated changes never drift */ if(R.anchor==null) R.anchor=(P.topWord!=null && P.k>=0)? P.topWord : R.pos; const i=R.anchor; pgApplyGeom(); P.k=-1; await pgShow(i); }
  },
  scroll:{
    async enter(){ scView.hidden=false; SC.userScrolled=false; asUI(); await scShow(R.pos); },
    leave(){ asStop(true); scView.hidden=true; scFlow.replaceChildren(); $('#asBar').hidden=true; },
    show:(i)=>scShow(i),
    async relayout(){ if(R.anchor==null) R.anchor=R.pos; await scShow(R.anchor); }
  },
  speed:{
    async enter(){ while(R.pos>0 && glued(R.pos)) R.pos--; $('#speedView').hidden=false; el.scrub.max=Math.max(1,R.n-1); setWpm(S.wpm); await new Promise(r=>requestAnimationFrame(r)); buildScrollText(); enableManualScroll(); showPaused(); positionLine(); syncScroll(true); },
    leave(){ if(R.playing) pause(); $('#speedView').hidden=true; $('#scrollText').innerHTML=''; R.spans=null; R.curSpan=null; R.winA=R.winB=null; },
    show(i){ while(i>0 && glued(i)) i--; R.pos=i; showPaused(); syncScroll(true); },
    relayout(){ showChunk(R.pos); positionLine(); syncScroll(true); }
  }
};
async function switchMode(m){
  if(!MODES[m]) m='pages'; R.anchor=null;
  if(m===R.mode) return;
  if(TTS.mode) ttsModeOff(true);
  stopActivity(); selClear();
  if(R.mode) MODES[R.mode].leave();
  R.mode=m; S.mode=m; saveSettings(); $('#rAs').hidden=m!=='scroll';
  $('#v-reader').dataset.mode=m; $('#v-reader').classList.toggle('overlay', !!S.focus && !TTS.mode); setChrome(true);
  await MODES[m].enter(); updateChrome(); resetClock();
}
let relayT=null;
function relayoutSoon(){ clearTimeout(relayT); relayT=setTimeout(async()=>{ if(!R.mode || $('#v-reader').hidden) return; pinApp(); applyLook(); try{ await MODES[R.mode].relayout(); if(R.mode==='pages') pgCheckAnchor(); }catch(e){ console.error(e); } updateChrome(); },140); }
/* after a rotation the page area can settle a moment later (the notch insets): if the anchor word isn't on screen, lay out once more */
function pgCheckAnchor(){ setTimeout(async()=>{ if(R.mode!=='pages' || R.anchor==null || $('#v-reader').hidden) return; const w=wordEl(R.anchor); if(!w) return; const c=$('#pgClip').getBoundingClientRect(), r=w.getBoundingClientRect(); if(r.left<c.left-2 || r.right>c.right+2){ pgApplyGeom(); P.k=-1; await pgShow(R.anchor); } }, 400); }
function holdPlace(){ if(R.mode && R.meta && R.anchor==null && R.mode!=='speed') R.anchor = R.mode==='pages' && P.topWord!=null && P.k>=0 ? P.topWord : R.pos; }
/* iPhone can leave the whole app scrolled up after a rotation, hiding the top bar */
function pinApp(){ if(window.scrollY || document.documentElement.scrollTop || document.body.scrollTop){ window.scrollTo(0,0); document.documentElement.scrollTop=0; document.body.scrollTop=0; } }
window.addEventListener('resize', ()=>{ holdPlace(); pinApp(); relayoutSoon(); });
window.addEventListener('orientationchange', ()=>{ holdPlace(); relayoutSoon(); setTimeout(()=>{ pinApp(); relayoutSoon(); }, 500); });
window.addEventListener('scroll', pinApp, {passive:true});
try{ let rbSize=''; new ResizeObserver(()=>{ const rb=document.getElementById('rBody'); if(!rb) return; const k=rb.clientWidth+'x'+rb.clientHeight; if(k!==rbSize){ const prev=rbSize; rbSize=k; if(prev && !/^0x|x0$/.test(prev) && !/^0x|x0$/.test(k)){ holdPlace(); relayoutSoon(); } } }).observe(document.getElementById('rBody')); }catch(e){}
/* a font that finishes downloading changes line breaks, so lay the pages out again */
try{ document.fonts.addEventListener('loadingdone', ()=>{ PC.fontGen++; if(R.mode) relayoutSoon(); }); }catch(e){}
function fontsReady(ms){ try{ return Promise.race([document.fonts.ready, sleep(ms||1500)]); }catch(e){ return Promise.resolve(); } }

/* ---------- reading clock (time left, stats) ---------- */
const CLK={pos:0,t:0,saveT:0,lastAct:0,maxGap:0,touch:0};
function resetClock(){ CLK.pos=R.pos; CLK.t=performance.now(); CLK.lastAct=CLK.t; CLK.maxGap=0; }
/* any touch, key or scroll in a book is a sign you're reading; the longest quiet stretch decides how a page is counted */
function markActivity(){ const now=performance.now(); if(CLK.lastAct) CLK.maxGap=Math.max(CLK.maxGap, now-CLK.lastAct); CLK.lastAct=now; CLK.touch=now; }
const idleMs=()=>(S.idleMins||5)*60000;
const usualWpm=()=>S.measuredWpm||230;
/* Reading time for a stretch: never more than about twice what those words usually take you,
   and if you went quiet for longer than the idle limit, only the time they usually take. */
function creditFor(dt, dw, quiet){ const exp=dw/usualWpm()*60000; return quiet? Math.min(dt, exp) : Math.min(dt, exp*2); }
function noteProgress(){
  if(!R.meta || R.mode==='speed') return;
  if(TTS.on){ resetClock(); return; } /* read-aloud time is counted as each sentence finishes */
  const now=performance.now(), dw=R.pos-CLK.pos, dt=now-CLK.t;
  if(dw<=0){ if(dw<0) resetClock(); return; }
  if(dt<1200) return;
  if(dt>4*3600000 || dt/dw<40){ resetClock(); return; } /* left open for hours, or skimming */
  const quiet=Math.max(CLK.maxGap, now-CLK.lastAct)>idleMs();
  recordStats(creditFor(dt,dw,quiet), dw);
  const w=dw/(dt/60000);
  if(!quiet && !(R.mode==='scroll'&&SC.auto) && w>60 && w<1200){ S.measuredWpm=S.measuredWpm?Math.round(S.measuredWpm*0.85+w*0.15):Math.round(w); if(now-CLK.saveT>20000){ CLK.saveT=now; saveSettings(); } }
  resetClock();
}
function readWpm(){ return TTS.mode&&R.mode!=='speed'? ttsWpmNow() : R.mode==='speed'?S.wpm : (R.mode==='scroll'&&S.autoScroll)?S.scrollWpm : (S.measuredWpm||230); }
function chapterEnd(i){ const c=R.meta.chapters||[]; for(const ch of c){ if(ch.i>i) return ch.i; } return R.n; }
function infoText(){
  const wpm=readWpm(), pct=Math.round(100*R.pos/Math.max(1,R.n-1));
  if(S.info===1) return `${pct}% · ${fmtMins((R.n-R.pos)/wpm)} left in book`;
  if(S.info===2) return `Location ${(R.pos+1).toLocaleString()} of ${R.n.toLocaleString()}`;
  const left=fmtMins((chapterEnd(R.pos)-R.pos)/wpm)+' left in chapter';
  if(R.mode==='pages'){ const bp=bookPages(); return `Page ${bp.page} of ${bp.total} · ${left}`; }
  return `${pct}% · ${left}`;
}
let scrubbing=false;
function bookmarkHere(){
  const bm=R.meta.bookmarks||[]; let a=R.pos, b=R.pos+1;
  if(R.mode==='pages'){ a=pgFirstWord(P.page); b=P.rangeEnd; }
  else if(R.mode==='scroll'){ a=R.pos; b=wordAtY(scView.getBoundingClientRect().bottom-4)+1; }
  return bm.find(x=>x.i>=a && x.i<Math.max(b,a+1));
}
function updateChrome(){
  if(!R.meta) return;
  const ch=currentChapter(R.pos); $('#rSub').textContent=ch?ch.t:(KIND[R.meta.kind]||'');
  Drop.progress(R.n>1?R.pos/(R.n-1):0);
  if(R.mode==='speed'||!R.mode) return;
  const sc=$('#rScrub'); sc.max=Math.max(1,R.n-1); if(!scrubbing) sc.value=R.pos;
  const info=infoText(); $('#rInfo').textContent=info; $('#runFoot').textContent=info; $('#runHead').textContent=ch?ch.t:R.meta.title;
  $('#rMark').classList.toggle('on', !!bookmarkHere());
  $('#rAs').hidden=R.mode!=='scroll'; $('#rAs').classList.toggle('on', !!S.autoScroll && !TTS.mode); $('#rAs').setAttribute('aria-label',S.autoScroll?'Close auto-scroll controls':'Auto-scroll');
  $('#rTts').classList.toggle('on', !!TTS.mode); $('#rTts').innerHTML=ICON.speaker; $('#rTts').setAttribute('aria-label',TTS.mode?'Close read-aloud controls':'Read aloud'); ttsBarUI();
}
$('#rInfo').onclick=()=>{ S.info=(S.info+1)%3; saveSettings(); updateChrome(); };
$('#rScrub').addEventListener('input',e=>{ scrubbing=true; const i=+e.target.value; Drop.progress(i/Math.max(1,R.n-1),true); const ch=currentChapter(i); $('#rInfo').textContent=`Go to ${Math.round(100*i/Math.max(1,R.n-1))}%`+(ch?' · '+ch.t:''); });
$('#rScrub').addEventListener('change',e=>{ scrubbing=false; goTo(+e.target.value, true); });
$('#rMark').onclick=()=>{
  const ex=bookmarkHere(); const bm=R.meta.bookmarks||(R.meta.bookmarks=[]);
  if(ex){ bm.splice(bm.indexOf(ex),1); toast('Bookmark removed'); }
  else { const ch=currentChapter(R.pos); bm.push({i:R.pos, name:ch?ch.t:'', at:Date.now()}); bm.sort((a,b)=>a.i-b.i); toast('Bookmarked', {label:'See all', fn:()=>openToc('marks')}); }
  touch(R.meta); updateChrome();
};

/* ---------- open / close a book ---------- */
const loadedFonts=new Set();
async function loadBookFont(text){
  R.bookFamily=null; if(!text.font || !text.font.faces || !window.FontFace) return;
  const name='tooz-book-'+text.id;
  if(!loadedFonts.has(name)){
    let ok=0;
    for(const f of text.font.faces){
      try{ const src=f.blob? await f.blob.arrayBuffer() : (f.data? await dataURLToBlob(f.data).arrayBuffer() : null); if(!src) continue;
        const w=/bold/i.test(f.w)?'700':/^\d+$/.test(f.w)?f.w:'400';
        const ff=new FontFace(name, src, {weight:w, style:/italic|oblique/i.test(f.st)?'italic':'normal'}); await ff.load(); document.fonts.add(ff); ok++; }catch(e){}
    }
    if(!ok) return; loadedFonts.add(name);
  }
  R.bookFamily=name;
}
/* Words joined by a dash ("26:8—“Yes,", "me—and") become two words, so each side can be selected,
   highlighted and read on its own. Older books are converted once: every saved position, highlight,
   bookmark, chapter, paragraph, note and picture is moved to its new word number. */
function splitDashWord(w){
  if(!w || !/[^—–\s-](?:[—–]+|-{2,})[^—–\s-]/.test(w)) return null;
  const p=w.match(/.*?(?:[—–]+|-{2,})(?=[^—–-])|.+$/g).filter(Boolean);
  return p.length>1? p : null;
}
/* renumber everything that points at word numbers after the words change; meta[flag] marks positions already converted */
function remapWords(text, meta, words, wf, WF, M, MI, flag){
  text.words=words; if(WF||wf.some(x=>x)) text.wf=Uint8Array.from(wf);
  if(text.ends) text.ends=text.ends.map(MI);
  if(text.blocks) text.blocks=text.blocks.map(b=>Object.assign({},b,{s:M(b.s), e:M(b.e)}));
  if(text.chapters) text.chapters=text.chapters.map(c=>Object.assign({},c,{i:M(c.i)}));
  if(text.notes) text.notes=text.notes.map(([a,b])=>[M(a),M(b)]);
  if(text.breaks) text.breaks=text.breaks.map(M);
  if(text.marks) for(const k in text.marks) text.marks[k]=text.marks[k].map(([a,b])=>[M(a),MI(b-1)+1]);
  if(text.acts) text.acts=text.acts.map(([a,b,x])=>[M(a),MI(b-1)+1,x]);
  if(text.secs) text.secs=text.secs.map(M);
  if(text.images && text.images.at) text.images.at=text.images.at.map(a=>Object.assign({},a,{i:M(a.i)}));
  if(meta){
    meta.count=words.length;
    if(meta.chapters) meta.chapters=meta.chapters.map(c=>Object.assign({},c,{i:M(c.i)}));
    if(meta[flag]) return;   /* positions already use the new word numbers (e.g. restored from the archive) */
    if(typeof meta.pos==='number') meta.pos=M(meta.pos);
    if(Array.isArray(meta.highlights)) meta.highlights=meta.highlights.map(h=>Object.assign({},h,{s:M(h.s), e:MI(h.e)}));
    if(Array.isArray(meta.bookmarks)) meta.bookmarks=meta.bookmarks.map(b=>Object.assign({},b,{i:M(b.i)}));
    const lp=LS.get('pos.'+meta.id,null); if(lp && typeof lp.pos==='number'){ lp.pos=M(lp.pos); LS.set('pos.'+meta.id,lp); }
    meta[flag]=1;
  }
}
/* the dash split also cut number ranges ("3:7–" + "8"); join them back into one word so Speed mode shows "3:7–8" */
function rangeJoinText(text, meta){
  if(text.rangeJoin) return false;
  const W=text.words, WF=text.wf&&text.wf.length===W.length?text.wf:null, n=W.length;
  text.rangeJoin=1;
  const join=(prev,k)=>WF && (WF[k]&F_GLUE) && /\d[–-]$/.test(prev) && /^\d/.test(W[k]);
  let any=false; for(let k=1;k<n;k++){ if(join(W[k-1],k)){ any=true; break; } }
  if(!any){ if(meta) meta.rangeJoin=1; return true; }
  const map=new Int32Array(n+1), words=[], wf=[];
  for(let k=0;k<n;k++){
    if(words.length && join(words[words.length-1],k)){ map[k]=words.length-1; words[words.length-1]+=W[k]; continue; }
    map[k]=words.length; words.push(W[k]); wf.push(WF?WF[k]:0);
  }
  map[n]=words.length;
  const M=i=>(i==null||i<0)?i: i>=n? words.length+(i-n) : map[i];
  remapWords(text, meta, words, wf, WF, M, M, 'rangeJoin');
  return true;
}
function dashSplitText(text, meta){
  if(text.dashSplit) return false;
  const W=text.words, WF=text.wf&&text.wf.length===W.length?text.wf:null, n=W.length;
  let any=false; for(let k=0;k<n;k++){ if(splitDashWord(W[k])){ any=true; break; } }
  text.dashSplit=1; if(!any){ if(meta) meta.dashSplit=1; return true; }
  const map=new Int32Array(n+1), words=[], wf=[];
  for(let k=0;k<n;k++){
    map[k]=words.length; const parts=splitDashWord(W[k])||[W[k]]; const f=WF?WF[k]:0;
    parts.forEach((pt,q)=>{ words.push(pt); wf.push(q? (f|F_GLUE)&~F_N : f); });
  }
  map[n]=words.length;
  const M=i=>(i==null||i<0)?i: i>=n? words.length+(i-n) : map[i];
  const MI=i=>(i==null||i<0)?i: i>=n-1? (i>=n? words.length+(i-n) : words.length-1) : map[i+1]-1;   /* inclusive end */
  remapWords(text, meta, words, wf, WF, M, MI, 'dashSplit');
  return true;
}
async function openDoc(id){
  const meta=LIB.find(x=>x.id===id); if(!meta){ toast('That document couldn’t be found.'); return false; }
  if(RT.back && id!==RT.inId) endReturnLink(true);   /* leaving the linked-to book ends the return link */
  if(meta.pending){ if(!await fetchShelfBook(meta)) return false; }
  R.anchor=null; LS.set('tutOpen', meta.kind==='sample');
  let text=await Store.get('texts',id).catch(()=>null);
  if(!text){ text=fetchText(meta); if(!text){ toast('That document’s text is missing. Delete it and add the file again.', null, 6000); return false; } Store.put('texts',text).catch(()=>{}); }
  if(R.meta){ stopActivity(); saveProgress(true); if(R.mode) MODES[R.mode].leave(); R.mode=null; }
  let fixed=false;
  if(!text.dashSplit && dashSplitText(text, meta)) fixed=true;
  if(!text.rangeJoin && rangeJoinText(text, meta)) fixed=true;
  if(fixed){ Store.put('texts',text).catch(()=>{}); touch(meta); }
  applySavedPos(meta);
  R.meta=meta; R.text=text; R.words=text.words; LS.set('resume', meta.kind==='sample'? null : meta.id); /* reopen here next launch */
  R.n=text.words.length; R.ends=new Set(text.ends);
  R.wf=(text.wf && text.wf.length===R.n)? text.wf : null;
  R.blocks=deriveBlocks(text, meta.chapters);
  R.notes=new Map(text.notes||[]); R.breaks=new Set(text.breaks||[]); buildBacklinks(); loadMarks(text);
  if(!Array.isArray(meta.highlights)) meta.highlights=[]; if(!Array.isArray(meta.bookmarks)) meta.bookmarks=[];
  (R.imgUrls||[]).forEach(u=>{ if(u&&u.startsWith('blob:')) try{ URL.revokeObjectURL(u); }catch(e){} });
  R.imgUrls=[]; R.imgList=[]; R.imgAt=new Map(); R.imgBefore=new Map(); R.imgAfter=new Map(); R.imgEnd=[];
  if(text.images){
    R.imgUrls=text.images.files.map(f=>f.blob?URL.createObjectURL(f.blob):(f.data||'')); R.imgList=text.images.at;
    R.imgList.forEach((a,idx)=>{
      if(!R.imgAt.has(a.i)) R.imgAt.set(a.i,[]); R.imgAt.get(a.i).push(idx);
      if(a.i>=R.n){ R.imgEnd.push(idx); return; }
      const bi=blockAt(a.i); const m=(a.i<=R.blocks[bi].s)?R.imgBefore:R.imgAfter;
      if(!m.has(bi)) m.set(bi,[]); m.get(bi).push(idx);
    });
  }
  buildSections(); R.sIdx=null; clearBack(); R.flash=null; goalRing(); diffCache={s:-1,e:-1,f:1};
  R.pos=clamp(meta.finished?0:meta.pos,0,R.n-1); if(meta.finished) meta.finished=false;
  R.tear=LS.get('tear.'+meta.id,null); if(R.tear!=null && !(R.tear>0 && R.tear<R.n)) R.tear=null;
  R.tearCenter= R.tear!=null && Math.abs(R.tear-R.pos)<400; R.tearShow=false;
  R.lastNav=false; R.playing=false; R.hasPlayed=false;
  meta.lastRead=Date.now(); touch(meta);
  $('#rTitle').textContent=meta.title;
  document.documentElement.lang=(text.lang||'en').split(/[^a-zA-Z-]/)[0]||'en';
  const big=R.n>15000;
  if(big){ progress('Opening “'+meta.title+'” ('+R.n.toLocaleString()+' words)…', null); await new Promise(r=>requestAnimationFrame(()=>setTimeout(r,40))); }
  await loadBookFont(text);
  showView('reader'); applyLook(); setChrome(true);
  await new Promise(r=>requestAnimationFrame(r));
  await fontsReady(1500);
  try{ await switchMode(S.mode); }
  catch(e){ console.error(e); toast('Something went wrong opening this book.', null, 6000); }
  finally{ if(big && $('#toastMsg').textContent.startsWith('Opening')) $('#toast').hidden=true; }
  resetClock(); updateChrome();
  return true;
}
/* the page you were on when you closed the book: count it, up to the time it usually takes you */
function lastVisibleWord(){
  const box=(R.mode==='pages'?$('#pgClip'):scView).getBoundingClientRect();
  for(let dy=6; dy<80; dy+=10) for(const dx of [8,40,box.width/2]){ const i=wordAtPoint(box.right-dx, box.bottom-dy); if(i!=null) return i; }
  return null;
}
function creditLastPage(){
  if(!R.meta || (R.mode!=='pages' && R.mode!=='scroll') || TTS.on || SC.auto) return;
  const last=lastVisibleWord(); if(last==null) return;
  const dw=last-CLK.pos+1, dt=performance.now()-CLK.t; if(dw<=0 || dt<2000) return;
  recordStats(creditFor(dt,dw,true), dw); resetClock();
}
function closeReader(quiet){
  tearMark(); R.tearShow=false;
  creditLastPage(); if(TTS.mode) ttsModeOff(true); stopActivity(); noteProgress(); saveProgress(true); selClear();
  const m=R.meta;
  if(R.mode) MODES[R.mode].leave(); R.mode=null; R.meta=null; /* nothing may save a closed book's record again */
  clearBack(); R.flash=null; endReturnLink(true); LS.set('resume',null);   /* back in the library: next launch opens the library */
  const back=R.returnTo||'library'; R.returnTo=null;
  showView(back); applyLook();
  if(quiet || !m) return;
  /* the tutorial is removed once it's closed (Settings can bring it back) */
  if(m.kind==='sample'){ LS.set('tutOpen',false); if(!keepTutorial()) setTimeout(()=>tutorialPrompt(m.id), 300); return; }
  if(m.finished){ if(!m.finishedAt){ m.finishedAt=Date.now(); touch(m); } if(!m.keepFinished) setTimeout(()=>finishPrompt(m.id), 350); }
}
document.addEventListener('visibilitychange',()=>{
  if(document.hidden && R.meta && R.mode){ tearMark(); stopActivity(); noteProgress(); saveProgress(true); CLK.away=performance.now(); }
  else if(!document.hidden && CLK.away){ CLK.away=0; if(R.meta && R.mode) resetClock(); tearShowOnReturn(); }   /* time away from the app never counts */
});
const vr=document.getElementById('v-reader');
for(const ev of ['pointerdown','keydown','wheel','touchstart']) vr.addEventListener(ev, markActivity, {capture:true, passive:true});
/* Auto-scroll and Speed keep going by themselves: after 10 minutes with no touch, pause and ask */
setInterval(()=>{
  if(document.hidden || !R.meta || !(R.playing || SC.auto)) return;
  if(performance.now()-(CLK.touch||0) < 10*60000) return;
  const wasSpeed=R.playing; if(R.playing) pause(); if(SC.auto) asStop(true); setChrome(true);
  openSheet('Still reading?', `<p class="note" style="margin-top:0">${wasSpeed?'Speed reading':'Auto-scroll'} paused after 10 minutes without a touch, so your reading time isn’t counted while you’re away.</p><button class="btn primary block" type="button" data-act="go">Keep reading</button>`, {
    go:()=>{ closeSheet(); markActivity(); resetClock(); if(wasSpeed) play(); else asStart(); }
  });
}, 30000);
const leaving=()=>{ if(R.meta && R.mode){ tearMark(); stopActivity(); saveProgress(true); } };
window.addEventListener('pagehide',leaving); window.addEventListener('beforeunload',leaving); document.addEventListener('freeze',leaving);
document.addEventListener('keydown',e=>{
  if($('#v-reader').hidden||!$('#sheet').hidden||$('#imgOverlay')) return;
  if(e.target.matches('input,textarea,select')) return;
  if(R.mode==='scroll') SC.userScrolled=true;
  if(R.mode==='speed'){ if(e.key===' '){ e.preventDefault(); toggle(); } else if(e.key==='ArrowLeft') $('#bWord').click(); else if(e.key==='ArrowRight') $('#fWord').click(); return; }
  if(R.mode==='pages'){ if(['ArrowRight','PageDown',' '].includes(e.key)){ e.preventDefault(); pgTurn(1); } else if(['ArrowLeft','PageUp'].includes(e.key)){ e.preventDefault(); pgTurn(-1); } return; }
  if(R.mode==='scroll' && S.autoScroll && e.key===' '){ e.preventDefault(); SC.auto?asStop():asStart(); }
});

/* ---------- text selection: highlight, note, copy, define ---------- */
let SEL=null, selT=null;
/* on phones, any native selection inside the book is dropped at once; Tooz's own selection is used instead */
function dropNativeSel(){ try{ const s=getSelection(); const h=hostEl(); if(s&&s.rangeCount&&!s.isCollapsed&&h&&h.contains(s.getRangeAt(0).commonAncestorContainer)){ s.removeAllRanges(); return true; } }catch(e){} return false; }
document.addEventListener('selectionchange',()=>{ if(coarse()){ dropNativeSel(); return; } clearTimeout(selT); selT=setTimeout(selCheck,220); });
for(const el of [pgView, scView]) el.addEventListener('selectstart',e=>{ if(coarse()) e.preventDefault(); });
function nodeIdx(node, off, isStart){
  let base=node.nodeType===3?node.parentElement:node;
  let w=base&&base.closest?base.closest('w'):null;
  if(!w && node.nodeType===1){ const kids=node.childNodes; const ch=kids[Math.min(off, kids.length-1)]; if(ch&&ch.nodeType===1) w=ch.matches('w')?ch:ch.querySelector('w'); }
  if(!w) return null;
  let i=idxOf(w); if(i==null) return null;
  if(!isStart && node.nodeType===3 && off===0 && i>0 && !(node.previousSibling)) i--;
  /* a selection that starts at the very end of a word really starts at the next one */
  if(isStart && node.nodeType===3 && off>=node.length && node.parentElement && node.parentElement.closest('w')===w && !node.nextSibling) i++;
  return i;
}
function selCheck(){
  if($('#v-reader').hidden || R.mode==='speed' || !R.mode){ selHide(); return; }
  const s=getSelection(); if(!s||s.isCollapsed||!s.rangeCount||!s.toString().trim()){ selHide(); return; }
  const rg=s.getRangeAt(0); const host=hostEl(); if(!host||!host.contains(rg.commonAncestorContainer)){ selHide(); return; }
  let a=nodeIdx(rg.startContainer, rg.startOffset, true), b=nodeIdx(rg.endContainer, rg.endOffset, false);
  if(a==null||b==null){ selHide(); return; } if(b<a) [a,b]=[b,a];
  SEL={s:a,e:b, text:s.toString()}; $('#selBar').hidden=false; if(SC.auto) asStop();
}
function selHide(){ $('#selBar').hidden=true; SEL=null; if(TS.on){ TS.on=false; tsPaint(); } }
function selClear(){ selHide(); try{ const s=getSelection(); if(s&&!s.isCollapsed) s.removeAllRanges(); }catch(e){} }
$('#selBar').addEventListener('mousedown',e=>e.preventDefault());
$('#selBar').addEventListener('click',e=>{
  const b=e.target.closest('button'); if(!b||!SEL) return; const {s,e:en}=SEL;
  if(b.dataset.hl){ addHighlight(s,en,+b.dataset.hl); selClear(); return; }
  const act=b.dataset.sel; selClear();
  if(act==='copy') copyQuote(s,en);
  else if(act==='note'){ const ex=(R.meta.highlights||[]).find(h=>h.e>=s && h.s<=en); const h=addHighlight(s,en,ex?ex.c:1); openHlMenu(h,true); }
  else if(act==='define'){ const k=defineIdx(s,en); const w=clean(R.words[k]); if(w) defineWord(w,k); }
  else if(act==='share') quoteImage(s,en);
});
/* the word to define: the first real word in the selection (skipping note numbers and stray punctuation) */
function defineIdx(s,e){ for(let k=s;k<=e;k++){ if(R.wf && (R.wf[k]&F_N)) continue; if(clean(R.words[k])) return k; } return s; }
/* "quote" — Author, Title, chapter */
/* exact citations: a Bible gives the verses ("John 3:16–18 (KJV)"); other books give where in the book
   ("Thomas à Kempis, The Imitation of Christ, Book I, ch. XII") */
function verseAt(k, from){ for(let q=k;q>=from;q--) if(R.wf && (R.wf[q]&F_P) && /^\d{1,3}$/.test(R.words[q])) return +R.words[q]; return 0; }
function verseRef(s,e){
  const cs=currentChapter(s), ce=currentChapter(e); if(!cs) return '';
  const v1=verseAt(s, cs.i), v2=verseAt(e, ce? ce.i : cs.i);
  if(!v1) return cs.t;
  if(ce && ce!==cs){ const short=ce.t.replace(/^.*?(\d+)$/,'$1'); return `${cs.t}:${v1}–${short}:${v2||1}`; }
  return `${cs.t}:${v1}`+(v2&&v2!==v1? '–'+v2 : '');
}
function placeCite(s){
  const ch=R.meta.chapters||[], cur=currentChapter(s); if(!cur) return ''; const k=ch.indexOf(cur), t=R.meta.title;
  const path=[]; let d=cur.d||0;
  for(let j=k-1;j>=0&&d>0;j--){ if((ch[j].d||0)<d){ d=ch[j].d||0; if(ch[j].t!==t) path.unshift(wheelLabel(j,null)); } }
  const own=wheelLabel(k,null), bare=/^(?:[ivxlcdm]+|\d+)\.?$/i.test(own.trim());
  return [...path, own===t? '' : (bare? 'ch. '+own : own)].filter(Boolean).join(', ');
}
function citation(s,e){
  if(hasVerses()) return verseRef(s, e==null? s : e)+' ('+bibleAbbr(R.meta)+')';
  return [R.meta.author, R.meta.title, placeCite(s)].filter(Boolean).join(', ');
}
async function copyQuote(s,e){
  const t='“'+textOf(s,e)+'” — '+citation(s,e);
  try{ await navigator.clipboard.writeText(t); toast('Copied'); }catch(err){ toast('Couldn’t copy. Select the text and use the iPhone’s Copy instead.'); }
}

/* ---------- touch selection: press and hold a word, drag the handles; no phone menu over the book ---------- */
const TS={on:false, a:0, b:0, timer:0, start:null, drag:null, extending:false};
const coarse=()=>{ try{ return matchMedia('(hover:none),(pointer:coarse)').matches; }catch(e){ return false; } };
function tsPaint(){
  document.querySelectorAll('w.tsel,wd.tsel').forEach(w=>w.classList.remove('tsel'));
  const A=$('#tsA'), B=$('#tsB');
  if(!TS.on){ A.hidden=B.hidden=true; return; }
  for(let k=TS.a;k<=TS.b;k++){ const w=wordEl(k); if(w){ w.classList.add('tsel'); const d=k<TS.b&&dashOf(w); if(d) d.classList.add('tsel'); } }
  const wa=wordEl(TS.a), wb=wordEl(TS.b);
  if(wa){ const b=bandOf(wa, wa.getClientRects()[0]||wa.getBoundingClientRect()); A.style.setProperty('--stem',b.h+'px'); A.style.left=b.l+'px'; A.style.top=(b.top-13)+'px'; A.hidden=false; } else A.hidden=true;
  if(wb){ const rs=wb.getClientRects(); const b=bandOf(wb, rs[rs.length-1]||wb.getBoundingClientRect()); B.style.setProperty('--stem',b.h+'px'); B.style.left=b.r+'px'; B.style.top=b.top+'px'; B.hidden=false; } else B.hidden=true;
  TS.bh=wb?bandOf(wb, wb.getBoundingClientRect()).h:22;
}
function tsSet(a,b){ TS.on=true; TS.a=Math.min(a,b); TS.b=Math.max(a,b); SEL={s:TS.a, e:TS.b}; $('#selBar').hidden=false; if(SC.auto) asStop(); tsPaint(); }
function wordAtPoint(x,y){ const el=document.elementFromPoint(x,y); const w=el&&el.closest?el.closest('w'):null; if(!w || !hostEl() || !hostEl().contains(w)) return null; return idxOf(w); }
/* the coloured band of a word: no taller than its line (tall fonts have boxes that reach into the next line) */
function bandOf(w, r){
  const cs=getComputedStyle(w), fs=parseFloat(cs.fontSize)||16; let lh=parseFloat(cs.lineHeight); if(!lh) lh=(S.lineH||1.5)*fs;
  const h=Math.max(8, Math.min(r.height, lh-0.14*fs)); return {l:r.left, r:r.right, top:r.top+(r.height-h)/2, h, mid:r.top+r.height/2};
}
/* the word nearest the finger: first the nearest line (by line centre), then the nearest word on it.
   Past the end of a short last line picks that line's last word. */
function tsRects(){
  if(TS.rects) return TS.rects;
  const h=hostEl(), out=[]; if(!h) return out; const H=innerHeight, W=innerWidth;
  for(const w of h.querySelectorAll('w')){ const rs=w.getClientRects(); for(const r of rs){ if(r.width<1 || r.bottom<0 || r.top>H || r.right<0 || r.left>W) continue; const i=idxOf(w); if(i!=null) out.push({i, l:r.left, r:r.right, mid:r.top+r.height/2}); } }
  TS.rects=out; return out;
}
function wordNear(x,y){
  const L=tsRects(); if(!L.length) return null;
  let best=Infinity; for(const q of L){ const d=Math.abs(q.mid-y); if(d<best) best=d; }
  const line=L.filter(q=>Math.abs(Math.abs(q.mid-y)-best)<3);
  let pick=null, bd=Infinity; for(const q of line){ const d= x<q.l ? q.l-x : x>q.r ? x-q.r : 0; if(d<bd || (d===bd && pick && q.i>pick.i && x>q.r)){ bd=d; pick=q; } }
  return pick?pick.i:null;
}
function tsExtendTo(i){
  if(i==null) return;
  if(i!==TS.lastTick){ TS.lastTick=i; }   /* a tick each time the selection snaps to another word */
  if(TS.extending && TS.start) tsSet(TS.start.i, i);
  else if(TS.drag==='tsA') tsSet(Math.min(i,TS.b), TS.b);
  else if(TS.drag==='tsB') tsSet(TS.a, Math.max(i,TS.a));
}
/* dragging a selection to the top or bottom edge scrolls (Scroll) or turns the page (Pages) so it can keep going */
const EDGE={top:100, bottom:70, dwell:650};
function tsEdgeStart(){ TS.rects=null; document.body.classList.add('tsdrag'); if(TS.loop) return; TS.dwellAt=0; TS.loop=setInterval(tsEdgeTick,40); }
function tsEdgeStop(){ document.body.classList.remove('tsdrag'); clearInterval(TS.loop); TS.loop=0; TS.dwellAt=0; }
async function tsEdgeTick(){
  if(!(TS.extending||TS.drag) || !TS.pt){ if(!(TS.extending||TS.drag)) tsEdgeStop(); return; }
  const {x,y}=TS.pt, H=innerHeight;
  const zone= y>=H-EDGE.bottom ? 1 : y<=EDGE.top ? -1 : 0;
  if(!zone){ TS.dwellAt=0; return; }
  if(R.mode==='scroll'){
    const depth= zone>0 ? (y-(H-EDGE.bottom))/EDGE.bottom : (EDGE.top-y)/EDGE.top;
    scView.scrollTop += zone*Math.round(4+Math.min(1,Math.max(0,depth))*16); TS.rects=null;
    SC.gestureAt=Date.now();
    tsExtendTo(wordNear(x, zone>0? H-EDGE.bottom-6 : EDGE.top+6));
  } else if(R.mode==='pages'){
    const now=performance.now();
    if(!TS.dwellAt){ TS.dwellAt=now; return; }
    if(now-TS.dwellAt<EDGE.dwell || P.busy || TS.turning) return;
    TS.turning=true; TS.edge=true;
    try{ await pgTurn(zone); } finally{ TS.edge=false; TS.turning=false; TS.dwellAt=performance.now(); TS.rects=null; }
    if(TS.extending||TS.drag) tsExtendTo(wordNear(x, zone>0? H-EDGE.bottom-6 : EDGE.top+6));
    tsPaint();
  }
}
for(const host of [pgView, scView]){
  host.addEventListener('pointerdown',e=>{
    if(e.pointerType==='mouse' || !coarse()) return;
    clearTimeout(TS.timer); const w=e.target.closest&&e.target.closest('w'); if(!w) return; const i=idxOf(w); if(i==null) return;
    TS.start={x:e.clientX,y:e.clientY,i};
    TS.timer=setTimeout(()=>{ if(!TS.start) return; tsSet(TS.start.i, TS.start.i); TS.extending=true; TS.pt={x:TS.start.x,y:TS.start.y}; tsEdgeStart(); markActivity(); try{ navigator.vibrate&&navigator.vibrate(8); }catch(_){} }, 450);
  });
  host.addEventListener('pointermove',e=>{
    if(TS.extending){ TS.pt={x:e.clientX,y:e.clientY}; tsExtendTo(wordNear(e.clientX,e.clientY)); return; }
    if(TS.start && Math.hypot(e.clientX-TS.start.x, e.clientY-TS.start.y)>9){ clearTimeout(TS.timer); TS.start=null; }
  });
  const end=()=>{ clearTimeout(TS.timer); if(TS.extending){ TS.extending=false; TS.justSelected=performance.now(); } TS.start=null; if(!TS.drag) tsEdgeStop(); };
  host.addEventListener('pointerup',end); host.addEventListener('pointercancel',end);
  /* while a press-and-hold is extending the selection, the page mustn't scroll */
  host.addEventListener('touchmove',e=>{ if(TS.extending||TS.drag) e.preventDefault(); },{passive:false});
  host.addEventListener('contextmenu',e=>{ if(coarse()) e.preventDefault(); });
}
for(const id of ['tsA','tsB']){
  const h=$('#'+id);
  h.addEventListener('pointerdown',e=>{ e.preventDefault(); e.stopPropagation(); TS.drag=id; TS.pt={x:e.clientX,y:e.clientY}; tsEdgeStart(); try{ h.setPointerCapture(e.pointerId); }catch(_){} });
  h.addEventListener('pointermove',e=>{ if(TS.drag!==id) return; e.preventDefault(); TS.pt={x:e.clientX,y:e.clientY}; tsExtendTo(wordNear(e.clientX, id==='tsA'? e.clientY+13+(TS.bh||22)/2 : e.clientY-(TS.bh||22)/2-6)); });
  const up=()=>{ TS.drag=null; TS.justSelected=performance.now(); tsEdgeStop(); }; h.addEventListener('pointerup',up); h.addEventListener('pointercancel',up);
  h.addEventListener('touchmove',e=>e.preventDefault(),{passive:false});
}
/* a tap anywhere else lets go of the selection */
document.addEventListener('pointerdown',e=>{ if(!TS.on || TS.extending) return; if(e.target.closest('#selBar,.tsh,#sheet')) return; if(performance.now()-(TS.justSelected||0)<350) return; selClear(); TS.clearedAt=performance.now(); }, true);

/* ---------- share a quote as an image ---------- */
function quoteImage(s,e, style){
  style=style||LS.get('qstyle','light');
  const q=textOf(s,e); const quote=q.length>700? q.slice(0,700).replace(/\s+\S*$/,'')+'…' : q;
  const by=[citation(s,e)];
  const STY={light:{bg:'#f6f1e7',ink:'#2a241c',mute:'#7a6d5c',acc:'#a8743a'}, dark:{bg:'#1d1f24',ink:'#efe9de',mute:'#a59d90',acc:'#d7a45f'}, sepia:{bg:'#e9dcc3',ink:'#3a2c1a',mute:'#6f5b40',acc:'#8a5a2b'}};
  const c=document.createElement('canvas'); c.width=c.height=1080; const x=c.getContext('2d'); const st=STY[style]||STY.light;
  x.fillStyle=st.bg; x.fillRect(0,0,1080,1080);
  const serif='Georgia, "Iowan Old Style", "Times New Roman", serif';
  const wrap=(txt,size)=>{ x.font=`${size}px ${serif}`; const words=txt.split(/\s+/), lines=[]; let cur=''; for(const w of words){ const t=cur?cur+' '+w:w; if(x.measureText(t).width>840 && cur){ lines.push(cur); cur=w; } else cur=t; } if(cur) lines.push(cur); return lines; };
  let size=64, lines=wrap('“'+quote+'”',size); while(lines.length*size*1.35>620 && size>26){ size-=2; lines=wrap('“'+quote+'”',size); }
  const lh=size*1.35, total=lines.length*lh; let y=(1080-total-120)/2+size;
  x.fillStyle=st.acc; x.fillRect(120, y-size-28, 72, 5);
  x.fillStyle=st.ink; x.font=`${size}px ${serif}`; for(const l of lines){ x.fillText(l,120,y); y+=lh; }
  x.fillStyle=st.mute; x.font=`italic 34px ${serif}`; y+=30;
  if(by.length){ const t='— '+by.join(', '); const bl=wrap(t,34); x.font=`italic 34px ${serif}`; for(const l of bl.slice(0,2)){ x.fillText(l,120,y); y+=46; } }
  x.fillStyle=st.mute; x.globalAlpha=.55; x.font='22px -apple-system, system-ui, sans-serif'; x.fillText('Tooz eReader', 120, 1020); x.globalAlpha=1;
  const url=c.toDataURL('image/png');
  openSheet('Share as image', `<img class="qcard-prev" src="${url}" alt="Quote card">
    <div class="seg" style="margin-bottom:12px">${[['light','Light'],['sepia','Sepia'],['dark','Dark']].map(([k,l])=>`<button type="button" data-act="sty" data-s="${k}" aria-pressed="${k===style}">${l}</button>`).join('')}</div>
    <div class="row"><button class="btn primary" type="button" data-act="share">Share or save</button></div>`, {
    sty:(b)=>{ LS.set('qstyle',b.dataset.s); quoteImage(s,e,b.dataset.s); },
    share:()=>{ c.toBlob(async blob=>{ const name=(R.meta.title||'Quote').replace(/[^\w\s-]/g,'').slice(0,40).trim()+' quote.png'; const file=new File([blob], name, {type:'image/png'});
      try{ if(navigator.canShare && navigator.canShare({files:[file]})){ await navigator.share({files:[file]}); return; } }catch(err){ if(err&&err.name==='AbortError') return; }
      const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(a.href),4000); toast('Image saved'); }, 'image/png'); }
  });
}

/* ---------- highlights and notes ---------- */
function hlAt(i){ if(i==null) return null; return (R.meta.highlights||[]).find(h=>i>=h.s && i<=h.e)||null; }
function addHighlight(s,e,c,note){
  const list=R.meta.highlights; let notes=note?[note]:[];
  for(let k=list.length-1;k>=0;k--){ const h=list[k]; if(h.e>=s && h.s<=e){ s=Math.min(s,h.s); e=Math.max(e,h.e); if(h.note) notes.unshift(h.note); list.splice(k,1); } }
  const h={id:uid(), s, e, c, note:notes.join('\n\n'), at:Date.now()}; list.push(h); list.sort((a,b)=>a.s-b.s);
  touch(R.meta); redecorate(); return h;
}
function openHlMenu(h, focusNote){
  openSheet('Highlight', `
    <div class="quote">${esc(textOf(h.s,Math.min(h.e,h.s+120)))}${h.e>h.s+120?'…':''}</div>
    <div class="chips" style="gap:12px">${[1,2,3,4].map(c=>`<button class="swatch" type="button" data-act="col" data-c="${c}" aria-label="Color ${c}" aria-pressed="${h.c===c}" style="background:var(--hl${c})"></button>`).join('')}</div>
    <div class="field"><label for="hlNote">Note</label><textarea class="short" id="hlNote" placeholder="Add a note">${esc(h.note||'')}</textarea></div>
    <div class="row"><button class="btn primary" type="button" data-act="save">Save note</button><button class="btn" type="button" data-act="copy">Copy</button><button class="btn" type="button" data-act="share">Share image</button></div>
    <button class="btn block danger" type="button" data-act="del">${ICON.trash} Remove highlight</button>`, {
    col:(b)=>{ h.c=+b.dataset.c; touch(R.meta); redecorate(); document.querySelectorAll('#sheet .swatch').forEach(x=>x.setAttribute('aria-pressed', x===b)); },
    save:()=>{ h.note=$('#hlNote').value.trim(); touch(R.meta); redecorate(); closeSheet(); toast(h.note?'Note saved':'Note cleared'); },
    copy:()=>{ copyQuote(h.s,h.e); },
    share:()=>{ closeSheet(); quoteImage(h.s,h.e); },
    del:()=>{ const L=R.meta.highlights; const k=L.indexOf(h); if(k>=0) L.splice(k,1); touch(R.meta); redecorate(); closeSheet(); toast('Highlight removed'); }
  });
  if(focusNote) setTimeout(()=>{ const t=$('#hlNote'); t&&t.focus(); },120);
}

/* ---------- a Bible's own preference switches ----------
   The Crossway ESV has a Preferences page ([Red] [Black], cross-references [Yes] [No]…) worked by its own scripts,
   which Tooz never runs. Tooz recognises those links and applies them itself, for that book: words of Christ in red,
   cross-reference letters, footnote markers and verse numbers shown or hidden. Pop-ups are always on. */
const BP_KEY={redletter:'woc', crossrefs:'xr', footnotes:'fn', versenums:'vn', usenavigation:'nav'}, MK_BIT={woc:1, xr:2, fn:4, vn:8};
function loadMarks(text){
  R.mk=null; R.acts=null;
  if(text.marks){ R.mk=new Uint8Array(R.n); for(const k in text.marks){ const bit=MK_BIT[k]; if(!bit) continue; for(const [a,b] of text.marks[k]) for(let i=Math.max(0,a);i<Math.min(R.n,b);i++) R.mk[i]|=bit; } }
  if(text.acts){ R.acts=new Map(); for(const [a,b,x] of text.acts) for(let i=a;i<b&&i<R.n;i++) R.acts.set(i,x); }
  else oldPrefs();
  applyBookPrefs();
}
/* a Bible added before Tooz knew its Preferences page: find the switches by their wording, undo their mistaken note
   links, and mark cross-reference letters, footnote markers and verse numbers from what was kept (red letters need
   the book added again) */
const PREF_LINE=[[/^Words of Christ:/i,'redletter',{red:'show',black:'hide'}],[/^Display cross-references:/i,'crossrefs'],[/^Display footnote references:/i,'footnotes'],[/^Display verse numbers:/i,'versenums'],[/^Use pop-up navigation:/i,'usenavigation',{yes:'use',no:'skip'}]];
function oldPrefs(){
  const B=R.blocks||[], acts=new Map();
  for(const bl of B.slice(0,4000)){ if(bl.e-bl.s>12) continue; const t=R.words.slice(bl.s,bl.e).join(' ');
    const L=PREF_LINE.find(x=>x[0].test(t)); if(!L) continue;
    for(let k=bl.s;k<bl.e;k++){ const w=R.words[k].replace(/[\[\]]/g,'').toLowerCase(); const verb=(L[2]||{yes:'show',no:'hide'})[w]; if(verb){ acts.set(k, L[1]+'.'+verb); if(R.wf) R.wf[k]&=~F_N; R.notes.delete(k); } } }
  if(!acts.size) return;
  R.acts=acts;
  if(!R.mk && R.wf){ R.mk=new Uint8Array(R.n);
    for(const [k] of R.notes){ const w=R.words[k]; if(/^[a-z]{1,2}$/.test(w)) R.mk[k]|=MK_BIT.xr; else if(/^\[\d{1,3}\]$/.test(w)) R.mk[k]|=MK_BIT.fn; }
    for(let k=0;k<R.n;k++) if((R.wf[k]&F_P) && /^\d{1,3}$/.test(R.words[k])) R.mk[k]|=MK_BIT.vn; }
}
function bookPrefs(){ return Object.assign({woc:true, xr:true, fn:true, vn:true, nav:true}, (R.meta&&R.meta.bp)||{}); }
function applyBookPrefs(){ const p=bookPrefs(), v=$('#v-reader'); for(const k of ['woc','xr','fn','vn']) v.classList.toggle('bp-no'+k, !p[k]); }
function prefOn(act){ const [n,verb]=act.split('.'), k=BP_KEY[n]; return k==='nav'? verb==='use' : bookPrefs()[k]===(verb==='show'); }
function tapBookPref(i){
  const act=R.acts&&R.acts.get(i); if(!act) return; const [n,verb]=act.split('.'), k=BP_KEY[n];
  if(k==='nav' || prefOn(act)) return;
  R.meta.bp=Object.assign({}, R.meta.bp, {[k]: verb==='show'}); touch(R.meta); applyBookPrefs();
  document.querySelectorAll('#v-reader w.pa').forEach(w=>{ const x=R.acts.get(idxOf(w)); if(x) w.classList.toggle('on', prefOn(x)); });
  relayoutSoon();
}

/* ---------- footnotes ---------- */
/* ---------- scripture peek: references like "Isa. 26:8" or "1 Cor. 13:4–7" in any book (not in a Bible itself) get a
   faint dotted underline; tap one and a card shows the verses from your Bible. "Read it in context" opens the Bible
   there, and the hollow drop brings you back. ---------- */
const ORD_DIGIT={First:'1',Second:'2',Third:'3'};
/* references in words[a..b): "Ps. 33:6; 136:5" → both. A bare "12:1" only counts as a follow-on right after a ";" or
   "," or "and"/"cf.", so a cross-reference note's own verse ("b 1:2 Jer. 4:23") isn't taken for the book before it. */
const FOLLOW=/[;,]$/, FOLLOW_W=/^(and|or|also|cf\.?|see)$/i;
function refsIn(W, a, b, out, home){
  let book=null, ord='', c=0, at=-99;
  const parse=w=>{ const m=REF_RE.exec(coreOf(w)); return m? {c:+m[1], v:+m[2], x:m[3]?+m[3]:0, y:m[4]?+m[4]:0} : null; };
  const bare=w=>{ const m=/^(\d{1,3})(?:[–—-](\d{1,3}))?$/.exec(coreOf(w)); return m? {v:+m[1], x:m[2]?+m[2]:0} : null; };
  const set=(ks,r)=>{ for(const q of ks) if(q>=a) out.set(q,r); };
  for(let k=a;k<b;k++){
    const w=W[k]; if(!w) continue;
    const bk=BIBLE_BOOKS[bookKey(w)];
    if(bk && k+1<b && isRef(W[k+1])){ const o=BOOK_ORD[bookKey(W[k-1]||'')]; book=bk; ord=o?ORD_DIGIT[o]:'';
      const r=Object.assign({book, ord}, parse(W[k+1])); c=r.c; set(o?[k-1,k,k+1]:[k,k+1], r); at=k+1; k++; continue; }
    /* in a study Bible's notes: "ch. 3:28" is this book, "ver. 33" / "vv. 4–7" this chapter */
    if(home && /^[\[(]?(ch|chs|chap|chapter)\.?$/i.test(w) && k+1<b && isRef(W[k+1])){ book=home.book; ord=home.ord;
      const r=Object.assign({book, ord}, parse(W[k+1])); c=r.c; set([k,k+1], r); at=k+1; k++; continue; }
    if(home && home.c && /^[\[(]?(ver|vv|vs|verse|verses)\.?$/i.test(w) && k+1<b && bare(W[k+1])){ book=home.book; ord=home.ord; c=home.c;
      const bv=bare(W[k+1]), r={book, ord, c, v:bv.v, x:bv.x, y:0}; set([k,k+1], r); at=k+1; k++; continue; }
    const prev=W[k-1]||'';
    if(book && k-at<=6 && isRef(w) && (FOLLOW.test(prev) || FOLLOW_W.test(prev))){ const r=Object.assign({book, ord}, parse(w)); c=r.c; out.set(k, r); at=k; continue; }
    /* "Rev. 1:4, 8, 17": verses of the same chapter after a comma */
    if(book && c && k-at===1 && /,$/.test(prev) && bare(w)){ const bv=bare(w); out.set(k, {book, ord, c, v:bv.v, x:bv.x, y:0}); at=k; }
  }
  return out;
}
/* the Bible book a place in a Bible belongs to, from its contents ("1 John" → {book:'John', ord:'1'}) */
function bookAt(i){
  const ch=R.meta.chapters||[]; let hit=null;
  for(const x of ch){ if(x.i>i) break; const m=/^([1-3])?\s*(.+?)(?:\s+\d+)?$/.exec((x.t||'').trim()); const bk=m&&BIBLE_BOOKS[m[2].toLowerCase()]; if(bk) hit={book:bk, ord:m[1]||''}; }
  return hit;
}
function scanRefs(){
  if(R.refFor===R.meta.id) return R.refIdx;
  R.refFor=R.meta.id; R.refMap=new Map(); R.refIdx=[];
  /* in a Bible, only its notes and cross references (paragraphs without verse numbers), never the verse text */
  if(hasVerses()){ for(const bl of R.blocks||[]) if(!/^h/.test(bl.t) && !versesIn(bl.s,bl.e).length) refsIn(R.words, bl.s, bl.e, R.refMap); }
  else refsIn(R.words, 0, R.n, R.refMap);
  R.refIdx=[...R.refMap.keys()].sort((a,b)=>a-b);
  return R.refIdx;
}
function refName(r){ const b=(r.ord?r.ord+' ':'')+r.book; return `${b} ${r.c}:${r.v}`+(r.y? `–${r.x}:${r.y}` : r.x? `–${r.x}` : ''); }
function bibleAbbr(m){ const t=(m.title||'')+' '+(m.author||''); return /king james/i.test(t)?'KJV' : /world english/i.test(t)?'WEB' : /english standard|\besv\b/i.test(t)?'ESV' : (m.title||'Bible'); }
function pickBible(){
  const isBible=m=>/bible|english standard version|\besv\b|new international version|\bniv\b|\bnasb\b|\bcsb\b|\bnkjv\b/i.test(m.title||'') || /^shelf-(kjv|web)$/.test(m.id);
  return LIB.filter(isBible).sort((a,b)=>(!a.pending-!b.pending)*-1 || (b.lastRead||0)-(a.lastRead||0) || (a.id==='shelf-kjv'?-1:1))[0] || null;
}
async function bibleText(m){
  if(R.bible && R.bible.id===m.id) return R.bible.t;
  if(m.pending){ toast('Getting the Bible…', null, 0); const ok=await fetchShelfBook(m); $('#toast').hidden=true; if(!ok) return null; }
  const t=await Store.get('texts',m.id).catch(()=>null); if(t) R.bible={id:m.id, t}; return t;
}
/* where a reference is in a Bible: the chapter, then the verses (raised numbers) inside it */
/* Bibles are built many ways. The contents may list every chapter ("Genesis 1"), only the books, or nothing useful;
   verse numbers may be real superscripts or just styled numbers; a chapter may start with "11:1", a big "11", or a
   heading. So: find the book (contents, else a heading), then the chapter (contents, else the numbers in the text),
   then the verses (superscripts, else the numbers that count up 1, 2, 3… inside the chapter). */
const BK_KEY=s=>(s||'').toLowerCase().replace(/^(?:the\s+)?(?:book|gospel|letter|epistle|first letter|second letter|third letter|(?:first|second|third)\s+(?:book|letter|epistle))\s+(?:of|according to)\s+(?:(?:paul|the apostle paul|saint|st\.?)\s+(?:to\s+the\s+)?)?/,'')
  .replace(/^(first|second|third)\b/,w=>({first:'1',second:'2',third:'3'})[w]).replace(/^(i{1,3})\s+(?=[a-z])/,w=>String(w.trim().length)).replace(/[^a-z0-9]/g,'');
const vNum=w=>{ const m=/^[\[(]?(\d{1,3})(?::(\d{1,3}))?[\])]?[.:,]?$/.exec(w||''); if(m) return {a:+m[1], b:m[2]?+m[2]:0};
  const g=/^(\d{1,3})(?::(\d{1,3}))?(?!st\b|nd\b|rd\b|th\b|s\b)[^\d\s:,.%\-–—]/i.exec(w||''); return g? {a:+g[1], b:g[2]?+g[2]:0, g:1} : null; };   /* "2The": a styled verse number stuck to its first word */
function bibleBookSpan(m, t, names){
  const ch=m.chapters||[], n=t.words.length;
  const hit=k=>{ const x=BK_KEY(ch[k].t); return names.includes(x); };
  let j=ch.findIndex((c,k)=>hit(k));
  if(j>=0){ const d=ch[j].d||0; let b=n; for(let q=j+1;q<ch.length;q++){ const dq=ch[q].d||0;
      if(dq<d || (dq===d && !names.some(nm=>BK_KEY(ch[q].t).startsWith(nm)))){ b=ch[q].i; break; } }
    return {a:ch[j].i, b, j}; }
  /* not in the contents: a heading in the text with the book's name, up to the next heading of the same level */
  const B=t.blocks||[]; const kt=bl=>BK_KEY(t.words.slice(bl.s,bl.e).join(' '));
  const h=B.findIndex(bl=>/^h/.test(bl.t) && bl.e-bl.s<=8 && names.includes(kt(bl))); if(h<0) return null;
  for(let q=h+1;q<B.length;q++) if(B[q].t===B[h].t && B[q].e-B[q].s<=8 && BIBLE_BOOKS[BK_KEY(t.words.slice(B[q].s,B[q].e).join(' ')).replace(/^\d/,'')]) return {a:B[h].s, b:B[q].s, j:-1};
  return {a:B[h].s, b:n, j:-1};
}
/* chapter starts inside a book, read from the text: "3:1" markers, or a number opening a paragraph after which the
   verses restart at 2 (a verse number opening a paragraph is followed by the next verse instead) */
function textChapters(t, a, b){
  const starts=new Set(), inHead=new Set(), out=[{c:1,i:a}]; let next=1;
  for(const bl of t.blocks||[]){ if(bl.e<=a||bl.s>=b) continue; starts.add(bl.s); if(/^h/.test(bl.t)) for(let k=bl.s;k<bl.e;k++) inHead.add(k); }
  const F=k=>(t.wf && t.wf[k])||0, isV=k=>(F(k)&F_P) && /^\d{1,3}$/.test(t.words[k]);
  let np=0; for(let k=a;k<Math.min(b,a+30000)&&np<3;k++) if(isV(k)) np++;
  const raised=np>=3;   /* the verse numbers are superscripts, so only they count as verses */
  const nextNum=k=>{ for(let q=k+1;q<Math.min(b,k+400);q++){ if(inHead.has(q) || (F(q)&F_N)) continue;
      if(raised){ if(isV(q)) return +t.words[q]; continue; }
      const v=vNum(t.words[q]); if(v) return v.b? -1 : v.a; } return 0; };   /* a "3:1" marker next means this number was a verse */
  /* a chapter number opens a paragraph or is bold (some Bibles put the section title and "JOHN 3" in bold at the start of
     the chapter's first paragraph), and is followed by words, not more numbers (that's a list of chapters) */
  const mark=k=>{ if(F(k)&(F_P|F_N)) return false; if(!starts.has(k) && !(F(k)&F_B)) return false;
    const nx=t.words[k+1]; return !!nx && !vNum(nx) && /[A-Za-z“‘"(]/.test(nx); };
  for(let k=a;k<b;k++){
    if(inHead.has(k) || (F(k)&F_N)) continue; const v=vNum(t.words[k]); if(!v || v.g) continue;
    if(v.b===1 && v.a>=next && v.a<=next+1 && !(F(k+1)&F_N)){ if(v.a===1) out[0].i=k; else out.push({c:v.a,i:k}); next=v.a+1; continue; }
    if(!v.b && mark(k) && (v.a===next || v.a===next+1)){
      if(v.a===1){ if(nextNum(k)===2){ out[0].i=k; next=2; } continue; }
      if(nextNum(k)===2){ out.push({c:v.a,i:k}); next=v.a+1; }
    }
  }
  return out;
}
/* verse starts inside a chapter: superscripts if the Bible has them, else numbers counting up */
function textVerses(t, a, b, c){
  const vs=[]; for(let k=a;k<b;k++) if(t.wf && (t.wf[k]&F_P) && /^\d{1,3}$/.test(t.words[k])) vs.push({n:+t.words[k], i:k});
  if(vs.length>=2){ if(vs[0].n===2){ let i=a; for(let k=vs[0].i-1;k>=a;k--){ const f=(t.wf&&t.wf[k])||0; if(f&(F_P|F_N)) continue; const v=vNum(t.words[k]); if(v && !v.g && v.a===c && (v.b===1||!v.b)){ i=k; break; } } vs.unshift({n:1,i}); }   /* verse 1 unnumbered */
    return vs; }
  const out=[]; let exp=1;
  for(let k=a;k<b;k++){
    if(t.wf && (t.wf[k]&F_N)) continue; const v=vNum(t.words[k]); if(!v) continue;
    if(v.b){ if(v.a===c && v.b>=exp){ out.push({n:v.b,i:k}); exp=v.b+1; } continue; }
    if(!out.length && k-a<4 && v.a===c){ out.push({n:1,i:k}); exp=2; continue; }   /* a big chapter number standing in for verse 1 */
    if(v.a===exp){ out.push({n:exp,i:k}); exp++; }
    else if(exp===1 && v.a===2){ out.push({n:1,i:a},{n:2,i:k}); exp=3; }   /* verse 1 unnumbered at the chapter's start */
  }
  return out.length? out : vs;
}
function findVerses(m, t, r){
  const ch=m.chapters||[], key=s=>s.toLowerCase().replace(/[^a-z0-9]/g,'');
  const names=[(r.ord||'')+r.book]; if(r.book==='Psalm') names.push('psalms'); if(/^Song of/.test(r.book)) names.push('songofsolomon','songofsongs','canticles');
  const nk=names.map(key);
  let a=-1, b=t.words.length;
  /* the contents lists the chapter itself ("Genesis 1", "Psalm 23") */
  const j=ch.findIndex(c=>nk.some(n=>key(c.t)===n+r.c));
  if(j>=0){ a=ch[j].i; for(let q=j+1;q<ch.length;q++) if((ch[q].d||0)<=(ch[j].d||0)){ b=ch[q].i; break; } }
  else{
    R.bibleCache=R.bibleCache&&R.bibleCache.id===m.id&&R.bibleCache.n===t.words.length? R.bibleCache : {id:m.id, n:t.words.length};
    const ck=nk[0]; let bk=R.bibleCache[ck];
    if(bk===undefined){ const sp=bibleBookSpan(m, t, nk);
      if(sp){ /* chapters under the book in the contents ("1", "Chapter 1", "Genesis 1"), else read from the text */
        let kids=[]; if(sp.j>=0){ const d=ch[sp.j].d||0; for(let q=sp.j+1;q<ch.length&&ch[q].i<sp.b;q++){ const mm=/(\d{1,3})\s*$/.exec(ch[q].t); if(mm && (ch[q].d||0)>d) kids.push({c:+mm[1], i:ch[q].i}); } }
        sp.chs= kids.length? kids : textChapters(t, sp.a, sp.b); }
      bk=R.bibleCache[ck]=sp; }
    if(!bk) return null;
    const ci=bk.chs.findIndex(x=>x.c===r.c); if(ci<0) return null;
    a=bk.chs[ci].i; b= ci+1<bk.chs.length? bk.chs[ci+1].i : bk.b;
  }
  const vs=textVerses(t, a, b, r.c);
  const vi=vs.findIndex(v=>v.n===r.v); if(vi<0) return {i:a, s:-1, e:-1};
  const last= r.y? vs.length-1 : r.x? Math.max(vi, vs.findIndex(v=>v.n===r.x)) : vi;
  const lastCap=Math.min(last, vi+7);
  return {i:vs[vi].i, s:vs[vi].i, e: vs[lastCap+1]? vs[lastCap+1].i : b, more:lastCap<last, vs};
}
function versesHTML(t, s, e, vs){
  const at=new Map((vs||[]).map(v=>[v.i,v.n]));
  let h=''; for(let k=s;k<e;k++){ const f=t.wf? t.wf[k]:0; if(f&F_N) continue; const w=esc(t.words[k]);
    const sp= k>s && !(f&F_GLUE) ? ' ' : '';
    const m= at.has(k) && !(f&F_P) && /^(\d{1,3}(?::\d{1,3})?)(.*)$/.exec(t.words[k]);   /* plain-styled verse numbers shown raised too */
    h+= (f&F_P) && /^\d{1,3}$/.test(t.words[k]) ? `${sp}<sup>${w}</sup>` : m? `${sp}<sup>${at.get(k)}</sup>${m[2]?(/^[.,:\])]$/.test(m[2])?'':' ')+esc(m[2].replace(/^[.,:\])]$/,'')):''}` : sp+w; }
  return h;
}
async function openRefPeek(i){ scanRefs(); const r=R.refMap.get(i); if(r) return peekRef(r); }
async function peekRef(r){
  const m=pickBible(); const name=refName(r);
  if(!m){ openSheet(name, '<p class="note">Add a Bible to your library to see verses here.</p>', {}, 'short'); return; }
  const t=await bibleText(m); if(!t){ toast('Couldn’t get the Bible right now.'); return; }
  const at=findVerses(m, t, r);
  if(!at){ openSheet(name, `<p class="note">${esc(name)} isn’t in this Bible.</p>`, {}, 'short'); return; }
  const body= at.s>=0? `<div class="peek">${versesHTML(t, at.s, at.e, at.vs)}${at.more?' …':''}</div>` : `<p class="note">That verse isn’t in this chapter; you can open the chapter.</p>`;
  openSheet(name+' · '+bibleAbbr(m), body+`<button class="btn primary block" type="button" data-act="ctx">Read it in context</button>`, {
    ctx:()=>{ closeSheet(); jumpDoc(m.id, ()=>{ const v=findVerses(R.meta, R.text, r); R.flash= v&&v.s>=0? {s:v.s, e:v.e} : null; return v? v.i : at.i; }).then(()=>redecorate()); }   /* found again once open: opening can renumber words */
  }, 'short');
}
function openFootnote(i){
  if(i==null) return; if(R.backTo && R.backTo.has(i)){ goTo(R.backTo.get(i), true); return; }
  const t=R.notes.get(i); if(t==null) return;
  const B=R.blocks; let bi=blockAt(t); let s=B[bi].s, e=B[bi].e-1;
  if(e-s<4 && bi+1<B.length) e=B[bi+1].e-1;
  /* several notes can share a paragraph (a study Bible's cross references): show only this one */
  if(!R.noteT || R.noteT.id!==R.meta.id){ R.noteT={id:R.meta.id, a:[...new Set(R.notes.values())].sort((x,y)=>x-y)}; }
  { const A=R.noteT.a; let lo=0, hi=A.length; while(lo<hi){ const m=(lo+hi)>>1; if(A[m]<=t) lo=m+1; else hi=m; } if(lo<A.length && A[lo]>t && A[lo]<=e) e=A[lo]-1; if(t>s && t<=e) s=t; }
  const z=Math.min(e, s+200);
  /* scripture references in the note (cross references in a study Bible) can be tapped for the verses */
  let home=null; if(hasVerses()){ const b=bookAt(i)||bookAt(t), v=/^(\d{1,3}):\d{1,3}$/.exec(coreOf(R.words[s])||''); if(b) home=Object.assign(b, {c: v? +v[1] : 0}); }
  const refs=refsIn(R.words, s, z+1, new Map(), home); let h='', open=null;
  for(let k=s;k<=z;k++){ const r=refs.get(k), sp=k>s && !glued(k) ? ' ' : '';
    if(open && r!==open){ h+='</button>'; open=null; }
    let w=R.words[k];
    if(r && !open){ const lb=/^[\[(]*/.exec(w)[0]; h+=sp+esc(lb)+`<button type="button" class="nref" data-act="ref" data-k="${k}">`; w=w.slice(lb.length); open=r; } else h+=sp;
    if(open && refs.get(k+1)!==open){ const m=/^(.*?)([;,.\])]*)$/.exec(w); h+=esc(m[1])+'</button>'+esc(m[2]); open=null; }   /* brackets and punctuation stay outside */
    else h+=esc(w); }
  const ttl= home && home.c? refName({book:home.book, ord:home.ord, c:home.c, v:+(/:(\d+)/.exec(R.words[s])||[0,0])[1], x:0, y:0}) : 'Note';
  openSheet(ttl, `<div class="quote">${h}${e>s+200?'…':''}</div><button class="btn block" type="button" data-act="go">Go to this note in the book</button>`, {
    go:()=>{ closeSheet(); goTo(t,true); },
    ref:(b)=>{ const r=refs.get(+b.dataset.k); if(r) peekRef(r); } });
}

/* ---------- contents, bookmarks, highlights ---------- */
/* ---------- one sheet: Contents (with bookmarks in place) | Notes ----------
   Contents: search the book (chapter titles, bookmarks, then the text), a filter to one section, and a
   Both / Contents / Bookmarks switch that only shows once the book has bookmarks. Notes: highlights and notes,
   grouped by chapter, with their own search. The current chapter carries the drop. */
function placeLabel(i){
  if(R.mode==='pages' && R.SEC && R.SEC.length){
    const c=PC.counts||[]; let kw=0, kp=0; for(let k=0;k<R.SEC.length;k++) if(c[k]){ kw+=R.SEC[k][1]-R.SEC[k][0]; kp+=c[k]; }
    const wpp=kp? kw/kp : 280; let before=0;
    for(let k=0;k<R.SEC.length;k++){ const [a,b]=R.SEC[k]; const n=c[k]||Math.max(1,Math.round((b-a)/wpp));
      if(i<b || k===R.SEC.length-1) return 'Page '+(before+Math.min(n-1,Math.floor(n*(i-a)/Math.max(1,b-a)))+1).toLocaleString();
      before+=n; }
  }
  return 'Location '+(i+1).toLocaleString();
}
function tocSpan(k){ const ch=R.meta.chapters||[], d=ch[k].d||0; for(let j=k+1;j<ch.length;j++) if((ch[j].d||0)<=d) return [ch[k].i, ch[j].i]; return [ch[k].i, R.n]; }
function norm(s){ return (s||'').toLowerCase().replace(/[’‘]/g,"'").replace(/[“”]/g,'"').replace(/\s+/g,' ').trim(); }
function bmRow(b){
  const k=R.meta.bookmarks.indexOf(b), ch=currentChapter(b.i), cht=ch?ch.t:'';
  const sub=[cht?'in '+cht:'', b.name&&b.name!==cht? b.name:'', '“'+textOf(b.i,Math.min(R.n-1,b.i+8))+'…”'].filter(Boolean).join(' · ');
  return `<div class="li bmli"><button type="button" class="grow" data-act="go" data-i="${b.i}">${ICON.mark}<span><b>${esc(placeLabel(b.i))}</b><span class="small">${esc(sub)}</span></span></button><button class="icon-btn" type="button" data-act="rmbm" data-k="${k}" aria-label="Remove bookmark">${ICON.close}</button></div>`;
}
function tocList(){
  const ch=R.meta.chapters||[], bm=(R.meta.bookmarks||[]).slice().sort((a,b)=>a.i-b.i);
  const show=R.tocShowNow||'both', q=norm(R.tocQ), sc=R.tocScope&&R.tocScope.id===R.meta.id? R.tocScope.k : -1;
  const [lo,hi]= sc>=0&&ch[sc]? tocSpan(sc) : [0,R.n];
  const inScope=i=>i>=lo&&i<hi;
  const wantCh=show!=='marks', wantBm=show!=='toc';
  if(q){
    const chs=wantCh? ch.map((c,k)=>k).filter(k=>inScope(ch[k].i)&&norm(ch[k].t).includes(q)) : [];
    const bms=wantBm? bm.filter(b=>inScope(b.i)&&(norm(b.name).includes(q)||norm(textOf(b.i,Math.min(R.n-1,b.i+8))).includes(q))) : [];
    const ref=refTarget(R.tocQ||''); let h=(ref?`<button class="li refgo" type="button" data-act="go" data-i="${ref.i}"><span class="grow">Go to ${esc(ref.t)}</span><span class="small">${esc(placeLabel(ref.i))}</span></button>`:'')+chs.map(k=>`<button class="li" type="button" data-act="go" data-i="${ch[k].i}"><span class="grow">${esc(ch[k].t)}</span><span class="small">${esc(placeLabel(ch[k].i))}</span></button>`).join('')+bms.map(bmRow).join('');
    let txt='';
    if(q.length>=2){
      const {s,off}=buildSearchIndex(); const MAX=100; const hits=[]; let p=0, total=0;
      const cLo=off[Math.min(lo,R.n-1)], cHi=hi>=R.n? s.length : off[hi];
      p=cLo; while(total<5000){ p=s.indexOf(q,p); if(p<0||p>=cHi) break; total++; if(hits.length<MAX) hits.push(p); p+=q.length; }
      const qW=q.split(' ').length; const span=i=>{ let j=i,n=0; while(j<R.n&&n<qW){ j++; if(!glued(j)) n++; } return Math.max(1,j-i); };
      txt=hits.map(c=>{ const i=wordAtChar(c), L=span(i), a=Math.max(0,i-6), b=Math.min(R.n-1,i+L+8); let t=''; for(let k=a;k<=b;k++){ const w=esc(R.words[k]); t+=(k>a&&!glued(k)?' ':'')+(k>=i&&k<i+L?'<mark>'+w+'</mark>':w); }
        const c2=currentChapter(i); return `<button class="result" type="button" data-act="res" data-i="${i}" data-l="${L}">${a>0?'…':''}${t}${b<R.n-1?'…':''}<span class="where">${esc(c2?c2.t:'')} · ${esc(placeLabel(i))}</span></button>`; }).join('');
      if(total) txt=`<div class="tochd">In the text · ${total>=5000?'5000+':total}${total>MAX?` (first ${MAX} shown)`:''}</div>`+txt;
    }
    return (h||txt)? `<div class="list">${h}</div>${txt}` : '<p class="note">Nothing found.</p>';
  }
  if(!wantCh || !ch.length){
    const list=bm.filter(b=>inScope(b.i));
    if(!wantCh || bm.length) return list.length? `<div class="list">${list.map(bmRow).join('')}</div>` : '<p class="note">No bookmarks yet. Tap the bookmark at the bottom of any page.</p>';
    return '<p class="note">This document has no chapter list. Search above, or use the progress bar to move around.</p>';
  }
  const cur=currentChapter(R.pos);
  /* a very long list (the Bible's 1,189 chapters) shows books first; tap a book to show its chapters */
  let rows=ch.map((c,k)=>k), kids=new Set(), open=-1;
  if(ch.length>150){
    const maxD=Math.max(...ch.map(c=>c.d||0));
    const parentOf=k=>{ for(let j=k-1;j>=0;j--) if((ch[j].d||0)<(ch[k].d||0)) return j; return -1; };
    ch.forEach((c,k)=>{ if((c.d||0)===maxD){ const p=parentOf(k); if(p>=0) kids.add(p); } });
    const curK=ch.indexOf(cur);
    open = (R.tocOpen&&R.tocOpen.id===R.meta.id)? R.tocOpen.k : (curK>=0&&(cur.d||0)===maxD? parentOf(curK) : curK);
    if(maxD>0) rows=rows.filter(k=>(ch[k].d||0)<maxD || parentOf(k)===open);
  }
  rows=rows.filter(k=>inScope(ch[k].i));
  let h='', bj=0; const marks=wantBm? bm.filter(b=>inScope(b.i)) : [];
  while(bj<marks.length && rows.length && marks[bj].i<ch[rows[0]].i) h+=bmRow(marks[bj++]);
  rows.forEach((k,x)=>{ const c=ch[k], par=kids.has(k), nextI= x+1<rows.length? ch[rows[x+1]].i : Infinity;
    h+=`<button class="li${c===cur?' on':''}${k===open?' open':''}" type="button" data-act="${par?'tocx':'go'}" data-k="${k}" data-i="${c.i}" style="padding-left:${14+(c.d||0)*16}px"${par?` aria-expanded="${k===open}"`:''}><span class="grow">${par?(k===open?'▾ ':'▸ '):''}${esc(c.t)}</span><span class="small">${esc(placeLabel(c.i))}</span></button>`;
    while(bj<marks.length && marks[bj].i<nextI) h+=bmRow(marks[bj++]); });
  while(bj<marks.length) h+=bmRow(marks[bj++]);
  return `<div class="list">${h}</div>`;
}
function hlList(){
  const q=norm(R.hlQ); const hl=(R.meta.highlights||[]).slice().sort((a,b)=>a.s-b.s);
  if(!hl.length) return '<p class="note">Select text with a long press, then pick a color to highlight it or tap Note to add a note.</p>';
  const items=hl.filter(h=>!q||norm(textOf(h.s,h.e)).includes(q)||norm(h.note).includes(q));
  if(!items.length) return '<p class="note">Nothing found.</p>';
  let last=null, h='';
  for(const x of items){ const c=currentChapter(x.s), t=c?c.t:''; if(t!==last){ h+=`<div class="tochd">${esc(t)}</div>`; last=t; }
    h+=`<div class="hlrow"><span class="bar" style="background:var(--hl${x.c})"></span><div class="grow" data-act="go" data-i="${x.s}"><div class="t">${esc(textOf(x.s,Math.min(x.e,x.s+60)))}${x.e>x.s+60?'…':''}</div>${x.note?`<div class="nt">${esc(x.note)}</div>`:''}<div class="where">${esc(placeLabel(x.s))}</div></div><button class="icon-btn" type="button" data-act="edit" data-id="${x.id}" aria-label="Edit highlight">${ICON.more}</button></div>`; }
  return h + (q? '' : `<button class="btn block" type="button" data-act="copyall">Copy all highlights and notes</button>`);
}
function tocScopeOpts(){
  const ch=R.meta.chapters||[]; let ks=ch.map((c,k)=>k);
  if(ch.length>150){ const maxD=Math.max(...ch.map(c=>c.d||0)); if(maxD>0) ks=ks.filter(k=>(ch[k].d||0)<maxD); }
  return `<option value="-1">Whole book</option>`+ks.map(k=>`<option value="${k}">${' '.repeat(ch[k].d||0)}${esc(ch[k].t)}</option>`).join('');
}
/* ---------- the wheels (contents style "spine"; Aa → More text options → Contents: List | Wheels) ----------
   Picker wheels like the iPhone's date picker: Book | Chapter | Verse in a Bible, Part | Chapter | Page in a book
   with parts, Chapter | Page in a plain novel. Flick with momentum; the band across the middle is the pick, and it
   opens on where you are. When a wheel lands, the wheels to its right refill. Nothing moves until Go. A thin spine
   down the left keeps the map: chapters, highlights, bookmarks, the drop where you are, and a ring at the pick. */
function spineUse(){ return S.tocStyle==='spine' && (R.tocTab||'toc')==='toc' && !norm(R.tocQ); }
function pageNo(i){ const m=/^Page ([\d,]+)/.exec(placeLabel(i)); return m? +m[1].replace(/,/g,'') : 0; }
/* verse starts in [a,b): small raised numbers in the text */
function versesIn(a,b){ const out=[]; if(!R.wf) return out; for(let k=a;k<b&&k<R.n;k++) if((R.wf[k]&F_P) && /^\d{1,3}$/.test(R.words[k])) out.push({t:R.words[k], i:k}); return out; }
function hasVerses(){ if(R.vFor===R.meta.id) return R.vHas; const ch=R.meta.chapters||[]; let n=0;
  for(const c of ch.slice(0,40)){ if(versesIn(c.i,Math.min(R.n,c.i+400)).length>=2) n++; } R.vFor=R.meta.id; return R.vHas= n>=3; }
function kidsOf(k){ const ch=R.meta.chapters||[], [a,b]=tocSpan(k), d=ch[k].d||0; let kids=[], md=Infinity;
  for(let j=k+1;j<ch.length&&ch[j].i<b;j++){ const dj=ch[j].d||0; if(dj>d){ if(dj<md){ md=dj; kids=[]; } if(dj===md) kids.push(j); } }
  return kids; }
function shortTitle(j,k){ const ch=R.meta.chapters, p=k!=null? ch[k].t : null, t=ch[j].t; return p&&t.startsWith(p+' ')? t.slice(p.length+1) : t; }
/* the name on a wheel: short ("Book I" from "Book I: Admonitions…", "XII" from "XII: The Bishop…") */
function wheelLabel(j,k){ const t=shortTitle(j,k), m=/^([^:]{1,18}):\s+\S/.exec(t); return m? m[1] : t; }
/* the name on Go: the full title; a chapter listed only as a number ("I") gets the subtitle printed under its heading */
function fullTitle(j){ const ch=R.meta.chapters, t=ch[j].t;
  if(!/^(?:chapter\s+)?(?:[ivxlcdm]+|\d+)\.?$/i.test(t.trim()) || !R.blocks) return t;
  R.subT=R.subT&&R.subT.id===R.meta.id? R.subT : {id:R.meta.id};
  if(R.subT[j]!==undefined) return R.subT[j]||t;
  const bl=R.blocks; let lo=0, hi=bl.length-1; while(lo<hi){ const m=(lo+hi)>>1; if(bl[m].s<ch[j].i) lo=m+1; else hi=m; }
  const hb=bl[lo], nb=bl[lo+1]; let sub='';
  if(hb && hb.s===ch[j].i && /^h/.test(hb.t) && nb && nb.e-nb.s<=20 && (bl[lo+2]||{}).s===nb.e) sub=textOf(nb.s,nb.e-1).replace(/[.:;,]$/,'');
  return (R.subT[j]= sub? t.replace(/\.$/,'')+'. '+sub : '')||t; }
function pageEntries(a,b){
  b=Math.max(a+1,b); const out=[];
  if(R.mode==='pages'){ const p0=pageNo(a), p1=Math.max(p0,pageNo(b-1));
    if(p0) for(let p=p0;p<=p1;p++) out.push({t:'Page '+p.toLocaleString(), i: a+Math.round((p-p0)/(p1-p0+1)*(b-a))}); }
  if(!out.length) for(let i=a;i<b;i+=250) out.push({t:'Loc '+(i+1).toLocaleString(), i});
  return out;
}
function drawSpine(el){
  const ch=R.meta.chapters||[], sc=R.tocScope&&R.tocScope.id===R.meta.id? R.tocScope.k : -1;
  const [lo,hi]= sc>=0&&ch[sc]? tocSpan(sc) : [0,R.n];
  const H=el.clientHeight, PAD=14, GOH=86, U=Math.max(40,H-2*PAD), X=16;
  const y=i=>PAD+U*(clamp(i,lo,hi)-lo)/Math.max(1,hi-lo);
  const ks=ch.map((c,k)=>k).filter(k=>ch[k].i>=lo&&ch[k].i<hi);
  /* the first wheel: a level of the book (with any front/back matter beside it) whose size best fits, skipping a
     wrapper heading that holds most of the book (books in the Bible, Book I–IV in a treatise, chapters in a novel) */
  const kidsIn=k=>ks.some(j=>j>k&&(ch[j].d||0)>(ch[k].d||0)&&ch[j].i<tocSpan(k)[1]);
  const ds=[...new Set(ks.map(k=>ch[k].d||0))].sort((a,b)=>a-b), fit=Math.max(4,U/26);
  const levelList=d=>ks.filter(k=>{ const dk=ch[k].d||0; return dk===d || dk<d && !kidsIn(k); });
  const score=d=>{ const L=levelList(d); if(!L.length) return 99; const big=Math.max(...L.map(k=>{ const [a,b]=tocSpan(k); return (Math.min(b,hi)-a)/Math.max(1,hi-lo); }));
    return Math.abs(Math.log(L.length/fit)) + (big>.5&&L.length>1? 2 : 0); };
  const lv=ds.length? ds.reduce((best,d)=>score(d)<score(best)? d : best, ds[0]) : 0;
  const items=levelList(lv);
  const verses=hasVerses();
  /* what's inside an entry: its chapters, else its verses (Bible chapter), else its pages */
  const inside=(e,col)=>{ if(e.k!=null){ const kids=kidsOf(e.k);
      if(kids.length>=1){ const path=[e.path, e.t].filter(Boolean).join(' · ');
        return kids.map(j=>{ const f=fullTitle(j); return {t:wheelLabel(j,e.k), full:f, path: f.startsWith(e.full)? e.path : path, i:ch[j].i, k:j}; }); }
      const [a,b]=tocSpan(e.k); if(verses){ const vs=versesIn(a,b); if(vs.length>=2) return vs.map(v=>({t:v.t, full:e.full+':'+v.t, path:e.path, i:v.i})); }
      if(col===0) return pageEntries(a,b).map(p=>({t:p.t, full:e.full, path:e.path, page:1, i:p.i})); }   /* pages only beside a single level */
    return null; };
  const L1= items.length? items.map(k=>({t:wheelLabel(k,null), full:fullTitle(k), path:'', i:ch[k].i, k})) : pageEntries(lo,hi).map(p=>({t:p.t, full:p.t, path:'', page:1, i:p.i}));
  /* the map */
  let h=`<div class="whmap"><i class="sp-track" style="top:${PAD}px;height:${U}px;left:${X-2}px"></i>`;
  if(R.pos>=lo) h+=`<i class="sp-read" style="top:${PAD}px;height:${y(R.pos)-PAD}px;left:${X-2}px"></i>`;
  if(items.length<400) for(const k of items) h+=`<i class="sp-tick" style="top:${y(ch[k].i)}px;left:${X-5}px"></i>`;
  h+=`</div>`;
  for(const x of (R.meta.highlights||[])) if(x.s>=lo&&x.s<hi) h+=`<button type="button" class="sp-bead" data-h="${x.id}" style="top:${y(x.s)}px;left:${X}px;--hc:var(--hl${x.c})" aria-label="Highlight"></button>`;
  (R.meta.bookmarks||[]).forEach((b,k)=>{ if(b.i>=lo&&b.i<hi) h+=`<button type="button" class="sp-flag" data-b="${k}" style="top:${y(b.i)}px;left:${X+4}px" aria-label="Bookmark">${ICON.mark}</button>`; });
  if(R.pos>=lo&&R.pos<hi) h+=`<i class="sp-drop" style="top:${y(R.pos)}px;left:${X}px"></i>`;
  h+=`<i class="wh-tgt" style="left:${X}px"></i><div class="whs" style="bottom:${GOH}px"><i class="wh-band"></i></div>
    <button type="button" class="btn primary whgo"><span class="wg-t"></span><span class="wg-s"></span></button>
    <button type="button" class="sp-card" hidden></button>`;
  el.innerHTML=h;
  const whs=el.querySelector('.whs'), go=el.querySelector('.whgo'), tgt=el.querySelector('.wh-tgt'), card=el.querySelector('.sp-card');
  const cols=[];          /* {el, entries, x} */
  const pickNow=()=>{ let e=null; for(const c of cols){ if(c.stale) break; e=c.entries[c.x]||e; } return e; };
  let exact=null;          /* set while/after dragging the left line: Go goes to that exact spot */
  const label=()=>{ const e=pickNow(); if(!e) return; const at= exact!=null? exact : e.i, pl=placeLabel(at);
    go.querySelector('.wg-t').textContent='Go to '+e.full; go.querySelector('.wg-s').textContent=[e.path, e.full.includes(pl)? '' : pl].filter(Boolean).join(' · ');
    go.dataset.i=at; tgt.style.top=y(at)+'px'; };
  const atPos=(list,t=R.pos)=>{ let x=0; list.forEach((e,j)=>{ if(e.i<=t) x=j; }); return x; };
  function setCols(from, target){        /* (re)build the wheels right of column `from` from its pick */
    const t= target!=null? target : R.pos;
    for(const c of cols.splice(from+1)) c.el.remove();
    let parent=cols[from].entries[cols[from].x];
    while(cols.length<3 && parent){ const list=inside(parent, cols.length-1); if(!list||!list.length) break;
      const sel= t>=parent.i && t<(tocEnd(parent)) ? atPos(list,t) : 0;
      addCol(list, sel); parent= list[0]&&list[0].k!=null? list[cols[cols.length-1].x] : null; }
    layout(); label();
  }
  const tocEnd=e=> e.k!=null? tocSpan(e.k)[1] : e.i+1;
  const IH=40;
  function addCol(list, sel){
    const c={el:document.createElement('div'), entries:list, x:sel, stale:false}; c.el.className='whc';
    c.el.innerHTML=`<div class="whp"></div>${list.map((e,j)=>`<div class="whi" data-x="${j}">${esc(e.t)}</div>`).join('')}<div class="whp"></div>`;
    whs.appendChild(c.el); cols.push(c); const me=cols.length-1;
    let raf=0, tm=0;
    c.el.addEventListener('scroll',()=>{ if(!raf) raf=requestAnimationFrame(()=>{ raf=0; shade(c);
      const x=clamp(Math.round(c.el.scrollTop/IH),0,list.length-1);
      if(x!==c.x){ c.x=x; exact=null; for(let j=me+1;j<cols.length;j++){ cols[j].stale=true; cols[j].el.classList.add('stale'); } label(); } });
      clearTimeout(tm); tm=setTimeout(()=>{ if(cols[me]!==c) return; if(cols.slice(me+1).some(k=>k.stale)) setCols(me); }, 160); },{passive:true});
    c.el.addEventListener('click',e=>{ const it=e.target.closest('.whi'); if(it) c.el.scrollTo({top:+it.dataset.x*IH, behavior:'smooth'}); });
  }
  function shade(c){ if(c.lastOn&&!c.lastOn.isConnected) c.lastOn=null; const mid=c.el.scrollTop/IH, a=Math.max(0,Math.floor(mid-6)), b=Math.min(c.entries.length-1,Math.ceil(mid+6)), its=c.el.children;
    for(let j=a;j<=b;j++){ const d=Math.abs(j-mid), it=its[j+1]; it.style.opacity=Math.max(.18,1-d*.22); it.style.transform=`scale(${Math.max(.8,1-d*.05)})`; if(d<.5&&c.lastOn!==it){ if(c.lastOn) c.lastOn.classList.remove('on'); it.classList.add('on'); c.lastOn=it; } } }
  function layout(){ const ph=(whs.clientHeight-IH)/2;
    /* each wheel as wide as its longest name needs (within reason) */
    const need=cols.map(c=>Math.min(16,Math.max(3,...c.entries.map(e=>e.t.length))));
    cols.forEach((c,j)=>{ c.el.style.flex=`${need[j]} 1 0`; c.el.querySelectorAll('.whp').forEach(p=>p.style.height=ph+'px'); c.el.scrollTop=c.x*IH; c.stale=false; c.el.classList.remove('stale'); shade(c); }); }
  addCol(L1, atPos(L1)); setCols(0);
  go.onclick=()=>{ closeSheet(); goTo(+go.dataset.i,true); };
  /* drag the thin line on the left to run through the whole book: every wheel follows the thumb (section, chapter,
     verse or page), and Go goes to the exact spot under it */
  const map=el.querySelector('.whmap'); let md=null;
  function seek(i){
    for(let n=0;n<cols.length;n++){ const c=cols[n], x=atPos(c.entries,i);
      if(x!==c.x || c.stale){ c.x=x; c.el.scrollTop=x*IH; shade(c); setCols(n,i); return; } }
  }
  const mapTo=cy=>{ const r=el.getBoundingClientRect(), i=Math.min(hi-1,Math.round(lo+(hi-lo)*clamp((cy-r.top-PAD)/U,0,1)));
    exact=i; seek(i); label(); };
  map.addEventListener('pointerdown',e=>{ md=1; try{ map.setPointerCapture(e.pointerId); }catch(_){} map.classList.add('drag'); card.hidden=true; mapTo(e.clientY); e.preventDefault(); });
  map.addEventListener('pointermove',e=>{ if(md) mapTo(e.clientY); });
  const mapUp=()=>{ if(!md) return; md=null; map.classList.remove('drag'); };
  map.addEventListener('pointerup',mapUp); map.addEventListener('pointercancel',mapUp);
  const showCard=(i,html)=>{ card.innerHTML=html; card.dataset.i=i; card.hidden=false; const ch2=card.offsetHeight; card.style.top=clamp(y(i)-ch2/2,4,H-ch2-4)+'px'; };
  el.onclick=e=>{ const bd=e.target.closest('.sp-bead'), fl=e.target.closest('.sp-flag'), cd=e.target.closest('.sp-card');
    if(cd){ closeSheet(); goTo(+cd.dataset.i,true); return; }
    if(!card.hidden && !e.target.closest('.sp-bead,.sp-flag')){ card.hidden=true; }
    if(bd){ const x=R.meta.highlights.find(z=>z.id===bd.dataset.h); if(x) showCard(x.s, `<span class="t" style="--hc:var(--hl${x.c})">${esc(textOf(x.s,Math.min(x.e,x.s+40)))}${x.e>x.s+40?'…':''}</span>${x.note?`<span class="nt">${esc(x.note)}</span>`:''}<span class="where">${esc(((currentChapter(x.s)||{}).t||''))} · ${esc(placeLabel(x.s))}</span>`); return; }
    if(fl){ const b=R.meta.bookmarks[+fl.dataset.b]; if(b) showCard(b.i, `<span class="bt">${ICON.mark}${esc(placeLabel(b.i))}</span><span class="where">${esc(((currentChapter(b.i)||{}).t||''))}${b.name&&b.name!==(currentChapter(b.i)||{}).t?' · '+esc(b.name):''}</span>`); return; }
  };
}
/* a typed reference ("rev 22 3", "jn 3:16", "1 cor 13") in a book with verses */
const REF_ABBR={jn:'john',jhn:'john',jon:'jonah',jnh:'jonah',jdg:'judges',judg:'judges',jud:'jude',jde:'jude',mk:'mark',mrk:'mark',mt:'matthew',mat:'matthew',lk:'luke',luk:'luke',php:'philippians',phil:'philippians',phm:'philemon',philem:'philemon',ps:'psalms',psa:'psalm',psalm:'psalm',ez:'ezekiel',ezk:'ezekiel',sos:'song',rv:'revelation',rm:'romans',ro:'romans',gn:'genesis',ex:'exodus',lv:'leviticus',nm:'numbers',nu:'numbers',dt:'deuteronomy',jas:'james',jm:'james',co:'corinthians',cor:'corinthians',th:'thessalonians',thes:'thessalonians',ti:'timothy',tim:'timothy',pe:'peter',pt:'peter',jo:'john',sa:'samuel',sam:'samuel',ki:'kings',kgs:'kings',ch:'chronicles',chr:'chronicles'};
function refTarget(q){
  if(!hasVerses()) return null;
  const m=/^([1-3])?\s*([a-z]+)\.?\s*(?:(\d{1,3})(?:\s*[:. ]\s*(\d{1,3}))?)?$/.exec(q.toLowerCase().trim()); if(!m) return null;
  const nm=(m[1]||'')+(REF_ABBR[m[2]]||m[2]), ch=R.meta.chapters||[];
  const books=ch.map((c,k)=>k).filter(k=>kidsOf(k).length>=1 && kidsOf(k).every(j=>!kidsOf(j).length));
  const key=k=>ch[k].t.toLowerCase().replace(/[^a-z0-9]/g,'');
  let k=books.find(k=>key(k)===nm) ?? books.find(k=>key(k).startsWith(nm));
  if(k==null && nm.replace(/^\d/,'').length>=2){ const re=new RegExp('^'+nm.split('').join('.*')); k=books.find(b=>re.test(key(b))); }
  if(k==null) return null;
  let t=ch[k].t, i=ch[k].i;
  if(m[3]){ const kids=kidsOf(k), j=kids[+m[3]-1]; if(j==null) return null; t=ch[j].t; i=ch[j].i;
    if(m[4]){ const [a,b]=tocSpan(j), v=versesIn(a,b).find(v=>v.t===m[4]); if(!v) return null; t+=':'+m[4]; i=v.i; } }
  return {t, i};
}
function openToc(tab, inPlace){
  if(R.mode==='speed' && R.playing) pause();
  let t=tab||R.tocTab||'toc'; R.tocTab=t;
  if(t==='marks'){ t='toc'; R.tocShowNow='marks'; } else if(tab) R.tocShowNow=LS.get('tocShow','both');
  if(!(R.meta.bookmarks||[]).length) R.tocShowNow='both';
  if(R.tocFor!==R.meta.id){ R.tocFor=R.meta.id; R.tocQ=''; R.hlQ=''; }
  const ch=R.meta.chapters||[], nb=(R.meta.bookmarks||[]).length, sc=R.tocScope&&R.tocScope.id===R.meta.id? R.tocScope.k : -1;
  const seg=`<div class="seg" id="tocTabs">${[['toc','Contents'],['hls','Notes']].map(([k,l])=>`<button type="button" data-act="tab" data-t="${k}" aria-pressed="${t===k}">${l}</button>`).join('')}</div>`;
  let body;
  if(t==='toc'){
    body=`<div class="tocbar"><input class="input" id="tocQ" type="search" placeholder="Search this book" enterkeyhint="search" autocomplete="off" autocapitalize="off" spellcheck="false" value="${esc(R.tocQ||'')}">${ch.length?`<label class="icon-btn tocflt${sc>=0?' on':''}" aria-label="Show one section">${ICON.filter}<select id="tocScope">${tocScopeOpts()}</select></label>`:''}</div>`
      +(sc>=0&&ch[sc]?`<div class="tocscope"><span>${esc(ch[sc].t)}</span><button class="icon-btn" type="button" data-act="unscope" aria-label="Show the whole book">${ICON.close}</button></div>`:'')
      +(nb&&S.tocStyle!=='spine'?`<div class="seg tocshow" id="tocShowSeg">${[['both','Both'],['toc','Contents'],['marks','Bookmarks']].map(([k,l])=>`<button type="button" data-act="show" data-s="${k}" aria-pressed="${R.tocShowNow===k}">${l}</button>`).join('')}</div>`:'')
      +`<div id="tocOut">${spineUse()?'<div class="spnmap" id="spine"></div>':tocList()}</div>`;
  } else {
    body=`<input class="input" id="hlQ" type="search" placeholder="Search highlights and notes" enterkeyhint="search" autocomplete="off" autocapitalize="off" spellcheck="false" value="${esc(R.hlQ||'')}"><div id="tocOut">${hlList()}</div>`;
  }
  const acts={
    tab:(b)=>{ R.tocTab=b.dataset.t; openToc(b.dataset.t, true); },
    show:(b)=>{ R.tocShowNow=b.dataset.s; LS.set('tocShow',R.tocShowNow); b.parentNode.querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',x===b)); $('#tocOut').innerHTML=tocList(); },
    unscope:()=>{ R.tocScope=null; openToc(); },
    tocx:(b)=>{ const k=+b.dataset.k; const was=R.tocOpen&&R.tocOpen.id===R.meta.id&&R.tocOpen.k===k; R.tocOpen={id:R.meta.id, k: was? -1 : k}; openToc(); setTimeout(()=>{ const o=$('#sheet .li.open'); o&&o.scrollIntoView({block:'start'}); },40); },
    go:(b)=>{ closeSheet(); goTo(+b.dataset.i, true); },
    res:(b)=>{ const i=+b.dataset.i, len=+b.dataset.l; closeSheet(); goTo(i,true).then(()=>flashFound(i,len)); },
    rmbm:(b)=>{ const bm=R.meta.bookmarks, k=+b.dataset.k, gone=bm[k]; bm.splice(k,1); touch(R.meta); updateChrome(); openToc();
      toast('Bookmark deleted', {label:'Undo', fn:()=>{ bm.push(gone); bm.sort((a,c)=>a.i-c.i); touch(R.meta); updateChrome(); if(!$('#sheet').hidden) openToc(); }}); },
    edit:(b)=>{ const h=R.meta.highlights.find(x=>x.id===b.dataset.id); if(h) openHlMenu(h); },
    copyall:async()=>{ const txt=R.meta.title+'\n\n'+R.meta.highlights.slice().sort((a,b)=>a.s-b.s).map(h=>'“'+textOf(h.s,h.e)+'” — '+(hasVerses()? verseRef(h.s,h.e) : placeCite(h.s)||R.meta.title)+(h.note?'\nNote: '+h.note:'')).join('\n\n'); try{ await navigator.clipboard.writeText(txt); toast('Copied '+R.meta.highlights.length+' highlight'+(R.meta.highlights.length===1?'':'s')); }catch(e){ toast('Couldn’t copy on this device.'); } }
  };
  /* already open: swap the contents in place, so quick taps inside the sheet aren't eaten as ghost taps */
  const cls='toc'+(S.tocStyle==='spine'&&t==='toc'?' spine':'');
  const sh=$('#sheet'); if(!sh.hidden && sh.classList.contains('toc') && (!tab||inPlace)){ sheetActs=acts; sh.className=cls;
    /* keep the Contents | Notes control itself, so the drop slides across instead of growing in anew */
    const tabs=$('#tocTabs'), pane=$('#tocPane');
    if(tabs&&pane){ tabs.querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',x.dataset.t===t)); pane.innerHTML=body; }
    else sh.querySelector('.sheet-body').innerHTML=seg+`<div id="tocPane">${body}</div>`; }
  else openSheet(R.meta.title, seg+`<div id="tocPane">${body}</div>`, acts, cls);
  const sp=$('#spine'); if(sp) requestAnimationFrame(()=>drawSpine(sp));
  const out=$('#tocOut'), inp=$('#tocQ')||$('#hlQ'); let tm=null;
  inp.addEventListener('input',()=>{ clearTimeout(tm); tm=setTimeout(()=>{ if(t==='toc'){ R.tocQ=inp.value; if(spineUse()){ if(!$('#spine')){ out.innerHTML='<div class="spnmap" id="spine"></div>'; drawSpine($('#spine')); } } else out.innerHTML=tocList(); } else { R.hlQ=inp.value; out.innerHTML=hlList(); } }, t==='toc'?260:120); });
  const sel=$('#tocScope'); if(sel){ sel.value=String(sc); sel.addEventListener('change',()=>{ const k=+sel.value; R.tocScope= k>=0? {id:R.meta.id,k} : null; openToc(); }); }
  if(t==='toc' && tab && !inPlace && !R.tocQ && !spineUse()) setTimeout(()=>{ const on=$('#sheet .li.on')||$('#sheet .li.open'); on&&on.scrollIntoView({block:'center'}); },30);
}

/* ---------- search ---------- */
function buildSearchIndex(){
  if(R.sIdx) return R.sIdx; let s=''; const off=new Int32Array(R.n);
  for(let k=0;k<R.n;k++){ if(k>0 && !glued(k)) s+=' '; off[k]=s.length; s+=R.words[k].toLowerCase().replace(/[’‘]/g,"'").replace(/[“”]/g,'"'); }
  return R.sIdx={s,off};
}
function wordAtChar(c){ const off=R.sIdx.off; let lo=0, hi=off.length-1; while(lo<hi){ const m=(lo+hi+1)>>1; if(off[m]<=c) lo=m; else hi=m-1; } return lo; }
function flashFound(i,len){
  if(R.mode==='speed') return;
  const ws=[]; for(let k=i;k<i+len;k++){ const w=wordEl(k); if(w){ w.classList.add('found'); ws.push(w); } }
  setTimeout(()=>ws.forEach(w=>w.classList.remove('found')),2600);
}

/* ---------- read aloud ---------- */
const TTS={on:false, utt:null, cur:-1, voices:[], seq:0, mode:false, pick:null};
function voiceTier(v){ const u=(v.voiceURI+' '+v.name).toLowerCase(); if(/premium|enhanced|neural|natural/.test(u)) return 0; if(/eloquence|speech\.synthesis\.voice|bells|bubbles|zarvox|whisper|trinoids|organ|cellos|bahh|boing|jester|superstar|wobble|albert|bad news|good news/.test(u)) return 2; return 1; }
function voiceLabel(v){ let n=v.name.replace(/\s*\((Enhanced|Premium)\)/i,''); const u=(v.voiceURI+' '+v.name).toLowerCase(); const q=/premium/.test(u)?'Premium':/enhanced/.test(u)?'Enhanced':''; const reg=(v.lang||'').split(/[-_]/)[1]; return n+(q?' · '+q:'')+(reg?' ('+reg.toUpperCase()+')':'')+(v.localService===false?' · online':''); }
function voicePreview(){ try{ speechSynthesis.cancel(); const u=new SpeechSynthesisUtterance('This is how your books will sound when Tooz reads them aloud.'); const v=TTS.voices.find(x=>x.voiceURI===S.ttsVoice); if(v){ u.voice=v; u.lang=v.lang; } u.rate=S.ttsRate||1; speechSynthesis.speak(u); }catch(e){ toast('Read aloud isn’t available here.'); } }
function ttsVoices(){ try{ TTS.voices=speechSynthesis.getVoices()||[]; }catch(e){ TTS.voices=[]; } return TTS.voices; }
if('speechSynthesis' in window){ ttsVoices(); try{ speechSynthesis.addEventListener('voiceschanged',ttsVoices); }catch(e){} }
function ttsStart(){
  if(R.mode==='speed') return;
  const nat=S.ttsEngine!=='system';
  if(!nat && !('speechSynthesis' in window)){ toast('Read aloud isn’t available on this device.'); return; }
  stopActivity(); selClear(); TTS.mode=true; ttsPickMark(null); TTS.on=true; TTS.seq++; TTS.nat=nat; requestWake(); updateChrome(); asUI();
  if(nat){ natStart(); return; }
  try{ speechSynthesis.cancel(); }catch(e){}
  ttsSpeakFrom(R.pos, TTS.seq);
}
function ttsStop(){ if(!TTS.on) return; TTS.on=false; TTS.seq++; if(TTS.nat) natClear(); try{ speechSynthesis.cancel(); }catch(e){} ttsMark(-1); releaseWake(); resetClock(); updateChrome(); }
/* start reading again from the current word (after a jump or a voice change) */
function ttsRestart(){
  if(TTS.nat){ if(!natReady() && !abPartAt(R.pos)){ natClear(); natStart(); return; } TTS.seq++; natSpeakFrom(R.pos, TTS.seq); return; }
  TTS.seq++; try{ speechSynthesis.cancel(); }catch(e){} ttsSpeakFrom(R.pos, TTS.seq);
}
function ttsSpeakFrom(i, seq){
  if(!TTS.on || seq!==TTS.seq) return;
  if(i>=R.n){ ttsStop(); toast('Finished reading aloud'); return; }
  const ch=speechChunk(i,70,12); const j=ch.j, text=ch.text, map=ch.map; i=ch.i;
  if(!text){ if(j>=R.n){ ttsStop(); toast('Finished reading aloud'); return; } ttsSpeakFrom(j, seq); return; }
  const t0=performance.now();
  const u=new SpeechSynthesisUtterance(text); u.rate=S.ttsRate;
  const v=TTS.voices.find(x=>x.voiceURI===S.ttsVoice); if(v){ u.voice=v; u.lang=v.lang; } else u.lang=document.documentElement.lang||'en';
  let lastMark=i;
  u.onboundary=(e)=>{ if(seq!==TTS.seq) return; if(e.name && e.name!=='word') return; const c=e.charIndex; let lo=0, hi=map.length-1; while(lo<hi){ const m=(lo+hi+1)>>1; if(map[m]<=c) lo=m; else hi=m-1; } lastMark=i+lo; ttsMark(lastMark); };
  u.onend=()=>{ if(seq===TTS.seq && TTS.on){ const ms=performance.now()-t0; recordStats(Math.max(500,ms), j-i); ttsLearn(j-i, ms); if(ch.pauseAfter) setTimeout(()=>{ if(seq===TTS.seq && TTS.on) ttsSpeakFrom(j, seq); }, ch.pauseAfter/(S.ttsRate||1)); else ttsSpeakFrom(j, seq); } };
  u.onerror=(e)=>{ if(seq!==TTS.seq) return; if(e.error==='interrupted'||e.error==='canceled') return; ttsStop(); toast('Read aloud stopped ('+(e.error||'error')+').'); };
  TTS.utt=u; ttsMark(i); speechSynthesis.speak(u);
}
let ttsMoveT=0;
async function ttsMark(k){
  const prev=TTS.cur; TTS.cur=k;
  if(prev>=0){ const p=wordEl(prev); if(p) p.classList.remove('tts'); }
  if(k<0) return;
  R.pos=k;
  let w=wordEl(k);
  if(!w){ if(R.mode==='pages') await pgShow(k); else if(R.mode==='scroll') await scShow(k); w=wordEl(k); }
  if(!w) return; w.classList.add('tts');
  if(R.mode==='pages'){ const pg=pgPageOfEl(w); if(pg!==P.page){ pgSet(pg,true); } }
  else if(R.mode==='scroll'){
    /* keep the spoken word no lower than the middle of the screen; only the end of the book lets it go further down */
    const r=w.getBoundingClientRect(), v=scView.getBoundingClientRect(), mid=v.top+v.height*0.5, wc=r.top+r.height/2;
    if(wc>mid || r.top<v.top+8){ scView.scrollTo({top:scView.scrollTop+(wc-mid), behavior: Math.abs(wc-mid)>v.height*0.6?'auto':'smooth'}); }
  }
  const now=performance.now(); if(now-ttsMoveT>800){ ttsMoveT=now; updateChrome(); if(now-R.lastSave>3000) saveProgress(); }
}
/* ---------- read-aloud controls ----------
   The speaker button opens the audio controls (in place of the auto-scroll controls). Nothing plays until Play.
   While the controls are open, tapping a word chooses where to start (or jumps there if already playing). */
function ttsModeOn(){
  if(R.mode==='speed') return;
  if(SC.auto) asStop(true);
  selClear(); TTS.mode=true; TTS.pick=null; setChrome(true); updateChrome(); asUI();
  /* with "hide controls" on, the page normally runs under the controls; make room for them while they stay up */
  if($('#v-reader').classList.contains('overlay')){ holdPlace(); $('#v-reader').classList.remove('overlay'); relayoutSoon(); }
}
function ttsModeOff(quiet){ ttsStop(); ttsPickMark(null); TTS.mode=false; updateChrome(); asUI();
  if(!quiet && S.focus && R.mode && R.mode!=='speed' && !$('#v-reader').classList.contains('overlay')){ holdPlace(); $('#v-reader').classList.add('overlay'); relayoutSoon(); } }
function ttsBarUI(){
  const b=$('#ttsBar'); b.hidden=!TTS.mode || R.mode==='speed'; $('#ttsHint').hidden=b.hidden || TTS.on || TTS.pick!=null; if(b.hidden) return;
  $('#ttsPlay').innerHTML=TTS.on?ICON.pause:ICON.play; $('#ttsPlay').setAttribute('aria-label',TTS.on?'Pause':'Play');
  $('#ttsSpeed').value=S.ttsRate||1; $('#ttsLabel').textContent=(+(S.ttsRate||1)).toFixed(2).replace(/0$/,'')+'×';
}
async function ttsPickMark(k){
  if(TTS.pick!=null){ const w=wordEl(TTS.pick); if(w) w.classList.remove('ttspick'); }
  TTS.pick=k; ttsBarUI(); if(k==null) return;
  let w=wordEl(k);
  if(!w || (R.mode==='pages' && pgPageOfEl(w)!==P.page)){ if(R.mode==='pages') await pgShow(k); else if(R.mode==='scroll') await scShow(k); w=wordEl(k); }
  if(w){ w.classList.add('ttspick'); if(R.mode==='scroll'){ const r=w.getBoundingClientRect(), v=scView.getBoundingClientRect(); if(r.top<v.top+20 || r.bottom>v.bottom-80) scView.scrollTo({top:scView.scrollTop+(r.top-v.top)-v.height*0.3}); } }
}
function ttsPickWord(i){
  if(TTS.on){ R.pos=i; ttsRestart(); return; }
  ttsPickMark(i);
}
function ttsPlayPause(){
  if(TTS.on){ const k=TTS.cur; ttsStop(); if(k>=0) ttsPickMark(k); return; }
  if(TTS.pick!=null) R.pos=TTS.pick;
  ttsStart();
}
function sentStartOf(i){ let k=Math.max(0,i); while(k>0 && !isSentEnd(k-1)) k--; return k; }
function ttsSkip(d){
  const c= TTS.on&&TTS.cur>=0 ? TTS.cur : TTS.pick!=null ? TTS.pick : R.pos;
  let t;
  if(d<0){ const s0=sentStartOf(c); t= c-s0<3 && s0>0 ? sentStartOf(s0-1) : s0; }
  else { let k=c; while(k<R.n-1 && !isSentEnd(k)) k++; t=Math.min(R.n-1,k+1); }
  if(TTS.on){ R.pos=t; ttsRestart(); } else ttsPickMark(t);
}
let ttsRateT=0;
function ttsRateApply(){
  ttsBarUI();
  if(TTS.on && TTS.nat){ natRateChanged(); return; }
  if(TTS.on){ clearTimeout(ttsRateT); ttsRateT=setTimeout(()=>{ if(TTS.on){ R.pos=Math.max(0,TTS.cur); ttsRestart(); } },400); }
}
function ttsSetRate(v){ S.ttsRate=Math.round(clamp(v,0.5,2)*20)/20; saveSettings(); ttsRateApply(); }
$('#rTts').onclick=()=>{ TTS.mode?ttsModeOff():ttsModeOn(); };
$('#ttsPlay').onclick=ttsPlayPause;
$('#ttsPrev').onclick=()=>ttsSkip(-1);
$('#ttsNext').onclick=()=>ttsSkip(1);
$('#ttsVoice').onclick=openVoiceSheet;
$('#ttsSpeed').addEventListener('input',e=>ttsSetRate(+e.target.value));
$('#ttsPrev').innerHTML=ICON.bsent; $('#ttsNext').innerHTML=ICON.fsent; $('#ttsVoice').innerHTML=ICON.voice;
/* Scroll: the auto-scroll button shows or hides the auto-scroll controls (like the speaker does for read aloud) */
$('#rAs').innerHTML=ICON.autoscroll; $('#asMore').innerHTML=ICON.more; $('#spOpts').innerHTML=ICON.gear;
$('#rAs').onclick=()=>{
  if(S.autoScroll){ if(SC.auto) asStop(true); S.autoScroll=false; }
  else { if(TTS.mode) ttsModeOff(); S.autoScroll=true; }
  saveSettings(); asUI(); updateChrome();
};
$('#asMore').onclick=()=>{ if(SC.auto) asStop(true); openAsOpts(); };
$('#spOpts').onclick=openSpeedOpts;

/* ---------- reading options panel (Aa) ---------- */
const FMT={ lineH:v=>(+v).toFixed(2), dim:v=>v+'%', warmth:v=>v+'%', scrollWpm:v=>v+' wpm', wpm:v=>v+' wpm', rampSecs:v=>v+' sec', charBudget:v=>v+' letters',
  commaPause:v=>(+v).toFixed(1)+'×', sentPause:v=>(+v).toFixed(1)+'×', paraPause:v=>(+v).toFixed(1)+'×', autoRewind:v=>+v?v+' words':'Off', speedSize:v=>v+' pt', ttsRate:v=>(+v).toFixed(2)+'×', size:v=>v+' px' };
const LAYOUT_KEYS=new Set(['font','size','lineH','margin','para','justify','hyphen','boldText','wordStart','twoCol']);
const REPANEL_KEYS=new Set(['mode','autoScroll','nightAuto','ramp','multi']);
const pRange=(key,label,min,max,step,desc)=>`<div class="set"><div class="hd"><label for="o_${key}">${label}</label><span class="val" data-val="${key}">${FMT[key]?FMT[key](S[key]):S[key]}</span></div><input type="range" id="o_${key}" data-set="${key}" data-type="range" min="${min}" max="${max}" step="${step}" value="${S[key]}">${desc?`<div class="desc">${desc}</div>`:''}</div>`;
const pToggle=(key,label,desc)=>`<div class="set"><div class="hd"><label for="o_${key}">${label}</label><input type="checkbox" class="switch" id="o_${key}" data-set="${key}" data-type="toggle"${S[key]?' checked':''}></div>${desc?`<div class="desc">${desc}</div>`:''}</div>`;
const pSeg=(key,opts,label,desc)=>`<div class="set">${label?`<div class="hd"><label>${label}</label></div>`:''}<div class="seg" data-set="${key}" data-type="seg">${opts.map(([v,l])=>`<button type="button" data-v="${v}" aria-pressed="${String(S[key])===String(v)}">${l}</button>`).join('')}</div>${desc?`<div class="desc">${desc}</div>`:''}</div>`;
function fontGrid(key){
  key=key||'font';
  /* "Book's font" appears only when this book brings its own font; otherwise "original" means Literata */
  const fam=R.bookFamily||null, bookName=R.text&&R.text.font?R.text.font.family:null;
  const cur=(S[key]==='original' && !fam)?'literata':S[key];
  const same=key==='speedFont'?`<button class="chip" type="button" data-v="same" aria-pressed="${S.speedFont==='same'}" style="font-family:${esc(fontCSS())}">Same<small>as reading font</small></button>`:'';
  const tiles=Object.entries(FONTS).filter(([k])=>k!=='original'||fam).map(([k,f])=>{
    const css= k==='original'? `"${fam}",Georgia,serif` : f.css;
    const label= k==='original'? 'Book’s font' : k==='opendyslexic'?'Open<wbr>Dyslexic':f.label;
    const note= k==='original'? esc(String(bookName||fam).replace(/[-_]+/g,' ').slice(0,20)) : f.note;
    return `<button class="chip${k==='opendyslexic'?' wide':''}" type="button" data-v="${k}" aria-pressed="${cur===k}" style="font-family:${esc(css)}">${label}<small>${note}</small></button>`;
  });
  return `<div class="fontgrid" data-set="${key}" data-type="seg">${same}${tiles.join('')}</div>`;
}
/* the Aa sheet: the few things you change most, with the rest folded away underneath */
const AAOPEN=new Set();
const fold=(k,title,body)=>`<details class="aadet" data-k="${k}"${AAOPEN.has(k)?' open':''}><summary>${title}</summary><div class="aadet-b">${body}</div></details>`;
function quickFonts(key){
  const cur=(S[key]==='original' && !R.bookFamily)?'literata':S[key];
  const pick=[cur]; for(const k of ['literata','newyork','georgia','lexend','atkinson']){ if(pick.length>=4) break; if(k!==cur && FONTS[k]) pick.push(k); }
  if(key==='speedFont' && !pick.includes('same')) pick[pick.length-1]='same';
  return `<div class="fontrow" data-set="${key}" data-type="seg">${pick.map(k=>{ const f=k==='same'?{label:'Same',css:fontCSS()}:k==='original'?{label:'Book’s',css:`"${R.bookFamily}",Georgia,serif`}:FONTS[k]; return `<button type="button" data-v="${k}" aria-pressed="${(key==='speedFont'?S.speedFont:cur)===k}" style="font-family:${esc(f.css)}">${k==='opendyslexic'?'Dyslexic':f.label}</button>`; }).join('')}</div>`;
}
function panelHTML(){
  const m=S.mode;
  const themeKeys=['auto',...S.themes.map(t=>t.id)], thName=k=>k==='auto'?'Phone':esc((S.themes.find(t=>t.id===k)||{}).label||'');
  const swatch=(k)=>{ const T=themeById(k); return T?`background:${T.bg};color:${T.ink}`:'background:linear-gradient(135deg,#fff 50%,#16181C 50%);color:#888'; };
  const sizeKey=m==='speed'?'speedSize':'size';
  const sizeRow=`<div class="aarow"><span class="aalbl">${m==='speed'?'Word size':'Text size'}</span><div class="stepper"><button type="button" data-step="${sizeKey}" data-d="${m==='speed'?-2:-1}" data-min="${m==='speed'?24:12}" data-max="${m==='speed'?72:40}" aria-label="Smaller" style="font-size:.85rem">A</button><span class="v" data-val="${sizeKey}">${S[sizeKey]} px</span><button type="button" data-step="${sizeKey}" data-d="${m==='speed'?2:1}" data-min="${m==='speed'?24:12}" data-max="${m==='speed'?72:40}" aria-label="Larger" style="font-size:1.25rem">A</button></div></div>`;
  let h=`<div class="panel-sec">${pSeg('mode',[['pages','Pages'],['scroll','Scroll'],['speed','Speed']])}</div>
  <div class="panel-sec aaquick">
    ${sizeRow}
    <div class="themes" data-set="theme" data-type="seg">${themeKeys.map(k=>`<button type="button" data-v="${k}" aria-pressed="${S.theme===k}" style="${swatch(k)}" aria-label="${k==='auto'?'Match phone':thName(k)}">Aa</button>`).join('')}
      <div class="lbl">${themeKeys.map(k=>`<span>${thName(k)}</span>`).join('')}</div></div>
    ${quickFonts(m==='speed'?'speedFont':'font')}
  </div>`;
  if(m!=='speed'){
    h+=fold('text','More text options',`${fontGrid()}
      <div class="group">
      ${pRange('lineH','Line spacing',1.2,2.2,0.05)}
      ${pSeg('margin',[['narrow','Narrow'],['normal','Normal'],['wide','Wide']],'Margins')}
      ${pSeg('para',[['indent','Indented'],['spaced','Spaced'],['both','Spaced and indented']],'Paragraphs')}
      ${pSeg('tocStyle',[['list','List'],['spine','Wheels']],'Contents')}
      ${pToggle('justify','Justify text')}
      ${pToggle('hyphen','Hyphenation','Breaks long words at line ends for even spacing.')}
      ${pToggle('boldText','Bold text')}
      ${pToggle('wordStart','Word-start emphasis','Bolds the first part of each word to guide your eyes.')}
      </div>`);
  } else {
    h+=fold('word','Word display',`${fontGrid('speedFont')}<div class="group">
      <div class="set"><div class="hd"><label>Focus letter color</label></div><div class="chips" data-set="focusColor" data-type="seg" style="align-items:center">${COLORS.map(([n,c])=>`<button class="swatch" type="button" data-v="${c}" aria-label="${n}" aria-pressed="${S.focusColor.toLowerCase()===c.toLowerCase()}" style="background:${c}"></button>`).join('')}<label class="note" style="display:flex;align-items:center;gap:8px">Custom <input type="color" data-set="focusColor" data-type="text" value="${esc(S.focusColor)}"></label></div></div>
      ${pToggle('context','Show the sentence when paused')}
      ${pToggle('boldText','Bold text')}
      ${pSeg('tocStyle',[['list','List'],['spine','Wheels']],'Contents')}
      </div>
      <p class="note" style="margin:6px 0 0">Speed, pauses and the speed ramp are under ${ICON.gear} on the Speed controls.</p>`);
  }
  if(m==='pages') h+=fold('pages','Pages',`<div class="group">
      ${pSeg('turn',[['slide','Slide'],['fade','Fade'],['none','None']],'Page turn')}
      ${pSeg('tapZones',[['edges','Edges'],['anywhere','Anywhere']],'Tap to turn', S.tapZones==='edges'?'Tap the left or right edge to turn. Tap the middle to show or hide controls.':'Tap the left third to go back, anywhere else to go forward. Tap the top to show or hide controls.')}
      ${pToggle('twoCol','Two pages side by side when wide','On an iPad or a phone turned sideways.')}
      ${pToggle('focus','Hide controls while reading','Tap the middle of the page to bring them back.')}
    </div>`);
  if(m==='scroll') h+=fold('scroll','Scrolling',`<div class="group">
      ${pToggle('focus','Hide controls while reading','Tap the page to bring them back.')}
    </div>
    <p class="note" style="margin:6px 0 0">Auto-scroll has its own button at the bottom of the page.</p>`);
  return h;
}
/* light settings live on the Settings page (they apply everywhere) */
function lightHTML(){ return `<div class="group">
      ${pRange('dim','Dim',0,80,5,'Darkens the page beyond the phone’s lowest brightness.')}${pRange('warmth','Warmth',0,100,5,'Adds a warm tint for night reading.')}
    </div>`; }
/* themes: cards for the user's themes (Settings → Themes), the night switch, and the colour editor sheet */
const TH_DOTS={
  bg:['#FFFFFF','#F8F5EE','#F1E4C9','#E4EEDF','#4B4C50','#16181C','#0B1020','#000000'],
  ink:['#1B1B1B','#262320','#3D2E1E','#2B3A33','#EDEDED','#D8DBE0','#C8C8C8','#F4E9D0'],
  accent:['#2244B5','#8AA4FF','#E0303F','#E39B12','#139E9A','#8E5BE8','#E0479E','#2E9B4F']
};
function themesHTML(){
  const cur=effectiveTheme();
  const cards=S.themes.map(t=>{ const T=resolveTheme(t); return `<div class="tcard" style="background:${T.bg};color:${T.ink};border-color:${T.line}"><button type="button" class="tpick" data-tpick="${esc(t.id)}" aria-pressed="${t.id===cur}" aria-label="${esc(t.label)}"><span class="taa">Aa</span><span class="tname">${esc(t.label)}</span></button><i class="tdotc" style="background:${T.accent}"></i><button type="button" class="tedit" data-tedit="${esc(t.id)}" aria-label="Edit ${esc(t.label)}" style="color:${T.ink}">${ICON.pencil}</button></div>`; }).join('');
  const add=S.themes.length<MAX_THEMES?`<button type="button" class="tcard tadd" data-tadd="1" aria-label="New theme">+</button>`:'';
  return `<div class="tcards">${cards}${add}</div><div class="group" style="margin-top:12px">
      ${pToggle('nightAuto','Switch theme at night')}
      ${S.nightAuto?`<div class="set"><div class="timerow">From <input class="input" type="time" data-set="nightFrom" data-type="text" value="${esc(S.nightFrom)}"> to <input class="input" type="time" data-set="nightTo" data-type="text" value="${esc(S.nightTo)}"></div>${pSeg('nightTheme',S.themes.map(t=>[t.id,esc(t.label)]),'Night theme')}</div>`:''}
    </div>`;
}
function themesRefresh(){ const el=$('#themeSet'); if(el && el.offsetParent!==null) el.innerHTML=themesHTML(); }
function themesChanged(){ saveSettings(); applyLook(); themesRefresh(); if(!$('#v-reader').hidden) relayoutSoon(); }
function bindThemes(){
  const el=$('#themeSet'); if(!el) return; bindPanel(el);
  el.addEventListener('click',e=>{
    const p=e.target.closest('[data-tpick]'), ed=e.target.closest('[data-tedit]'), ad=e.target.closest('[data-tadd]');
    if(p){ S.theme=p.dataset.tpick; saveSettings(); applyLook(); themesRefresh(); }
    else if(ed) openThemeEditor(ed.dataset.tedit);
    else if(ad && S.themes.length<MAX_THEMES){
      const c=S.themes.find(t=>t.id===effectiveTheme())||S.themes[0], id='t'+Date.now().toString(36);
      S.themes.push({id, label:'New theme', bg:c.bg, ink:c.ink, accent:c.accent}); S.theme=id; themesChanged(); openThemeEditor(id);
    }
  });
}
function openThemeEditor(id){
  const t=S.themes.find(x=>x.id===id); if(!t) return;
  const row=(k,name)=>`<div class="trow" data-k="${k}"><span class="tlbl">${name}</span><div class="tdots">${TH_DOTS[k].map(c=>`<button type="button" class="tdot" data-act="dot" data-k="${k}" data-v="${c}" style="background:${c}" aria-label="${c}"></button>`).join('')}<label class="tdot tcustom" aria-label="Custom ${name}"><input type="color" data-tcolor="${k}" value="${t[k].toLowerCase()}"></label></div></div>`;
  const body=`<input class="input tname-in" type="text" maxlength="16" value="${esc(t.label)}" aria-label="Name" data-tname="1">
    ${row('bg','Page')}${row('ink','Text')}${row('accent','Accent')}
    <div class="tprev" id="tPrev"><p>The quiet hours of reading are the ones we keep. A <b>single page</b> can hold a whole afternoon.</p><span class="tprevbtn">Highlight</span></div>
    ${S.themes.length>1?`<button type="button" class="btn danger block" data-act="del" style="margin-top:14px">Delete theme</button>`:''}`;
  const paint=()=>{
    const pv=$('#tPrev'); if(!pv) return; const T=resolveTheme(t);
    pv.style.cssText=`background:${T.bg};color:${T.ink};border-color:${T.line}`; pv.querySelector('b').style.color=T.accent; const b=pv.querySelector('.tprevbtn'); b.style.cssText=`background:${T.accent};color:${chromeTokens(T)['--accent-ink']}`;
    for(const k of ['bg','ink','accent']){ const r=$(`#sheet .trow[data-k="${k}"]`); if(!r) continue; let hit=false;
      r.querySelectorAll('.tdot[data-v]').forEach(d=>{ const on=d.dataset.v.toLowerCase()===t[k].toLowerCase(); d.setAttribute('aria-pressed',on); if(on) hit=true; });
      const cu=r.querySelector('.tcustom'); cu.classList.toggle('on',!hit); cu.style.setProperty('--cur',t[k]); const inp=cu.querySelector('input'); if(inp.value.toLowerCase()!==t[k].toLowerCase()) inp.value=t[k].toLowerCase(); }
  };
  const set=(k,v)=>{ t[k]=v.toUpperCase(); paint(); themesChanged(); };
  openSheet('Edit theme', body, {
    dot:b=>set(b.dataset.k,b.dataset.v),
    del:()=>{
      if(S.themes.length<2) return; S.themes=S.themes.filter(x=>x.id!==id);
      const f=S.themes[0].id; if(S.theme===id) S.theme=f; if(S.nightTheme===id) S.nightTheme=f;
      closeSheet(); themesChanged();
    }
  });
  const sb=$('#sheet .sheet-body');
  sb.addEventListener('input',e=>{ const x=e.target; if(x.dataset.tcolor) set(x.dataset.tcolor,x.value); else if(x.dataset.tname){ t.label=x.value.trim().slice(0,16)||t.label; themesChanged(); } });
  paint();
}
/* Speed controls → ⚙︎ */
function speedOptsHTML(){
  return `<div class="group">
      ${pRange('wpm','Reading speed',100,1000,10)}
      ${pToggle('ramp','Speed ramp','Starts at 60% of your speed each time you press play and eases up.')}
      ${S.ramp?pRange('rampSecs','Ramp length',2,20,1):''}
      ${pToggle('multi','Show 2–3 words at once','Groups short words. A long word always gets its own flash.')}
      ${S.multi?pRange('charBudget','Group width',8,24,1,'Most letters (with spaces) shown in one flash.'):''}
      ${pToggle('adaptive','Adaptive pacing','Slows a little on long sentences and long words, speeds up on easy stretches.')}
    </div>
    <h3 class="subh">Pauses</h3><div class="group">
      ${pRange('commaPause','After commas and dashes',1,4,0.1)}
      ${pRange('sentPause','At the end of a sentence',1,4,0.1)}
      ${pRange('paraPause','At the end of a paragraph',1,5,0.1)}
      ${pToggle('longWord','Extra time on long words','Words over 7 letters stay on screen a little longer.')}
      ${pRange('autoRewind','Rewind when resuming',0,10,1,'After a pause, play backs up this many words. Jumps never rewind.')}
    </div>`;
}
function openSpeedOpts(){ if(R.playing) pause(); openSheet('Speed reading options', speedOptsHTML(), {}); $('#sheet .sheet-body').dataset.sheet='speed'; bindPanel(); }
/* auto-scroll bar → ⋯ */
function asOptsHTML(){ return `<div class="group">
    ${pToggle('asRamp','Ease into speed','Starts slower and builds to full speed over a few seconds.')}
    ${pToggle('asPauses','Pause at pictures and headings','Holds for a moment so you can take them in.')}
    ${pToggle('adaptive','Adaptive pacing','Slows a little on long sentences and long words, speeds up on easy stretches.')}
  </div>`; }
function openAsOpts(){ openSheet('Auto-scroll options', asOptsHTML(), {}); $('#sheet .sheet-body').dataset.sheet='as'; bindPanel(); }
/* audio controls → voice button */
function voiceSheetHTML(){ const lang=(document.documentElement.lang||'en').slice(0,2).toLowerCase(); return voiceSectionHTML(lang)+(R.meta?abSectionHTML():''); }
function openVoiceSheet(){ openSheet('Voice', voiceSheetHTML(), Object.assign({},READ_ACTS,AB_ACTS)); $('#sheet .sheet-body').dataset.sheet='voice'; bindPanel(); setTimeout(()=>{ natStateUI(); abUI(); },0); }
/* actions shared by the Aa menu and the reading section of Settings */
const READ_ACTS={
  vprev:()=>{ if(TTS.on) ttsStop(); if(S.ttsEngine!=='system') natPreview(); else voicePreview(); },
  kokget:async()=>{ if(await natEnsure()){ toast('Natural voice is ready'); } natStateUI(); },
  kokdel:async()=>{ if(TTS.on) ttsStop(); await natRemove(); toast('Voice download removed'); natStateUI(); },
  resetlook:()=>{ resetReading(); refreshPanel(); toast('Reading options reset'); }
};
function openPanel(){
  if(R.mode==='speed' && R.playing) pause();
  if(SC.auto) asStop(true);
  openSheet('Reading options', panelHTML(), READ_ACTS, 'short');
  $('#sheet .sheet-body').dataset.aa='1';
  bindPanel();
}
/* re-draw whichever reading controls are on screen (the Aa menu, the Settings page section) */
function refreshPanel(){
  const ls=$('#lightSet'); if(ls && ls.offsetParent!==null) ls.innerHTML=lightHTML();
  themesRefresh();
  const body=$('#sheet .sheet-body'); if(!body || $('#sheet').hidden) return;
  const html= body.dataset.aa? panelHTML() : body.dataset.sheet==='speed'? speedOptsHTML() : body.dataset.sheet==='as'? asOptsHTML() : body.dataset.sheet==='voice'? voiceSheetHTML() : null;
  if(html==null) return;
  const st=body.scrollTop; body.innerHTML=html; body.scrollTop=st; if(body.dataset.sheet==='voice'){ natStateUI(); abUI(); }
}
/* Aa → More settings: the Settings page over the book, with a way back */
function openSettingsFromReader(){
  closeSheet(); if(TTS.on) ttsStop();
  R.inSet=true; for(const x of VIEWS) $('#v-'+x).hidden=(x!=='settings'); $('#v-reader').hidden=true; $('#tabs').hidden=true;
  renderSettings(); requestAnimationFrame(()=>{ const r=$('#readHead'); if(r) r.scrollIntoView({block:'start'}); });
}
function backToBook(){
  R.inSet=false; $('#v-settings').hidden=true; $('#v-reader').hidden=false; $('#tabs').hidden=true;
  holdPlace(); applyLook(); relayoutSoon(); updateChrome();
}
function resetReading(){
  const keep={themes:S.themes, linkService:S.linkService, goalMins:S.goalMins, measuredWpm:S.measuredWpm, info:S.info};
  Object.assign(S, DEFAULTS, keep, {mode:S.mode}); normThemes(); saveSettings(); applyLook(); setWpm(S.wpm); asUI(); relayoutSoon();
}
function afterSet(key){
  saveSettings();
  if(key==='mode'){ refreshPanel(); switchMode(S.mode).then(refreshPanel); return; }
  if(key==='wpm') setWpm(S.wpm);
  if(key==='scrollWpm'||key==='autoScroll'){ if(!S.autoScroll && SC.auto) asStop(true); asUI(); }
  if(key==='focus') setChrome(true);
  if(key==='ttsEngine'){ if(TTS.on) ttsStop(); refreshPanel(); return; }
  if(key==='ttsRate'){ ttsRateApply(); }
  if(key==='pipVoice'){ setTimeout(natStateUI,0); const el=$('#kokSpeed'); if(el) el.textContent='The first sample also shows how quickly this phone can make speech.'; }
  if((key==='pipVoice'||key==='ttsVoice') && TTS.on){ clearTimeout(TTS.restartT); TTS.restartT=setTimeout(()=>{ if(TTS.on) ttsRestart(); },400); }
  applyLook();
  if(key==='speedSize'||key==='focusColor'||key==='boldText'){ if(R.mode==='speed') showChunk(R.pos); }
  if((key==='font'||key==='speedFont') && R.mode==='speed'){ document.fonts&&document.fonts.ready.then(()=>{ if(R.mode==='speed'){ showChunk(R.pos); syncScroll(true); } }); }
  if(key==='context' && R.mode==='speed') renderContext();
  if(LAYOUT_KEYS.has(key) && R.mode!=='speed') relayoutSoon();
  if(key==='focus' && R.mode!=='speed'){ $('#v-reader').classList.toggle('overlay', !!S.focus && !TTS.mode); relayoutSoon(); }
  if(REPANEL_KEYS.has(key)) refreshPanel();
  if(key==='tapZones') refreshPanel();
  updateChrome();
}
function bindPanel(root){
  const body=root||$('#sheet .sheet-body'); if(!body || body.dataset.bound) return; body.dataset.bound='1';
  body.addEventListener('toggle',e=>{ const d=e.target; if(d.matches && d.matches('details[data-k]')){ if(d.open) AAOPEN.add(d.dataset.k); else AAOPEN.delete(d.dataset.k); } },true);
  body.addEventListener('input',e=>{
    const t=e.target; const key=t.dataset.set; if(!key) return;
    if(t.dataset.type==='range'){ S[key]=+t.value; const v=body.querySelector(`[data-val="${key}"]`); if(v) v.textContent=FMT[key]?FMT[key](S[key]):S[key]; afterSet(key); }
    else if(t.dataset.type==='text' && t.type==='color'){ S[key]=t.value; afterSet(key); }
  });
  body.addEventListener('change',e=>{
    const t=e.target; const key=t.dataset.set; if(!key) return;
    if(t.dataset.type==='toggle'){ S[key]=t.checked; afterSet(key); }
    else if(t.dataset.type==='text'){ S[key]=t.value; afterSet(key); }
  });
  body.addEventListener('click',e=>{
    const st=e.target.closest('[data-step]');
    if(st){ const key=st.dataset.step; S[key]=clamp(S[key]+(+st.dataset.d),+(st.dataset.min||12),+(st.dataset.max||40)); const v=body.querySelector(`[data-val="${key}"]`); if(v) v.textContent=FMT[key](S[key]); afterSet(key); return; }
    const b=e.target.closest('button[data-v]'); if(!b) return; const grp=b.closest('[data-set]'); if(!grp||grp.dataset.type!=='seg') return;
    const key=grp.dataset.set; let v=b.dataset.v; if(typeof DEFAULTS[key]==='number') v=+v;
    S[key]=v; grp.querySelectorAll('button[data-v]').forEach(x=>x.setAttribute('aria-pressed', x===b)); afterSet(key);
  });
}
$('#rAa').onclick=openPanel;
$('#rToc').onclick=()=>openToc('toc');
$('#markBtn').onclick=()=>openToc('marks');
/* night theme switch and phone light/dark changes */
setInterval(()=>{ if(S.nightAuto) applyLook(); },60000);
try{ matchMedia('(prefers-color-scheme: dark)').addEventListener('change',()=>applyLook()); }catch(e){}
