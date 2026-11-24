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

  /* ----- reaching the daily goal: the drop comes alive as a little creature, hops and cheers, then melts back ----- */
  function celebrate(){
    if(RM.matches || document.querySelector('.drop-buddy')) return;
    /* where it starts: the drop itself if it's on screen, else the goal circle, else the bottom middle */
    let r=null; const ring=document.getElementById('goalRing');
    if(el && vis && cur) r={x:cur.l+cur.w/2, y:cur.t+cur.h/2};
    else if(ring && !ring.hidden){ const b=ring.getBoundingClientRect(); if(b.width) r={x:b.left+b.width/2, y:b.top+b.height/2}; }
    if(!r) r={x:innerWidth/2, y:innerHeight-40};
    const SZ=56, x=Math.max(SZ/2+8, Math.min(innerWidth-SZ/2-8, r.x)), up=Math.min(110, r.y-SZ-20);
    const w=document.createElement('div'); w.className='drop-buddy'; w.setAttribute('aria-hidden','true');
    w.style.left=px(x-SZ/2); w.style.top=px(r.y-SZ);
    w.innerHTML=`<svg viewBox="0 0 56 56" width="56" height="56">
      <g class="db-arm l"><path d="M14 33 Q6 28 5 19" /></g><g class="db-arm r"><path d="M42 33 Q50 28 51 19" /></g>
      <path class="db-body" d="M28 6 C33 14 44 22 44 34 C44 44 37 50 28 50 C19 50 12 44 12 34 C12 22 23 14 28 6 Z"/>
      <g class="db-eyes"><ellipse cx="22.5" cy="32" rx="3.2" ry="3.8"/><ellipse cx="33.5" cy="32" rx="3.2" ry="3.8"/><circle class="db-pupil" cx="23.3" cy="32.8" r="1.6"/><circle class="db-pupil" cx="34.3" cy="32.8" r="1.6"/></g>
      <path class="db-smile" d="M23 39.5 Q28 44 33 39.5"/></svg>`;
    document.body.appendChild(w);
    if(el) el.animate([{opacity:el.style.opacity||1},{opacity:0,offset:.06},{opacity:0,offset:.94},{opacity:el.style.opacity||1}],{duration:3300});   /* the drop "becomes" the creature */
    const E='cubic-bezier(.3,1.35,.45,1)';
    w.animate([
      {transform:'translateY(0) scale(.15,.06)',opacity:0},
      {transform:'translateY(0) scale(.5,.25)',opacity:1,offset:.06},
      {transform:`translateY(${-up}px) scale(.9,1.15)`,offset:.2,easing:E},
      {transform:`translateY(${-up+6}px) scale(1.12,.86)`,offset:.28},
      {transform:`translateY(${-up-26}px) scale(.94,1.08)`,offset:.38},
      {transform:`translateY(${-up+4}px) scale(1.1,.88)`,offset:.48},
      {transform:`translateY(${-up-22}px) scale(.95,1.06)`,offset:.58},
      {transform:`translateY(${-up}px) scale(1)`,offset:.7},
      {transform:`translateY(${-up}px) scale(1)`,offset:.8},
      {transform:'translateY(0) scale(.6,.4)',opacity:1,offset:.94,easing:'ease-in'},
      {transform:'translateY(0) scale(.15,.06)',opacity:0}],{duration:3300,easing:'ease-out'}).onfinish=()=>w.remove();
    for(const [sel,a] of [['.db-arm.l',-1],['.db-arm.r',1]]){ const g=w.querySelector(sel);
      g.animate([{transform:'rotate(0)'},{transform:`rotate(${a*28}deg)`,offset:.33},{transform:`rotate(${a*-10}deg)`,offset:.43},{transform:`rotate(${a*28}deg)`,offset:.53},{transform:`rotate(${a*-10}deg)`,offset:.63},{transform:'rotate(0)',offset:.75},{transform:'rotate(0)'}],{duration:3300}); }
    w.querySelector('.db-eyes').animate([{transform:'scaleY(1)'},{transform:'scaleY(1)',offset:.72},{transform:'scaleY(.1)',offset:.75},{transform:'scaleY(1)',offset:.78},{transform:'scaleY(1)'}],{duration:3300});
    /* a little burst of sparkles at the top of the first hop */
    setTimeout(()=>{ if(!w.isConnected) return; const b=w.getBoundingClientRect(), cx=b.left+b.width/2, cy=b.top+b.height/2;
      for(let k=0;k<9;k++){ const sp=document.createElement('i'); sp.className='db-spark'+(k%3===0?' gold':''); sp.style.left=px(cx-3); sp.style.top=px(cy-3); document.body.appendChild(sp);
        const a=(k/9)*Math.PI*2+.3, d=44+((k*37)%22);
        sp.animate([{transform:'translate(0,0) scale(.4)',opacity:1},{transform:`translate(${Math.cos(a)*d}px,${Math.sin(a)*d}px) scale(1)`,opacity:1,offset:.6},{transform:`translate(${Math.cos(a)*(d+10)}px,${Math.sin(a)*(d+10)+12}px) scale(.3)`,opacity:0}],{duration:900,easing:'cubic-bezier(.2,.8,.2,1)'}).onfinish=()=>sp.remove(); }
    }, 3300*.36);
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

