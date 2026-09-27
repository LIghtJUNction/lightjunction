import { ISLANDS, TAU, random } from './world.mjs';

const SKY = [0.91, 0.925, 0.87];
const PALETTE = {
  earth: ['#76615f', '#876b65', '#9b7870', '#b28c7d'],
  turf: ['#cbd3a7', '#b7c98b', '#b7c9bb', '#d4b1a7'],
  stone: '#f3e9cc', ink: '#3d4840', mint: '#7c9d8e', gold: '#ffd277', orange: '#ed794f',
};
const hex = (s) => [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16) / 255);
const cache = new Map();
function color(c) { if (!cache.has(c)) cache.set(c, hex(c)); return cache.get(c); }
function cube(out, x, y, z, sx, sy, sz, c, rotation = 0) {
  const rgb = typeof c === 'string' ? color(c) : c;
  out.push(x, y, z, sx, sy, sz, ...rgb, rotation);
}
function mul(a, b) {
  const out = new Float32Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++)
    for (let k = 0; k < 4; k++) out[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
  return out;
}
function normalize(v) { const n = Math.hypot(...v); return v.map((x) => x / n); }
function cross(a, b) { return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]]; }
function cameraMatrix(cx, cz, halfHeight, aspect, offset) {
  const eye = [cx + 28, 36, cz + 36], target = [cx, 0, cz];
  const z = normalize(eye.map((v, i) => v - target[i]));
  const x = normalize(cross([0, 1, 0], z)), y = cross(z, x);
  const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
  const view = new Float32Array([x[0], y[0], z[0], 0, x[1], y[1], z[1], 0,
    x[2], y[2], z[2], 0, -dot(x, eye), -dot(y, eye), -dot(z, eye), 1]);
  const proj = new Float32Array([1/(halfHeight*aspect),0,0,0, 0,1/halfHeight,0,0,
    0,0,-2/160,0, offset,0,-1,1]);
  return mul(proj, view);
}
const VERTEX = `#version 300 es
precision highp float;
layout(location=0) in vec3 aPosition;
layout(location=1) in vec3 aNormal;
layout(location=2) in vec3 iPosition;
layout(location=3) in vec3 iScale;
layout(location=4) in vec3 iColor;
layout(location=5) in float iRotation;
uniform mat4 uMatrix;
out vec3 vColor;
out float vDepth;
void main() {
  float c=cos(iRotation), s=sin(iRotation);
  mat3 rot=mat3(c,0.,-s, 0.,1.,0., s,0.,c);
  vec3 pos=rot*(aPosition*iScale)+iPosition;
  vec3 n=rot*aNormal;
  float light=.68+.32*max(0.,dot(n,normalize(vec3(-.4,1.,.6))));
  vColor=iColor*light;
  vDepth=max(0.,-pos.y-3.);
  gl_Position=uMatrix*vec4(pos,1.);
}`;
const FRAGMENT = `#version 300 es
precision highp float;
in vec3 vColor;
in float vDepth;
out vec4 outColor;
void main() {
  vec3 col=mix(vColor,vec3(.91,.925,.87),clamp(vDepth*.04,0.,.4));
  outColor=vec4(col,1.);
}`;
function geometry() {
  const out = [];
  const faces = [
    [[1,0,0], [[.5,-.5,-.5],[.5,.5,-.5],[.5,.5,.5],[.5,-.5,.5]]],
    [[-1,0,0], [[-.5,-.5,.5],[-.5,.5,.5],[-.5,.5,-.5],[-.5,-.5,-.5]]],
    [[0,1,0], [[-.5,.5,-.5],[-.5,.5,.5],[.5,.5,.5],[.5,.5,-.5]]],
    [[0,-1,0], [[-.5,-.5,.5],[-.5,-.5,-.5],[.5,-.5,-.5],[.5,-.5,.5]]],
    [[0,0,1], [[-.5,-.5,.5],[.5,-.5,.5],[.5,.5,.5],[-.5,.5,.5]]],
    [[0,0,-1], [[.5,-.5,-.5],[-.5,-.5,-.5],[-.5,.5,-.5],[.5,.5,-.5]]],
  ];
  for (const [normal, points] of faces) for (const i of [0,1,2,0,2,3]) out.push(...points[i], ...normal);
  return new Float32Array(out);
}
function shader(gl, type, source) {
  const s = gl.createShader(type);
  if (!s) throw new Error('无法创建着色器');
  gl.shaderSource(s, source); gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(s); gl.deleteShader(s); throw new Error(info || '着色器编译失败');
  }
  return s;
}
function terrain() {
  const out = [], rng = random(804);
  for (const [index, island] of ISLANDS.entries()) {
    for (let x = -7; x <= 7; x++) for (let z = -7; z <= 7; z++) {
      const d = Math.hypot(x, z);
      if (d > island.radius + (rng() - .5) * .7) continue;
      const h = .6 + Math.floor((island.radius - d) * .5) * .7 + rng() * .3;
      cube(out, island.x+x, -1-h/2, island.z+z, 1, h, 1, PALETTE.earth[Math.floor(rng()*4)]);
      cube(out, island.x+x, -.84, island.z+z, .99, .3, .99, PALETTE.turf[index]);
      if (d > 2.4 && d < island.radius-1 && rng() < .1) {
        const rock = rng() < .55;
        const y = rock ? -.4 : .05;
        cube(out, island.x+x, y, island.z+z, rock?.5:.2, rock?.5:1.3, rock?.5:.2,
          rock?'#e8debc':'#837c5d');
        if (!rock) {
          cube(out, island.x+x, .7, island.z+z, 1, .85, 1, index===3?'#dcaa9c':'#879d70');
          cube(out, island.x+x+.15, 1.2, island.z+z, .65, .4, .65, index===3?'#ebc4ad':'#a7b785');
        }
      }
    }
    // Runic pedestal and four corner lights.
    cube(out, island.x, -.42, island.z, 2.8, .5, 2.8, PALETTE.ink);
    cube(out, island.x, -.13, island.z, 2.1, .1, 2.1, PALETTE.stone);
    for (const x of [-1,1]) for (const z of [-1,1])
      cube(out, island.x+x, .1, island.z+z, .23, .4, .23, PALETTE.orange);
  }
  // Clouds are separate little voxel clusters, not a flat image or an opaque fog wall.
  for (let i = 0; i < 23; i++) {
    const x = (rng()-.5)*80, z=(rng()-.5)*80, y=-5-rng()*5;
    for (let j=0;j<5;j++) cube(out,x+(rng()-.5)*5,y+rng(),z+(rng()-.5)*3,
      2+rng()*2,.7+rng(),1+rng()*2, '#f1efdf');
  }
  // Stepping-light paths between destinations.
  const route = [0,1,2,3,0];
  for(let j=0;j<route.length-1;j++) {
    const a=ISLANDS[route[j]], b=ISLANDS[route[j+1]];
    for(let i=1;i<16;i++) {
      const t=i/16, x=a.x+(b.x-a.x)*t, z=a.z+(b.z-a.z)*t;
      if (Math.hypot(x-a.x,z-a.z)<a.radius+1 || Math.hypot(x-b.x,z-b.z)<b.radius+1) continue;
      cube(out,x,-.7,z,.25,.12,.25,'#90a99b');
    }
  }
  return out;
}
export class VoxelRenderer {
  constructor(canvas, labels, reducedMotion = false) {
    this.canvas=canvas; this.labels=labels; this.reducedMotion=reducedMotion;
    this.labelContext=labels.getContext('2d');
    if(!this.labelContext)throw new Error('无法创建标签画布。作品与联系入口仍然可以访问。');
    this.gl=canvas.getContext('webgl2',{alpha:false,antialias:false,powerPreference:'low-power'});
    this.staticData=terrain();
    this.software=!this.gl;
    if(this.software) {
      this.context=canvas.getContext('2d',{alpha:false});
      if(!this.context) throw new Error('这台设备无法创建绘图画布。作品与联系入口仍然可以访问。');
      this.static={count:this.staticData.length/10};
    } else {
    const gl=this.gl;
    const vs=shader(gl,gl.VERTEX_SHADER,VERTEX), fs=shader(gl,gl.FRAGMENT_SHADER,FRAGMENT);
    this.program=gl.createProgram(); gl.attachShader(this.program,vs); gl.attachShader(this.program,fs);
    gl.linkProgram(this.program); gl.deleteShader(vs); gl.deleteShader(fs);
    if(!gl.getProgramParameter(this.program,gl.LINK_STATUS)) throw new Error('3D 场景初始化失败');
    this.matrixUniform=gl.getUniformLocation(this.program,'uMatrix');
    this.geometry=gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,this.geometry);
    gl.bufferData(gl.ARRAY_BUFFER,geometry(),gl.STATIC_DRAW);
    this.static=this.batch(new Float32Array(this.staticData),true);
    this.dynamic=this.batch(new Float32Array(24000),false);
    this.dynamicData=new Float32Array(24000);
    gl.enable(gl.DEPTH_TEST); gl.clearColor(...SKY,1);
    }
    this.cx=1; this.cz=-5; this.halfHeight=29; this.offset=0;
    this.particles=[]; this.trails=[]; this.pixelSize=2;
    this.width=1;this.height=1;this.matrix=new Float32Array(16);
  }
  batch(data, fixed) {
    const gl=this.gl, vao=gl.createVertexArray(), buffer=gl.createBuffer();
    gl.bindVertexArray(vao); gl.bindBuffer(gl.ARRAY_BUFFER,this.geometry);
    for(let i=0;i<2;i++) { gl.enableVertexAttribArray(i);gl.vertexAttribPointer(i,3,gl.FLOAT,false,24,i*12); }
    gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,data,fixed?gl.STATIC_DRAW:gl.DYNAMIC_DRAW);
    for(const [loc,size,off] of [[2,3,0],[3,3,12],[4,3,24],[5,1,36]]) {
      gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,size,gl.FLOAT,false,40,off);gl.vertexAttribDivisor(loc,1);
    }
    return {vao,buffer,count:fixed?data.length/10:0,capacity:data.length};
  }
  resize() {
    const w=this.canvas.clientWidth,h=this.canvas.clientHeight;
    this.width=w;this.height=h;
    const scale=Math.max(this.pixelSize,w/1000);
    const rw=Math.max(1,Math.round(w/scale)),rh=Math.max(1,Math.round(h/scale));
    if(this.canvas.width!==rw||this.canvas.height!==rh) {
      this.canvas.width=rw;this.canvas.height=rh;if(this.gl)this.gl.viewport(0,0,rw,rh);
    }
    const dpr=Math.min(devicePixelRatio||1,2);
    if(this.labels.width!==Math.round(w*dpr)||this.labels.height!==Math.round(h*dpr)) {
      this.labels.width=Math.round(w*dpr);this.labels.height=Math.round(h*dpr);
    }
  }
  project(x,y,z) {
    const m=this.matrix;
    return {x:((m[0]*x+m[4]*y+m[8]*z+m[12])+1)*this.width/2,
      y:(1-(m[1]*x+m[5]*y+m[9]*z+m[13]))*this.height/2};
  }
  burst(x,z,c,count=14) {
    if(this.reducedMotion) return;
    for(let i=0;i<count && this.particles.length<220;i++) {
      const a=Math.random()*TAU;
      this.particles.push({x,y:2,z,vx:Math.cos(a)*(2+Math.random()*5),vy:2+Math.random()*3,
        vz:Math.sin(a)*(2+Math.random()*5),life:.5+Math.random()*.4,c});
    }
  }
  render(state,dt,clock) {
    this.resize();
    const out=[], p=state.player, intro=state.phase==='ready', mobile=this.width<760;
    const frozen=state.phase==='paused'||state.phase==='won'||state.phase==='lost';
    const tick=this.reducedMotion?0:(frozen?state.time:clock);
    const visualDelta=frozen?0:Math.min(dt,.05);
    const smooth=this.reducedMotion?1:1-Math.exp(-dt*2.7);
    this.cx+=((intro?1:p.x+p.vx*.35)-this.cx)*smooth;
    this.cz+=((intro?-5:p.z+p.vz*.35)-this.cz)*smooth;
    const scale=intro?(mobile?36:26):(mobile?16:13.5);
    this.halfHeight+=(scale-this.halfHeight)*smooth;
    this.offset+=((intro&&!mobile?.29:0)-this.offset)*smooth;
    this.matrix=cameraMatrix(this.cx,this.cz,this.halfHeight,this.width/this.height,this.offset);
    if(intro&&mobile)this.matrix[13]+=.52;
    // Collectible glyphs orbit above the island's floor.
    for(const token of state.tokens) if(!token.taken) {
      const bob=this.reducedMotion?0:Math.sin(tick*2.5+token.phase)*.18;
      cube(out,token.x,1.8+bob,token.z,.3,.3,.3,PALETTE.gold,tick*.9+token.phase);
      cube(out,token.x,1.8+bob,token.z,.09,.62,.09,'#fff4c2');
    }
    for(const [index,island] of ISLANDS.entries()) {
      const lit=index===0?state.beacons.every(b=>b.active):state.beacons[index-1].active;
      const col=lit?'#f5c06a':'#e3e3c2';
      if(index) {
        cube(out,island.x,.6,island.z,.7,1.4,.7,PALETTE.ink);
        cube(out,island.x,1.75,island.z,.72,.72,.72,col,tick*.4);
        cube(out,island.x,1.75,island.z,1.2,.12,1.2,col,tick*.4);
      }
      for(let i=0;i<12;i++) {
        const a=i/12*TAU+(this.reducedMotion?0:tick*.25),r=index?1.6:2.1;
        cube(out,island.x+Math.cos(a)*r,lit?2.5:0,island.z+Math.sin(a)*r,.22,.22,.22,col);
      }
      if(lit) for(let i=0;i<8;i++) {
        const y=(i*.7+tick*.8)%6;
        cube(out,island.x+Math.sin(i*2)*.4,y,island.z+Math.cos(i*2)*.4,.12,.36,.12,'#efd298');
      }
    }
    for(const e of state.enemies) if(e.dead<=0) {
      const y=1.8+Math.sin(tick*3+e.phase)*.22;
      cube(out,e.x,y,e.z,.85,.85,.85,'#c86254',tick);
      cube(out,e.x,y,e.z,1.5,.2,.2,'#934b49',tick);
      cube(out,e.x,y,e.z,.2,1.5,.2,'#934b49',tick);
    }
    // Tiny voxel courier. It flies above the islands, so scenery never blocks movement.
    const hover=this.reducedMotion?0:Math.sin(tick*5)*.09, y=2.2+hover, yaw=p.facing;
    cube(out,p.x,-.57,p.z,1.8,.04,1.2,'#8e9880',yaw);
    const ship=(x,dy,z,sx,sy,sz,c)=>cube(out,p.x+Math.cos(yaw)*x+Math.sin(yaw)*z,y+dy,
      p.z-Math.sin(yaw)*x+Math.cos(yaw)*z,sx,sy,sz,c,yaw);
    const blink=p.invulnerable>0&&Math.floor(tick*12)%2===0;
    ship(0,0,0,1.1,.45,1.4,blink?'#ffffff':'#edf0dd');
    ship(0,.3,.12,.65,.28,.65,'#3d5551');
    ship(0,0,.87,.5,.22,.4,'#ec875a');
    ship(-.9,-.04,-.15,.8,.18,.8,'#e4b47c');ship(.9,-.04,-.15,.8,.18,.8,'#e4b47c');
    ship(-.62,.06,-.65,.2,.25,.2,'#f59b67');ship(.62,.06,-.65,.2,.25,.2,'#f59b67');
    if(!frozen&&Math.hypot(p.vx,p.vz)>1) {
      this.trails.push({x:p.x-Math.sin(yaw),z:p.z-Math.cos(yaw),life:.3});
      if(this.trails.length>24)this.trails.shift();
    }
    for(const t of this.trails) {t.life-=visualDelta;cube(out,t.x,2,t.z,t.life*1.5,.1,t.life*1.5,'#ebbc73');}
    this.trails=this.trails.filter(t=>t.life>0);
    // The collected tokens remain as a little living cloud around their courier.
    for(let i=0;i<Math.min(20,state.inventory);i++) {
      const a=i*2.4+tick*.7, r=1.6+(i%3)*.26;
      cube(out,p.x+Math.cos(a)*r,2.6+Math.sin(a*1.7)*.4,p.z+Math.sin(a)*r,.13,.13,.13,'#efbc68',a);
    }
    if(state.pulse>0) for(let i=0;i<40;i++) {
      const a=i/40*TAU,r=8*(1-state.pulse/.7);
      cube(out,state.pulseOrigin.x+Math.cos(a)*r,1.1,state.pulseOrigin.z+Math.sin(a)*r,.25,.15,.25,'#90bca6');
    }
    for(const q of this.particles) {
      q.life-=visualDelta;q.x+=q.vx*visualDelta;q.z+=q.vz*visualDelta;q.y+=q.vy*visualDelta;q.vy-=9*visualDelta;
      const s=Math.max(0,q.life*.35);cube(out,q.x,q.y,q.z,s,s,s,q.c);
    }
    this.particles=this.particles.filter(q=>q.life>0);
    if(this.software) { this.drawSoftware(out); } else {
    const gl=this.gl;
    gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(this.program);
    gl.uniformMatrix4fv(this.matrixUniform,false,this.matrix);
    gl.bindVertexArray(this.static.vao);gl.drawArraysInstanced(gl.TRIANGLES,0,36,this.static.count);
    if(out.length>this.dynamicData.length) {
      this.dynamicData=new Float32Array(out.length*2);
      gl.bindBuffer(gl.ARRAY_BUFFER,this.dynamic.buffer);gl.bufferData(gl.ARRAY_BUFFER,this.dynamicData,gl.DYNAMIC_DRAW);
    }
    this.dynamicData.set(out);
    gl.bindBuffer(gl.ARRAY_BUFFER,this.dynamic.buffer);
    gl.bufferSubData(gl.ARRAY_BUFFER,0,this.dynamicData.subarray(0,out.length));
    gl.bindVertexArray(this.dynamic.vao);gl.drawArraysInstanced(gl.TRIANGLES,0,36,out.length/10);
    }
    this.drawLabels(state,tick,intro);
  }
  /** Same 3D geometry and camera on devices without WebGL. No network or asset fallback. */
  drawSoftware(dynamic) {
    const ctx=this.context,w=this.canvas.width,h=this.canvas.height,m=this.matrix;
    ctx.fillStyle='#e8ecde';ctx.fillRect(0,0,w,h);
    const faces=[],light=normalize([-.4,1,.6]);
    const faceData=[
      {normal:[1,0,0],corners:[[.5,-.5,-.5],[.5,.5,-.5],[.5,.5,.5],[.5,-.5,.5]]},
      {normal:[-1,0,0],corners:[[-.5,-.5,.5],[-.5,.5,.5],[-.5,.5,-.5],[-.5,-.5,-.5]]},
      {normal:[0,1,0],corners:[[-.5,.5,-.5],[-.5,.5,.5],[.5,.5,.5],[.5,.5,-.5]]},
      {normal:[0,0,1],corners:[[-.5,-.5,.5],[.5,-.5,.5],[.5,.5,.5],[-.5,.5,.5]]},
      {normal:[0,0,-1],corners:[[.5,-.5,-.5],[-.5,-.5,-.5],[-.5,.5,-.5],[.5,.5,-.5]]},
    ];
    for(const data of [this.staticData,dynamic])for(let i=0;i<data.length;i+=10) {
      const [x,y,z,sx,sy,sz,r,g,b,yaw]=data.slice(i,i+10);
      if(sx<=0||sy<=0||sz<=0)continue;
      const c=Math.cos(yaw),s=Math.sin(yaw);
      const centerX=(m[0]*x+m[4]*y+m[8]*z+m[12]+1)*w/2;
      const centerY=(1-m[1]*x-m[5]*y-m[9]*z-m[13])*h/2;
      const margin=(sx+sy+sz)*w/this.halfHeight;
      if(centerX < -margin || centerX > w+margin || centerY < -margin || centerY > h+margin)continue;
      for(const face of faceData) {
        const [nx,ny,nz]=face.normal,normal=[nx*c+nz*s,ny,-nx*s+nz*c];
        if(normal[0]*28+normal[1]*36+normal[2]*36<=0)continue;
        const points=[];let depth=0;
        for(const [vx,vy,vz] of face.corners) {
          const wx=x+vx*sx*c+vz*sz*s,wy=y+vy*sy,wz=z-vx*sx*s+vz*sz*c;
          points.push([Math.round((m[0]*wx+m[4]*wy+m[8]*wz+m[12]+1)*w/2),
            Math.round((1-m[1]*wx-m[5]*wy-m[9]*wz-m[13])*h/2)]);
          depth+=m[2]*wx+m[6]*wy+m[10]*wz;
        }
        const shade=.68+.32*Math.max(0,normal[0]*light[0]+normal[1]*light[1]+normal[2]*light[2]);
        const fog=Math.min(.4,Math.max(0,-y-3)*.04);
        const rgb=[r,g,b].map((v,j)=>Math.round((v*shade*(1-fog)+SKY[j]*fog)*255));
        faces.push({points,depth,color:`rgb(${rgb.join(',')})`});
      }
    }
    faces.sort((a,b)=>b.depth-a.depth);
    for(const f of faces) {
      ctx.beginPath();ctx.moveTo(...f.points[0]);for(let j=1;j<4;j++)ctx.lineTo(...f.points[j]);
      ctx.closePath();ctx.fillStyle=f.color;ctx.fill();
    }
  }
  drawLabels(state,tick,intro) {
    const ctx=this.labelContext,dpr=this.labels.width/this.width;
    ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,this.width,this.height);
    ctx.textAlign='center';
    const words=['<think>','01','token','{ }','云','return','0xFF','</>'];
    state.tokens.forEach((t,i)=>{
      if(t.taken||i%7!==0)return;
      const point=this.project(t.x,2.8+Math.sin(tick+t.phase)*.25,t.z);
      ctx.font='600 10px ui-monospace, monospace';ctx.fillStyle='#796f4a';
      ctx.globalAlpha=intro?.55:.65;ctx.fillText(words[(i/7)%words.length|0],point.x,point.y);
    });
    ctx.globalAlpha=1;
    ISLANDS.forEach((island,i)=>{
      const q=this.project(island.x,4.1,island.z);
      if(q.x<20||q.x>this.width-20||q.y<85||q.y>this.height-140)return;
      if(intro&&(this.width<760?q.y>this.height*.43:q.x<this.width*.38))return;
      const active=i?state.beacons[i-1].active:state.beacons.every(b=>b.active);
      ctx.font='600 11px ui-monospace, monospace';
      const text=i?`${active?'◆':'◇'} ${island.name} ${active?'':island.cost+' TK'}`:'⌂ 归航港';
      const w=ctx.measureText(text).width+20;
      if(q.x<w/2+8||q.x>this.width-w/2-8)return;
      ctx.fillStyle='#e9ecde';ctx.fillRect(q.x-w/2,q.y-15,w,25);
      ctx.fillStyle=active?'#9e5b39':'#465349';ctx.fillText(text,q.x,q.y+1);
    });
  }
  destroy() {
    if(this.software){this.particles=[];this.trails=[];return;}
    const gl=this.gl;
    for(const b of [this.static,this.dynamic]){gl.deleteBuffer(b.buffer);gl.deleteVertexArray(b.vao);}
    gl.deleteBuffer(this.geometry);gl.deleteProgram(this.program);
    this.particles=[];this.trails=[];
  }
}
