import { ISLANDS, WORLD_LIMIT, createWorld, startWorld, pauseWorld, resumeWorld,
  advance, dash, pulse, objective, readRecord, saveRecord } from './world.mjs';
import { VoxelRenderer } from './renderer.mjs';

const $ = (id) => document.getElementById(id);
// Preserve existing deep links into the unchanged portfolio and cryptographic challenge.
if(location.hash && location.hash !== '#game') {
  const archive = new URL('./archive.html', location.href);
  archive.hash = location.hash; archive.search = location.search;
  location.replace(archive.href);
}
const root = $('token-drift');
const canvas = $('voxel-world');
const events = new AbortController();
const on = (target, event, fn, options = {}) => target.addEventListener(event, fn, { ...options, signal: events.signal });
let world = createWorld();
let storage;
try { storage = localStorage; } catch { /* Storage is optional. */ }
let record = readRecord(storage);
let renderer, raf = 0, last = performance.now(), accumulator = 0, hudClock = 0, endSaved = false;
let announcedUntil = 0, displayedPhase = '';
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const keys = new Set();
const stick = { x: 0, y: 0, pointer: null };
const FIXED_STEP = 1 / 60;

class ChipSound {
  constructor() { this.enabled = false; this.context = null; this.lastPickup = 0; }
  async toggle() {
    try {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) throw new Error('浏览器不支持音频');
      if (!this.context) this.context = new Audio();
      this.enabled = !this.enabled;
      if (this.enabled) await this.context.resume();
      $('sound-toggle').setAttribute('aria-pressed', String(this.enabled));
      $('sound-toggle').querySelector('span').textContent = this.enabled ? 'ON' : 'OFF';
      if (this.enabled) this.tone(523, .1);
    } catch { this.enabled = false; announce('音频暂不可用，仍可无声游玩。'); }
  }
  tone(frequency, duration = .08, wave = 'square', delay = 0) {
    if (!this.enabled || !this.context || this.context.state !== 'running') return;
    const ctx = this.context, start = ctx.currentTime + delay;
    const oscillator = ctx.createOscillator(), gain = ctx.createGain();
    oscillator.type = wave; oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(0, start);gain.gain.linearRampToValueAtTime(.025, start + .008);
    gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
    oscillator.connect(gain);gain.connect(ctx.destination);oscillator.start(start);oscillator.stop(start + duration + .02);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  }
  play(type, value) {
    if (type === 'token') {
      if (performance.now() - this.lastPickup < 45) return;
      this.lastPickup = performance.now();this.tone(392 * 2 ** (Math.min(7, value - 1) / 12), .075);
    } else if (type === 'dash') { this.tone(130, .13, 'sawtooth'); this.tone(260, .08, 'triangle', .04); }
    else if (type === 'pulse') { [196, 293, 392].forEach((f,i) => this.tone(f,.2,'triangle',i*.035)); }
    else if (type === 'break') this.tone(98,.11,'sawtooth');
    else if (type === 'hit' || type === 'lost') this.tone(65,.24,'sawtooth');
    else if (type === 'beacon' || type === 'won') [523,659,784,1047].forEach((f,i) => this.tone(f,.17,'square',i*.09));
  }
}
const sound = new ChipSound();

function pixelTitle() {
  const font = {
    T:['11111','00100','00100','00100','00100','00100','00100'],
    O:['01110','11011','11011','11011','11011','11011','01110'],
    K:['11001','11011','11110','11100','11110','11011','11001'],
    E:['11111','11000','11000','11110','11000','11000','11111'],
    N:['11001','11101','11101','11011','11011','11001','11001'],
    D:['11110','11011','11011','11011','11011','11011','11110'],
    R:['11110','11011','11011','11110','11100','11010','11001'],
    I:['11111','00100','00100','00100','00100','00100','11111'],
    F:['11111','11000','11000','11110','11000','11000','11000'],
  };
  const container = $('pixel-title');container.replaceChildren();
  for (const word of ['TOKEN','DRIFT']) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
    svg.setAttribute('viewBox',`0 0 ${word.length*6-1} 7`);svg.setAttribute('fill','currentColor');
    svg.setAttribute('shape-rendering','crispEdges');
    for (const [letterIndex,letter] of [...word].entries()) for(const [y,row] of font[letter].entries())
      for(const [x,bit] of [...row].entries()) if(bit==='1') {
        const rect=document.createElementNS(svg.namespaceURI,'rect');
        rect.setAttribute('x',String(letterIndex*6+x));rect.setAttribute('y',String(y));
        rect.setAttribute('width','1');rect.setAttribute('height','1');svg.append(rect);
      }
    container.append(svg);
  }
}
function announce(message, duration = 3) {
  $('announcement').textContent = message;
  $('announcement').classList.add('visible');announcedUntil = performance.now() + duration * 1000;
}
function movement() {
  let x = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0) + stick.x;
  let y = (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) - (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) + stick.y;
  const len = Math.hypot(x,y);if(len>1) {x/=len;y/=len;}
  // Controls are aligned with the isometric camera, not the world axes.
  return { x: x*.789352 + y*.613941, z: -x*.613941 + y*.789352 };
}
function clearInput() {
  keys.clear();stick.x=0;stick.y=0;stick.pointer=null;
  $('joystick-knob').style.transform='translate(0, 0)';
}
function syncPhase() {
  const phase=world.phase;if(phase===displayedPhase)return;displayedPhase=phase;root.dataset.phase=phase;
  $('intro').hidden=phase!=='ready';
  $('hud').hidden=phase==='ready';
  $('pause-button').hidden=phase!=='playing'&&phase!=='paused';
  $('pause-button').textContent=phase==='paused'?'继续':'暂停';
  $('pause-panel').hidden=phase!=='paused';
  $('result').hidden=phase!=='won'&&phase!=='lost';
  if((phase==='won'||phase==='lost')&&!endSaved) {
    endSaved=true;record=saveRecord(storage,record,world);clearInput();
    const won=phase==='won';
    $('result-kicker').textContent=won?'SIGNAL RESTORED / 03 OF 03':'SIGNAL LOST / TRY ANOTHER ROUTE';
    $('result-title').textContent=won?'欢迎回家。':'再出发一次吧。';
    $('result-copy').textContent=won?'三座岛重新连在了一起。散落的 token，终于有了去处。':'护盾耗尽了。试试用冲刺穿过红色噪声，或用引力脉冲为自己开路。';
    const stats=$('result-stats');stats.replaceChildren();
    for(const [name,value] of [['SCORE',world.score],['BEST FLOW',`×${world.maxCombo}`],['TIME',`${Math.floor(world.time/60)}:${String(Math.floor(world.time%60)).padStart(2,'0')}`]]) {
      const label=document.createElement('span'),number=document.createElement('b');
      label.textContent=name;number.textContent=String(value);label.append(number);stats.append(label);
    }
    $('restart-button').focus();
  }
}
function start() {
  startWorld(world);syncPhase();clearInput();accumulator=0;
  requestDraw();canvas.focus({preventScroll:true});announce('跟随金色 token。收集后，靠近岛中心的信标。',4);
}
function pauseGame() {
  if(world.phase!=='playing')return;
  pauseWorld(world);clearInput();accumulator=0;syncPhase();$('resume-button').focus();
}
function resumeGame() {
  if(world.phase!=='paused')return;
  resumeWorld(world);clearInput();accumulator=0;last=performance.now();syncPhase();requestDraw();canvas.focus({preventScroll:true});
}
function restart() {
  world=createWorld();endSaved=false;renderer.particles=[];renderer.trails=[];start();updateHUD();
}
function drawMinimap() {
  const ctx=$('minimap').getContext('2d'),s=160;
  if(!ctx)return;
  ctx.clearRect(0,0,s,s);ctx.fillStyle='#e6ebdc';ctx.fillRect(0,0,s,s);
  const point=(p)=>({x:s/2+p.x/(WORLD_LIMIT*2)*s,y:s/2+p.z/(WORLD_LIMIT*2)*s});
  ctx.strokeStyle='#35483f18';ctx.lineWidth=1;
  for(let i=16;i<s;i+=16){ctx.beginPath();ctx.moveTo(i,0);ctx.lineTo(i,s);ctx.stroke();ctx.beginPath();ctx.moveTo(0,i);ctx.lineTo(s,i);ctx.stroke();}
  const goal=point(objective(world)),p=point(world.player);
  ctx.setLineDash([2,4]);ctx.strokeStyle='#cf714b';ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(goal.x,goal.y);ctx.stroke();ctx.setLineDash([]);
  ISLANDS.forEach((island,i)=>{const q=point(island);ctx.fillStyle='#b8c5a4';ctx.fillRect(q.x-9,q.y-8,18,16);
    ctx.fillStyle=i&&world.beacons[i-1].active?'#cf714b':'#647861';ctx.save();ctx.translate(q.x,q.y);ctx.rotate(Math.PI/4);ctx.fillRect(-3,-3,6,6);ctx.restore();});
  ctx.fillStyle='#fff9e8';ctx.fillRect(p.x-3,p.y-3,6,6);ctx.strokeStyle='#35483f';ctx.strokeRect(p.x-3,p.y-3,6,6);
}
function updateHUD() {
  const target=objective(world),p=world.player;
  $('intro-best').textContent=String(record.best).padStart(6,'0');
  $('beacon-count').textContent=`${world.beacons.filter(b=>b.active).length} / 3`;
  $('objective-name').textContent=target.label;
  $('objective-detail').textContent=target.cost===0?'全部点亮了！返回归航港完成旅程':target.remaining?`还差 ${target.remaining} TK · 靠近信标自动充能`:'能量够了！靠近这个信标自动充能';
  $('mission-fill').style.width=`${target.cost?Math.min(100,world.inventory/target.cost*100):100}%`;
  $('token-count').textContent=String(world.inventory).padStart(2,'0');$('score').textContent=String(world.score).padStart(6,'0');
  $('shield').textContent='◆'.repeat(p.hp)+'◇'.repeat(3-p.hp);$('shield').setAttribute('aria-label',`${p.hp} 格护盾`);
  $('combo').hidden=world.combo<2;$('combo-number').textContent=`×${world.combo}`;
  $('combo-fill').style.transform=`scaleX(${world.comboTime/3})`;
  $('dash-fill').style.transform=`scaleX(${1-p.dashCooldown/1.3})`;
  $('pulse-fill').style.transform=`scaleX(${1-p.pulseCooldown/5.5})`;
  $('dash-button').disabled=p.dashCooldown>0||world.phase!=='playing';
  $('pulse-button').disabled=p.pulseCooldown>0||world.phase!=='playing';
  drawMinimap();
}
function consumeEvents() {
  for(const e of world.events.splice(0)) {
    sound.play(e.type,e.value);
    if(e.type==='token')renderer.burst(e.x,e.z,'#f1c679',5);
    else if(e.type==='break')renderer.burst(e.x,e.z,'#cd7a66',18);
    else if(e.type==='beacon') {
      renderer.burst(e.x,e.z,'#e2b878',50);
      announce(e.value===3?'三座信标已点亮。返回归航港！':`信标已点亮 ${e.value} / 3 · 护盾恢复一格`,4);
    } else if(e.type==='hit') {renderer.burst(e.x,e.z,'#dc825a',16);announce('护盾受损！空格冲刺 / E 引力脉冲可以击散噪声。',2.5);}
    else if(e.type==='won')renderer.burst(e.x,e.z,'#e5b05f',100);
  }
}
function requestDraw() {
  if(!raf&&!document.hidden&&root.dataset.phase!=='error'){last=performance.now();raf=requestAnimationFrame(frame);}
}
function frame(now) {
  raf=0;
  const dt=Math.min(.1,Math.max(0,(now-last)/1000));last=now;
  if(world.phase==='playing') {
    accumulator+=dt;
    while(accumulator>=FIXED_STEP) {advance(world,FIXED_STEP,movement());accumulator-=FIXED_STEP;}
    consumeEvents();syncPhase();
  }
  renderer.render(world,dt,now/1000);
  hudClock+=dt;if(hudClock>.08){hudClock=0;updateHUD();}
  if(announcedUntil&&now>announcedUntil){$('announcement').classList.remove('visible');announcedUntil=0;}
  if(!document.hidden&&!$('help-dialog').open&&(world.phase==='playing'||(world.phase==='ready'&&!reducedMotion)))
    raf=requestAnimationFrame(frame);
}
function showHelp() {
  if(world.phase==='playing')pauseGame();
  $('help-dialog').showModal();$('close-help').focus();
}
function fatal(message) {
  cancelAnimationFrame(raf);raf=0;pauseWorld(world);clearInput();
  for(const id of ['intro','hud','result','pause-panel','pause-button'])$(id).hidden=true;
  root.dataset.phase='error';$('fallback').hidden=false;$('fallback-reason').textContent=message;
}

try {
  pixelTitle();updateHUD();
  renderer=new VoxelRenderer(canvas,$('world-labels'),reducedMotion);
  on($('start-button'),'click',start);on($('restart-button'),'click',restart);
  on($('resume-button'),'click',resumeGame);
  on($('pause-button'),'click',()=>world.phase==='paused'?resumeGame():pauseGame());
  on($('sound-toggle'),'click',()=>{sound.toggle();if(world.phase==='playing')canvas.focus({preventScroll:true});});
  on($('help-button'),'click',showHelp);on($('pause-help'),'click',showHelp);
  on($('close-help'),'click',()=>$('help-dialog').close());on($('help-done'),'click',()=>$('help-dialog').close());
  on($('help-dialog'),'close',requestDraw);
  on($('help-dialog'),'click',(e)=>{if(e.target===$('help-dialog')){const r=$('help-dialog').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$('help-dialog').close();}});
  on($('dash-button'),'click',()=>{dash(world,movement());canvas.focus({preventScroll:true});consumeEvents();});
  on($('pulse-button'),'click',()=>{pulse(world);canvas.focus({preventScroll:true});consumeEvents();});
  on($('pixel-toggle'),'click',()=>{renderer.pixelSize=renderer.pixelSize===2?3:2;$('pixel-toggle').querySelector('span').textContent=`×${renderer.pixelSize}`;requestDraw();if(world.phase==='playing')canvas.focus({preventScroll:true});});
  on(window,'keydown',(e)=>{
    if($('help-dialog').open)return;
    if(e.code==='Escape') {if(world.phase==='playing')pauseGame();else if(world.phase==='paused')resumeGame();return;}
    if(world.phase!=='playing'||e.target.closest?.('button,a,input,textarea,select'))return;
    if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowLeft','ArrowDown','ArrowRight','Space','KeyE'].includes(e.code)) {
      e.preventDefault();keys.add(e.code);
      if(!e.repeat&&e.code==='Space')dash(world,movement());
      if(!e.repeat&&e.code==='KeyE')pulse(world);
      consumeEvents();
    }
  });
  on(window,'keyup',(e)=>keys.delete(e.code));
  on(canvas,'pointerdown',()=>canvas.focus({preventScroll:true}));
  const joystick=$('joystick');
  function moveStick(e) {
    if(e.pointerId!==stick.pointer)return;
    const r=joystick.getBoundingClientRect();let x=e.clientX-r.left-r.width/2,y=e.clientY-r.top-r.height/2;
    const radius=37,len=Math.hypot(x,y);if(len>radius){x=x/len*radius;y=y/len*radius;}
    stick.x=Math.abs(x)<3?0:x/radius;stick.y=Math.abs(y)<3?0:y/radius;
    $('joystick-knob').style.transform=`translate(${x}px, ${y}px)`;
  }
  on(joystick,'pointerdown',(e)=>{
    if(world.phase!=='playing'||stick.pointer!==null)return;e.preventDefault();
    stick.pointer=e.pointerId;joystick.setPointerCapture(e.pointerId);moveStick(e);
  });
  on(joystick,'pointermove',moveStick);
  for(const event of ['pointerup','pointercancel','lostpointercapture'])on(joystick,event,(e)=>{if(e.pointerId===stick.pointer)clearInput();});
  on(window,'blur',()=>{clearInput();pauseGame();});
  on(document,'visibilitychange',()=>{if(document.hidden){pauseGame();clearInput();cancelAnimationFrame(raf);raf=0;}else requestDraw();});
  on(window,'resize',requestDraw);
  on(canvas,'webglcontextlost',(e)=>{e.preventDefault();fatal('3D 图形上下文已丢失。重新加载可重新启航；也可以直接浏览原网站。');});
  on(window,'pagehide',(e)=>{cancelAnimationFrame(raf);raf=0;pauseGame();if(!e.persisted){events.abort();renderer.destroy();sound.context?.close().catch(()=>{});}});
  on(window,'pageshow',(e)=>{if(e.persisted){requestDraw();}});
  on($('reload-button'),'click',()=>location.reload());
  // Test-only inspection is unavailable on the deployed public origin.
  if(['localhost','127.0.0.1'].includes(location.hostname)&&new URLSearchParams(location.search).has('test'))
    window.__tokenDrift={get state(){return world;},get renderer(){return renderer;},step(seconds){for(let i=0;i<seconds/FIXED_STEP;i++)advance(world,FIXED_STEP);consumeEvents();syncPhase();updateHUD();}};
  requestDraw();
} catch(error) {
  fatal(error instanceof Error?error.message:'场景初始化失败，请重新加载。');
  on($('reload-button'),'click',()=>location.reload());
}
