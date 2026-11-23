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
      const on=rd.dataset.mode!=='speed';   /* shown with or without the controls; Speed mode has its own progress bar */
      return {kind:'base', l:0, t:innerHeight-Math.max(inset()*.5,7)-3, w:Math.max(6,Math.min(1,frac)*innerWidth), h:3, vis:on};
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
    if(from.kind===to.kind && to.kind==='base'){          /* progress: glide, a little give at the end */
      anim=el.animate([{width:px(from.w)},{width:px(to.w)}],{duration:420,easing:SPRING}); return;
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
    if(t.vis!==vis){ vis=t.vis; el.style.opacity=vis?1:0; fade(el,vis?0:1,vis?1:0,200); }
  }
  const later=()=>{ if(!queued){ queued=true; queueMicrotask(sync); } };
  function init(){
    el=document.createElement('i'); el.id='drop'; el.setAttribute('aria-hidden','true'); document.body.appendChild(el);
    const mo=new MutationObserver(later);
    const tabs=document.getElementById('tabs'), rd=document.getElementById('v-reader');
    if(tabs){ mo.observe(tabs,{attributes:true,subtree:true,attributeFilter:['aria-current','hidden']}); }
    if(rd){ mo.observe(rd,{attributes:true,attributeFilter:['hidden','class','data-mode']}); }
    addEventListener('resize',()=>{ if(!el||!placed) return; const t=target(); if(t){ cur=t; put(el,t); } });
    requestAnimationFrame(sync);
  }
  /* ----- reading progress (0..1) ----- */
  function progress(f){ frac=Math.max(0,Math.min(1,+f||0)); later(); }

  /* ----- segmented controls: the selection is the same liquid ----- */
  const seen=new Map();
  function seg(g){
    if(g._lq||!g.classList.contains('seg')) return; g._lq=1; g.classList.add('lq');
    const key=g.id||g.dataset.set||''; let d=null, shown=false, at=null;
    const geo=()=>{ const b=g.querySelector('button[aria-pressed="true"]'); return b&&b.offsetWidth?{l:b.offsetLeft,t:b.offsetTop,w:b.offsetWidth,h:b.offsetHeight}:null; };
    const mk=()=>{ if(!d||!d.isConnected){ d=document.createElement('i'); d.className='drop-seg'; g.prepend(d); } return d; };
    function reveal(animate){
      const r=geo(); if(!r) return; shown=true; at=r; put(mk(),r); g.classList.add('lq-on'); seen.set(key,Date.now());
      if(!animate) return;
      if(RM.matches){ fade(d,0,1,260); return; }
      d.animate([{transform:'scale(.1,.3)',opacity:0,borderRadius:'999px'},{offset:.3,opacity:1,borderRadius:'999px'},{transform:'none',opacity:1,borderRadius:'0px'}],{duration:620,easing:SPRING});
    }
    function move(){
      const to=geo(); if(!to||!shown) return; const from=at; at=to; mk(); put(d,to);
      if(!from||RM.matches){ fade(d,.2,1,220); return; }
      const L=Math.min(from.l,to.l), Rr=Math.max(from.l+from.w,to.l+to.w);
      d.animate([
        {...css(from),borderRadius:'0px',easing:DRAG},
        {offset:.4,left:px(L),width:px(Rr-L),top:px(from.t+4),height:px(from.h-8),borderRadius:'999px',easing:SPRING},
        {...css(to),borderRadius:'0px'}],{duration:520});
    }
    new MutationObserver(move).observe(g,{attributes:true,subtree:true,attributeFilter:['aria-pressed']});
    new ResizeObserver(()=>{ if(!shown) return; const r=geo(); if(r){ at=r; put(mk(),r); } }).observe(g);
    /* a group that was just on screen (a settings page redrawn) is placed at once; a new one waits until it's fully in view, then a beat */
    if(key && Date.now()-(seen.get(key)||0)<4000){ reveal(false); if(shown) return; }
    if(!('IntersectionObserver' in window)){ reveal(false); return; }
    const io=new IntersectionObserver(es=>{ if(es.some(e=>e.isIntersecting&&e.intersectionRatio>=.9)){ io.disconnect(); setTimeout(()=>reveal(true),260); } },{threshold:[.9,1]});
    io.observe(g);
  }
  const scan=root=>{ if(root.nodeType!==1) return; if(root.classList&&root.classList.contains('seg')) seg(root); root.querySelectorAll&&root.querySelectorAll('.seg').forEach(seg); };
  function watch(){
    document.querySelectorAll('.seg').forEach(seg);
    for(const id of ['settingsBody','sheet','v-words','v-library','v-stats']){
      const n=document.getElementById(id); if(!n) continue;
      new MutationObserver(ms=>{ for(const m of ms) m.addedNodes.forEach(scan); }).observe(n,{childList:true,subtree:true});
    }
  }
  function start(){ init(); watch(); }
  if(document.readyState==='loading') addEventListener('DOMContentLoaded',start); else start();
  return {progress, sync:later, seg};
})();
