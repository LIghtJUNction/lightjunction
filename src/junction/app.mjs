import { STATIONS, PROJECTS, MEMORIES, SAVE_KEY, readSave, persist, createWorld, routeFromHash, tick, travel, pulse, createCircuit, rotateCircuit, circuitSolved, repair, collectMemory, distance } from './world.mjs';
import { createScene } from './scene.mjs';
const $=id=>document.getElementById(id);
const ICONS=['✣','♧','⌁','◈','⌁','>_','◇','↗'];
const node=(tag,text,className)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(className)el.className=className;return el;};
const button=(text,fn,className)=>{const el=node('button',text,className);el.type='button';el.addEventListener('click',fn);return el;};
function link(text,url,className='station-action'){const a=node('a',text,className);a.href=url;if(/^https:/.test(url)){a.target='_blank';a.rel='noopener noreferrer';}return a;}
function safeRepoURL(value){try{const u=new URL(value);return u.protocol==='https:'&&u.hostname==='github.com'&&!u.username&&!u.password?u.href:null;}catch{return null;}}

function start() {
  const canvas=$('junction-scene'), scene=createScene(canvas), media=matchMedia('(prefers-reduced-motion: reduce)');
  let storage;try{storage=localStorage;}catch{/* Session-only mode is fully usable. */}
  const world=createWorld(readSave(storage));
  if(media.matches)world.save.reducedMotion=true;
  const dialog=$('station-dialog'), content=$('station-content'), map=$('map-dialog'), settings=$('settings-dialog');
  const labels=new Map(), dock=new Map(), keys=new Set(), circuits=PROJECTS.map((project,i)=>{const circuit=createCircuit(i);if(world.save.repaired.includes(project.id))circuit.turns=[...circuit.target];return circuit;});
  let frameID=0, previous=performance.now(), pending=null, active='home', pixel=2, statusTimer=0, stick={x:0,z:0}, cryptoPromise, shaderPromise, resetArmed=false, audio;
  const reduced=()=>world.save.reducedMotion;
  const secureBusy=()=>Boolean($('secure-card')&&!$('secure-card').hidden)||$('result-overlay')?.getAttribute('aria-hidden')==='false';
  const busy=()=>dialog.open||map.open||settings.open||secureBusy();
  const announce=text=>{clearTimeout(statusTimer);$('world-status').textContent=text;$('world-status').classList.add('visible');statusTimer=setTimeout(()=>$('world-status').classList.remove('visible'),2600);};
  function sound(){if(world.save.muted)return;try{audio||=new (window.AudioContext||window.webkitAudioContext)();void audio.resume();const osc=audio.createOscillator(),gain=audio.createGain();osc.type='sine';osc.frequency.setValueAtTime(520,audio.currentTime);osc.frequency.exponentialRampToValueAtTime(900,audio.currentTime+.08);gain.gain.setValueAtTime(.035,audio.currentTime);gain.gain.exponentialRampToValueAtTime(.0001,audio.currentTime+.12);osc.connect(gain);gain.connect(audio.destination);osc.start();osc.stop(audio.currentTime+.13);}catch{/* Audio is optional. */}}
  function save(){const ok=persist(storage,world.save);$('save-status').textContent=ok?'本机存档 · 无需登录':'临时探索 · 浏览器未允许保存';}
  function updateProgress(){
    $('shard-count').textContent=String(world.save.collected.length).padStart(2,'0');$('place-count').textContent=`${world.save.visited.length}/8`;
    const repaired=world.save.repaired.length, memories=world.save.memories.length;
    $('quest-text').textContent=repaired<4?`接通开源船坞的 ${4-repaired} 条线路。` :memories<3?`在花园找回 ${3-memories} 段记忆。` :world.save.visited.length<8?'走遍地图，让每一个设施亮起来。':'所有设施已点亮。还有云间碎片等你发现。';
    $('quest-progress').style.width=`${(repaired+memories+world.save.visited.length)/15*100}%`;
    for(const s of STATIONS){labels.get(s.id).dataset.visited=String(world.save.visited.includes(s.id));}
  }
  function drainEvents(){if(!world.events.length)return;const count=world.events.filter(e=>e.type==='collect').length;const event=world.events.at(-1);world.events.length=0;updateProgress();save();if(event.type==='collect'){sound();announce(`信号碎片 +${count} · ${world.save.collected.length}/42`);}else if(event.type==='repair'){sound();announce('线路已接通，机库重新亮起。');}else if(event.type==='memory'){sound();announce('记忆已写入本机档案。');}}
  function clearInput(){keys.clear();stick={x:0,z:0};$('flight-stick').firstElementChild.style.transform='';}
  function returnPayloads(){content.querySelectorAll('[data-junction-payload]').forEach(el=>$('station-payloads')?.append(el));}
  // Native dialog close events are queued: a synchronous flag cannot suppress them.
  const quietClosures=new WeakMap();
  function closeQuietly(el){if(!el.open)return;quietClosures.set(el,(quietClosures.get(el)||0)+1);el.close();}
  function quietEvent(el){const count=quietClosures.get(el)||0;if(!count)return false;quietClosures.set(el,count-1);return true;}
  function closeDialogs(){for(const el of [dialog,map,settings])closeQuietly(el);returnPayloads();clearInput();}
  function navigate(id){if(location.hash===`#${id}`)route();else location.hash=id;}
  function back(){navigate('home');}
  function closeToWorld(){if(quietEvent(dialog))return;returnPayloads();scene.setFocus(null);clearInput();if(location.hash&&routeFromHash(location.hash)!=='home')history.replaceState(null,'',`${location.pathname}${location.search}#home`);active='home';for(const b of dock.values())b.removeAttribute('aria-current');dock.get('home').setAttribute('aria-current','location');canvas.focus({preventScroll:true});}
  dialog.addEventListener('close',closeToWorld);
  $('station-close').addEventListener('click',back);
  for(const [el,id] of [[map,'map-close'],[settings,'settings-close']]){$(id).addEventListener('click',()=>el.close());el.addEventListener('close',()=>{if(quietEvent(el))return;clearInput();canvas.focus({preventScroll:true});});}
  for(const el of [dialog,map,settings])el.addEventListener('click',event=>{if(event.target!==el)return;const r=el.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)el.close();});
  function openMap(){if(secureBusy())return;closeDialogs();scene.setFocus(null);map.showModal();}
  $('map-button').addEventListener('click',openMap);
  $('settings-button').addEventListener('click',()=>{if(secureBusy())return;closeDialogs();settings.showModal();});
  $('motion-setting').checked=world.save.reducedMotion;
  $('sound-setting').checked=!world.save.muted;
  $('motion-setting').addEventListener('change',event=>{world.save.reducedMotion=event.target.checked;save();});
  media.addEventListener('change',event=>{world.save.reducedMotion=event.matches;$('motion-setting').checked=event.matches;save();});
  $('sound-setting').addEventListener('change',event=>{world.save.muted=!event.target.checked;save();sound();});
  $('pixels-button').addEventListener('click',()=>{pixel=pixel===2?3:2;scene.setPixels(pixel);$('pixels-button').textContent=`PIXELS ×${pixel}`;});
  $('reset-save').addEventListener('click',()=>{if(!resetArmed){resetArmed=true;$('reset-note').textContent='再次点击确认。只删除本站探索记录，不会删除战斗成绩或任何消息。';return;}try{storage?.removeItem(SAVE_KEY);}catch{}location.reload();});
  for(const [index,s] of STATIONS.entries()){
    const label=button('',()=>{if(busy())return;travel(world,s.id);pending=s.id;announce(`前往${s.name}，也可用下方船坞直接传送。`);canvas.focus({preventScroll:true});},'station-label');
    label.append(node('b',s.name),node('small',s.en));label.style.setProperty('--accent',s.color);label.setAttribute('aria-label',`驾驶前往${s.name}`);$('station-labels').append(label);labels.set(s.id,label);
    const shortcut=button('',()=>navigate(s.id));shortcut.append(node('small',String(index+1).padStart(2,'0')),node('span',ICONS[index]),document.createTextNode(s.name));shortcut.style.setProperty('--accent',s.color);shortcut.setAttribute('aria-label',`直接进入${s.name}`);$('world-dock').append(shortcut);dock.set(s.id,shortcut);
    const mapButton=button('',()=>navigate(s.id));mapButton.append(node('span',ICONS[index]),node('b',s.name),node('small',`${s.en} / ${s.x}, ${s.z}`));$('map-places').append(mapButton);
  }
  function showMemory(){
    const art=node('div',undefined,'memory-avatar');art.append(node('div',undefined,'pixel-face'));content.append(art);
    const tabs=node('div',undefined,'memory-tabs'), dialogue=node('p',undefined,'dialogue');tabs.setAttribute('aria-label','阅读并收集记忆片段');
    const show=index=>{dialogue.textContent=MEMORIES[index][1];[...tabs.children].forEach((el,i)=>el.setAttribute('aria-pressed',String(i===index)));collectMemory(world,index);drainEvents();};
    MEMORIES.forEach(([title],i)=>tabs.append(button(`${String(i+1).padStart(2,'0')} / ${title}`,()=>show(i))));content.append(tabs,dialogue,node('h3','CAPABILITIES / 技能背包','station-subtitle'));
    const inventory=node('div',undefined,'skill-inventory');for(const skill of ['Arch Linux','Rust','TypeScript','Python','Go','Shell','Agents','OpenPGP','OAuth'])inventory.append(node('span',skill));content.append(inventory,link('查看公开身份 ↗','https://github.com/LIghtJUNction'));show(0);
  }
  async function loadFleet(target){
    target.textContent='正在读取已同步的舰队记录…';
    try{
      const {fetchStaticProjectCards}=await import('../github.ts');const repos=await fetchStaticProjectCards();if(!target.isConnected)return;target.replaceChildren();
      const label=node('label','搜索项目'), search=node('input');search.type='search';search.placeholder='输入项目名、语言或关键词';search.setAttribute('aria-label','搜索完整开源舰队');label.append(search);const list=node('div',undefined,'fleet-list');
      const render=()=>{list.replaceChildren();const query=search.value.trim().toLowerCase();const matches=repos.filter(repo=>`${repo.name} ${repo.language||''} ${repo.description||''}`.toLowerCase().includes(query));for(const repo of matches.slice(0,80)){const url=safeRepoURL(repo.html_url);if(!url)continue;const a=link(repo.name+' ↗',url,'fleet-row');a.append(node('small',repo.language||'source'));list.append(a);}if(!matches.length)list.append(node('p','没有匹配的项目。'));};search.addEventListener('input',render);target.append(label,list);render();
    }catch{target.replaceChildren(node('p','同步记录暂时不可用，仍可直接进入完整仓库。'),link('打开 GitHub 舰队 ↗','https://github.com/LIghtJUNction?tab=repositories'));}
  }
  function showProjects(){
    content.append(node('p','每一艘船都是一个真实项目。旋转四个接头，让箭头对准右下角的目标方向，点亮机库。源码随时可打开。','station-note'));
    const tabs=node('div',undefined,'project-selector'), detail=node('div');
    function show(index){
      [...tabs.children].forEach((el,i)=>el.setAttribute('aria-pressed',String(i===index)));detail.replaceChildren();const p=PROJECTS[index], circuit=circuits[index];
      detail.append(node('h3',p.name,'project-name'),node('span',p.language,'micro'),node('p',p.note,'project-description'));
      const puzzle=node('div',undefined,'circuit'), status=node('p',undefined,'circuit-status');
      const directions=['↑','→','↓','←'];
      function renderCircuit(){[...puzzle.children].forEach((b,i)=>{b.style.setProperty('--turn',circuit.turns[i]);b.dataset.correct=String(circuit.turns[i]===circuit.target[i]);b.setAttribute('aria-label',`接头 ${i+1}，当前${directions[circuit.turns[i]]}，目标${directions[circuit.target[i]]}，点击顺时针旋转`);});const solved=circuitSolved(circuit);status.textContent=world.save.repaired.includes(p.id)?'● 机库已点亮 · 线路记录已保存':solved?'● 线路接通':'旋转接头，把四个箭头对准目标。';}
      for(let i=0;i<4;i++){const b=button('',()=>{rotateCircuit(circuit,i);if(circuitSolved(circuit))repair(world,p.id);renderCircuit();drainEvents();});b.dataset.target=directions[circuit.target[i]];puzzle.append(b);}
      detail.append(puzzle,status,link('进入真实仓库 ↗',p.url));renderCircuit();
    }
    PROJECTS.forEach((p,i)=>tabs.append(button(p.name,()=>show(i))));content.append(tabs,detail);show(0);
    const fleet=node('details',undefined,'field-manual'), summary=node('summary','完整开源舰队 / 搜索已同步的所有项目'), fleetBody=node('div',undefined,'fleet-body');let loaded=false;fleet.addEventListener('toggle',()=>{if(fleet.open&&!loaded){loaded=true;void loadFleet(fleetBody);}});fleet.append(summary,fleetBody);content.append(fleet);
  }
  function attachPayload(id){const payload=$(id);if(!payload){content.append(node('p','这个设施的资料未能载入。请刷新后重试。','station-note'));return null;}payload.dataset.junctionPayload='';payload.classList.add('station-payload');content.append(payload);return payload;}
  async function showShaders(){
    content.append(node('p','拖动光场改变它的形态；左右切换四项实验。这里运行的是原始实时着色器，不是视频。','station-note'));if(!attachPayload('shaders'))return;
    try{shaderPromise||=import('../shader-gallery.ts').then(module=>module.mountShaderShowcase());await shaderPromise;}catch{content.append(node('p','实时渲染器未能载入。请刷新或更换支持 WebGL2 的浏览器。','station-note'));}
  }
  function showContact(){
    content.append(node('p','把游标移到中央，让信号重合。小游戏不会阻止你联系，也不会自动发送任何消息。','station-note'));
    const scope=node('div',undefined,'signal-scope'), label=node('label',undefined,'signal-label'), value=node('span','25 / 100'), slider=node('input');slider.type='range';slider.min='0';slider.max='100';slider.value='25';slider.className='signal-frequency';slider.id='signal-frequency';label.htmlFor=slider.id;label.append(node('span','天线频率'),value);
    const status=node('p','信号有偏移。','station-note');slider.addEventListener('input',()=>{scope.style.setProperty('--signal',`${slider.value}%`);value.textContent=`${slider.value} / 100`;status.textContent=Math.abs(Number(slider.value)-50)<=3?'● 信号已对齐。可以写下一段消息。':'信号有偏移。';});content.append(scope,label,slider,status);
    const compose=button('打开加密通讯 ↗',async()=>{
      compose.disabled=true;compose.textContent='正在连接本地加密器…';
      try{cryptoPromise||=import('../secure-card.ts').then(module=>{module.initSecureCard(()=>{});return module;});const module=await cryptoPromise;closeQuietly(dialog);clearInput();scene.setFocus(null);canvas.focus({preventScroll:true});module.openSecureCard();}catch{cryptoPromise=undefined;announce('加密组件载入失败，请重试或通过 GitHub 联系。');}finally{compose.disabled=false;compose.textContent='打开加密通讯 ↗';}
    },'station-action');
    content.append(compose,link('通过 GitHub 联系 ↗','https://github.com/LIghtJUNction','secondary-action'),node('p','消息仍由原来的 OpenPGP + age 流程在本地加密，再由你确认 GitHub 交接。不要填写私钥、口令、恢复码或其他凭据。','contact-warning'),link('查看 age 收件人 ↓','./age-recipients.txt','secondary-action'));
  }
  function showTerminal(){
    content.append(node('p','这是世界导航控制台，不是服务器 Shell。输入 help 查看可用命令。','station-note'));
    const log=node('div','JUNCTION OS / LOCAL NAVIGATION\n\n输入 help，或试试 go work。\n','terminal-log');log.setAttribute('role','log');log.setAttribute('aria-live','polite');const form=node('form',undefined,'terminal-form'), label=node('label','>'), input=node('input');input.id='world-command';input.autocomplete='off';input.spellcheck=false;input.setAttribute('aria-label','世界导航命令');label.htmlFor=input.id;const submit=node('button','↵');submit.type='submit';form.append(label,input,submit);const history=[];let cursor=0;
    const write=text=>{log.textContent+=text+'\n';if(log.textContent.length>12000)log.textContent=log.textContent.slice(-9000);log.scrollTop=log.scrollHeight;};
    form.addEventListener('submit',event=>{event.preventDefault();const text=input.value.trim();if(!text)return;history.push(text);cursor=history.length;input.value='';write(`> ${text}`);const [command,arg]=text.toLowerCase().split(/\s+/);switch(command){case 'help':write('help / map / go <地点> / projects / about / contact / status / clear\n地点: home about work shaders contact terminal challenge-two frontier');break;case 'clear':log.textContent='';break;case 'map':openMap();break;case 'go':if(STATIONS.some(s=>s.id===arg))navigate(arg);else write('未知地点。输入 help 查看地图坐标。');break;case 'projects':navigate('work');break;case 'about':navigate('about');break;case 'contact':navigate('contact');break;case 'status':write(`地点 ${world.save.visited.length}/8 · 碎片 ${world.save.collected.length}/42 · 机库 ${world.save.repaired.length}/4\n数据仅存于本机。不连接远程终端。`);break;default:write('没有这个命令。输入 help 查看支持的操作。');}});
    input.addEventListener('keydown',event=>{if(!['ArrowUp','ArrowDown'].includes(event.key))return;event.preventDefault();cursor=Math.max(0,Math.min(history.length,cursor+(event.key==='ArrowUp'?-1:1)));input.value=history[cursor]||'';});content.append(log,form);requestAnimationFrame(()=>{if(dialog.open&&active==='terminal')input.focus();});
  }
  async function showFrontier(){
    content.append(node('p','安全区到此为止。建设防线、指挥小队，在没有最后一波的边境继续战斗。探索存档与战斗成绩分开保存。','station-note'),link('部署无尽防线 ↗','./frontier.html'),node('p','离开会开始独立战斗场景。未结束的战局不跨刷新保存；边境内可返回这座世界。','station-note'));
    const manual=node('details',undefined,'field-manual');manual.append(node('summary','建筑 / 小队 / 敌人图鉴'));const body=node('div');manual.append(body);content.append(manual);let loaded=false;
    manual.addEventListener('toggle',async()=>{if(!manual.open||loaded)return;loaded=true;body.textContent='正在读取边境配置…';try{const {TOWERS,UNITS,ENEMIES,UPGRADES,readFrontierRecord}=await import('../token-drift/frontier-world.mjs');body.replaceChildren();const record=readFrontierRecord(storage);body.append(node('p',`本机最长防守 ${record.bestWave} 波 · ${record.bestScore} 分`,'station-note'));for(const [name,group] of [['建筑',TOWERS],['小队',UNITS],['敌人',ENEMIES],['肉鸽强化',UPGRADES]]){body.append(node('h3',name,'station-subtitle'));for(const def of Object.values(group)){const row=node('div',undefined,'manual-row');row.append(node('b',def.name),node('p',`${def.tip||'边境单位'}${def.hp?` · ${def.hp} HP`:''}${def.max?` · 最多 ${def.max} 级`:''}${def.cost?` · ${def.cost} TK`:''}`));body.append(row);}}}catch{loaded=false;body.textContent='图鉴暂未载入，请重新展开重试。';}});
  }
  function route(){
    if(secureBusy())return;
    const id=routeFromHash(location.hash), station=STATIONS.find(s=>s.id===id);closeDialogs();active=id;pending=null;
    if(id!=='home')travel(world,id,true);scene.setFocus(id==='home'?null:station);if(id!=='home')scene.snap(station.x,station.z);
    for(const [key,b] of dock){if(key===id)b.setAttribute('aria-current','location');else b.removeAttribute('aria-current');}
    $('arrival').querySelector('h1').textContent=station.name;$('arrival').querySelector('p').textContent=station.hint;
    if(id==='home'){canvas.focus({preventScroll:true});drainEvents();return;}
    content.replaceChildren();$('station-title').textContent=station.name;$('station-kicker').textContent=station.en;dialog.style.setProperty('--accent',station.color);dialog.dataset.station=id;
    const renderers={about:showMemory,work:showProjects,shaders:showShaders,contact:showContact,terminal:showTerminal,'challenge-two':()=>attachPayload('challenge-two'),frontier:showFrontier};
    dialog.showModal();void renderers[id]?.();drainEvents();
  }
  window.addEventListener('hashchange',route);
  function interact(){if(busy())return;if(world.nearest)navigate(world.nearest==='home'?'about':world.nearest);else announce('靠近一座设施，或打开地图直接传送。');}
  $('interact-button').addEventListener('click',interact);
  $('scan-button').addEventListener('click',()=>{if(!busy()){pulse(world);sound();}});
  window.addEventListener('keydown',event=>{
    if(busy()||event.ctrlKey||event.metaKey||event.altKey||event.target.closest?.('input,textarea,select,button,a,[contenteditable=true]'))return;
    const key=event.key.toLowerCase();if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright','shift',' ','e','m'].includes(key))event.preventDefault();
    keys.add(key);if(event.repeat)return;if(key==='e')interact();else if(key==='m')openMap();else if(key===' '){pulse(world);sound();}
  });
  window.addEventListener('keyup',event=>keys.delete(event.key.toLowerCase()));window.addEventListener('blur',clearInput);
  let pointer;
  canvas.addEventListener('pointerdown',event=>{if(event.button!==0||busy())return;pointer={id:event.pointerId,x:event.clientX,y:event.clientY};canvas.setPointerCapture(event.pointerId);canvas.focus({preventScroll:true});});
  canvas.addEventListener('pointerup',event=>{if(pointer?.id!==event.pointerId)return;const moved=Math.hypot(event.clientX-pointer.x,event.clientY-pointer.y);pointer=null;if(moved<12&&!busy()){world.target=scene.ground(event.clientX,event.clientY);pending=null;}});
  for(const type of ['pointercancel','lostpointercapture'])canvas.addEventListener(type,()=>pointer=null);
  canvas.addEventListener('wheel',event=>{if(busy())return;event.preventDefault();scene.setZoom(scene.getZoom()-Math.sign(event.deltaY)*.07);},{passive:false});
  const joystick=$('flight-stick');let stickPointer=null;
  function moveStick(event){if(event.pointerId!==stickPointer)return;const r=joystick.getBoundingClientRect();let dx=(event.clientX-r.left-r.width/2)/(r.width*.38),dy=(event.clientY-r.top-r.height/2)/(r.height*.38);const length=Math.max(1,Math.hypot(dx,dy));dx/=length;dy/=length;stick={x:(dx+dy)*.707,z:(dy-dx)*.707};joystick.firstElementChild.style.transform=`translate(${dx*24}px,${dy*24}px)`;pending=null;}
  joystick.addEventListener('pointerdown',event=>{if(busy())return;stickPointer=event.pointerId;joystick.setPointerCapture(event.pointerId);moveStick(event);});joystick.addEventListener('pointermove',moveStick);
  for(const type of ['pointerup','pointercancel','lostpointercapture'])joystick.addEventListener(type,()=>{stickPointer=null;clearInput();});
  let nearestBefore;
  function draw(now){
    frameID=0;if(document.hidden)return;const dt=Math.min(.05,(now-previous)/1000);previous=now;
    if(!busy()){
      const horizontal=Number(keys.has('d')||keys.has('arrowright'))-Number(keys.has('a')||keys.has('arrowleft'));
      const vertical=Number(keys.has('s')||keys.has('arrowdown'))-Number(keys.has('w')||keys.has('arrowup'));
      if(horizontal||vertical)pending=null;
      tick(world,dt,{x:(horizontal+vertical)*.707+stick.x,z:(vertical-horizontal)*.707+stick.z,dash:keys.has('shift')});
      if(pending&&!world.target){const s=STATIONS.find(s=>s.id===pending);if(distance(world.player,s)<7){const id=pending;pending=null;navigate(id);}}
      drainEvents();
    }
    if(!(dialog.open&&active==='shaders')){
      const coordinates=scene.draw(world,dt,reduced());
      for(const [id,pos] of coordinates){const el=labels.get(id);el.hidden=!pos.visible;el.style.left=`${pos.x}px`;el.style.top=`${pos.y}px`;el.dataset.near=String(world.nearest===id);}
    }
    if(world.nearest!==nearestBefore){nearestBefore=world.nearest;const s=STATIONS.find(s=>s.id===world.nearest);$('interact-button').querySelector('span').textContent=s?`进入${s.id==='home'?'记忆花园':s.name}`:'靠近设施后交互';if(!busy()&&s){$('arrival').querySelector('h1').textContent=s.name;$('arrival').querySelector('p').textContent=s.hint;}}
    frameID=requestAnimationFrame(draw);
  }
  window.addEventListener('resize',()=>scene.resize());
  document.addEventListener('visibilitychange',()=>{clearInput();previous=performance.now();if(document.hidden){cancelAnimationFrame(frameID);frameID=0;void audio?.suspend();save();}else if(!frameID)frameID=requestAnimationFrame(draw);});
  window.addEventListener('pagehide',()=>{save();clearInput();});
  scene.resize();updateProgress();save();route();frameID=requestAnimationFrame(draw);
  document.documentElement.dataset.worldReady='true';
}
try{start();}catch(error){console.error('Junction startup failed:',error);$('startup-fallback').hidden=false;}
