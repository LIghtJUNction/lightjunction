/** Endless siege simulation. No DOM, wall clock, network, or rendering side effects. */
export const LIMIT = 28;
export const CAPS = Object.freeze({ enemies: 100, bullets: 260, drops: 160, effects: 100, towers: 20, units: 24 });
export const RIFTS = Object.freeze([{ x: 0, z: -27 }, { x: 27, z: 0 }, { x: 0, z: 27 }, { x: -27, z: 0 }]);
export const ENEMIES = Object.freeze({
  crawler: { name: '噪声虫', hp: 24, speed: 2, damage: 8, radius: .55, color: '#cf785b' },
  skitter: { name: '闪烁蜂', hp: 15, speed: 3.5, damage: 6, radius: .4, color: '#dfa251' },
  tank: { name: '防火墙', hp: 100, speed: .9, damage: 18, radius: 1, color: '#908298' },
  gunner: { name: '注入者', hp: 36, speed: 1.5, damage: 10, radius: .65, color: '#759b91' },
  charger: { name: '断路者', hp: 48, speed: 1.8, damage: 17, radius: .7, color: '#cf674a' },
  splitter: { name: '裂变体', hp: 55, speed: 1.3, damage: 10, radius: .75, color: '#baa15a' },
  sapper: { name: '蚀矿者', hp: 44, speed: 2.3, damage: 20, radius: .6, color: '#9fa668' },
  boss: { name: 'NULL 核心', hp: 650, speed: .65, damage: 28, radius: 1.8, color: '#b67888' },
});
export const TOWERS = Object.freeze({
  bolt: { name: '脉冲炮塔', cost: 65, hp: 200, range: 10, damage: 22, interval: .75, color: '#527d72', tip: '快速单体攻击，适合守住入口。' },
  frost: { name: '冷却节点', cost: 80, hp: 170, range: 8, damage: 7, interval: 1, color: '#81a9ba', tip: '命中后减速 55%，持续 2 秒。' },
  mortar: { name: '爆裂阵列', cost: 110, hp: 160, range: 14, damage: 48, interval: 2.6, color: '#c59158', tip: '范围轰击，对密集敌群有效。' },
  relay: { name: '修复中继', cost: 95, hp: 180, range: 8, damage: 10, interval: 1, color: '#93a26c', tip: '每秒修复范围内的基地、塔和小队。' },
  mine: { name: 'Token 矿机', cost: 90, hp: 130, range: 0, damage: 0, interval: 1, color: '#cfaf67', tip: '每秒产出 3 TK；蚀矿者会优先攻击。' },
});
export const UNITS = Object.freeze({
  scout: { name: '游骑兵', cost: 45, hp: 85, speed: 4.3, range: 8, damage: 12, interval: .65, color: '#779b8a', tip: '快速移动与自动射击。' },
  siege: { name: '攻城机', cost: 85, hp: 130, speed: 2.3, range: 12, damage: 35, interval: 2, color: '#c69765', tip: '远程范围火力，适合守点。' },
  medic: { name: '修补蜂', cost: 65, hp: 65, speed: 3.6, range: 6, damage: 9, interval: .8, color: '#b1b882', tip: '修复附近友军、建筑和基地。' },
});
export const UPGRADES = Object.freeze([
  ['damage','超频核心','伤害提高 25%',5], ['rate','并行时钟','射击间隔缩短 16%',5],
  ['multishot','分叉编译','主炮多发一枚散射弹',3], ['pierce','穿透协议','主炮多穿透一个敌人',3],
  ['crit','幸运指针','暴击率提高 10%',4], ['orbit','环刃阵列','增加一枚自动环刃',4],
  ['chain','链式闪电','自动连锁攻击更多敌人',4], ['bomb','爆裂缓存','定时范围轰炸',3],
  ['leech','回收协议','击败敌人回复生命',3], ['armor','冗余装甲','旗舰减伤增加 12%',4],
  ['regen','热修复','旗舰每秒回复生命',3], ['hull','扩容舱','生命上限增加 25',4],
  ['speed','轻量引擎','移动速度提高 12%',3], ['magnet','引力索引','吸取范围增加 2',3],
  ['dash','相位穿梭','冲刺冷却缩短 18%',3], ['industry','自动工厂','基础 TK 收入增加 1 / 秒',4],
  ['engineering','协同火控','炮塔和小队伤害提高 15%',4], ['logistics','战地补给','每波恢复基地 35 点生命',4],
].map(([id,name,tip,max])=>Object.freeze({id,name,tip,max})));
const clamp = (n,a,b)=>Math.max(a,Math.min(b,n));
const distance = (a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const finitePoint = p=>p && Number.isFinite(p.x) && Number.isFinite(p.z);
const validNumber = n=>Number.isFinite(n) && n>0;
function random(w) { w.rng=(Math.imul(w.rng,1664525)+1013904223)>>>0; return w.rng/4294967296; }
function event(w,type,data={}) { if(w.events.length<100)w.events.push({type,...data}); }
function effect(w,kind,x,z,radius=1,color='#edc775',end=null) {
  if(w.effects.length<CAPS.effects)w.effects.push({kind,x,z,radius,color,end,life:.32});
}
export function createFrontier(seed=271828) {
  return {seed:seed>>>0,rng:seed>>>0,id:0,phase:'ready',stage:'planning',time:0,wave:0,planning:12,
    budget:0,spawnClock:0,bossPending:false,bosses:0,resources:220,earned:0,score:0,kills:0,
    base:{id:'base',x:0,z:0,hp:800,maxHp:800,radius:2.2},
    player:{id:'player',x:0,z:5,vx:0,vz:0,hp:100,maxHp:100,radius:.7,facing:Math.PI,invulnerable:0,dash:0,dashCooldown:0,pulseCooldown:0,haste:0,respawn:0},
    towers:[],units:[],queue:[],enemies:[],bullets:[],drops:[],effects:[],events:[],
    rally:{x:0,z:7},upgrades:{},level:1,xp:0,xpNext:30,choices:[],rerolls:2,
    fireClock:0,orbitClock:0,chainClock:0,bombClock:0,pulse:0,lossReason:''};
}
export function startFrontier(w) { if(w.phase==='ready') {w.phase='playing';event(w,'start');return true;}return false; }
export function pauseFrontier(w) { if(w.phase==='playing'){w.phase='paused';return true;}return false; }
export function resumeFrontier(w) {if(w.phase==='paused'){w.phase='playing';return true;}return false;}
export function playerStats(w) {
  const u=w.upgrades;
  return {damage:13*(1+.25*(u.damage||0)),interval:.4*.84**(u.rate||0)/(w.player.haste>0?2:1),
    speed:7*(1+.12*(u.speed||0)),magnet:3+2*(u.magnet||0),dashCooldown:1.5*.82**(u.dash||0),
    armor:.12*(u.armor||0),crit:.05+.1*(u.crit||0)};
}
export function buildCheck(w,kind,x,z) {
  const def=TOWERS[kind]; if(!def)return '未知建筑';
  if(w.phase!=='playing')return '先开始或继续游戏';
  if(!Number.isFinite(x)||!Number.isFinite(z)||Math.hypot(x,z)>22)return '只能建在环形防区内';
  if(w.towers.length>=CAPS.towers)return '建筑数量已达上限';
  if(w.resources<def.cost)return 'TK 不足';
  if(Math.hypot(x,z)<4)return '请留出基地周围空间';
  if(w.towers.some(t=>Math.hypot(t.x-x,t.z-z)<2.6))return '建筑之间至少间隔 3 格';
  return '';
}
export function buildTower(w,kind,x,z) {
  x=Math.round(x);z=Math.round(z);const reason=buildCheck(w,kind,x,z);if(reason)return {ok:false,reason};
  const d=TOWERS[kind],t={id:++w.id,kind,x,z,hp:d.hp,maxHp:d.hp,radius:1,level:1,clock:0,invested:d.cost,yaw:0};
  w.resources-=d.cost;w.towers.push(t);event(w,'built',{kind});return {ok:true,tower:t};
}
export function upgradeTower(w,id) {
  const t=w.towers.find(t=>t.id===id);if(w.phase!=='playing'||!t||t.level>=3)return false;
  const cost=Math.ceil(TOWERS[t.kind].cost*t.level*.8);if(w.resources<cost)return false;
  w.resources-=cost;t.invested+=cost;t.level++;t.maxHp+=70;t.hp=Math.min(t.maxHp,t.hp+70);return true;
}
export function repair(w,id='base') {
  const t=id==='base'?w.base:w.towers.find(t=>t.id===id);
  if(w.phase!=='playing'||!t||t.hp>=t.maxHp||w.resources<25)return false;
  w.resources-=25;t.hp=Math.min(t.maxHp,t.hp+125);effect(w,'heal',t.x,t.z,2,'#8db99b');return true;
}
export function sellTower(w,id) {
  const i=w.towers.findIndex(t=>t.id===id);if(w.phase!=='playing'||i<0)return false;
  w.resources+=Math.floor(w.towers[i].invested*.55);w.towers.splice(i,1);return true;
}
export function recruit(w,kind) {
  const d=UNITS[kind];if(w.phase!=='playing'||!d||w.resources<d.cost||w.units.length+w.queue.length>=CAPS.units)return false;
  w.resources-=d.cost;w.queue.push({kind,left:3});return true;
}
export function cancelRecruit(w) {
  if(w.phase!=='playing'||!w.queue.length)return false;
  const item=w.queue.pop();w.resources+=UNITS[item.kind].cost;return true;
}
export function commandUnits(w,ids,order,target=null) {
  if(w.phase!=='playing'||!['move','attack','hold'].includes(order)||!Array.isArray(ids))return false;
  if(order!=='hold'&&(!finitePoint(target)||Math.abs(target.x)>LIMIT||Math.abs(target.z)>LIMIT))return false;
  const selected=w.units.filter(u=>ids.includes(u.id));
  selected.forEach((u,i)=>{const column=i%5,row=Math.floor(i/5);u.order=order;
    u.target=order==='hold'?{x:u.x,z:u.z}:{x:clamp(target.x+(column-Math.min(4,selected.length-1)/2)*1.4,-LIMIT,LIMIT),z:clamp(target.z+row*1.4,-LIMIT,LIMIT)};
  });return selected.length>0;
}
export function setRally(w,target) {
  if(w.phase!=='playing'||!finitePoint(target)||Math.abs(target.x)>22||Math.abs(target.z)>22)return false;
  w.rally={...target};return true;
}
export function launchWave(w) {
  if(w.phase!=='playing'||w.stage!=='planning')return false;
  w.wave++;w.stage='siege';w.budget=Math.min(10000,8+w.wave*4);w.spawnClock=0;w.bossPending=w.wave%5===0;
  const heal=35*(w.upgrades.logistics||0);w.base.hp=Math.min(w.base.maxHp,w.base.hp+heal);
  event(w,'wave',{wave:w.wave});return true;
}
export function spawnEnemy(w,type,x,z,elite=false) {
  const d=ENEMIES[type];if(!d||w.enemies.filter(e=>!e.dead).length>=CAPS.enemies)return null;
  if(!Number.isFinite(x)||!Number.isFinite(z)){const r=RIFTS[Math.floor(random(w)*RIFTS.length)];x=r.x+(random(w)-.5)*2;z=r.z+(random(w)-.5)*2;}
  const scale=1+Math.min(10000,w.wave-1)*.15,hp=d.hp*scale*(elite?2:1);
  const e={id:++w.id,type,x:clamp(x,-LIMIT,LIMIT),z:clamp(z,-LIMIT,LIMIT),hp,maxHp:hp,radius:d.radius,elite,dead:false,
    telegraph:1,clock:1+random(w),slow:0,windup:0,charge:0,aimX:0,aimZ:0,ring:4,flash:0};w.enemies.push(e);return e;
}
function drop(w,kind,x,z,value=1) {
  if(w.drops.length<CAPS.drops)w.drops.push({id:++w.id,kind,x,z,value});
  else if(kind==='xp')w.xp+=value; // Capacity must not erase progression.
}
export function damageEnemy(w,e,amount) {
  if(w.phase!=='playing'||!e||e.dead||e.telegraph>0||!validNumber(amount))return false;
  e.hp-=amount*(e.type==='tank'?.72:1);e.flash=.1;if(e.hp>0)return false;
  e.dead=true;w.kills++;const boss=e.type==='boss',reward=boss?90:e.elite?20:4;
  w.resources+=reward;w.earned+=reward;w.score+=boss?1500:e.elite?200:25;
  drop(w,'xp',e.x,e.z,boss?100:e.elite?30:8);effect(w,'burst',e.x,e.z,e.radius+1,ENEMIES[e.type].color);
  if(w.upgrades.leech)w.player.hp=Math.min(w.player.maxHp,w.player.hp+w.upgrades.leech);
  if(e.type==='splitter')for(const side of [-.7,.7])spawnEnemy(w,'skitter',e.x+side,e.z+side);
  if(boss){w.bosses++;drop(w,'chest',e.x,e.z);event(w,'boss-down');}
  else if(e.elite)drop(w,'chest',e.x,e.z);
  else if(random(w)<.1){const pool=['heal','shield','haste','bomb','magnet'];drop(w,pool[Math.floor(random(w)*pool.length)],e.x,e.z);}
  return true;
}
function hurt(w,target,amount) {
  if(w.phase!=='playing'||!target||target.hp<=0||!validNumber(amount))return;
  if(target===w.player){if(target.invulnerable>0||target.dash>0||target.respawn>0)return;
    amount*=1-playerStats(w).armor;target.invulnerable=.6;event(w,'hit');}
  target.hp=Math.max(0,target.hp-amount);
  if(target===w.base&&target.hp<=0){w.phase='lost';w.lossReason='基地核心已失守';event(w,'lost');}
  else if(target===w.player&&target.hp<=0){target.respawn=8;hurt(w,w.base,40);event(w,'respawn');}
}
export function dashFrontier(w,direction) {
  const p=w.player;if(w.phase!=='playing'||p.dashCooldown>0||p.respawn>0)return false;
  if(finitePoint(direction)&&Math.hypot(direction.x,direction.z)>.1)p.facing=Math.atan2(direction.x,direction.z);
  p.dash=.25;p.invulnerable=.35;p.dashCooldown=playerStats(w).dashCooldown;event(w,'dash');return true;
}
export function pulseFrontier(w) {
  const p=w.player;if(w.phase!=='playing'||p.pulseCooldown>0||p.respawn>0)return false;
  p.pulseCooldown=6;w.pulse=.5;effect(w,'pulse',p.x,p.z,8,'#94b8a2');
  for(const e of [...w.enemies])if(distance(p,e)<8)damageEnemy(w,e,playerStats(w).damage*3);
  w.bullets=w.bullets.filter(b=>b.friendly||distance(p,b)>8);event(w,'pulse');return true;
}
function offer(w) {
  const pool=UPGRADES.filter(u=>(w.upgrades[u.id]||0)<u.max),choices=[];
  while(pool.length&&choices.length<3)choices.push(pool.splice(Math.floor(random(w)*pool.length),1)[0].id);
  if(!choices.length){w.resources+=60;w.base.hp=Math.min(w.base.maxHp,w.base.hp+60);return false;}
  w.choices=choices;w.phase='upgrade';event(w,'upgrade');return true;
}
function levelUp(w) {if(w.phase==='playing'&&w.xp>=w.xpNext){w.xp-=w.xpNext;w.level++;w.xpNext=30+14*(w.level-1);offer(w);}}
export function chooseUpgrade(w,id) {
  if(w.phase!=='upgrade'||!w.choices.includes(id))return false;
  const d=UPGRADES.find(u=>u.id===id);if(!d||(w.upgrades[id]||0)>=d.max)return false;
  w.upgrades[id]=(w.upgrades[id]||0)+1;
  if(id==='hull'){w.player.maxHp+=25;w.player.hp=Math.min(w.player.maxHp,w.player.hp+25);}
  w.choices=[];w.phase='playing';levelUp(w);return true;
}
export function reroll(w) {if(w.phase!=='upgrade'||w.rerolls<=0)return false;w.rerolls--;return offer(w);}
export function collectDrop(w,item) {
  if(w.phase!=='playing'||!w.drops.includes(item))return false;
  w.drops.splice(w.drops.indexOf(item),1);const p=w.player;
  if(item.kind==='xp')w.xp+=item.value;
  else if(item.kind==='heal')p.hp=Math.min(p.maxHp,p.hp+35);
  else if(item.kind==='shield')p.invulnerable=Math.max(p.invulnerable,5);
  else if(item.kind==='haste')p.haste=8;
  else if(item.kind==='bomb'){for(const e of [...w.enemies])if(distance(e,p)<12)damageEnemy(w,e,100);}
  else if(item.kind==='magnet'){for(const d of w.drops)if(d.kind==='xp')w.xp+=d.value;w.drops=w.drops.filter(d=>d.kind!=='xp');}
  else if(item.kind==='chest')offer(w);
  levelUp(w);return true;
}
/** Swept segment collision prevents fast projectiles tunnelling through a target. */
export function segmentHit(ax,az,bx,bz,target,radius) {
  const dx=bx-ax,dz=bz-az,length=dx*dx+dz*dz,t=length?clamp(((target.x-ax)*dx+(target.z-az)*dz)/length,0,1):0;
  return Math.hypot(ax+dx*t-target.x,az+dz*t-target.z)<=radius;
}
function shoot(w,from,to,damage,friendly,options={}) {
  const hostile=w.bullets.filter(b=>!b.friendly).length;
  if(w.bullets.length>=CAPS.bullets||(!friendly&&hostile>=180))return;
  const a=Math.atan2(to.x-from.x,to.z-from.z)+(options.angle||0),speed=friendly?24:9;
  w.bullets.push({id:++w.id,x:from.x,z:from.z,vx:Math.sin(a)*speed,vz:Math.cos(a)*speed,damage,friendly,
    life:2.5,remaining:1+(options.pierce||0),hits:[],splash:options.splash||0,slow:options.slow||0});
}
function nearest(list,from,range) {
  let chosen=null,best=range;for(const t of list){if(t.dead||t.hp<=0||t.telegraph>0)continue;const d=distance(t,from);if(d<best){chosen=t;best=d;}}return chosen;
}
function moveTowards(unit,target,speed,dt) {
  const d=distance(unit,target);if(d<.1)return;
  const step=Math.min(d,speed*dt);unit.x=clamp(unit.x+(target.x-unit.x)/d*step,-LIMIT,LIMIT);unit.z=clamp(unit.z+(target.z-unit.z)/d*step,-LIMIT,LIMIT);
}
function healNear(w,from,range,amount) {
  const damaged=[w.base,...w.towers,...w.units,...(w.player.respawn>0?[]:[w.player])].filter(t=>t.hp>0&&t.hp<t.maxHp&&distance(t,from)<range);
  if(!damaged.length)return;
  damaged.sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp);const t=damaged[0];t.hp=Math.min(t.maxHp,t.hp+amount);effect(w,'beam',from.x,from.z,0,'#aac482',t);
}
function allies(w,dt) {
  if(w.queue.length){w.queue[0].left-=dt;if(w.queue[0].left<=0){const {kind}=w.queue.shift(),d=UNITS[kind];w.units.push({id:++w.id,kind,x:0,z:3,hp:d.hp,maxHp:d.hp,radius:.6,clock:0,order:'attack',target:{...w.rally}});}}
  const power=1+.15*(w.upgrades.engineering||0);
  for(const t of w.towers){if(t.hp<=0)continue;const d=TOWERS[t.kind];t.clock-=dt;if(t.clock>0)continue;
    if(t.kind==='mine'){w.resources+=3*t.level;t.clock=1;continue;}
    if(t.kind==='relay'){healNear(w,t,d.range+t.level,10*t.level);t.clock=1;continue;}
    const target=nearest(w.enemies,t,d.range+(t.level-1)*1.5);if(!target)continue;
    t.clock=d.interval;t.yaw=Math.atan2(target.x-t.x,target.z-t.z);shoot(w,t,target,d.damage*(1+.5*(t.level-1))*power,true,{splash:t.kind==='mortar'?3:0,slow:t.kind==='frost'?2:0});
  }
  for(const u of w.units){if(u.hp<=0)continue;const d=UNITS[u.kind];u.clock-=dt;
    const target=nearest(w.enemies,u,d.range);
    if(u.order==='move'||(u.order==='attack'&&!target))moveTowards(u,u.target,d.speed,dt);
    if(u.clock>0)continue;
    if(u.kind==='medic'){healNear(w,u,d.range,d.damage*power);u.clock=d.interval;}
    else if(target){shoot(w,u,target,d.damage*power,true,{splash:u.kind==='siege'?2.5:0});u.clock=d.interval;}
  }
}
function flagship(w,dt,input) {
  const p=w.player,s=playerStats(w);
  for(const key of ['invulnerable','dashCooldown','pulseCooldown','haste'])p[key]=Math.max(0,p[key]-dt);
  if(p.respawn>0){p.respawn=Math.max(0,p.respawn-dt);p.vx=p.vz=0;if(p.respawn===0){p.hp=p.maxHp;p.x=0;p.z=5;p.invulnerable=3;}return;}
  let x=Number.isFinite(input.x)?input.x:0,z=Number.isFinite(input.z)?input.z:0,n=Math.hypot(x,z);if(n>1){x/=n;z/=n;}
  if(p.dash>0){p.vx=Math.sin(p.facing)*25;p.vz=Math.cos(p.facing)*25;}
  else {const f=1-Math.exp(-12*dt);p.vx+=(x*s.speed-p.vx)*f;p.vz+=(z*s.speed-p.vz)*f;if(Math.hypot(p.vx,p.vz)>.4)p.facing=Math.atan2(p.vx,p.vz);}
  p.x=clamp(p.x+p.vx*dt,-LIMIT,LIMIT);p.z=clamp(p.z+p.vz*dt,-LIMIT,LIMIT);p.dash=Math.max(0,p.dash-dt);
  p.hp=Math.min(p.maxHp,p.hp+(w.upgrades.regen||0)*dt);
  w.fireClock-=dt;const target=nearest(w.enemies,p,13);
  if(target&&w.fireClock<=0){const count=1+(w.upgrades.multishot||0);for(let i=0;i<count;i++)shoot(w,p,target,s.damage*(random(w)<s.crit?2:1),true,{angle:(i-(count-1)/2)*.14,pierce:w.upgrades.pierce||0});w.fireClock=s.interval;}
  w.orbitClock-=dt;w.chainClock-=dt;w.bombClock-=dt;
  if(w.upgrades.orbit&&w.orbitClock<=0){for(const e of [...w.enemies])if(distance(e,p)<3.5)damageEnemy(w,e,s.damage*w.upgrades.orbit*.5);w.orbitClock=.3;}
  if(target&&w.upgrades.chain&&w.chainClock<=0){let from=p;const pool=[...w.enemies];for(let i=0;i<=w.upgrades.chain;i++){const e=nearest(pool,from,i?6:13);if(!e)break;effect(w,'beam',from.x,from.z,0,'#bfd8c0',{x:e.x,z:e.z});damageEnemy(w,e,s.damage*1.2);pool.splice(pool.indexOf(e),1);from=e;}w.chainClock=2;}
  if(target&&w.upgrades.bomb&&w.bombClock<=0){effect(w,'burst',target.x,target.z,4,'#dfb06c');for(const e of [...w.enemies])if(distance(e,target)<4)damageEnemy(w,e,s.damage*w.upgrades.bomb*2);w.bombClock=3;}
}
function enemies(w,dt) {
  for(const e of [...w.enemies]){if(e.dead)continue;e.telegraph=Math.max(0,e.telegraph-dt);e.slow=Math.max(0,e.slow-dt);e.flash=Math.max(0,e.flash-dt);if(e.telegraph>0)continue;
    const d=ENEMIES[e.type],p=w.player;
    let target=w.base;
    if(e.type==='sapper')target=nearest(w.towers.filter(t=>t.kind==='mine'),e,60)||nearest(w.towers,e,12)||w.base;
    else target=nearest([...w.towers,...w.units,...(p.respawn===0?[p]:[])],e,8)||w.base;
    const gap=distance(e,target);e.clock-=dt;const speed=d.speed*(e.slow>0?.45:1)*(1+Math.min(.5,w.wave*.015));
    if(e.type==='charger'){
      if(e.windup>0){e.windup-=dt;if(e.windup<=0)e.charge=.65;continue;}
      if(e.charge>0){e.charge-=dt;e.x=clamp(e.x+e.aimX*15*dt,-LIMIT,LIMIT);e.z=clamp(e.z+e.aimZ*15*dt,-LIMIT,LIMIT);}
      else if(e.clock<=0&&gap<13&&gap>3){e.aimX=(target.x-e.x)/gap;e.aimZ=(target.z-e.z)/gap;e.windup=.85;e.clock=4;continue;}
      else moveTowards(e,target,speed,dt);
    }else if(gap>(e.type==='gunner'?7:e.radius+target.radius+.15))moveTowards(e,target,speed,dt);
    if(e.type==='gunner'&&gap<11&&e.clock<=0){shoot(w,e,target,d.damage,false);e.clock=2;}
    if(e.type==='boss'){e.ring-=dt;if(e.ring<=0){const count=e.hp<e.maxHp/2?16:10;for(let i=0;i<count;i++)shoot(w,e,{x:e.x+Math.sin(i/count*Math.PI*2),z:e.z+Math.cos(i/count*Math.PI*2)},d.damage*.6,false);e.ring=e.hp<e.maxHp/2?3:5;effect(w,'pulse',e.x,e.z,4,d.color);}}
    if(distance(e,target)<e.radius+target.radius+.35&&e.clock<=0){hurt(w,target,d.damage*(1+Math.min(3,w.wave*.04)));e.clock=1;}
    if(w.phase!=='playing')return;
  }
}
function projectiles(w,dt) {
  for(const b of w.bullets){if(b.life<=0)continue;const ox=b.x,oz=b.z;b.x+=b.vx*dt;b.z+=b.vz*dt;b.life-=dt;
    const targets=b.friendly?w.enemies:[w.base,...w.towers,...w.units,...(w.player.respawn===0?[w.player]:[])];
    // Sort by travel distance so a piercing shot damages nearer targets first.
    const hits=targets.filter(t=>t.hp>0&&!t.dead&&!(t.telegraph>0)&&!b.hits.includes(t.id)&&segmentHit(ox,oz,b.x,b.z,t,t.radius+.18)).sort((a,c)=>Math.hypot(a.x-ox,a.z-oz)-Math.hypot(c.x-ox,c.z-oz));
    for(const t of hits){b.hits.push(t.id);if(b.friendly){damageEnemy(w,t,b.damage);if(b.slow)t.slow=Math.max(t.slow,b.slow);
      if(b.splash){effect(w,'burst',t.x,t.z,b.splash,'#e0b77c');for(const other of [...w.enemies])if(other!==t&&distance(other,t)<b.splash)damageEnemy(w,other,b.damage*.7);}}
      else hurt(w,t,b.damage);
      if(--b.remaining<=0){b.life=0;break;}if(w.phase!=='playing')return;
    }
  }w.bullets=w.bullets.filter(b=>b.life>0&&Math.abs(b.x)<35&&Math.abs(b.z)<35);
}
export function advanceFrontier(w,dt,input={x:0,z:0}) {
  if(w.phase!=='playing'||!Number.isFinite(dt)||dt<=0)return;dt=Math.min(dt,.05);
  w.time+=dt;w.resources=Math.min(999999,w.resources+(1.5+(w.upgrades.industry||0))*dt);w.pulse=Math.max(0,w.pulse-dt);
  w.effects=w.effects.filter(e=>(e.life-=dt)>0);
  if(w.stage==='planning'){w.planning-=dt;if(w.planning<=0)launchWave(w);}
  if(w.stage==='siege'){
    w.spawnClock-=dt;
    if(w.bossPending){if(spawnEnemy(w,'boss'))w.bossPending=false;}
    if(w.budget>0&&w.spawnClock<=0){const types=['crawler','skitter',...(w.wave>=2?['gunner','charger']:[]),...(w.wave>=3?['tank','splitter','sapper']:[])];
      const e=spawnEnemy(w,types[Math.floor(random(w)*types.length)],undefined,undefined,w.wave%4===0&&w.budget===1);
      if(e){w.budget--;w.spawnClock=Math.max(.2,1.15-w.wave*.035);}}
  }
  flagship(w,dt,input);allies(w,dt);enemies(w,dt);if(w.phase!=='playing')return;projectiles(w,dt);if(w.phase!=='playing')return;
  w.enemies=w.enemies.filter(e=>!e.dead);w.towers=w.towers.filter(t=>t.hp>0);w.units=w.units.filter(u=>u.hp>0);
  if(w.player.respawn===0){const r=playerStats(w).magnet;for(const item of [...w.drops]){if(!w.drops.includes(item))continue;const d=distance(item,w.player);if(d<r)moveTowards(item,w.player,12,dt);if(distance(item,w.player)<1)collectDrop(w,item);if(w.phase!=='playing')return;}}
  levelUp(w);if(w.phase!=='playing')return;
  if(w.stage==='siege'&&w.budget===0&&!w.bossPending&&w.enemies.length===0){w.stage='planning';w.planning=12;w.resources+=35+w.wave*3;w.score+=100*w.wave;event(w,'clear',{wave:w.wave});}
}
export const RECORD_KEY='lightjunction.frontier.v1';
export function readFrontierRecord(storage) {
  try{const r=JSON.parse(storage.getItem(RECORD_KEY)||'{}'),safe=n=>Number.isSafeInteger(n)&&n>=0?Math.min(n,999999999):0;
    return {bestWave:safe(r?.bestWave),bestScore:safe(r?.bestScore),runs:safe(r?.runs)};
  }catch{return {bestWave:0,bestScore:0,runs:0};}
}
export function saveFrontierRecord(storage,w) {
  const r=readFrontierRecord(storage),record={bestWave:Math.max(r.bestWave,w.wave),bestScore:Math.max(r.bestScore,Math.floor(w.score)),runs:r.runs+(w.phase==='lost'?1:0)};
  try{storage.setItem(RECORD_KEY,JSON.stringify(record));}catch{/* Records are optional. */}return record;
}
