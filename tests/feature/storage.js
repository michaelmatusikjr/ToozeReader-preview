const { chromium } = require('playwright');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const ok=(n,c,x)=>console.log((c?'PASS ':'FAIL ')+n+(x!==undefined?' '+JSON.stringify(x):''));
const PORT=process.env.TOOZ_PORT||8750;
(async()=>{
  const b=await chromium.launch({});
  const pg=await (await b.newContext({viewport:{width:393,height:852},serviceWorkers:'block',hasTouch:true,isMobile:true})).newPage(); await pg.addInitScript(()=>{window.__toozKeepSample=true});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('http://localhost:'+PORT+'/'); await sleep(1500);
  // two books (one starter-shelf, one added), fake saved audio and a fake voice
  await pg.evaluate(async()=>{
    closeSheet();
    const mk=async(id,n)=>{ const words=Array.from({length:n},(_,i)=>'word'+i); await Store.put('texts',{id,words,ends:[n-1],blocks:[{s:0,e:n,t:'p'}],wf:null,notes:null,breaks:null,secs:null}); return words; };
    const sh=LIB.find(x=>x.id.startsWith('shelf-')&&x.source.startsWith('books/')); await mk(sh.id,20000);
    Object.assign(sh,{pending:null,count:20000,pos:50,chapters:[{t:'Start',i:0,d:0}],bookmarks:[{i:10,name:'Mark',at:1}],highlights:[{s:5,e:9,c:1,at:1}]}); touch(sh);
    await mk('own1',300);
    LIB.push({id:'own1',title:'My Own Book',author:'',kind:'text',count:300,chapters:[{t:'Start',i:0,d:0}],pos:0,highlights:[{s:1,e:3,c:1,at:1}],bookmarks:[],added:Date.now(),lastRead:Date.now(),mod:Date.now(),tags:[]}); touch(LIB[LIB.length-1]);
    const root=await navigator.storage.getDirectory();
    const w=async(dir,name,n)=>{ const h=await dir.getFileHandle(name,{create:true}); const s=await h.createWritable(); await s.write(new Uint8Array(n)); await s.close(); };
    const ad=await (await root.getDirectoryHandle('audiobooks',{create:true})).getDirectoryHandle(sh.id,{create:true}); await w(ad,'p0.mp3',1000000);
    const pd=await root.getDirectoryHandle('piper',{create:true}); await w(pd,'en_US-amy-medium.onnx',3000000); await w(pd,'en_US-amy-medium.onnx.json',2000);
    renderLibrary(); showView('settings');
  });
  await sleep(800);
  const shelfId=await pg.evaluate(()=>LIB.find(x=>x.id.startsWith('shelf-')&&!x.pending).id);
  await pg.evaluate(()=>$('#storeBooks').click()); await sleep(1500);
  const keys=()=>pg.evaluate(()=>[...document.querySelectorAll('#stgList .swrow')].map(r=>r.dataset.k));
  const k0=await keys();
  ok('list shows voice, audio, both books, biggest first', JSON.stringify(k0.slice(0,3))===JSON.stringify(['voice:en_US-amy-medium','audio:'+shelfId,'book:'+shelfId]) && k0.includes('book:own1') && k0.indexOf('book:own1')>2 && k0.length===5, k0);
  ok('rows are sorted biggest first', await pg.evaluate(()=>{ const n=[...document.querySelectorAll('#stgList .swrow .swfront > span.small')].map(e=>{ const m=e.textContent.match(/([\d.]+)\s*(B|KB|MB|GB)/i); return m? +m[1]*({B:1,KB:1024,MB:1048576,GB:1073741824}[m[2].toUpperCase()]) : 0; }); return n.every((v,i)=>!i||n[i-1]>=v*0.9); }));
  ok('last row is the fixed one with no swipe', await pg.evaluate(()=>{ const l=document.querySelector('#stgList').lastElementChild; return !l.classList.contains('swrow') && /reading log/.test(l.textContent); }));
  ok('total line and title', await pg.evaluate(()=>/Storage/.test($('#sheet h2').textContent) && /on this phone/.test($('#stgUse').textContent)), await pg.evaluate(()=>$('#stgUse').textContent));
  const swipe=async(k)=>{ await pg.evaluate((k)=>{ const el=document.querySelector('#stgList [data-k="'+k+'"] .swfront'); const r=el.getBoundingClientRect(); const y=r.top+r.height/2, x=r.right-30;
    const T=(cx)=>new Touch({identifier:1,target:el,clientX:cx,clientY:y});
    el.dispatchEvent(new TouchEvent('touchstart',{bubbles:true,cancelable:true,touches:[T(x)]}));
    for(let i=1;i<=6;i++) el.dispatchEvent(new TouchEvent('touchmove',{bubbles:true,cancelable:true,touches:[T(x-140*i/6)]}));
    el.dispatchEvent(new TouchEvent('touchend',{bubbles:true,cancelable:true,touches:[]})); },k); await sleep(500);
    await pg.evaluate((k)=>document.querySelector('#stgList [data-k="'+k+'"] .swdel').click(),k); await sleep(450); };
  const opfs=(dir,name)=>pg.evaluate(async([dir,name])=>{ try{ const root=await navigator.storage.getDirectory(); let d=await root.getDirectoryHandle(dir); for(const p of name.split('/').slice(0,-1)) d=await d.getDirectoryHandle(p); await d.getFileHandle(name.split('/').pop()); return true; }catch(e){ return false; } },[dir,name]);
  const undo=async()=>{ await pg.evaluate(()=>$('#toastAct').click()); await sleep(700); };

  // voice
  await swipe('voice:en_US-amy-medium');
  ok('voice row collapses out, toast has Undo', !(await keys()).includes('voice:en_US-amy-medium') && await pg.evaluate(()=>/Deleted Amy voice/.test($('#toastMsg').textContent) && !$('#toastAct').hidden));
  await undo(); await sleep(5500);
  ok('voice undo: row back, files kept', (await keys()).includes('voice:en_US-amy-medium') && await opfs('piper','en_US-amy-medium.onnx') && await opfs('piper','en_US-amy-medium.onnx.json'));
  await swipe('voice:en_US-amy-medium'); await sleep(5500);
  ok('voice deleted after the toast', !(await opfs('piper','en_US-amy-medium.onnx')) && !(await opfs('piper','en_US-amy-medium.onnx.json')));

  // saved audio
  await swipe('audio:'+shelfId);
  ok('audio row gone, toast', !(await keys()).includes('audio:'+shelfId) && await pg.evaluate(()=>/Deleted audio/.test($('#toastMsg').textContent)));
  await undo(); await sleep(5500);
  ok('audio undo: kept', (await keys()).includes('audio:'+shelfId) && await opfs('audiobooks',shelfId+'/p0.mp3'));
  await swipe('audio:'+shelfId); await sleep(5500);
  ok('audio deleted after the toast, book kept', !(await opfs('audiobooks',shelfId+'/p0.mp3')) && await pg.evaluate(async(id)=>!!LIB.find(x=>x.id===id) && !!(await Store.get('texts',id)),shelfId));

  // starter-shelf book: only the download goes
  await swipe('book:'+shelfId);
  ok('shelf book: shows as not downloaded at once, toast', await pg.evaluate((id)=>!!LIB.find(x=>x.id===id).pending && /Deleted download/.test($('#toastMsg').textContent),shelfId));
  await undo(); await sleep(5500);
  ok('shelf book undo: downloaded again, text kept', await pg.evaluate(async(id)=>!LIB.find(x=>x.id===id).pending && !!(await Store.get('texts',id)),shelfId));
  await pg.evaluate(()=>storageSheet()); await sleep(1200);
  await swipe('book:'+shelfId); await sleep(5500);
  const sh=await pg.evaluate(async(id)=>{ const m=LIB.find(x=>x.id===id); const sm=await Store.get('meta',id); return {inLib:!!m, pending:!!m.pending, text:!!(await Store.get('texts',id)), bm:m.bookmarks.length, hl:m.highlights.length, pos:m.pos, savedPending:!!(sm&&sm.pending)}; },shelfId);
  ok('shelf book after toast: stays in library, not downloaded, notes and place kept', sh.inLib && sh.pending && !sh.text && sh.bm===1 && sh.hl===1 && sh.pos===50 && sh.savedPending, sh);
  await pg.evaluate(()=>closeSheet()); await sleep(300);
  /* no internet in the test box for the epub reader library, so stand in for the download itself */
  const re=await pg.evaluate(async(id)=>{ let asked=null; window.fetchShelfBook=async m=>{ asked=m.pending&&m.pending.src; const words=Array.from({length:50},(_,i)=>'w'+i); await Store.put('texts',{id:m.id,words,ends:[49],blocks:[{s:0,e:50,t:'p'}],wf:null,notes:null,breaks:null,secs:null}); Object.assign(m,{count:50,pending:null}); touch(m); return true; };
    const r=await openDoc(id); return {r, asked, id:R.meta&&R.meta.id, pending:!!LIB.find(x=>x.id===id).pending, hl:LIB.find(x=>x.id===id).highlights.length, bm:LIB.find(x=>x.id===id).bookmarks.length}; },shelfId);
  await sleep(500);
  ok('shelf book downloads again when opened, notes kept', re.id===shelfId && /^books\//.test(re.asked||'') && !re.pending && re.hl===1 && re.bm===1, re);
  await pg.evaluate(()=>{ closeReader(true); showView('settings'); storageSheet(); }); await sleep(1500);

  // book he added
  ok('added book listed', (await keys()).includes('book:own1'));
  await swipe('book:own1');
  ok('added book leaves the library at once; toast says Deleted <title>', await pg.evaluate(()=>!LIB.find(x=>x.id==='own1') && /Deleted My Own Book/.test($('#toastMsg').textContent)));
  await undo(); await sleep(5500);
  ok('added book undo restores it fully', await pg.evaluate(async()=>{ const m=LIB.find(x=>x.id==='own1'); return !!m && m.highlights.length===1 && !!(await Store.get('texts','own1')) && !!(await Store.get('meta','own1')); }));
  await swipe('book:own1'); await sleep(5500);
  ok('added book gone after the toast', await pg.evaluate(async()=>!LIB.find(x=>x.id==='own1') && !(await Store.get('texts','own1')) && !(await Store.get('meta','own1'))));

  ok('no page errors', !errs.length, errs);
  await b.close();
})();
