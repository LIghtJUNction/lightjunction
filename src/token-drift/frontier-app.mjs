import { createFrontier,startFrontier,pauseFrontier,resumeFrontier,advanceFrontier,buildCheck,buildTower,upgradeTower,repair,sellTower,recruit,cancelRecruit,commandUnits,setRally,launchWave,dashFrontier,pulseFrontier,chooseUpgrade,reroll,TOWERS,UNITS,UPGRADES,CAPS,readFrontierRecord,saveFrontierRecord,playerStats } from './frontier-world.mjs';
import { FrontierRenderer } from './frontier-renderer.mjs';
const $=id=>document.getElementById(id),root=$('token-drift'),canvas=document.querySelector('[data-scene]');
const controller=new AbortController(),on=(target,type,fn,opts={})=>target.addEventListener(type,fn,{...opts,signal:controller.signal});
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
let storage;try{storage=localStorage;}catch{/* Optional local records. */}
const seed=()=>{try{return crypto.getRandomValues(new Uint32Array(1))[0];}catch{return Date.now()>>>0;}};
let world=createFrontier(seed()),renderer,raf=0,last=0,acc=0,hudClock=0,shown='',recorded=false,selected=[],towerId=null,buildKind=null,order=null,pointer=null,ghost=null,box=null,drawer='',sound=false,audio;
const keys=new Set(),stick={x:0,z:0,id:null},STEP=1/60;
const sounds={built:330,wave:130,clear:660,hit:80,upgrade:520,pulse:240,'boss-down':880};
function tone(type){if(!sound||!audio||audio.state!=='running')return;const osc=audio.createOscillator(),gain=audio.createGain(),now=audio.currentTime;
  osc.type='triangle';osc.frequency.value=sounds[type]||400;gain.gain.setValueAtTime(.03,now);gain.gain.exponentialRampToValueAtTime(.0001,now+.14);osc.connect(gain);gain.connect(audio.destination);osc.start();osc.stop(now+.16);osc.onended=()=>{osc.disconnect();gain.disconnect();};}
function announce(text){$('announcement').textContent=text;}
function clearInput(){keys.clear();stick.x=stick.z=0;stick.id=null;pointer=null;box=null;$('joystick-knob').style.transform='translate(0,0)';}
function cancelMode(){buildKind=null;order=null;ghost=null;updateHUD();requestDraw();}
function openDrawer(kind,force=false){drawer=force?kind:drawer===kind?'':kind;for(const el of document.querySelectorAll('[data-drawer]'))el.hidden=el.dataset.drawer!==drawer;for(const el of document.querySelectorAll('[data-tab]'))el.setAttribute('aria-expanded',String(el.dataset.tab===drawer));requestDraw();}
function movement(){let x=Number(keys.has('KeyD')||keys.has('ArrowRight'))-Number(keys.has('KeyA')||keys.has('ArrowLeft'))+stick.x,z=Number(keys.has('KeyS')||keys.has('ArrowDown'))-Number(keys.has('KeyW')||keys.has('ArrowUp'))+stick.z;
  const n=Math.hypot(x,z);if(n>1){x/=n;z/=n;}const a=renderer.camera.yaw;return {x:x*Math.cos(a)+z*Math.sin(a),z:-x*Math.sin(a)+z*Math.cos(a)};}
function start(){world=createFrontier(seed());startFrontier(world);recorded=false;selected=[];towerId=null;cancelMode();clearInput();renderer.camera.x=renderer.camera.z=0;renderer.camera.follow=false;acc=0;syncPhase();updateHUD();requestDraw();canvas.focus();announce('先建炮塔，再训练小队。核心失守才会结束；旗舰损毁后会重生。');}
function pause(){if(pauseFrontier(world)){if(world.wave>0)saveFrontierRecord(storage,world);clearInput();acc=0;syncPhase();$('resume-button').focus();requestDraw();}}
function resume(){if(resumeFrontier(world)){clearInput();acc=0;syncPhase();requestDraw();canvas.focus();}}
function syncPhase(){
  if(shown===world.phase)return;shown=world.phase;root.dataset.phase=shown;
  $('intro').hidden=shown!=='ready';$('hud').hidden=shown==='ready';$('pause-button').hidden=shown==='ready'||shown==='lost';
  $('paused').hidden=shown!=='paused';$('result').hidden=shown!=='lost';
  if(shown==='upgrade'){clearInput();buildKind=null;ghost=null;renderChoices();if(!$('upgrade').open)$('upgrade').showModal();$('choices').querySelector('button')?.focus();}
  else if($('upgrade').open)$('upgrade').close();
  if(shown==='lost'){clearInput();cancelMode();if(!recorded){saveFrontierRecord(storage,world);recorded=true;}
    $('result-title').textContent=world.lossReason||'防线失守';$('result-stats').textContent=`第 ${world.wave} 波 · 击败 ${world.kills} 个敌人 · ${Math.floor(world.score)} 分 · ${Math.floor(world.time/60)} 分 ${Math.floor(world.time%60)} 秒`;$('restart').focus();}
}
function renderChoices(){const host=$('choices');host.replaceChildren();for(const [i,id] of world.choices.entries()){
  const u=UPGRADES.find(u=>u.id===id),b=document.createElement('button');b.type='button';b.dataset.upgrade=id;
  const small=document.createElement('small'),strong=document.createElement('strong'),p=document.createElement('p');
  small.textContent=`0${i+1} / LV ${(world.upgrades[id]||0)+1}`;strong.textContent=u.name;p.textContent=u.tip;b.append(small,strong,p);host.append(b);
}$('reroll').textContent=`重抽 · 剩余 ${world.rerolls} 次`;$('reroll').disabled=world.rerolls<=0;}
function choose(id){if(!chooseUpgrade(world,id))return;shown='';syncPhase();updateHUD();requestDraw();if(world.phase==='playing')canvas.focus();}
function minimap(){const ctx=$('minimap').getContext('2d');if(!ctx)return;ctx.clearRect(0,0,140,140);ctx.fillStyle='#dae1c9';ctx.fillRect(0,0,140,140);const point=p=>({x:70+p.x*2.2,y:70+p.z*2.2});
  ctx.strokeStyle='#b2bea4';ctx.beginPath();ctx.moveTo(70,6);ctx.lineTo(70,134);ctx.moveTo(6,70);ctx.lineTo(134,70);ctx.stroke();
  for(const [list,color,size] of [[world.towers,'#64816b',4],[world.units,'#769d92',3],[world.enemies,'#c57859',3],[[world.base],'#a6824c',6],[[world.player],'#fdf5d4',4]]){ctx.fillStyle=color;for(const item of list){const p=point(item);ctx.fillRect(p.x-size/2,p.y-size/2,size,size);}}
  const p=point(renderer.camera);ctx.strokeStyle='#526c59';ctx.strokeRect(p.x-15,p.y-12,30,24);
}
function updateHUD(){
  const playing=world.phase==='playing',p=world.player,s=playerStats(world),rec=readFrontierRecord(storage);
  $('intro-best').textContent=String(rec.bestWave).padStart(2,'0');$('resources').textContent=Math.floor(world.resources);$('wave').textContent=String(world.wave).padStart(2,'0');
  $('stage-label').textContent=world.stage==='planning'?`整备 · ${Math.max(0,Math.ceil(world.planning))} 秒`:`剩余 ${world.enemies.length+world.budget+(world.bossPending?1:0)} 个威胁`;
  $('next-wave').hidden=world.stage!=='planning';$('next-wave').disabled=!playing;
  $('base-hp').textContent=`${Math.ceil(world.base.hp)} / ${world.base.maxHp}`;$('base-fill').style.width=`${100*world.base.hp/world.base.maxHp}%`;
  $('player-hp').textContent=p.respawn>0?`重生 ${Math.ceil(p.respawn)}s`:`${Math.ceil(p.hp)} HP`;
  $('level').textContent=`LV ${world.level}`;$('xp-fill').style.width=`${Math.min(100,world.xp/world.xpNext*100)}%`;
  $('score').textContent=String(Math.floor(world.score)).padStart(6,'0');$('army-count').textContent=`${world.units.length}+${world.queue.length} / ${CAPS.units}`;
  $('queue').textContent=world.queue.length?`${UNITS[world.queue[0].kind].name} ${world.queue[0].left.toFixed(1)}s · 队列 ${world.queue.length}`:'生产队列空闲';
  $('cancel-recruit').disabled=!playing||!world.queue.length;
  selected=selected.filter(id=>world.units.some(u=>u.id===id));const tower=world.towers.find(t=>t.id===towerId);if(!tower)towerId=null;
  $('selection-title').textContent=tower?`${TOWERS[tower.kind].name} · LV ${tower.level}`:selected.length?`已选择 ${selected.length} 个单位`:'指挥核心';
  $('selection-detail').textContent=tower?`${Math.ceil(tower.hp)} / ${tower.maxHp} HP · 升级 ${Math.ceil(TOWERS[tower.kind].cost*tower.level*.8)} TK`:'点选 / 框选单位；右键移动。手机选择指令后点地面。';
  $('upgrade-tower').hidden=!tower;$('sell-tower').hidden=!tower;$('upgrade-tower').disabled=!playing||!tower||tower.level>=3||world.resources<Math.ceil(TOWERS[tower.kind].cost*tower.level*.8);
  $('repair-target').textContent=tower?'修复建筑 · 25 TK':'修复基地 · 25 TK';$('repair-target').disabled=!playing||world.resources<25||(tower||world.base).hp>=(tower||world.base).maxHp;
  $('sell-tower').disabled=!playing;$('selection-count').textContent=String(selected.length);
  $('dash-button').disabled=!playing||p.dashCooldown>0||p.respawn>0;$('pulse-button').disabled=!playing||p.pulseCooldown>0||p.respawn>0;
  $('dash-fill').style.transform=`scaleX(${1-p.dashCooldown/s.dashCooldown})`;$('pulse-fill').style.transform=`scaleX(${1-p.pulseCooldown/6})`;
  $('camera-mode').textContent=renderer.camera.follow?'镜头：跟随':'镜头：战术';
  for(const b of document.querySelectorAll('[data-build]')){b.disabled=!playing||world.resources<TOWERS[b.dataset.build].cost||world.towers.length>=CAPS.towers;b.setAttribute('aria-pressed',String(buildKind===b.dataset.build));}
  for(const b of document.querySelectorAll('[data-recruit]'))b.disabled=!playing||world.resources<UNITS[b.dataset.recruit].cost||world.units.length+world.queue.length>=CAPS.units;
  for(const b of document.querySelectorAll('[data-order]'))b.disabled=!playing||(!selected.length&&b.dataset.order!=='rally');
  $('mode-hint').textContent=buildKind?`${TOWERS[buildKind].name} · 点击地面建造 · Esc 取消`:order?`${order==='attack'?'进攻移动':order==='rally'?'设置集结点':'移动'} · 点击目的地 · Esc 取消`:'';
  $('cancel-mode').hidden=!buildKind&&!order;minimap();
}
function requestDraw(){if(!raf&&!document.hidden&&root.dataset.phase!=='error'){last=performance.now();raf=requestAnimationFrame(frame);}}
function frame(now){raf=0;const dt=Math.min(.1,Math.max(0,(now-last)/1000));last=now;
  if(world.phase==='playing'){acc+=dt;while(acc>=STEP){advanceFrontier(world,STEP,movement());acc-=STEP;if(world.phase!=='playing'){acc=0;break;}}}
  for(const e of world.events.splice(0)){tone(e.type);if(e.type==='wave')announce(`第 ${e.wave} 波${e.wave%5===0?' · NULL 核心来袭':''}`);else if(e.type==='clear')announce(`第 ${e.wave} 波已守住。修复、扩建，准备下一波。`);else if(e.type==='boss-down')announce('NULL 已击败。无尽进攻仍会继续。');else if(e.type==='respawn')announce('旗舰损毁，8 秒后重生；基地受到 40 点损伤。');}
  syncPhase();renderer.render(world,dt,now/1000,{selected,towerId,ghost,box});hudClock+=dt;if(hudClock>.1){hudClock=0;updateHUD();}
  if(!document.hidden&&!$('help-dialog').open&&(world.phase==='playing'||(world.phase==='ready'&&!reduced)))raf=requestAnimationFrame(frame);
}
function selectBuild(kind){if(world.phase!=='playing')return;buildKind=kind;order=null;ghost=null;openDrawer('',true);announce('绿色表示可建造。建筑不能重叠；基地附近和防区外不可建。');updateHUD();canvas.focus();}
function setOrder(kind){if(world.phase!=='playing')return;buildKind=null;ghost=null;if(kind==='hold'){commandUnits(world,selected,'hold');order=null;announce('小队原地驻守。');}else{order=kind;openDrawer('',true);announce('点击战场指定目的地。');}updateHUD();}
function localPoint(e){const r=canvas.getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top};}
function nearestScreen(list,p,max){return list.map(t=>({t,d:Math.hypot(renderer.point(t.x,1,t.z).x-p.x,renderer.point(t.x,1,t.z).y-p.y)})).filter(o=>o.d<max).sort((a,b)=>a.d-b.d)[0]?.t;}
function clickWorld(p,shift=false){const q=renderer.ground(p.x,p.y);if(!q||world.phase!=='playing')return;
  if(buildKind){const result=buildTower(world,buildKind,q.x,q.z);if(result.ok){towerId=result.tower.id;selected=[];announce(`已建造${TOWERS[buildKind].name}`);if(world.resources<TOWERS[buildKind].cost)cancelMode();}else announce(result.reason);}
  else if(order){if(order==='rally'){if(!setRally(world,q))announce('集结点必须在防区内。');else announce('集结点已更新。');}else if(!commandUnits(world,selected,order,q))announce('请先选择单位，目的地需在地图内。');order=null;}
  else{const unit=nearestScreen(world.units,p,22),tower=nearestScreen(world.towers,p,26);
    if(unit){towerId=null;selected=shift?[...new Set([...selected,unit.id])]:[unit.id];}
    else if(tower){selected=[];towerId=tower.id;openDrawer('command',true);}
    else {selected=[];towerId=null;}}
  updateHUD();requestDraw();
}
function makeCatalog(){for(const [id,defs,attr] of [['build-options',TOWERS,'build'],['unit-options',UNITS,'recruit']]){
  const host=$(id);for(const [kind,d] of Object.entries(defs)){const b=document.createElement('button');b.type='button';b.dataset[attr]=kind;b.title=d.tip;
    const icon=document.createElement('i'),label=document.createElement('span'),cost=document.createElement('small');icon.className=`glyph glyph-${kind}`;icon.style.setProperty('--glyph',d.color);icon.setAttribute('aria-hidden','true');label.textContent=d.name;cost.textContent=`${d.cost} TK`;b.append(icon,label,cost);host.append(b);}
}}
function fatal(error){cancelAnimationFrame(raf);raf=0;pauseFrontier(world);clearInput();for(const id of ['intro','hud','paused','result'])$(id).hidden=true;if($('upgrade').open)$('upgrade').close();root.dataset.phase='error';$('fallback').hidden=false;$('fallback-reason').textContent=error instanceof Error?error.message:'绘图不可用，仍可浏览作品与联系页面。';}
try{
  // Previous portfolio hashes stay directly reachable; no progression gate.
  if(location.hash&&!['#game','#frontier'].includes(location.hash)){const target=new URL('./archive.html',location.href);target.hash=location.hash;location.replace(target.href);}
  makeCatalog();renderer=new FrontierRenderer(canvas,$('world-labels'),reduced);
  on($('start-button'),'click',start);on($('restart'),'click',start);on($('pause-button'),'click',()=>world.phase==='paused'?resume():pause());on($('resume-button'),'click',resume);
  on($('next-wave'),'click',()=>{launchWave(world);updateHUD();canvas.focus();});
  for(const b of document.querySelectorAll('[data-tab]'))on(b,'click',()=>openDrawer(b.dataset.tab));
  on($('build-options'),'click',e=>{const b=e.target.closest('[data-build]');if(b&&!b.disabled)selectBuild(b.dataset.build);});
  on($('unit-options'),'click',e=>{const b=e.target.closest('[data-recruit]');if(b&&recruit(world,b.dataset.recruit)){announce(`${UNITS[b.dataset.recruit].name}已加入生产队列`);updateHUD();}});
  on($('cancel-recruit'),'click',()=>{cancelRecruit(world);updateHUD();});
  on($('select-all'),'click',()=>{selected=world.units.map(u=>u.id);towerId=null;openDrawer('command',true);updateHUD();});
  for(const b of document.querySelectorAll('[data-order]'))on(b,'click',()=>setOrder(b.dataset.order));
  on($('upgrade-tower'),'click',()=>{upgradeTower(world,towerId);updateHUD();});on($('repair-target'),'click',()=>{repair(world,towerId||'base');updateHUD();});
  on($('sell-tower'),'click',()=>{sellTower(world,towerId);towerId=null;updateHUD();});on($('cancel-mode'),'click',cancelMode);
  on($('choices'),'click',e=>{const b=e.target.closest('[data-upgrade]');if(b)choose(b.dataset.upgrade);});
  on($('reroll'),'click',()=>{if(reroll(world))renderChoices();});on($('upgrade'),'cancel',e=>e.preventDefault());
  on($('dash-button'),'click',()=>{dashFrontier(world,movement());canvas.focus();});on($('pulse-button'),'click',()=>{pulseFrontier(world);canvas.focus();});
  const showHelp=()=>{pause();$('help-dialog').showModal();};on($('help-button'),'click',showHelp);on($('pause-help'),'click',showHelp);on($('close-help'),'click',()=>$('help-dialog').close());on($('help-dialog'),'close',requestDraw);
  on($('camera-mode'),'click',()=>{renderer.camera.follow=!renderer.camera.follow;if(!renderer.camera.follow){renderer.camera.x=renderer.camera.z=0;}updateHUD();requestDraw();});
  on($('pixel-toggle'),'click',()=>{renderer.pixelSize=renderer.pixelSize===2?3:2;$('pixel-toggle').textContent=`PIXELS ×${renderer.pixelSize}`;requestDraw();});
  on($('sound-toggle'),'click',async()=>{try{const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)throw new Error();audio??=new Audio();await audio.resume();sound=!sound;$('sound-toggle').setAttribute('aria-pressed',String(sound));$('sound-toggle').textContent=sound?'音效 ON':'音效 OFF';}catch{sound=false;announce('音频不可用，可无声游玩。');}});
  on(canvas,'contextmenu',e=>e.preventDefault());
  on(canvas,'pointerdown',e=>{if(world.phase!=='playing'||pointer)return;canvas.focus();const p=localPoint(e);pointer={id:e.pointerId,start:p,last:p,button:e.button,shift:e.shiftKey,touch:e.pointerType==='touch'};canvas.setPointerCapture(e.pointerId);});
  on(canvas,'pointermove',e=>{const p=localPoint(e),q=renderer.ground(p.x,p.y);
    if(buildKind&&q){const x=Math.round(q.x),z=Math.round(q.z);ghost={kind:buildKind,x,z,valid:!buildCheck(world,buildKind,x,z)};}
    if(!pointer||pointer.id!==e.pointerId)return;const dx=p.x-pointer.last.x,dy=p.y-pointer.last.y;
    if(pointer.button===1||keys.has('KeyQ'))renderer.pan(dx,dy);
    else if(pointer.button===0&&!buildKind&&!order&&Math.hypot(p.x-pointer.start.x,p.y-pointer.start.y)>7)box={x:Math.min(p.x,pointer.start.x),y:Math.min(p.y,pointer.start.y),w:Math.abs(p.x-pointer.start.x),h:Math.abs(p.y-pointer.start.y)};
    pointer.last=p;requestDraw();
  });
  on(canvas,'pointerup',e=>{if(!pointer||pointer.id!==e.pointerId)return;const state=pointer,p=localPoint(e),moved=Math.hypot(p.x-state.start.x,p.y-state.start.y)>7;pointer=null;
    if(state.button===2){const q=renderer.ground(p.x,p.y);if(q){commandUnits(world,selected,'move',q);announce(selected.length?'小队移动中。':'先点选、框选单位，或按 F 全选。');}}
    else if(box){const ids=world.units.filter(u=>{const p=renderer.point(u.x,1,u.z);return p.x>=box.x&&p.x<=box.x+box.w&&p.y>=box.y&&p.y<=box.y+box.h;}).map(u=>u.id);selected=state.shift?[...new Set([...selected,...ids])]:ids;towerId=null;}
    else if(!moved&&state.button===0)clickWorld(p,state.shift);
    box=null;updateHUD();requestDraw();
  });
  for(const type of ['pointercancel','lostpointercapture'])on(canvas,type,e=>{if(pointer?.id===e.pointerId){pointer=null;box=null;requestDraw();}});
  on(canvas,'wheel',e=>{if(e.ctrlKey||e.metaKey)return;e.preventDefault();renderer.camera.zoom=Math.max(.6,Math.min(1.5,renderer.camera.zoom*Math.exp(Math.max(-200,Math.min(200,e.deltaY))*.001)));requestDraw();},{passive:false});
  on(window,'keydown',e=>{
    if($('help-dialog').open)return;
    if(world.phase==='upgrade'){if(['Digit1','Digit2','Digit3'].includes(e.code)){e.preventDefault();choose(world.choices[Number(e.code.at(-1))-1]);}return;}
    if(e.code==='Escape'){if(buildKind||order)cancelMode();else if(world.phase==='paused')resume();else pause();return;}
    if(world.phase!=='playing'||e.target.closest?.('button,a,input,textarea,select'))return;
    const handled=['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowLeft','ArrowDown','ArrowRight','Space','KeyE','KeyF','KeyH','KeyQ','KeyT','KeyG','Digit1','Digit2','Digit3','Digit4','Digit5'];if(!handled.includes(e.code))return;
    e.preventDefault();keys.add(e.code);if(e.repeat)return;
    if(e.code==='Space')dashFrontier(world,movement());else if(e.code==='KeyE')pulseFrontier(world);
    else if(e.code==='KeyF'){selected=world.units.map(u=>u.id);towerId=null;updateHUD();}
    else if(e.code==='KeyH')setOrder('hold');else if(e.code==='KeyT')setOrder('attack');else if(e.code==='KeyG')setOrder('move');
    else if(e.code.startsWith('Digit'))selectBuild(Object.keys(TOWERS)[Number(e.code.at(-1))-1]);
  });
  on(window,'keyup',e=>keys.delete(e.code));
  const joystick=$('joystick'),moveStick=e=>{if(e.pointerId!==stick.id)return;const r=joystick.getBoundingClientRect();let x=e.clientX-r.left-r.width/2,z=e.clientY-r.top-r.height/2;const radius=r.width*.32,n=Math.hypot(x,z);if(n>radius){x=x/n*radius;z=z/n*radius;}stick.x=x/radius;stick.z=z/radius;$('joystick-knob').style.transform=`translate(${x}px,${z}px)`;};
  on(joystick,'pointerdown',e=>{if(world.phase!=='playing'||stick.id!==null)return;e.preventDefault();stick.id=e.pointerId;joystick.setPointerCapture(e.pointerId);moveStick(e);});on(joystick,'pointermove',moveStick);
  for(const name of ['pointerup','pointercancel','lostpointercapture'])on(joystick,name,e=>{if(e.pointerId===stick.id){stick.id=null;stick.x=stick.z=0;$('joystick-knob').style.transform='translate(0,0)';}});
  on($('minimap'),'pointerdown',e=>{const r=$('minimap').getBoundingClientRect();renderer.camera.follow=false;renderer.camera.x=Math.max(-20,Math.min(20,((e.clientX-r.left)/r.width*140-70)/2.2));renderer.camera.z=Math.max(-20,Math.min(20,((e.clientY-r.top)/r.height*140-70)/2.2));requestDraw();});
  on(window,'blur',()=>{clearInput();pause();});on(document,'visibilitychange',()=>{if(document.hidden){pause();cancelAnimationFrame(raf);raf=0;}else requestDraw();});on(window,'resize',requestDraw);
  on(canvas,'webglcontextlost',e=>{e.preventDefault();fatal(new Error('图形上下文已丢失。可重新加载，或浏览基地档案。'));});
  on(window,'pagehide',e=>{cancelAnimationFrame(raf);raf=0;pause();if(!e.persisted){controller.abort();renderer.destroy();audio?.close().catch(()=>{});}});on(window,'pageshow',e=>{if(e.persisted)requestDraw();});
  on($('reload-button'),'click',()=>location.reload());
  // Test hooks are unavailable on the deployed origin.
  if(['localhost','127.0.0.1'].includes(location.hostname)&&new URLSearchParams(location.search).has('test'))window.__frontier={get world(){return world;},get renderer(){return renderer;},step(n=1){for(let i=0;i<n;i++)advanceFrontier(world,STEP);syncPhase();updateHUD();requestDraw();},get selected(){return selected;},update(){syncPhase();updateHUD();requestDraw();}};
  syncPhase();updateHUD();requestDraw();
}catch(error){fatal(error);on($('reload-button'),'click',()=>location.reload());}
