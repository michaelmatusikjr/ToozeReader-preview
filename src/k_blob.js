/* ---------- the drop: one living bit of the accent colour ----------
   Home: a slim capsule on the tab bar, under the current tab. In the reader (controls hidden) it spreads along the
   bottom edge as your progress. Moving between the two it drips down / climbs back up.
   Selected segments (.seg) are the same material: the fill flows from the old choice to the new one.
   It draws nothing while idle: every move is a one-off Web Animation. Reduce Motion: it only fades. */
const Drop=(()=>{
  const RM=matchMedia('(prefers-reduced-motion: reduce)');
  const SPRING='cubic-bezier(.3,1.35,.45,1)', DRAG='cubic-bezier(.5,0,.8,.5)';
  const px=n=>Math.round(n*10)/10+'px';
  const fade=(el,from,to,ms)=>el.animate([{opacity:from},{opacity:to}],{duration:ms||220,easing:'ease-out'});
  const put=(el,r)=>{ el.style.left=px(r.l); el.style.top=px(r.t); el.style.width=px(r.w); el.style.height=px(r.h); };
  const css=r=>({left:px(r.l),top:px(r.t),width:px(r.w),height:px(r.h)});

  /* ----- the foundation (one fixed drop) ----- */
  let el=null, cur=null, vis=false, placed=false, frac=0, queued=false, anim=null;
  let probe=null; /* the phone's bottom safe area (home indicator), so the base sits just above it */
  function inset(){ if(!probe){ probe=document.createElement('div'); probe.style.cssText='position:fixed;left:0;bottom:0;width:0;height:0;visibility:hidden;padding-bottom:env(safe-area-inset-bottom,0px)'; document.body.appendChild(probe); } return parseFloat(getComputedStyle(probe).paddingBottom)||0; }
  function target(){
    const rd=document.getElementById('v-reader'), tabs=document.getElementById('tabs');
    if(rd && !rd.hidden){
      const on=rd.dataset.mode!=='speed';   /* Speed mode has its own progress bar */
      const sc=document.getElementById('rScrub'), sr=sc&&sc.getBoundingClientRect();
      if(on && !rd.classList.contains('chrome-off') && sr && sr.width){   /* controls up: the drop is the scrubber's thumb */
        return {kind:'scrub', l:sr.left+Math.min(1,frac)*(sr.width-36), t:sr.top+sr.height/2-6, w:36, h:12, vis:true};
      }
      /* the same 36px bead as on the tab bar, riding along the bottom as you read (a progress bar would be a speck in a long book) */
      return {kind:'base', l:Math.min(1,frac)*(innerWidth-36), t:innerHeight-Math.max(inset()*.5,7)-4, w:36, h:4, vis:on};
    }
    const b=tabs&&tabs.querySelector('button[aria-current="page"]'), tr=tabs&&tabs.getBoundingClientRect();
    if(!b||!tr||!tr.height) return null;
    const r=b.getBoundingClientRect(), w=36;
    return {kind:'tab', l:r.left+r.width/2-w/2, t:tr.top-1, w, h:3, vis:true};
  }
  const same=(a,b)=>a&&b&&a.kind===b.kind&&Math.abs(a.l-b.l)<.5&&Math.abs(a.t-b.t)<.5&&Math.abs(a.w-b.w)<.5;
  function flow(from,to){
    if(anim){ anim.cancel(); anim=null; }
    put(el,to);
    if(RM.matches){ anim=fade(el,.2,1); return; }
    if(from.kind===to.kind && (to.kind==='base'||to.kind==='scrub')){   /* progress: glide, a little give at the end */
      anim=el.animate([{left:px(from.l)},{left:px(to.l)}],{duration:420,easing:SPRING}); return;
    }
    if(from.kind===to.kind){                              /* tab to tab: stretch toward it, then pull the tail over */
      const L=Math.min(from.l,to.l), R=Math.max(from.l+from.w,to.l+to.w);
      anim=el.animate([
        {...css(from),easing:DRAG},
        {offset:.42,left:px(L),width:px(R-L),top:px(from.t+.5),height:px(2),borderRadius:'2px',easing:SPRING},
        css(to)],{duration:520});
      return;
    }
    /* tab <-> base: gather into a bead, drip down (or climb up), spread out */
    const a=from, b=to, ac=a.l+a.w/2, bc=b.l+b.w/2, dy=Math.abs(b.t-a.t);
    const bead=(c,t)=>({left:px(c-3),width:'6px',top:px(t),height:'8px'});
    anim=el.animate([
      {...css(a),easing:'ease-in'},
      {offset:.28,...bead(ac,a.t-2.5),borderRadius:'4px',easing:'linear'},
      {offset:.55,left:px((ac+bc)/2-3),width:'5px',top:px(Math.min(a.t,b.t)),height:px(dy*.55+8),borderRadius:'4px',easing:'linear'},
      {offset:.74,...bead(bc,b.t-2.5),borderRadius:'4px',easing:SPRING},
      css(b)],{duration:760});
  }
  function sync(){
    queued=false; if(!el) return;
    const t=target();
    if(!t){ if(vis){ vis=false; el.style.opacity=0; fade(el,1,0,160); } return; }
    if(!placed){                                          /* first arrival: a beat, then it swells in */
      placed=true; cur=t; put(el,t); vis=false; el.style.opacity=0;
      setTimeout(()=>{ if(!cur) return; vis=cur.vis; el.style.opacity=vis?1:0;
        if(vis) el.animate(RM.matches?[{opacity:0},{opacity:1}]:[{opacity:0,transform:'scaleX(.15)'},{opacity:1,transform:'none'}],{duration:520,easing:SPRING}); },320);
      return;
    }
    if(!same(cur,t)){ const from=cur; cur=t; if(vis&&t.vis) flow(from,t); else put(el,t); }
    ghostPlace();
    if(t.vis!==vis){ vis=t.vis; el.style.opacity=vis?1:0; fade(el,vis?0:1,vis?1:0,200); }
  }
  const later=()=>{ if(!queued){ queued=true; queueMicrotask(sync); } };
  function init(){
    el=document.createElement('i'); el.id='drop'; el.setAttribute('aria-hidden','true'); document.body.appendChild(el);
    const mo=new MutationObserver(later);
    const tabs=document.getElementById('tabs'), rd=document.getElementById('v-reader');
    if(tabs){ mo.observe(tabs,{attributes:true,subtree:true,attributeFilter:['aria-current','hidden']}); }
    if(rd){ mo.observe(rd,{attributes:true,attributeFilter:['hidden','class','data-mode']}); }
    addEventListener('resize',()=>{ if(!el||!placed) return; const t=target(); if(t){ cur=t; put(el,t); } ghostPlace(); });
    requestAnimationFrame(sync);
  }
  /* ----- where you were: a hollow drop on the same line, at the spot you left (see setBack in the reader) ----- */
  let gh=null, gFrac=null, gTap=null, gAway=false;
  function ghostSpot(){
    const rd=document.getElementById('v-reader');
    if(gFrac==null || !rd || rd.hidden || rd.dataset.mode==='speed') return null;
    const sc=document.getElementById('rScrub'), sr=sc&&sc.getBoundingClientRect();
    if(!rd.classList.contains('chrome-off') && sr && sr.width) return {l:sr.left+gFrac*(sr.width-36), t:sr.top+sr.height/2-6, w:36, h:12};
    return {l:gFrac*(innerWidth-36), t:innerHeight-Math.max(inset()*.5,7)-8, w:36, h:12};
  }
  function ghostPlace(){ if(!gh) return; const r=ghostSpot(); if(!r){ gh.hidden=true; return; } const was=gh.hidden; gh.hidden=false; put(gh,r);
    if(was && !RM.matches) gh.animate([{transform:'scale(.4)',opacity:0},{transform:'scale(1.35)',opacity:1,offset:.45},{transform:'none',opacity:.9}],{duration:700,easing:SPRING}); }
  function ghost(f, onTap, away){
    if(!gh){ gh=document.createElement('button'); gh.type='button'; gh.id='dropGhost'; gh.hidden=true; gh.setAttribute('aria-label','Back to where you were');
      gh.addEventListener('click',e=>{ e.stopPropagation(); const fn=gTap; if(fn) fn(); }); document.body.appendChild(gh); }
    const fresh= f!=null && (gFrac==null || Math.abs(f-gFrac)>1e-6 || gAway!==!!away);
    gFrac= f==null? null : Math.max(0,Math.min(1,+f||0)); gTap=onTap||null; gAway=!!away; gh.classList.toggle('away',gAway);
    if(gFrac==null){ gh.hidden=true; return; }
    if(fresh) gh.hidden=true;   /* a new spot: it appears with a small pulse so you notice it */
    ghostPlace();
  }

  /* ----- reaching the daily goal: the drop swells into a soft, faceless blob at the bottom of the screen; vague
     limbs stretch out twice as it celebrates, then it settles back into the drop (Mick: amorphous, subtle) ----- */
  function blobPath(t, cx, by){
    const N=12, R=9.5, ease=x=>x<0?0:x>1?1:x*x*(3-2*x);
    const grow=ease(t/.16)*(1-ease((t-.84)/.16));                 /* flat bead → round → flat bead */
    const pulse=(c,w)=>Math.exp(-Math.pow((t-c)/w,2));
    const reach=pulse(.38,.09)+pulse(.62,.09);                     /* two stretches */
    const sy=.18+.82*grow, sx=1/Math.sqrt(Math.max(.25,sy));
    const limbs=[[-2.55,1],[-0.6,1],[-1.57,.55]];                 /* upper left, upper right, a small one on top */
    const pts=[];
    for(let k=0;k<N;k++){
      const a=-Math.PI/2+k*2*Math.PI/N;
      let r=R*(1+.07*Math.sin(3*a+t*9)+.04*Math.sin(5*a-t*7));
      for(const [la,amt] of limbs){ let d=Math.atan2(Math.sin(a-la),Math.cos(a-la)); r+=reach*amt*7*Math.exp(-Math.pow(d/.42,2)); }
      const lift=1.5*grow+1.5*reach;
      pts.push([cx+Math.cos(a)*r*sx, by-R*sy-lift+Math.sin(a)*r*sy]);
    }
    /* smooth closed curve through the points */
    let d=`M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
    for(let k=0;k<N;k++){ const p0=pts[(k-1+N)%N], p1=pts[k], p2=pts[(k+1)%N], p3=pts[(k+2)%N];
      const c1=[p1[0]+(p2[0]-p0[0])/6, p1[1]+(p2[1]-p0[1])/6], c2=[p2[0]-(p3[0]-p1[0])/6, p2[1]-(p3[1]-p1[1])/6];
      d+=` C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`; }
    return d+'Z';
  }
  function celebrate(){
    if(RM.matches || document.querySelector('.drop-buddy')) return;
    /* where it starts: the drop itself if it's on screen, else the goal circle, else the bottom middle */
    let r=null; const ring=document.getElementById('goalRing');
    if(el && vis && cur) r={x:cur.l+cur.w/2, y:cur.t+cur.h};
    else if(ring && !ring.hidden){ const b=ring.getBoundingClientRect(); if(b.width) r={x:b.left+b.width/2, y:b.bottom}; }
    if(!r) r={x:innerWidth/2, y:innerHeight-12};
    const W=90, H=70, x=Math.max(W/2, Math.min(innerWidth-W/2, r.x));
    const w=document.createElementNS('http://www.w3.org/2000/svg','svg'); w.setAttribute('class','drop-buddy'); w.setAttribute('aria-hidden','true');
    w.setAttribute('width',W); w.setAttribute('height',H); w.setAttribute('viewBox',`0 0 ${W} ${H}`);
    w.style.left=px(x-W/2); w.style.top=px(r.y-H+2);
    const path=document.createElementNS('http://www.w3.org/2000/svg','path'); w.appendChild(path); document.body.appendChild(w);
    const D=3200, t0=performance.now(), was=el? (el.style.opacity||'1') : '1';
    if(el) el.style.opacity='0';                                   /* the drop becomes the blob… */
    document.body.classList.add('db-on');                           /* the page line steps aside while it celebrates */
    const step=now=>{ const t=Math.min(1,(now-t0)/D); path.setAttribute('d', blobPath(t, W/2, H-2));
      if(t<1) requestAnimationFrame(step); else { w.remove(); document.body.classList.remove('db-on'); if(el){ el.style.opacity=was; fade(el,0,+was||1,200); } } };   /* …and back */
    path.setAttribute('d', blobPath(0, W/2, H-2)); requestAnimationFrame(step);
  }

  /* ----- reading progress (0..1) ----- */
  function progress(f,live){
    frac=Math.max(0,Math.min(1,+f||0));
    ghostPlace(); later();
    if(live&&el&&placed&&cur&&cur.kind==='scrub'){ const t=target(); if(t&&t.kind==='scrub'){ if(anim){ anim.cancel(); anim=null; } cur=t; put(el,t); return; } }  /* dragging the scrubber: stick to the finger */
    later();
  }

  /* ----- segmented controls: the selection is the same liquid ----- */
  const seen=new Map(), RING='.themes[data-set],.fontrow[data-set],.fontgrid[data-set]';
  function seg(g){
    if(g._lq||!g.matches(RING+',.seg')) return; g._lq=1;
    /* segmented controls get a filled drop; swatches and font tiles get a ring that slides the same way */
    const ring=!g.classList.contains('seg'); g.classList.add(ring?'lqr':'lq');
    const key=g.id||(g.dataset.set? g.dataset.set+':'+(ring?g.className.split(' ')[0]:'seg') : ''); let d=null, shown=false, at=null;
    const out= g.classList.contains('themes')? 3 : 0, rad=b=>parseFloat(getComputedStyle(b).borderTopLeftRadius)||10;
    const geo=()=>{ const b=g.querySelector(':scope > button[aria-pressed="true"]'); return b&&b.offsetWidth?{l:b.offsetLeft-out,t:b.offsetTop-out,w:b.offsetWidth+2*out,h:b.offsetHeight+2*out,r:rad(b)+out}:null; };
    const mk=()=>{ if(!d||!d.isConnected){ d=document.createElement('i'); d.className= ring?'drop-ring':'drop-seg'; g.prepend(d); } if(ring&&at) d.style.borderRadius=px(at.r); return d; };
    let resume=0, pending=false;   /* a slide is about to start: nothing may move the drop to the end first */
    const remember=(fly)=>{ if(key) seen.set(key,Object.assign({}, seen.get(key)||{}, {t:Date.now(), at}, fly||{})); };   /* keeps an in-flight slide's start */
    function reveal(animate){
      const r=geo(); if(!r) return; shown=true; at=r; put(mk(),r); g.classList.add('lq-on'); remember();
      if(!animate) return;
      if(RM.matches){ fade(d,0,1,260); return; }
      d.animate([{transform:'scale(.1,.3)',opacity:0,borderRadius:'999px'},{offset:.3,opacity:1,borderRadius:'999px'},{transform:'none',opacity:1,borderRadius:'0px'}],{duration:620,easing:SPRING});
    }
    function move(){
      pending=false;
      const to=geo(); if(!to||!shown) return; const from=at, off=resume; resume=0; at=to; mk(); put(d,to);
      if(from&&from.l===to.l&&from.t===to.t&&from.w===to.w){ remember({from:null}); return; }
      remember({from, start:performance.now()-off});
      if(!from||RM.matches){ fade(d,.2,1,220); return; }
      const L=Math.min(from.l,to.l), Rr=Math.max(from.l+from.w,to.l+to.w);
      if(ring){ const T=Math.min(from.t,to.t), B=Math.max(from.t+from.h,to.t+to.h), same=Math.abs(from.t-to.t)<4;
        d.animate([
          {...css(from),borderRadius:px(from.r),easing:DRAG},
          {offset:.4,left:px(L),width:px(Rr-L),top:px(same?from.t+3:T),height:px(same?from.h-6:B-T),borderRadius:px(Math.min(from.r+8,(same?from.h-6:B-T)/2)),easing:SPRING},
          {...css(to),borderRadius:px(to.r)}],{duration:520, delay:-off});
        return; }
      d.animate([
        {...css(from),borderRadius:'0px',easing:DRAG},
        {offset:.4,left:px(L),width:px(Rr-L),top:px(from.t+4),height:px(from.h-8),borderRadius:'999px',easing:SPRING},
        {...css(to),borderRadius:'0px'}],{duration:520, delay:-off});   /* a redrawn control carries on mid-slide */
    }
    new MutationObserver(move).observe(g,{attributes:true,subtree:true,attributeFilter:['aria-pressed']});
    new ResizeObserver(()=>{ if(!shown||pending) return; const r=geo(); if(r){ at=r; put(mk(),r); remember(); } }).observe(g);
    /* touched before it woke up (e.g. in a fold that was never fully in view): wake it in place first, so the tap slides */
    g.addEventListener('pointerdown',()=>{ if(!shown){ const r=geo(); if(r){ shown=true; at=r; put(mk(),r); g.classList.add('lq-on'); remember(); } } },true);
    /* the same control redrawn (a panel rebuilt after a change): start where the old one was and slide to the new pick */
    const prev=key&&seen.get(key);
    if(prev && Date.now()-prev.t<4000){
      if(prev.at){ const el=prev.from? performance.now()-prev.start : 1e9, mid=el<520;
        shown=true; at= mid? prev.from : prev.at; resume= mid? el : 0; put(mk(),prev.at); g.classList.add('lq-on'); pending=true; requestAnimationFrame(()=>move()); return; }
      reveal(false); if(shown) return;
    }
    if(!('IntersectionObserver' in window)){ reveal(false); return; }
    /* a new one waits until it's mostly in view, then a beat */
    const io=new IntersectionObserver(es=>{ if(es.some(e=>e.isIntersecting&&e.intersectionRatio>=.6)){ io.disconnect(); setTimeout(()=>{ if(!shown) reveal(true); },260); } },{threshold:[.6,1]});
    io.observe(g);
  }
  const SEL='.seg,'+RING;
  const scan=root=>{ if(root.nodeType!==1) return; if(root.matches&&root.matches(SEL)) seg(root); root.querySelectorAll&&root.querySelectorAll(SEL).forEach(seg); };
  function watch(){
    document.querySelectorAll(SEL).forEach(seg);
    for(const id of ['settingsBody','sheet','v-words','v-library','v-stats']){
      const n=document.getElementById(id); if(!n) continue;
      new MutationObserver(ms=>{ for(const m of ms) m.addedNodes.forEach(scan); }).observe(n,{childList:true,subtree:true});
    }
  }
  function start(){ init(); watch(); }
  if(document.readyState==='loading') addEventListener('DOMContentLoaded',start); else start();
  return {progress, sync:later, seg, ghost, celebrate};
})();

