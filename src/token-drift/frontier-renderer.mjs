import { TOWERS, UNITS, ENEMIES, RIFTS } from './frontier-world.mjs';
const TAU=Math.PI*2, SKY=[.92,.93,.88], colors=new Map();
const faces=[
  [[1,0,0],[[.5,-.5,-.5],[.5,.5,-.5],[.5,.5,.5],[.5,-.5,.5]]],
  [[-1,0,0],[[-.5,-.5,.5],[-.5,.5,.5],[-.5,.5,-.5],[-.5,-.5,-.5]]],
  [[0,1,0],[[-.5,.5,-.5],[-.5,.5,.5],[.5,.5,.5],[.5,.5,-.5]]],
  [[0,-1,0],[[-.5,-.5,.5],[-.5,-.5,-.5],[.5,-.5,-.5],[.5,-.5,.5]]],
  [[0,0,1],[[-.5,-.5,.5],[.5,-.5,.5],[.5,.5,.5],[-.5,.5,.5]]],
  [[0,0,-1],[[.5,-.5,-.5],[-.5,-.5,-.5],[-.5,.5,-.5],[.5,.5,-.5]]],
];
function rgb(c){if(!colors.has(c))colors.set(c,[1,3,5].map(i=>parseInt(c.slice(i,i+2),16)/255));return colors.get(c);}
const cube=(a,x,y,z,sx,sy,sz,c,yaw=0)=>a.push(x,y,z,sx,sy,sz,...rgb(c),yaw);
function ring(out,x,y,z,r,color,n=36){for(let i=0;i<n;i++){const a=i/n*TAU;cube(out,x+Math.sin(a)*r,y,z+Math.cos(a)*r,.18,.1,.18,color);}}
const VERT=`#version 300 es
precision highp float;
layout(location=0) in vec3 position;layout(location=1) in vec3 normal;
layout(location=2) in vec3 center;layout(location=3) in vec3 scale;layout(location=4) in vec3 color;layout(location=5) in float rotation;
uniform mat4 matrix;out vec3 tint;
void main(){float c=cos(rotation),s=sin(rotation);mat3 r=mat3(c,0.,-s,0.,1.,0.,s,0.,c);vec3 p=r*(position*scale)+center;
float light=.67+.33*max(0.,dot(r*normal,normalize(vec3(-.4,1.,.6))));tint=mix(color*light,vec3(.92,.93,.88),clamp((-p.y-2.)*.04,0.,.4));gl_Position=matrix*vec4(p,1.);}`;
const FRAG=`#version 300 es
precision highp float;in vec3 tint;out vec4 outColor;void main(){outColor=vec4(tint,1.);}`;
function terrain(){
  const a=[];let seed=813;const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  for(let x=-26;x<=26;x+=2)for(let z=-26;z<=26;z+=2){
    const d=Math.hypot(x,z),lane=Math.abs(x)<3||Math.abs(z)<3;
    if(d>24&&!lane)continue;
    const height=1+Math.max(0,Math.floor((25-d)/6))*.65;
    cube(a,x,-1-height/2,z,2,height,2,'#a08d7c');
    cube(a,x,-.47,z,1.96,.3,1.96,lane?'#e2dcc0':rnd()>.5?'#bfc9a5':'#b5c2a0');
    if(d>21&&d<24&&!lane&&rnd()<.19){cube(a,x,.45,z,.25,1.6,.25,'#8c8669');cube(a,x,1.2,z,1.5,1,1.5,'#899d7c');}
  }
  for(let i=0;i<30;i++){const angle=rnd()*TAU,r=27+rnd()*13;cube(a,Math.sin(angle)*r,-4-rnd()*3,Math.cos(angle)*r,3+rnd()*3,1,2+rnd()*3,'#f1f0e2');}
  for(const r of RIFTS){cube(a,r.x,0,r.z,3,.4,3,'#887a79');cube(a,r.x,1.2,r.z,.8,2,.8,'#b47c6b');}
  return a;
}
export class FrontierRenderer {
  constructor(canvas,labels,reduced=false){
    this.canvas=canvas;this.labels=labels;this.ctx=labels.getContext('2d');this.reduced=reduced;
    this.camera={x:0,z:0,yaw:.65,pitch:.85,zoom:1,follow:false};this.width=1;this.height=1;this.pixelSize=2;this.matrix=new Float32Array(16);
    this.gl=canvas.getContext('webgl2',{alpha:false,antialias:false,powerPreference:'low-power'});this.software=!this.gl;
    this.staticData=terrain();if(!this.ctx)throw new Error('无法创建标签画布');
    if(!this.gl){this.soft=canvas.getContext('2d',{alpha:false});if(!this.soft)throw new Error('无法创建 3D 画布');return;}
    const gl=this.gl,compile=(type,source)=>{const s=gl.createShader(type);if(!s)throw new Error('着色器分配失败');gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){const message=gl.getShaderInfoLog(s);gl.deleteShader(s);throw new Error(message||'着色器编译失败');}return s;};
    const vs=compile(gl.VERTEX_SHADER,VERT),fs=compile(gl.FRAGMENT_SHADER,FRAG);this.program=gl.createProgram();
    if(!this.program)throw new Error('渲染程序分配失败');gl.attachShader(this.program,vs);gl.attachShader(this.program,fs);gl.linkProgram(this.program);gl.deleteShader(vs);gl.deleteShader(fs);
    if(!gl.getProgramParameter(this.program,gl.LINK_STATUS))throw new Error('渲染程序连接失败');this.uniform=gl.getUniformLocation(this.program,'matrix');
    const vertices=[];for(const [n,points] of faces)for(const i of [0,1,2,0,2,3])vertices.push(...points[i],...n);
    this.geometry=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.geometry);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(vertices),gl.STATIC_DRAW);
    this.static=this.batch(new Float32Array(this.staticData),true);this.data=new Float32Array(60000);this.dynamic=this.batch(this.data,false);gl.enable(gl.DEPTH_TEST);gl.clearColor(...SKY,1);
  }
  batch(data,fixed){const gl=this.gl,vao=gl.createVertexArray(),buffer=gl.createBuffer();gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,this.geometry);
    for(let i=0;i<2;i++){gl.enableVertexAttribArray(i);gl.vertexAttribPointer(i,3,gl.FLOAT,false,24,i*12);}gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,data,fixed?gl.STATIC_DRAW:gl.DYNAMIC_DRAW);
    for(const [i,n,o] of [[2,3,0],[3,3,12],[4,3,24],[5,1,36]]){gl.enableVertexAttribArray(i);gl.vertexAttribPointer(i,n,gl.FLOAT,false,40,o);gl.vertexAttribDivisor(i,1);}return {vao,buffer,count:data.length/10};
  }
  resize(){this.width=Math.max(1,this.canvas.clientWidth);this.height=Math.max(1,this.canvas.clientHeight);
    const scale=Math.max(this.pixelSize,this.width/1000),w=Math.max(1,Math.round(this.width/scale)),h=Math.max(1,Math.round(this.height/scale));
    if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h;this.gl?.viewport(0,0,w,h);}
    const d=Math.min(globalThis.devicePixelRatio||1,2);if(this.labels.width!==Math.round(this.width*d)||this.labels.height!==Math.round(this.height*d)){this.labels.width=Math.round(this.width*d);this.labels.height=Math.round(this.height*d);}
  }
  point(x,y,z){const m=this.matrix;return {x:(m[0]*x+m[4]*y+m[8]*z+m[12]+1)*this.width/2,y:(1-m[1]*x-m[5]*y-m[9]*z-m[13])*this.height/2};}
  ground(px,py){const m=this.matrix,x=px/this.width*2-1-m[12],y=1-py/this.height*2-m[13],det=m[0]*m[9]-m[8]*m[1];
    return Math.abs(det)<1e-8?null:{x:(x*m[9]-m[8]*y)/det,z:(m[0]*y-x*m[1])/det};
  }
  pan(dx,dy){const a=this.ground(0,0),b=this.ground(dx,dy);if(!a||!b)return;this.camera.follow=false;this.camera.x=Math.max(-20,Math.min(20,this.camera.x+a.x-b.x));this.camera.z=Math.max(-20,Math.min(20,this.camera.z+a.z-b.z));}
  render(w,dt,clock,{selected=[],towerId=null,ghost=null,box=null}={}){
    this.resize();const c=this.camera,t=this.reduced?0:w.phase==='ready'?clock:w.time,mobile=this.width<700;
    if(c.follow&&w.phase==='playing'){const f=this.reduced?1:1-Math.exp(-dt*7);c.x+=(w.player.x-c.x)*f;c.z+=(w.player.z-c.z)*f;}
    const intro=w.phase==='ready',hh=(intro?mobile?43:30:mobile?30:26)*c.zoom,rx=hh*this.width/this.height,sy=Math.sin(c.yaw),cy=Math.cos(c.yaw),sp=Math.sin(c.pitch),cp=Math.cos(c.pitch);
    const x=[cy,0,-sy],y=[-sy*sp,cp,-cy*sp],z=[sy*cp,sp,cy*cp],dot=v=>v[0]*c.x+v[2]*c.z;this.view=z;this.halfHeight=hh;
    this.matrix=new Float32Array([x[0]/rx,y[0]/hh,-2*z[0]/180,0,0,y[1]/hh,-2*z[1]/180,0,x[2]/rx,y[2]/hh,-2*z[2]/180,0,-dot(x)/rx+(intro&&!mobile?.32:0),-dot(y)/hh+(intro&&mobile?.5:0),2*(65+dot(z))/180-1,1]);
    const out=[];
    cube(out,0,.05,0,4,.65,4,'#4b6156');cube(out,0,.6,0,2.5,.5,2.5,'#dfdebc');cube(out,0,1.6,0,1.1,1.7,1.1,'#587f70',t*.2);
    cube(out,0,2.6,0,.75,.75,.75,'#e4bd74',t*.3);ring(out,0,.4,0,3,'#dfc27c');
    for(let i=0;i<12;i++){const a=t*.3+i/12*TAU;cube(out,Math.cos(a)*1.7,1.7,Math.sin(a)*1.7,.22,.22,.22,'#dfc381');}
    const buildings=intro?[{id:-1,kind:'bolt',x:6,z:4,level:2,yaw:0},{id:-2,kind:'mine',x:-7,z:4,level:1,yaw:0},{id:-3,kind:'mortar',x:2,z:-8,level:1,yaw:0}]:w.towers;
    for(const b of buildings){const d=TOWERS[b.kind],col=d.color;
      cube(out,b.x,0,b.z,2,.55,2,'#6d7b63');cube(out,b.x,.6,b.z,1.35,.8,1.35,col);cube(out,b.x,1.15,b.z,1.6,.2,1.6,'#e5dfbe');
      if(b.kind==='mine'){for(let i=0;i<4;i++){const a=t*.8+i/4*TAU;cube(out,b.x+Math.sin(a)*.8,1.8,b.z+Math.cos(a)*.8,.35,.6,.35,col,a);}}
      else if(b.kind==='relay'){cube(out,b.x,1.9,b.z,.28,1.5,.28,col);cube(out,b.x,2.4,b.z,1.1,.22,.22,col);}
      else if(b.kind==='frost'){cube(out,b.x,1.9,b.z,.65,1,.65,col,t);ring(out,b.x,1.4,b.z,1.1,col,12);}
      else{cube(out,b.x,1.5,b.z,.8,.55,.8,col,b.yaw);cube(out,b.x+Math.sin(b.yaw)*.5,1.65,b.z+Math.cos(b.yaw)*.5,b.kind==='mortar'?.8:.28,.4,1.5,'#405c51',b.yaw);}
      for(let i=0;i<b.level;i++)cube(out,b.x-.55+i*.5,.45,b.z+1.04,.2,.2,.1,'#efd382');
      if(b.id===towerId){ring(out,b.x,.05,b.z,1.7,'#fff5cf',24);if(d.range)ring(out,b.x,.06,b.z,d.range+(b.level-1)*1.5,'#688f7c',60);}
    }
    for(const u of w.units){const d=UNITS[u.kind];cube(out,u.x,1,u.z,1,.4,1.3,d.color);cube(out,u.x,1.35,u.z,.4,.3,.6,'#edf0ce');
      if(u.kind==='siege')cube(out,u.x,1.5,u.z,.4,.3,1.7,'#826b55');else if(u.kind==='medic')cube(out,u.x,1.5,u.z,1,.15,.2,'#e5ecc2');
      if(selected.includes(u.id)){ring(out,u.x,.05,u.z,1,'#fff4c8',16);if(u.order!=='hold')for(let i=0;i<12;i++){const s=i/12;cube(out,u.x+(u.target.x-u.x)*s,.04,u.z+(u.target.z-u.z)*s,.1,.07,.1,'#6a998b');}}
    }
    if(w.phase!=='ready'){ring(out,w.rally.x,.05,w.rally.z,1,'#839f95',16);cube(out,w.rally.x,.6,w.rally.z,.1,1.2,.1,'#536f63');}
    for(const e of w.enemies){const d=ENEMIES[e.type],r=e.radius,col=e.flash>0?'#fff4d6':d.color;
      if(e.telegraph>0){ring(out,e.x,.1,e.z,r+1,col);continue;}
      cube(out,e.x,1.2,e.z,r*1.5,r*1.4,r*1.5,col,t*.2);
      cube(out,e.x,1.4,e.z+r*.8,r*.8,.14,.1,'#f6e7c2');
      if(e.type==='skitter')for(const side of [-1,1])cube(out,e.x+side*r,1.3,e.z,.7,.1,.7,col);
      else if(e.type==='tank'){cube(out,e.x,.5,e.z,2.3,.5,1.9,'#736878');}
      else if(e.type==='gunner'){cube(out,e.x,1.8,e.z,.3,.3,1.8,'#496d62');}
      else if(e.type==='splitter')for(const side of [-1,1])cube(out,e.x+side*r,1.1,e.z,.5,.6,.5,col);
      else if(e.type==='sapper'){cube(out,e.x,1.8,e.z,.2,1,.2,col);cube(out,e.x,2.2,e.z,1,.2,.2,col);}
      else if(e.type==='charger'){cube(out,e.x+e.aimX,1.2,e.z+e.aimZ,.4,.4,1.4,col,Math.atan2(e.aimX,e.aimZ));}
      else if(e.type==='boss'){for(let i=0;i<6;i++){const a=t*.4+i/6*TAU;cube(out,e.x+Math.cos(a)*2.5,2,e.z+Math.sin(a)*2.5,.5,1.6,.5,col);}ring(out,e.x,.1,e.z,3,col);}
      if(e.elite)ring(out,e.x,2.5,e.z,r+1,'#e7bb6d',16);
      if(e.windup>0)for(let i=0;i<10;i++)cube(out,e.x+e.aimX*i,.1,e.z+e.aimZ*i,.2,.1,.2,'#d47858');
    }
    const p=w.player;
    if(p.respawn===0){const yaw=p.facing,ship=(x,y,z,sx,sy,sz,col)=>cube(out,p.x+Math.cos(yaw)*x+Math.sin(yaw)*z,1.8+y,p.z-Math.sin(yaw)*x+Math.cos(yaw)*z,sx,sy,sz,col,yaw);
      ship(0,0,0,1.1,.4,1.5,p.invulnerable>0?'#ffffe5':'#eef0d9');ship(0,.3,0,.65,.25,.6,'#405f55');ship(0,0,1,.5,.2,.5,'#d49367');ship(-.9,0,-.2,.8,.15,.9,'#d8b279');ship(.9,0,-.2,.8,.15,.9,'#d8b279');
      for(let i=0;i<(w.upgrades.orbit||0);i++){const a=t*3+i/Math.max(1,w.upgrades.orbit)*TAU;cube(out,p.x+Math.sin(a)*3,1.8,p.z+Math.cos(a)*3,.2,.2,1.4,'#f1d192',a);}
    }
    for(const b of w.bullets)cube(out,b.x,1.5,b.z,b.friendly?.16:.3,.15,b.friendly?.8:.3,b.friendly?'#fff0b5':'#d97653',Math.atan2(b.vx,b.vz));
    const dropColors={xp:'#8cb7ae',heal:'#90bb7a',shield:'#9ab7ce',haste:'#dbc578',magnet:'#bea3bd',bomb:'#ce9671',chest:'#d5b268'};
    for(const d of w.drops){const s=d.kind==='xp'?.25:.55;cube(out,d.x,.8+Math.sin(t+d.id)*.1,d.z,s,s,s,dropColors[d.kind]||'#dfc67c',t*.4);}
    for(const e of w.effects){if(e.kind==='beam'&&e.end){for(let i=0;i<16;i++){const s=i/16;cube(out,e.x+(e.end.x-e.x)*s,1.5,e.z+(e.end.z-e.z)*s,.2,.2,.2,e.color);}}else ring(out,e.x,.5,e.z,e.radius*(1-e.life/.4),e.color,24);}
    if(ghost){const col=ghost.valid?'#73a889':'#d48469';cube(out,ghost.x,.8,ghost.z,2,1.6,2,col);ring(out,ghost.x,.05,ghost.z,TOWERS[ghost.kind].range||2,col,48);}
    if(this.software)this.drawSoftware(out);else{
      const gl=this.gl;gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(this.program);gl.uniformMatrix4fv(this.uniform,false,this.matrix);gl.bindVertexArray(this.static.vao);gl.drawArraysInstanced(gl.TRIANGLES,0,36,this.static.count);
      if(out.length>this.data.length){this.data=new Float32Array(out.length*2);gl.bindBuffer(gl.ARRAY_BUFFER,this.dynamic.buffer);gl.bufferData(gl.ARRAY_BUFFER,this.data,gl.DYNAMIC_DRAW);}this.data.set(out);gl.bindBuffer(gl.ARRAY_BUFFER,this.dynamic.buffer);gl.bufferSubData(gl.ARRAY_BUFFER,0,this.data.subarray(0,out.length));gl.bindVertexArray(this.dynamic.vao);gl.drawArraysInstanced(gl.TRIANGLES,0,36,out.length/10);
    }
    this.drawLabels(w,{selected,towerId,box,intro});
  }
  drawSoftware(dynamic){
    const ctx=this.soft,w=this.canvas.width,h=this.canvas.height,m=this.matrix,polys=[];ctx.fillStyle='#ebede0';ctx.fillRect(0,0,w,h);
    for(const data of [this.staticData,dynamic])for(let i=0;i<data.length;i+=10){const [x,y,z,sx,sy,sz,r,g,b,yaw]=data.slice(i,i+10),c=Math.cos(yaw),s=Math.sin(yaw);
      const q=this.point(x,y,z),margin=(sx+sy+sz)*this.width/this.halfHeight;if(q.x<-margin||q.y<-margin||q.x>this.width+margin||q.y>this.height+margin)continue;
      for(const [n,points] of faces){const nx=n[0]*c+n[2]*s,ny=n[1],nz=-n[0]*s+n[2]*c;if(nx*this.view[0]+ny*this.view[1]+nz*this.view[2]<=0)continue;
        let depth=0;const coords=points.map(([vx,vy,vz])=>{const px=x+vx*sx*c+vz*sz*s,py=y+vy*sy,pz=z-vx*sx*s+vz*sz*c;depth+=m[2]*px+m[6]*py+m[10]*pz;return [(m[0]*px+m[4]*py+m[8]*pz+m[12]+1)*w/2,(1-m[1]*px-m[5]*py-m[9]*pz-m[13])*h/2];});
        const shade=.67+.33*Math.max(0,(-nx*.4+ny+nz*.6)/Math.sqrt(1.52)),fog=Math.min(.4,Math.max(0,-y-2)*.04),color=[r,g,b].map((v,j)=>Math.round((v*shade*(1-fog)+SKY[j]*fog)*255));polys.push({coords,depth,color:`rgb(${color})`});
      }
    }
    polys.sort((a,b)=>b.depth-a.depth);for(const p of polys){ctx.beginPath();ctx.moveTo(...p.coords[0]);for(let i=1;i<4;i++)ctx.lineTo(...p.coords[i]);ctx.closePath();ctx.fillStyle=p.color;ctx.fill();}
  }
  drawLabels(w,{selected,towerId,box,intro}){
    const ctx=this.ctx,d=this.labels.width/this.width;ctx.setTransform(d,0,0,d,0,0);ctx.clearRect(0,0,this.width,this.height);ctx.textAlign='center';ctx.font='600 10px ui-monospace, monospace';
    const bar=(a,width,color)=>{const p=this.point(a.x,3.1,a.z);ctx.fillStyle='#465b4d';ctx.fillRect(p.x-width/2,p.y,width,3);ctx.fillStyle=color;ctx.fillRect(p.x-width/2,p.y,width*Math.max(0,a.hp/a.maxHp),3);};
    if(!intro){bar(w.base,55,'#d9b871');for(const t of w.towers)if(t.hp<t.maxHp||t.id===towerId)bar(t,26,'#b5ce99');for(const u of w.units)if(selected.includes(u.id)||u.hp<u.maxHp)bar(u,18,'#a2c4b1');for(const e of w.enemies)if(e.type==='boss'||e.elite||e.hp<e.maxHp)bar(e,e.type==='boss'?65:22,'#d68d6b');}
    RIFTS.forEach((r,i)=>{const p=this.point(r.x,3,r.z);ctx.fillStyle='#8a6b59';ctx.fillText(`RIFT 0${i+1}`,p.x,p.y);});
    const base=this.point(0,4.5,0);ctx.fillStyle='#4d6859';ctx.fillText('JUNCTION / CORE',base.x,base.y);
    if(box){ctx.strokeStyle='#487f6a';ctx.fillStyle='#7dba9930';ctx.fillRect(box.x,box.y,box.w,box.h);ctx.strokeRect(box.x,box.y,box.w,box.h);}
  }
  destroy(){if(!this.gl)return;const gl=this.gl;for(const b of [this.static,this.dynamic]){gl.deleteBuffer(b.buffer);gl.deleteVertexArray(b.vao);}gl.deleteBuffer(this.geometry);gl.deleteProgram(this.program);}
}
