import { STATIONS, clamp } from './world.mjs';
const C={earth:'#929787',rock:'#777f70',grass:'#afbd9a',light:'#e7dfc5',ink:'#374840',gold:'#d8ac61'};
function shade(hex,factor){const n=parseInt(hex.slice(1),16);return `rgb(${[16,8,0].map(s=>Math.round(clamp(((n>>s)&255)*factor,0,255))).join(',')})`;}
/** Low-resolution software 3D, with depth-sorted voxel geometry and no downloaded artwork. */
export function createScene(canvas) {
  const ctx=canvas.getContext('2d',{alpha:false});if(!ctx)throw new Error('Canvas 2D is unavailable');
  const blocks=[], decor=[], hits=new Map();
  let w=0,h=0,scale=8,zoom=1,pixel=2,camera={x:0,z:0}, focus=null, frame=0;
  const add=(x,y,z,sx,sy,sz,color)=>blocks.push({x,y,z,sx,sy,sz,color});
  function tree(x,z,size=1){add(x,0,z,.45,size*2.5,.45,'#817b5b');add(x-.85*size,size*1.4,z-.85*size,1.8*size,1.4*size,1.8*size,'#889a78');add(x-.5*size,size*2.8,z-.5*size,1.1*size,size,1.1*size,'#a6b28c');}
  for(const [i,s] of STATIONS.entries()){
    const {x,z}=s;
    // Stepped islands, not a single flat quad underneath web links.
    add(x-5,-2.2,z-5,10,1.6,10,C.rock);add(x-5.5,-.6,z-4.6,11,.6,9.2,i===2?'#c8b798':C.grass);
    add(x-3.8,-3.2,z-3.8,7.6,1,7.6,'#7f8b79');add(x-2.5,-4,z-2.5,5,.8,5,'#8b9484');
    for(let n=0;n<8;n++){const angle=n*Math.PI/4;add(x+Math.cos(angle)*4.8-.45,-.1,z+Math.sin(angle)*4.8-.45,.9,.2,.9,'#d4d2b5');}
    add(x-2,0,z+2,4,.2,2.3,'#d4cfb7');
    if(s.type==='monument'){
      add(x-1.8,0,z-1.8,3.6,.55,3.6,C.light);add(x-.6,.55,z-.6,1.2,4.5,1.2,C.ink);
      add(x-2,3,z-.5,4,1,1,C.ink);add(x-.45,1,z-2, .9,.9,4,C.gold);
      for(let k=0;k<4;k++)tree(x+(k%2?3.6:-3.8),z+(k<2?-3.6:3.7),.55);
    }else if(s.type==='garden'){
      for(let k=0;k<7;k++)tree(x+Math.cos(k)*3.3,z+Math.sin(k)*3.2,.65+(k%3)*.13);
      add(x-1.3,0,z-1.3,2.6,.3,2.6,C.light);add(x-.5,.3,z-.5,1,1.4,1,'#dad5bd');add(x-.6,1.7,z-.6,1.2,1.1,1.2,C.ink);
      add(x-.4,2.1,z+.62,.8,.18,.05,s.color);
    }else if(s.type==='dock'){
      for(let k=0;k<3;k++){
        add(x-3+k*2.7,.1,z-1,2.1,.6,3.6,'#918c76');add(x-2.8+k*2.7,.7,z-.5,1.7,.7,2.2,s.color);
        add(x-2.2+k*2.7,1.4,z+.2,.5,.5,1,'#f4e9cf');
      }
      add(x-4,0,z-3,.4,4,.4,C.ink);add(x-4,3.6,z-3,8,.4,.4,C.ink);add(x+3.6,0,z-3,.4,4,.4,C.ink);
    }else if(s.type==='lab'){
      add(x-2.8,0,z-2.8,5.6,.5,5.6,C.light);
      for(let k=0;k<4;k++){const dx=k%2?2:-2,dz=k<2?-2:2;add(x+dx-.4,.5,z+dz-.4,.8,3.5,.8,s.color);}
      add(x-2.5,4,z-2.5,5,.4,5,C.ink);add(x-.9,.5,z-.9,1.8,2.2,1.8,'#d1c2d7');
    }else if(s.type==='radio'){
      add(x-2,0,z-2,4,.7,4,C.light);add(x-.4,.7,z-.4,.8,5.4,.8,C.ink);
      for(let k=0;k<5;k++)add(x-2.3+k,.7+2.7+Math.abs(k-2)*.5,z-1.4,.85,.4,2.8,s.color);
      add(x-.15,6.1,z-.15,.3,.6,.3,C.gold);add(x-3.5,0,z+1.5,1.8,1.2,1.2,'#939c86');
    }else if(s.type==='terminal'){
      add(x-2.5,0,z-2.5,5,.6,5,C.light);add(x-2,.6,z-1,4,2.5,1.6,C.ink);
      add(x-1.65,1.05,z+.62,3.3,1.65,.1,s.color);
      for(let k=0;k<4;k++)add(x-1.35,1.25+k*.34,z+.73,1.8-k*.3,.09,.06,C.ink);
    }else if(s.type==='vault'){
      for(let k=0;k<4;k++)add(x-2.8+k*.5,k*.75,z-2.8+k*.5,5.6-k, .75,5.6-k,C.light);
      add(x-.7,3,z-.7,1.4,1.8,1.4,C.ink);add(x-.5,3.5,z+.73,1,.12,.05,C.gold);
    }else{
      add(x-3,0,z-2,6,.6,4,C.light);add(x-3,.6,z-.6,1,5.8,1.2,C.ink);add(x+2,.6,z-.6,1,5.8,1.2,C.ink);add(x-3,6.4,z-.6,6,1,1.2,s.color);
      for(let k=0;k<4;k++)add(x-1.6+k*.85,.6,z-.15,.3,5.6,.3,s.color);
    }
    for(let k=0;k<5;k++)decor.push({x:x+Math.sin(k*9+i)*4,z:z+Math.cos(k*7+i)*4,color:s.color,id:i*5+k});
    if(i){const steps=Math.floor(Math.hypot(x,z)/2.5);for(let k=2;k<steps-2;k++){const t=k/steps;add(x*t-.65,-.35,z*t-.65,1.3,.25,1.3,'#c0bfaa');}}
  }
  // Draw farther voxels first. The view angle remains fixed so this ordering is reusable.
  blocks.sort((a,b)=>(a.x+a.z+a.sx+a.sz)-(b.x+b.z+b.sx+b.sz));
  function resize(){const r=canvas.getBoundingClientRect();w=Math.max(1,Math.round(r.width/pixel));h=Math.max(1,Math.round(r.height/pixel));if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;ctx.imageSmoothingEnabled=false;}scale=(r.width<700?6:7.1)*zoom*2/pixel;}
  function project(x,y,z){return {x:w*(focus&&canvas.clientWidth>700?.36:.52)+(x-camera.x-z+camera.z)*.82*scale,y:h*.49+(x-camera.x+z-camera.z)*.43*scale-y*scale};}
  function ground(clientX,clientY){const r=canvas.getBoundingClientRect(),px=(clientX-r.left)/r.width*w,py=(clientY-r.top)/r.height*h;const a=(px-w*(focus&&canvas.clientWidth>700?.36:.52))/(.82*scale),b=(py-h*.49)/(.43*scale);return {x:clamp(camera.x+(a+b)/2,-43,43),z:clamp(camera.z+(b-a)/2,-40,37)};}
  function polygon(points,color){ctx.fillStyle=color;ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(Math.round(p.x),Math.round(p.y)):ctx.moveTo(Math.round(p.x),Math.round(p.y)));ctx.closePath();ctx.fill();}
  function cube(b){
    const {x,y,z,sx,sy,sz,color}=b;
    const p=project(x,y+sy,z),a=project(x+sx,y+sy,z),c=project(x+sx,y+sy,z+sz),d=project(x,y+sy,z+sz);
    if(c.x<-100||d.x>w+100||p.y>h+80||c.y<-100)return;
    polygon([d,c,project(x+sx,y,z+sz),project(x,y,z+sz)],shade(color,.73));
    polygon([a,c,project(x+sx,y,z+sz),project(x+sx,y,z)],shade(color,.87));
    polygon([p,a,c,d],color);
  }
  function draw(world,dt=0,reduced=false){
    frame++;
    const target=focus||world.player,lerp=reduced?1:Math.min(1,dt*2.8);
    camera.x+=(target.x-camera.x)*lerp;camera.z+=(target.z-camera.z)*lerp;
    ctx.fillStyle='#ece9df';ctx.fillRect(0,0,w,h);
    const time=reduced?0:world.time;
    // Soft, drifting token clouds remain square and low-resolution.
    for(let i=0;i<90;i++){
      const x=((i*127.7+time*(1+i%3))%(w+80))-40, y=((i*79.3)%(h+30))-15;
      ctx.fillStyle=i%9===0?'#d3c5a5':'#deded2';const size=i%4+1;ctx.fillRect(Math.round(x),Math.round(y),size,size);
    }
    // Island shadows, painted before geometry.
    for(const s of STATIONS){const p=project(s.x,-7,s.z);ctx.fillStyle='#d8dace';ctx.beginPath();ctx.ellipse(p.x,p.y,scale*7,scale*2.3,0,0,Math.PI*2);ctx.fill();}
    const dynamic=[];
    for(const d of decor)dynamic.push({x:d.x,y:.2,z:d.z,sx:.22,sy:.45+Math.sin(time+d.id)*.1,sz:.22,color:d.color});
    for(const shard of world.shards){if(world.save.collected.includes(shard.id))continue;dynamic.push({x:shard.x-.16,y:1.3+Math.sin(time*2+shard.id)*.2,z:shard.z-.16,sx:.32,sy:.32,sz:.32,color:C.gold});}
    // Repairs leave a visible signal in the world rather than only a menu counter.
    const dock=STATIONS.find(s=>s.id==='work'),garden=STATIONS.find(s=>s.id==='about');
    for(let i=0;i<world.save.repaired.length;i++){
      const drift=reduced?0:(time*.7+i*2)%6;
      dynamic.push({x:dock.x-4+i*2,y:3.3+drift*.15,z:dock.z+3+drift,sx:1.2,sy:.45,sz:1.8,color:C.gold});
    }
    for(const i of world.save.memories)dynamic.push({x:garden.x-2+i*2,y:2.8,z:garden.z+1,sx:.5,sy:.5,sz:.5,color:C.gold});
    const p=world.player, bob=reduced?0:Math.sin(time*5)*.1;
    dynamic.push({x:p.x-.45,y:.55+bob,z:p.z-.45,sx:.9,sy:.9,sz:.9,color:C.light}, {x:p.x-.5,y:1.45+bob,z:p.z-.5,sx:1,sy:.8,sz:1,color:C.ink}, {x:p.x-.3,y:1.7+bob,z:p.z+.51,sx:.6,sy:.17,sz:.05,color:C.gold});
    // Wide island slabs are terrain, not foreground objects. Sorting their far
    // corner together with props incorrectly painted the ground over buildings.
    const depth=b=>b.x+b.sx/2+b.z+b.sz/2+(b.y+b.sy/2)*1.2;
    const geometry=[...blocks,...dynamic].sort((a,b)=>Number(a.y>=0)-Number(b.y>=0)||depth(a)-depth(b));
    for(const b of geometry)cube(b);
    // Light bridges wake up as their destination is visited.
    for(const s of STATIONS){
      if(!world.save.visited.includes(s.id))continue;
      const q=project(s.x,.23,s.z+3);ctx.fillStyle=s.color;ctx.fillRect(q.x-6,q.y-1,12,2);
    }
    if(world.pulse>0){const q=project(p.x,.5,p.z),r=(1-world.pulse)*scale*8;ctx.strokeStyle='#bb995c';ctx.lineWidth=1;ctx.globalAlpha=world.pulse;ctx.beginPath();ctx.ellipse(q.x,q.y,r,r*.53,0,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=1;}
    if(world.target){const q=project(world.target.x,.1,world.target.z);ctx.strokeStyle=C.ink;ctx.strokeRect(q.x-3,q.y-2,6,4);}
    hits.clear();
    for(const s of STATIONS){const q=project(s.x,7.8,s.z);hits.set(s.id,{x:q.x/w*canvas.clientWidth,y:q.y/h*canvas.clientHeight,visible:q.x>10&&q.x<w-10&&q.y>25&&q.y<h-18});}
    return hits;
  }
  return {draw,ground,resize,labels:hits,setFocus(s){focus=s;},setZoom(value){zoom=clamp(value,.65,1.65);resize();},getZoom(){return zoom;},setPixels(value){pixel=value;resize();},snap(x,z){camera={x,z};},pan(dx,dy){camera.x+=dx;camera.z+=dy;}};
}
