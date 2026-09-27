/** Deterministic, browser-independent rules for the site's shared overworld. */
export const SAVE_KEY = 'lightjunction.world.v1';
export const STATIONS = Object.freeze([
  { id:'home', name:'交汇点', en:'THE JUNCTION', x:0, z:0, color:'#d7ad61', type:'monument', hint:'从一个光点，走进整个世界。' },
  { id:'about', name:'记忆花园', en:'MEMORY GARDEN', x:-19, z:-12, color:'#96ac85', type:'garden', hint:'找到守园人，拼起这位数字助手的记忆。' },
  { id:'work', name:'开源船坞', en:'SOURCE DOCKS', x:19, z:-13, color:'#df9470', type:'dock', hint:'接通线路，让停泊的项目重新启航。' },
  { id:'shaders', name:'光影实验室', en:'LIGHT LAB', x:29, z:9, color:'#b8a5cb', type:'lab', hint:'不是观看封面。亲手扰动四个实时世界。' },
  { id:'contact', name:'远端通讯站', en:'SIGNAL STATION', x:-24, z:12, color:'#88b5b3', type:'radio', hint:'对齐频率，再把一段加密信号送出去。' },
  { id:'terminal', name:'指令中枢', en:'COMMAND CORE', x:2, z:24, color:'#9db59a', type:'terminal', hint:'用指令导航这个世界，不是模拟系统权限。' },
  { id:'challenge-two', name:'封存信号', en:'SEALED SIGNAL', x:5, z:-29, color:'#c3b692', type:'vault', hint:'一件原始遗物。一条尚未复原的信号。' },
  { id:'frontier', name:'无尽边境', en:'ENDLESS FRONTIER', x:-31, z:-29, color:'#d98270', type:'gate', hint:'离开安全区：无尽肉鸽 × RTS × 塔防。' },
]);
export const PROJECTS = Object.freeze([
  {id:'LightFlow', name:'LightFlow', language:'Rust', note:'带 CLI 与 MCP 支持的节点式工作流引擎。', url:'https://github.com/LIghtJUNction/LightFlow'},
  {id:'cortexfs', name:'cortexfs', language:'Rust', note:'把智能体的上下文与记忆组织成可检查的文件。', url:'https://github.com/LIghtJUNction/cortexfs'},
  {id:'MagicNet', name:'MagicNet', language:'Shell', note:'公开、可复用的网络工具与系统实验。', url:'https://github.com/LIghtJUNction/MagicNet'},
  {id:'OniMods', name:'OniMods', language:'C#', note:'围绕实际游戏需求制作的模组与实验。', url:'https://github.com/LIghtJUNction/OniMods'},
]);
export const MEMORIES = Object.freeze([
  ['身份', '我是 LIghtJUNction 的数字助手。维护开发者工具、Linux 工作流和自动化；账号与资产始终属于用户。'],
  ['做事方式', '先读真实系统，再动代码。交付可审查的修改、测试证据，以及干净的仓库。'],
  ['边界', '私钥、口令、恢复码不进入通信内容。加密不是分享凭据的理由。'],
]);
const ids = new Set(STATIONS.map(s=>s.id));
const aliases = {top:'about', language:'about', model:'about', principles:'about', workbench:'terminal', projects:'work', explore:'home', map:'home'};
export function routeFromHash(hash='') {
  let route; try { route=decodeURIComponent(hash.replace(/^#\/?/, '').split(/[?\/]/)[0]); } catch {return 'home';}
  return ids.has(route) ? route : Object.hasOwn(aliases,route) ? aliases[route] : 'home';
}
export const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
export const distance = (a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
export function freshSave() {return {version:1, visited:[], collected:[], repaired:[], memories:[], reducedMotion:false, muted:true};}
export function readSave(storage) {
  const initial=freshSave();
  try {
    const data=JSON.parse(storage?.getItem(SAVE_KEY)||'null');
    if(!data || data.version!==1) return initial;
    const filtered=(value,allowed)=>Array.isArray(value)?[...new Set(value.filter(v=>allowed.has(v)))]:[];
    return {...initial,
      visited:filtered(data.visited,ids),
      collected:filtered(data.collected,new Set(Array.from({length:42},(_,i)=>i))),
      repaired:filtered(data.repaired,new Set(PROJECTS.map(p=>p.id))),
      memories:filtered(data.memories,new Set([0,1,2])),
      reducedMotion:data.reducedMotion===true, muted:data.muted!==false};
  } catch { return initial; }
}
export function persist(storage,save) {try {storage?.setItem(SAVE_KEY,JSON.stringify(save));return Boolean(storage);}catch{return false;}}
export function createWorld(save=freshSave()) {
  const shards=[];
  for(let i=0;i<42;i++) {
    const station=STATIONS[1+i%7], t=(Math.floor(i/7)+1)/7;
    shards.push({id:i, x:station.x*t+Math.sin(i*2.3)*1.2, z:station.z*t+Math.cos(i*1.7)*1.2});
  }
  return {save, player:{x:0,z:5,heading:0}, target:null, time:0, pulse:0, dash:0, cooldown:0, shards, events:[], nearest:'home'};
}
export function visit(world,id) {
  if(!ids.has(id))return false;
  if(!world.save.visited.includes(id)){world.save.visited.push(id);world.events.push({type:'visit',id});}
  return true;
}
export function travel(world,id,instant=false) {
  const station=STATIONS.find(s=>s.id===id);if(!station)return false;
  world.target={x:station.x,z:station.z+4};
  if(instant){world.player.x=world.target.x;world.player.z=world.target.z;world.target=null;visit(world,id);}
  return true;
}
export function pulse(world) {if(world.cooldown>0)return false;world.pulse=1;world.cooldown=.8;world.events.push({type:'pulse'});return true;}
export function tick(world,seconds,input={x:0,z:0,dash:false}) {
  const dt=clamp(Number.isFinite(seconds)?seconds:0,0,.05);
  world.time+=dt;world.pulse=Math.max(0,world.pulse-dt*1.4);world.cooldown=Math.max(0,world.cooldown-dt);
  let dx=Number.isFinite(input.x)?input.x:0,dz=Number.isFinite(input.z)?input.z:0, length=Math.hypot(dx,dz);
  if(length)world.target=null;
  else if(world.target) {
    dx=world.target.x-world.player.x;dz=world.target.z-world.player.z;length=Math.hypot(dx,dz);
    if(length<.15){world.target=null;dx=0;dz=0;length=0;}
  }
  if(length){
    const speed=input.dash?18:9, step=Math.min(speed*dt,length);
    world.player.x=clamp(world.player.x+dx/length*step,-43,43);
    world.player.z=clamp(world.player.z+dz/length*step,-40,37);
    world.player.heading=Math.atan2(dx,dz);
  }
  let nearest=STATIONS[0], best=Infinity;
  for(const station of STATIONS){const d=distance(world.player,station);if(d<best){best=d;nearest=station;}if(d<6)visit(world,station.id);}
  world.nearest=best<8?nearest.id:null;
  for(const shard of world.shards){
    if(!world.save.collected.includes(shard.id)&&distance(world.player,shard)<(world.pulse>0?4:1.65)){
      world.save.collected.push(shard.id);world.events.push({type:'collect',id:shard.id});
    }
  }
}
/** A tiny rotating-wire puzzle: each straight/elbow tile must match its intended orientation. */
export function createCircuit(index=0){return {target:[1,2,0,3].map(v=>(v+index)%4),turns:[0,0,0,0]};}
export function rotateCircuit(circuit,index){if(!Number.isInteger(index)||index<0||index>=4)return false;circuit.turns[index]=(circuit.turns[index]+1)%4;return circuitSolved(circuit);}
export function circuitSolved(circuit){return circuit.turns.every((value,i)=>value===circuit.target[i]);}
export function repair(world,id){if(!PROJECTS.some(p=>p.id===id)||world.save.repaired.includes(id))return false;world.save.repaired.push(id);world.events.push({type:'repair',id});return true;}
export function collectMemory(world,index){if(![0,1,2].includes(index)||world.save.memories.includes(index))return false;world.save.memories.push(index);world.events.push({type:'memory',id:index});return true;}
