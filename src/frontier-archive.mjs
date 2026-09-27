import { TOWERS, UNITS, ENEMIES, UPGRADES, readFrontierRecord } from './token-drift/frontier-world.mjs';
import './frontier-archive.css';

function mountArchive() {
  if (!document.body.classList.contains('frontier-archive')) return;
  let storage;try {storage=localStorage;}catch{/* Optional. */}
  const record=readFrontierRecord(storage),label=document.getElementById('frontier-record');
  if(label)label.textContent=record.bestWave?`本机最长防守 ${record.bestWave} 波 · ${record.bestScore} 分`:'所有内容直接可见 · 无需通关';
  const captions={
    'workspace-title':'开放项目档案。',
    'workspace-kicker':'06 / 代码仓库与交互终端',
    'contact-title':'通讯室。留下一段信号。',
  };
  for(const [id,text] of Object.entries(captions)){const node=document.getElementById(id);if(node)node.textContent=text;}
  const back=document.querySelector('.site-footer a');if(back){back.href='./';back.textContent='返回无尽防线 ↗';}
  const dialog=document.createElement('dialog');dialog.id='frontier-codex';dialog.setAttribute('aria-labelledby','codex-title');
  const close=document.createElement('button');close.type='button';close.className='codex-close';close.setAttribute('aria-label','关闭图鉴');close.textContent='×';close.addEventListener('click',()=>dialog.close());
  const kicker=document.createElement('p');kicker.className='codex-kicker';kicker.textContent='FIELD MANUAL / LIVE GAME DATA';
  const title=document.createElement('h2');title.id='codex-title';title.textContent='了解你的防线。';
  const note=document.createElement('p');note.className='codex-note';note.textContent='图鉴直接读取游戏配置。这里的 TK 是游戏资源，不是平台额度。';
  const tabs=document.createElement('div');tabs.className='codex-tabs';tabs.setAttribute('role','group');tabs.setAttribute('aria-label','图鉴分类');
  const content=document.createElement('div');content.className='codex-grid';content.id='codex-content';
  const groups=[['建筑',TOWERS],['小队',UNITS],['敌人',ENEMIES],['肉鸽强化',Object.fromEntries(UPGRADES.map(u=>[u.id,u]))]];
  function show(index){
    [...tabs.children].forEach((b,i)=>b.setAttribute('aria-pressed',String(i===index)));content.replaceChildren();
    for(const [kind,def] of Object.entries(groups[index][1])){
      const card=document.createElement('article'),icon=document.createElement('i'),h=document.createElement('h3'),text=document.createElement('p'),stat=document.createElement('small');
      icon.className='codex-icon';icon.style.setProperty('--unit-color',def.color||'#a8925f');icon.setAttribute('aria-hidden','true');h.textContent=def.name;
      text.textContent=def.tip||(kind==='boss'?'每 5 波再次出现；击败后继续无尽防守。':'从裂隙出发，威胁基地与附近的友军。');
      stat.textContent=def.cost?`${def.cost} TK · ${def.hp} HP${def.range?` · 射程 ${def.range}`:''}`:def.max?`最多叠加 ${def.max} 级`:`基础生命 ${def.hp} · 波次增长后强化`;
      card.append(icon,h,text,stat);content.append(card);
    }
  }
  groups.forEach(([name],i)=>{const b=document.createElement('button');b.type='button';b.textContent=name;b.setAttribute('aria-controls','codex-content');b.addEventListener('click',()=>show(i));tabs.append(b);});
  dialog.append(close,kicker,title,note,tabs,content);document.body.append(dialog);show(0);
  document.getElementById('frontier-codex-button')?.addEventListener('click',()=>dialog.showModal());
  dialog.addEventListener('click',e=>{if(e.target!==dialog)return;const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();});
}
// Existing portfolio / encryption initialization retains ownership of its DOM and handlers.
if(document.readyState==='complete')mountArchive();else window.addEventListener('load',mountArchive,{once:true});
