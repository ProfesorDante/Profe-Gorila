'use strict';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const VIEW_W = canvas.width;
const VIEW_H = canvas.height;
const BASE_WORLD_W = 2100;
const BASE_WORLD_H = 1180;
let WORLD_W = BASE_WORLD_W;
let WORLD_H = BASE_WORLD_H;
let mapScale = 1;
const CLASSMATES = ['Franchu','Martu','Lucy','Jose','Samy','Ori','Rousy','Vicky chiquita','Vicky grande','Anto','Vitti','Ramirito','Santi','Francis','Leandrus','Feli','Beltru','Lauti'];
const keys = {};
const joy = {x:0,y:0,active:false,id:null};

let level = 1;
let unlocked = Number(localStorage.getItem('tinaFlagUnlocked') || 1);
let running = false;
let last = 0;
let timeLeft = 110;
let musicOn = true;
let audioCtx = null;
let musicTimer = null;
let musicStep = 0;
let musicBar = 0;
let noiseBuffer = null;
let player, bots = [], guardians = [], traps = [], bananas = [], objects = [], obstacles = [];
let flag, homeFlag, enemyBase, homeBase, particles = [], shake = 0;
let levelElapsed = 0;
let director = null;
let lastActionAt = 0;
let stats = {jumpsUsed:0,hits:0,bananas:0};
let camera = {x:0,y:0};
let progression = {jumpCap:1,recharge:5,jumpDistance:145};
let duelMode=false, duelScore={tina:0,nito:0}, duelRound=1, duelRoundReset=0;
let duelCountdownTimer=null;

const upgrades = [
  {at:2,type:'cap',text:'¡Ahora podés guardar 2 saltos!'},
  {at:4,type:'recharge',text:'¡La recarga bajó a 4 segundos!'},
  {at:6,type:'distance',text:'¡El salto ahora llega a distancia media!'},
  {at:8,type:'cap',text:'¡Ahora podés guardar 3 saltos!'},
  {at:10,type:'recharge',text:'¡La recarga bajó a 3 segundos!'},
  {at:12,type:'distance',text:'¡El salto ahora llega a distancia larga!'},
  {at:14,type:'cap',text:'¡Ahora podés guardar 4 saltos!'},
  {at:16,type:'recharge',text:'¡La recarga bajó a 2 segundos!'}
];

function recalcProgression(n){
  progression = {jumpCap:1,recharge:5,jumpDistance:145};
  for(const u of upgrades){
    if(n > u.at){
      if(u.type === 'cap') progression.jumpCap++;
      if(u.type === 'recharge') progression.recharge--;
      if(u.type === 'distance') progression.jumpDistance += 70;
    }
  }
  updateUpgradeHud();
}

function updateUpgradeHud(){
  jumpCapLabel.textContent = progression.jumpCap;
  rechargeLabel.textContent = progression.recharge + ' s';
  distanceLabel.textContent = progression.jumpDistance < 180 ? 'Corta' : progression.jumpDistance < 250 ? 'Media' : 'Larga';
}

function resetLevel(n = level){
  duelMode=false;
  level = n;
  // Desde el nivel 8 el bosque deja de crecer hacia todos lados: evita mapas enormes y mejora celulares.
  mapScale = Math.min(1.32, Math.pow(1.15, Math.floor((level - 1) / 3)));
  WORLD_W = Math.round(BASE_WORLD_W * mapScale);
  WORLD_H = Math.round(BASE_WORLD_H * mapScale);
  recalcProgression(level);
  levelLabel.textContent = level;
  bananaLabel.textContent = 0;
  flagLabel.textContent = 'En juego';
  missionTitle.textContent = `Nivel ${level}: contra ${CLASSMATES[level-1]}`;
  missionText.textContent = 'Tomá la bandera rival y defendé la tuya.';
  timeLeft = 125 - Math.min(level * .8, 14);
  levelElapsed = 0;
  lastActionAt = 0;
  director = makeDirector();
  stats = {jumpsUsed:0,hits:0,bananas:0};
  running = false;

  homeBase = {x:80*mapScale,y:WORLD_H/2-115*mapScale,w:150*mapScale,h:230*mapScale};
  enemyBase = {x:WORLD_W-230*mapScale,y:WORLD_H/2-115*mapScale,w:150*mapScale,h:230*mapScale};
  player = {
    id:'tina',x:250*mapScale,y:WORLD_H/2,r:22,vx:1,vy:0,speed:235,
    jumps:progression.jumpCap,recharge:0,jump:null,inv:0,stun:0,
    bananas:0,carrying:null,flagHP:0,slow:0,speedBoost:0
  };
  flag = {kind:'enemy',x:enemyBase.x+75,y:WORLD_H/2,homeX:enemyBase.x+75,homeY:WORLD_H/2,r:18,carrier:null,dropped:false};
  homeFlag = {kind:'home',x:homeBase.x+75,y:WORLD_H/2,homeX:homeBase.x+75,homeY:WORLD_H/2,r:18,carrier:null,dropped:false};

  obstacles = makeOrganicMaze();
  bots = [];
  const botCount = level <= 4 ? 1 : level <= 12 ? 2 : 3;
  player.flagMaxHP = (botCount + 2) * 2; // 3, 4 o 5 corazones para Tina
  for(let i=0;i<botCount;i++) bots.push(makeBot(i));
  guardians = makeGuardians();
  traps = makeTraps();
  bananas = makeBananas();
  objects = makeObjects();
  particles = [];
  camera.x = clamp(player.x - VIEW_W/2, 0, Math.max(0,WORLD_W - VIEW_W));
  camera.y = clamp(player.y - VIEW_H/2, 0, Math.max(0,WORLD_H - VIEW_H));
  updateJumpUI();
  draw();
}

function makeOrganicMaze(){
  const raw=[];
  const add=(x,y,w,h,type='hedge',low=false,breakable=true)=>raw.push({x,y,w,h,type,low,breakable});
  add(0,0,BASE_WORLD_W,55,'trees',false,false); add(0,BASE_WORLD_H-55,BASE_WORLD_W,55,'trees',false,false);
  add(0,0,55,BASE_WORLD_H,'trees',false,false); add(BASE_WORLD_W-55,0,55,BASE_WORLD_H,'trees',false,false);
  const design=Math.floor((level-1)/3); // seis bosques
  const variant=(level-1)%3;            // conocer, aplicar, dominar
  const layouts=[
    [[310,135,480,70],[760,135,70,245],[1120,185,460,70],[1540,185,70,250],[360,650,210,68],[680,780,390,70],[1030,975,440,70]],
    [[300,150,360,70],[630,150,70,250],[850,260,430,70],[1250,120,70,260],[1490,260,330,70],[390,760,370,70],[730,650,70,250],[1000,820,420,70],[1390,690,70,250]],
    [[250,180,260,105,'rock'],[600,120,70,310],[810,250,280,90,'rock'],[1180,130,70,330],[1400,220,330,100,'rock'],[300,780,300,100,'rock'],[690,700,70,300],[930,860,300,95,'rock'],[1350,720,70,300],[1550,820,260,95,'rock']],
    [[280,135,430,70],[680,135,70,220],[870,330,320,60,'log',true],[1160,135,70,220],[1420,135,420,70],[340,800,410,70],[720,700,70,250],[960,790,300,60,'log',true],[1230,700,70,250],[1470,850,340,70]],
    [[260,140,300,70],[540,140,70,300],[790,250,340,70],[1110,140,70,300],[1370,140,420,70],[340,790,310,70],[630,650,70,300],[890,820,340,70],[1210,650,70,300],[1490,790,330,70]],
    [[250,150,420,70],[640,150,70,230],[830,300,360,70],[1160,150,70,230],[1430,150,380,70],[270,820,380,70],[620,700,70,260],[860,850,360,70],[1190,700,70,260],[1480,820,330,70],[880,485,70,210],[1190,485,70,210]]
  ];
  for(const item of layouts[design]) add(...item);
  // Centro común: peligroso pero con espacio para esquivar.
  add(430,455,230,62,'log',true); add(760,485,70,190); add(1015,435,70,240); add(1270,485,70,190); add(1460,455,230,62,'log',true);
  if(variant>=1){
    add(520,330,90,70); add(1450,740,90,70); add(820,810,170,60,'log',true); add(1160,300,170,60,'log',true);
  }
  if(variant>=2){
    add(690,390,95,80,'rock'); add(1320,690,95,80,'rock'); add(920,210,180,65); add(1050,910,180,65);
  }
  add(900,85,220,82,'flowers'); add(880,1030,250,78,'flowers');
  // A partir del nivel 8, dos troncos bajos cortan la 'autopista' central sin cerrar rutas.
  if(level>=8){
    const shift=(variant-1)*95;
    add(900+shift,365,190,52,'log',true,true);
    add(1080-shift,735,190,52,'log',true,true);
  }
  // Los laterales crecen junto al mapa, pero nunca se convierten en autopistas vacías.
  const edgeDensity=2+design+variant;
  for(let i=0;i<edgeDensity;i++){
    const x=360+i*(1260/Math.max(1,edgeDensity-1));
    const wobble=(i%2)*70;
    add(x,82+wobble,92,68,'rock',false,true);
    add(x+55,BASE_WORLD_H-150-wobble,104,72,'rock',false,true);
  }
  return raw.map(o=>({...o,x:o.x*mapScale,y:o.y*mapScale,w:o.w*mapScale,h:o.h*mapScale}));
}

function findSafePoint(x,y,r){
  if(!collidesObstacle(x,y,r,false)) return {x,y};
  for(let ring=1;ring<=12;ring++){
    const radius=ring*34*mapScale;
    for(let a=0;a<16;a++){
      const ang=(Math.PI*2*a)/16;
      const tx=clamp(x+Math.cos(ang)*radius,r+58,WORLD_W-r-58);
      const ty=clamp(y+Math.sin(ang)*radius,r+58,WORLD_H-r-58);
      if(!collidesObstacle(tx,ty,r,false)) return {x:tx,y:ty};
    }
  }
  return {x:enemyBase.x-55*mapScale,y:WORLD_H/2};
}

function botPersonalityFor(levelNumber,index,botCount){
  if(levelNumber===1)return 'tutorial';
  if(levelNumber===2)return 'standard';
  if(levelNumber===3)return 'strategist';
  if(levelNumber===4)return 'offensive';
  if(botCount===2){
    const lead=['standard','strategist','offensive','prankster'][(levelNumber-5)%4];
    return index===0?lead:'defensive';
  }
  // Con tres rivales siempre hay al menos uno ofensivo y uno defensivo.
  return ['offensive','defensive',levelNumber%2?'strategist':'prankster'][index]||'standard';
}

function makeBot(i){
  const ys=[350,590,830].map(v=>v*mapScale);
  const botCount = level <= 4 ? 1 : level <= 12 ? 2 : 3;
  const jumpCap = progression.jumpCap>=3 ? 2 : 1;
  const jumpRecharge = progression.recharge<=3 ? 4 : 5;
  const spawn=findSafePoint(WORLD_W-(315+i*54)*mapScale,ys[i%3],20);
  return {
    id:'bot'+i,name:CLASSMATES[(level-1+i)%CLASSMATES.length],personality:botPersonalityFor(level,i,botCount),
    x:spawn.x,y:spawn.y,spawnX:spawn.x,spawnY:spawn.y,r:20,speed:148+level*3.1,
    stun:0,inv:0,bananas:0,dirTimer:0,roamX:WORLD_W-450*mapScale,roamY:ys[i%3],
    navPath:[],navTimer:0,stuckTime:0,lastX:spawn.x,lastY:spawn.y,
    jumps:jumpCap,jumpCap,jumpRecharge,jumpCharge:0,jump:null,vx:-1,vy:0,
    carrying:null,flagHP:0,flagMaxHP:6,state:'neutral',decisionTimer:0,recoveryTimer:0,
    observedPlayerTrouble:0
  };
}

function makeGuardians(){
  const count=level<=6?3:level<=12?4:5;
  const roster=['gorilla','turtle','elephant','parrot','sloth'];
  const growth=Math.pow(1.05,Math.floor((level-1)/3));
  const positions=[[720,520],[930,670],[1160,510],[1370,670],[1510,500]];
  return roster.slice(0,count).map((type,i)=>{
    const [px,py]=positions[i];
    const r=type==='elephant'?31:type==='gorilla'?29:type==='turtle'?27:25;
    const baseV=type==='elephant'?128:type==='gorilla'?138:type==='turtle'?116:type==='parrot'?108:98;
    const safe=findSafePoint(px*mapScale,py*mapScale,r+9);
    return {
      type,x:safe.x,y:safe.y,spawnX:safe.x,spawnY:safe.y,r,v:(baseV+level*2.5)*growth,dir:i%2? -1:1,
      target:null,targetCheck:0,lock:0,navPath:[],navTimer:0,
      jump:null,jumpCharge:0,jumpCap:progression.jumpCap>=3?2:1,jumps:progression.jumpCap>=3?2:1,
      jumpRecharge:progression.recharge<=3?4:5,phase:i*1.7,stuckTime:0,lastX:safe.x,lastY:safe.y,
      recoveryTimer:0,sleeping:false,perchIndex:0
    };
  });
}

function makeTraps(){
  const out=[];
  const points=[
    [430,235],[650,260],[900,285],[1210,325],[1460,330],[1680,520],
    [420,930],[620,880],[820,915],[1160,900],[1390,940],[1670,760]
  ];
  points.forEach((p,i)=>out.push({x:p[0]*mapScale,y:p[1]*mapScale,r:24,type:i%3===0?'mud':i%3===1?'log':'vine'}));
  if(level>7){out.push({x:1010*mapScale,y:235*mapScale,r:24,type:'mud'},{x:1510*mapScale,y:960*mapScale,r:24,type:'vine'});}
  return out;
}

function makeBananas(){
  const out=[];
  const pts=[
    [320,220],[520,250],[700,330],[940,225],[1200,300],[1450,250],[1750,430],
    [330,940],[540,860],[780,960],[980,880],[1240,960],[1480,920],[1760,760],
    [610,590],[840,610],[1040,575],[1280,625],[1510,585]
  ];
  pts.forEach((p,i)=>out.push({x:p[0]*mapScale,y:p[1]*mapScale,r:13,got:false,value:i%7===0?3:1}));
  return out;
}

function makeObjects(){
  const pts=[
    [720,215,'helmet'],[1180,860,'skateboard'],[1510,600,'shoes'],
    [930,585,'coconut'],[1320,320,'helmet'],[510,900,'skateboard']
  ];
  return pts.map(([x,y,type])=>({x:x*mapScale,y:y*mapScale,r:17,type,got:false}));
}

function startLevel(n=level){
  level=n;
  hideAllOverlays();
  if(n===19){startDuel();return;}
  resetLevel(n);
  running=true;
  last=performance.now();
  startMusic();
  requestAnimationFrame(loop);
}

function loop(t){
  if(!running) return;
  const dt=Math.min(.03,(t-last)/1000 || 0);
  last=t;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

function update(dt){
  if(duelMode&&duelRoundReset>0){duelRoundReset-=dt;if(duelRoundReset<=0)resetDuelRound();}
  timeLeft -= dt;
  levelElapsed += dt;
  // Inmunidad específica tras escapar del abrazo del perezoso.
  for(const e of [player,...bots]) if(e&&e.slothImmune>0) e.slothImmune=Math.max(0,e.slothImmune-dt);
  if(timeLeft<=0){finishByTime();return;}
  updatePlayer(dt);
  updateBots(dt);
  updateGuardians(dt);
  updateDirector(dt);
  updateParticles(dt);
  updateCamera(dt);
  checkWorld();
}

function getInputVector(){
  let dx=(keys.ArrowRight||keys.d||keys.D?1:0)-(keys.ArrowLeft||keys.a||keys.A?1:0)+joy.x;
  let dy=(keys.ArrowDown||keys.s||keys.S?1:0)-(keys.ArrowUp||keys.w||keys.W?1:0)+joy.y;
  const len=Math.hypot(dx,dy);
  if(len>1){dx/=len;dy/=len;}
  return {x:dx,y:dy,len:Math.min(1,len)};
}

function updatePlayer(dt){
  if(player.stun>0){player.stun-=dt; if(player.inv>0)player.inv-=dt; return;}
  const input=getInputVector();
  if(input.len>.05){player.vx=input.x;player.vy=input.y;}

  if(player.jump){
    const j=player.jump;
    j.elapsed += dt;
    const t=Math.min(1,j.elapsed/j.duration);
    const ease=t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2;
    player.x=j.sx+(j.ex-j.sx)*ease;
    player.y=j.sy+(j.ey-j.sy)*ease;
    j.height=Math.sin(Math.PI*t)*54;
    if(t>=1){
      player.x=j.ex;player.y=j.ey;player.jump=null;player.inv=.18;
      burst(player.x,player.y,'#fff1aa');
      tone(190,.08,'triangle',.035);
    }
  }else{
    let speed=player.speed;
    if(player.slow>0){player.slow-=dt;speed*=.5;}
    if(player.speedBoost>0){player.speedBoost-=dt;speed*=1.28;}
    const px=player.x,py=player.y;
    moveWithSliding(player,input.x*speed*dt,input.y*speed*dt,false);
    if(input.len>.2 && Math.hypot(player.x-px,player.y-py)<speed*dt*.18) registerAction('wall');
  }

  if(player.inv>0) player.inv-=dt;
  if(player.jumps<progression.jumpCap){
    player.recharge += dt;
    if(player.recharge>=progression.recharge){
      player.recharge=0;player.jumps++;tone(740,.08,'triangle',.035);updateJumpUI();
    }
  }
}

function moveWithSliding(entity,dx,dy,ignoreLow){
  const steps=Math.max(1,Math.ceil(Math.hypot(dx,dy)/8));
  const sx=dx/steps,sy=dy/steps;
  for(let i=0;i<steps;i++){
    const nx=clamp(entity.x+sx,entity.r+58,WORLD_W-entity.r-58);
    if(!collidesObstacle(nx,entity.y,entity.r,ignoreLow)) entity.x=nx;
    const ny=clamp(entity.y+sy,entity.r+58,WORLD_H-entity.r-58);
    if(!collidesObstacle(entity.x,ny,entity.r,ignoreLow)) entity.y=ny;
  }
}

function collidesObstacle(x,y,r,ignoreLow=false){
  for(const o of obstacles){
    if(ignoreLow && o.low) continue;
    if(circleRectCollision(x,y,r,o)) return true;
  }
  return false;
}

function circleRectCollision(x,y,r,rect){
  const cx=clamp(x,rect.x,rect.x+rect.w),cy=clamp(y,rect.y,rect.y+rect.h);
  return Math.hypot(x-cx,y-cy)<r;
}

function jump(){
  if(!running || player.jumps<=0 || player.jump) return;
  let dx=player.vx,dy=player.vy;
  if(Math.hypot(dx,dy)<.1){dx=1;dy=0;}
  const l=Math.hypot(dx,dy);dx/=l;dy/=l;
  const distance=progression.jumpDistance*(player.jumpShoes?1.5:1);
  player.jumpShoes=false;
  const target=findJumpLanding(player.x,player.y,dx,dy,distance);
  player.jump={sx:player.x,sy:player.y,ex:target.x,ey:target.y,elapsed:0,duration:.34,height:0};
  player.jumps--;player.recharge=0;player.inv=.45;stats.jumpsUsed++;registerAction('jump');
  burst(player.x,player.y,'#e8f7d0');tone(360,.1,'square',.04);updateJumpUI();
}

function findJumpLanding(x,y,dx,dy,distance){
  for(let d=distance;d>=50;d-=10){
    const tx=clamp(x+dx*d,player.r+58,WORLD_W-player.r-58);
    const ty=clamp(y+dy*d,player.r+58,WORLD_H-player.r-58);
    if(!collidesObstacle(tx,ty,player.r,false)) return {x:tx,y:ty};
  }
  return {x,y};
}

function updateJumpUI(){
  jumpCount.textContent=player?player.jumps:progression.jumpCap;
  const frac=player&&player.jumps<progression.jumpCap?player.recharge/progression.recharge:1;
  jumpProgress.style.strokeDashoffset=258*(1-frac);
}

function updateBots(dt){
  for(const b of bots){
    if(b.inv>0)b.inv-=dt;
    if(b.recoveryTimer>0)b.recoveryTimer-=dt;
    if(b.jump){updateBotJump(b,dt);}else{
      if(b.jumps<b.jumpCap){b.jumpCharge+=dt;if(b.jumpCharge>=b.jumpRecharge){b.jumpCharge=0;b.jumps++;}}
      if(b.stun>0){b.stun-=dt;continue;}
      const goal=chooseBotGoal(b,dt);
      const oldX=b.x,oldY=b.y;
      navigateEntity(b,goal.x,goal.y,b.speed*goal.speed*(b.speedBoost>0?1.35:1),dt,false);
      if(b.speedBoost>0)b.speedBoost-=dt;
      const dx=b.x-oldX,dy=b.y-oldY;if(Math.hypot(dx,dy)>.1){b.vx=dx;b.vy=dy;}
      const moved=Math.hypot(b.x-b.lastX,b.y-b.lastY);
      if(moved<1.35)b.stuckTime+=dt;else b.stuckTime=Math.max(0,b.stuckTime-dt*2.5);
      b.lastX=b.x;b.lastY=b.y;
      if(b.stuckTime>.38){
        recoverBotFromObstacle(b,goal);
        b.stuckTime=0;
      }
    }
    if(!b.jump&&dist(b,player)<b.r+player.r+4&&player.inv<=0&&!player.jump&&b.inv<=0)collidePlayerBot(b);
    handleBotFlags(b);
  }
}

function recoverBotFromObstacle(b,goal){
  b.navPath=[];b.navTimer=0;
  // Primero intenta saltar si tiene carga; así no insiste eternamente contra la misma roca.
  if(b.jumps>0){
    startBotJump(b,goal.x,goal.y);
    if(b.jump)return;
  }
  // Si no puede saltar, busca un punto lateral libre y lo usa como desvío temporal.
  const dx=goal.x-b.x,dy=goal.y-b.y,l=Math.hypot(dx,dy)||1;
  const nx=dx/l,ny=dy/l;
  const side=(Math.random()<.5?-1:1);
  const candidates=[
    {x:b.x-ny*120*side,y:b.y+nx*120*side},
    {x:b.x+ny*160*side,y:b.y-nx*160*side},
    {x:b.x-nx*90-ny*90*side,y:b.y-ny*90+nx*90*side}
  ];
  for(const c of candidates){
    const safe=findSafePoint(clamp(c.x,90,WORLD_W-90),clamp(c.y,90,WORLD_H-90),b.r+6);
    if(lineClear(b,safe,b.r,false)||!collidesObstacle(safe.x,safe.y,b.r,false)){
      b.navPath=[safe];b.navTimer=.8;b.recoveryTimer=.7;return;
    }
  }
  // Último recurso: lo libera suavemente al punto válido más cercano, sin teletransportarlo lejos.
  const safe=findSafePoint(b.x,b.y,b.r+10);
  b.x=safe.x;b.y=safe.y;b.inv=.25;
}

function chooseBotGoal(b,dt){
  if(duelMode){
    if(b.carrying==='duel')return {x:enemyBase.x+enemyBase.w/2,y:enemyBase.y+enemyBase.h/2,speed:1.15};
    if(player.carrying==='duel')return {x:player.x,y:player.y,speed:1.22};
    return {x:flag.x,y:flag.y,speed:1.08};
  }
  const losing=player.carrying==='enemy';
  const winning=bots.some(x=>x.carrying==='home');
  b.state=losing?'losing':winning?'winning':'neutral';
  const safeLane=nearestQuietLane(b);

  if(b.carrying==='home'){
    if(b.personality==='offensive'&&winning)return {x:enemyBase.x+enemyBase.w/2,y:WORLD_H/2,speed:1.28};
    return {x:enemyBase.x+enemyBase.w/2,y:safeLane,speed:winning?.92:1.18};
  }
  if(homeFlag.dropped)return {x:homeFlag.x,y:homeFlag.y,speed:1.22};

  if(b.personality==='tutorial'){
    if(levelElapsed<15){
      const a=levelElapsed*.42+Number(b.id.slice(-1))*2;
      return {x:WORLD_W*.55+Math.cos(a)*210*mapScale,y:WORLD_H*.5+Math.sin(a)*250*mapScale,speed:.7};
    }
    return {x:homeFlag.x,y:homeFlag.y,speed:.9};
  }
  if(b.personality==='standard'){
    if(losing)return {x:homeFlag.x,y:homeFlag.y,speed:1.28};
    return {x:homeFlag.x,y:homeFlag.y,speed:1.02};
  }
  if(b.personality==='strategist'){
    b.commitTimer=(b.commitTimer||0)-dt;
    const nearestG=nearestGuardianTo(player);
    const trouble=player.stun>0||player.slow>0||(nearestG&&dist(player,nearestG)<125*mapScale);
    if(b.commitTimer<=0||!b.commitGoal||trouble||losing){
      if(trouble||levelElapsed>22)b.commitGoal={x:homeFlag.x,y:homeFlag.y,speed:1.25};
      else if(losing){const g=nearestG;b.commitGoal={x:g?g.x:player.x,y:g?g.y:player.y,speed:1.16};}
      else b.commitGoal={x:WORLD_W*.52,y:safeLane,speed:.9};
      b.commitTimer=3.6+Math.random()*1.2;
    }
    return b.commitGoal;
  }
  if(b.personality==='offensive'){
    if(winning)return {x:homeFlag.x,y:WORLD_H/2,speed:1.32};
    return {x:player.x,y:player.y,speed:losing?1.38:1.2};
  }
  if(b.personality==='defensive'){
    if(losing)return {x:enemyBase.x-340*mapScale,y:player.y,speed:1.0};
    if(winning)return {x:enemyBase.x-110*mapScale,y:WORLD_H/2,speed:.76};
    if(player.x>WORLD_W*.57)return {x:player.x,y:player.y,speed:1.05};
    return {x:enemyBase.x-180*mapScale,y:WORLD_H/2,speed:.78};
  }
  if(b.personality==='prankster'){
    if(losing)return {x:homeFlag.x,y:homeFlag.y,speed:1.22};
    const g=nearestGuardianTo(player);
    if(winning)return {x:player.x+player.vx*70,y:player.y+player.vy*70,speed:1.26};
    return g?{x:(player.x+g.x)/2,y:(player.y+g.y)/2,speed:1.12}:{x:player.x,y:player.y,speed:1.08};
  }
  return {x:homeFlag.x,y:homeFlag.y,speed:1};
}

function nearestQuietLane(b){
  const lanes=[280,590,900].map(v=>v*mapScale);
  return lanes.reduce((best,y)=>{
    const danger=guardians.reduce((sum,g)=>sum+1/Math.max(40,Math.abs(g.y-y)),0)+(Math.abs(player.y-y)<150*mapScale?0.01:0);
    return danger<best.danger?{y,danger}:best;
  },{y:lanes[0],danger:Infinity}).y;
}
function nearestGuardianTo(e){return guardians.length?guardians.reduce((a,g)=>dist(e,g)<dist(e,a)?g:a,guardians[0]):null;}

function handleBotFlags(b){
  if(duelMode){
    if(!b.carrying&&!flag.carrier&&dist(b,flag)<b.r+flag.r){b.carrying='duel';b.flagHP=b.flagMaxHP;flag.carrier=b;flag.dropped=false;tone(392,.1,'triangle',.035);}
    if(b.carrying==='duel'){flag.x=b.x;flag.y=b.y-30-(b.jump?b.jump.height*.2:0);if(rectCircle(enemyBase,b))scoreDuel('nito');}
    return;
  }
  if(!b.carrying && !homeFlag.carrier && dist(b,homeFlag)<b.r+homeFlag.r){
    registerAction('flag');b.carrying='home';b.flagHP=b.flagMaxHP||6;homeFlag.carrier=b;homeFlag.dropped=false;tone(392,.1,'triangle',.035);
  }
  if(b.carrying==='home'){
    homeFlag.x=b.x;homeFlag.y=b.y-30-(b.jump?b.jump.height*.2:0);
    if(rectCircle(enemyBase,b)) botWins(b);
  }
  if(flag.dropped && dist(b,flag)<b.r+flag.r){returnFlag(flag);}
}

function startBotJump(b,tx,ty){
  if(b.jumps<=0||b.jump)return;
  let dx=tx-b.x,dy=ty-b.y;
  if(Math.hypot(dx,dy)<.1){dx=b.vx||-1;dy=b.vy||0;}
  const l=Math.hypot(dx,dy)||1;dx/=l;dy/=l;
  const distance=progression.jumpDistance;
  const target=findEntityJumpLanding(b.x,b.y,dx,dy,distance,b.r);
  if(Math.hypot(target.x-b.x,target.y-b.y)<38*mapScale)return;
  b.jump={sx:b.x,sy:b.y,ex:target.x,ey:target.y,elapsed:0,duration:.34,height:0};
  b.jumps--;b.jumpCharge=0;b.inv=.48;
  burst(b.x,b.y,'#d9ecff');
}

function updateBotJump(b,dt){
  const j=b.jump;j.elapsed+=dt;
  const t=Math.min(1,j.elapsed/j.duration);
  const ease=t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2;
  b.x=j.sx+(j.ex-j.sx)*ease;b.y=j.sy+(j.ey-j.sy)*ease;
  j.height=Math.sin(Math.PI*t)*42;
  if(t>=1){b.x=j.ex;b.y=j.ey;b.jump=null;b.inv=.2;burst(b.x,b.y,'#d9ecff');}
}

function findEntityJumpLanding(x,y,dx,dy,distance,r){
  for(let d=distance;d>=42;d-=10){
    const tx=clamp(x+dx*d,r+58,WORLD_W-r-58);
    const ty=clamp(y+dy*d,r+58,WORLD_H-r-58);
    if(!collidesObstacle(tx,ty,r,false))return {x:tx,y:ty};
  }
  return {x,y};
}

const NAV_CELL=52;
function lineClear(a,b,r,ignoreLow=false){
  const d=Math.hypot(b.x-a.x,b.y-a.y),steps=Math.max(1,Math.ceil(d/22));
  for(let i=1;i<=steps;i++){
    const t=i/steps,x=a.x+(b.x-a.x)*t,y=a.y+(b.y-a.y)*t;
    if(collidesObstacle(x,y,r,ignoreLow))return false;
  }
  return true;
}
function navigateEntity(o,tx,ty,speed,dt,stayMiddle=false){
  o.navTimer=(o.navTimer||0)-dt;
  const target={x:tx,y:ty};
  if(lineClear(o,target,o.r,false)){
    o.navPath=[];
    moveEntityToward(o,tx,ty,speed*dt,stayMiddle);
    return;
  }
  if(o.navTimer<=0||!o.navPath||!o.navPath.length){
    o.navPath=findPath(o.x,o.y,tx,ty,o.r,stayMiddle);
    o.navTimer=.45+Math.random()*.18;
  }
  const node=o.navPath&&o.navPath[0];
  if(!node){moveEntityToward(o,tx,ty,speed*dt,stayMiddle);return;}
  if(Math.hypot(o.x-node.x,o.y-node.y)<NAV_CELL*.38)o.navPath.shift();
  const next=o.navPath&&o.navPath[0]||target;
  moveEntityToward(o,next.x,next.y,speed*dt,stayMiddle);
}
function findPath(sx,sy,tx,ty,r,stayMiddle=false){
  const cols=Math.ceil(WORLD_W/NAV_CELL),rows=Math.ceil(WORLD_H/NAV_CELL);
  const key=(c,rr)=>rr*cols+c;
  const toCell=(x,y)=>({c:clamp(Math.floor(x/NAV_CELL),0,cols-1),r:clamp(Math.floor(y/NAV_CELL),0,rows-1)});
  const S=toCell(sx,sy);
  let T=toCell(tx,ty);
  if(collidesObstacle((T.c+.5)*NAV_CELL,(T.r+.5)*NAV_CELL,r+5,false)){
    let bestTarget=null,bestD=Infinity;
    for(let ring=1;ring<=5&&!bestTarget;ring++){
      for(let dr=-ring;dr<=ring;dr++)for(let dc=-ring;dc<=ring;dc++){
        if(Math.max(Math.abs(dc),Math.abs(dr))!==ring)continue;
        const c=T.c+dc,rr=T.r+dr;if(c<0||rr<0||c>=cols||rr>=rows)continue;
        const x=(c+.5)*NAV_CELL,y=(rr+.5)*NAV_CELL;
        if(!collidesObstacle(x,y,r+5,false)){const d=Math.hypot(x-tx,y-ty);if(d<bestD){bestD=d;bestTarget={c,r:rr};}}
      }
    }
    if(bestTarget)T=bestTarget;
  }
  const open=[{...S,g:0,f:0}],came=new Map(),best=new Map([[key(S.c,S.r),0]]);
  const dirs=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
  let found=null,guard=0;
  while(open.length&&guard++<1800){
    open.sort((a,b)=>a.f-b.f);const cur=open.shift();
    if(cur.c===T.c&&cur.r===T.r){found=cur;break;}
    for(const [dc,dr] of dirs){
      const c=cur.c+dc,rr=cur.r+dr;if(c<0||rr<0||c>=cols||rr>=rows)continue;
      const x=(c+.5)*NAV_CELL,y=(rr+.5)*NAV_CELL;
      if(stayMiddle&&(y<390*mapScale||y>790*mapScale||x<540*mapScale||x>1570*mapScale))continue;
      if(collidesObstacle(x,y,r+5,false))continue;
      const ng=cur.g+(dc&&dr?1.42:1),k=key(c,rr);
      if(ng>=(best.get(k)??Infinity))continue;
      best.set(k,ng);came.set(k,cur);open.push({c,r:rr,g:ng,f:ng+Math.hypot(T.c-c,T.r-rr)});
    }
  }
  if(!found)return [];
  const path=[];let cur=found;
  while(!(cur.c===S.c&&cur.r===S.r)){
    path.push({x:(cur.c+.5)*NAV_CELL,y:(cur.r+.5)*NAV_CELL});cur=came.get(key(cur.c,cur.r));if(!cur)break;
  }
  return path.reverse();
}
function moveEntityToward(o,x,y,step,stayMiddle=false){
  const dx=x-o.x,dy=y-o.y,l=Math.hypot(dx,dy)||1;
  moveWithSliding(o,dx/l*step,dy/l*step,false);
  if(stayMiddle){
    o.x=clamp(o.x,560*mapScale,1545*mapScale);
    o.y=clamp(o.y,405*mapScale,775*mapScale);
  }
}

function updateGuardians(dt){
  for(const g of guardians){
    g.phase+=dt;
    if(g.recoveryTimer>0)g.recoveryTimer-=dt;
    const beforeX=g.x,beforeY=g.y;
    if(g.type==='elephant'){updateElephantFury(g,dt);}
    else if(g.type==='parrot'&&(flag.dropped||homeFlag.dropped)){updateParrotFlagDuty(g,dt);}
    else if(g.type==='sloth'){updateSloth(g,dt);}
    else{
      const target=chooseGuardianTarget(g,dt);
      if(target){
        let tx=target.x,ty=target.y;
        if(g.type==='turtle'){tx+=(target.vx||0)*55;ty+=(target.vy||0)*55;}
        if(g.type==='gorilla'&&g.jump){updateGuardianJump(g,dt);}else{
          navigateEntity(g,tx,ty,g.v*((target.carrying)?1.12:1),dt,true);
          if(g.type==='gorilla')maybeGorillaJump(g,target,dt);
        }
      }else patrolGuardian(g,dt);
    }
    const moved=Math.hypot(g.x-beforeX,g.y-beforeY);
    if(moved<.45&&!g.sleeping&&!g.jump)g.stuckTime+=dt;else g.stuckTime=Math.max(0,g.stuckTime-dt*2);
    if(g.stuckTime>.55){recoverGuardian(g);g.stuckTime=0;}
    guardianContacts(g);
  }
}

function recoverGuardian(g){
  g.navPath=[];g.navTimer=0;g.targetCheck=0;
  const center={x:1050*mapScale,y:590*mapScale};
  const side=Math.random()<.5?-1:1;
  const candidates=[
    {x:g.x+side*120*mapScale,y:g.y+80*mapScale},
    {x:g.x-side*120*mapScale,y:g.y-80*mapScale},
    {x:(g.spawnX+center.x)/2,y:(g.spawnY+center.y)/2}
  ];
  for(const c of candidates){
    const x=clamp(c.x,590*mapScale,1530*mapScale),y=clamp(c.y,415*mapScale,765*mapScale);
    if(!collidesObstacle(x,y,g.r+5,false)){
      g.x=x;g.y=y;g.inv=.2;g.recoveryTimer=.8;return;
    }
  }
  const safe=findSafePoint(g.spawnX,g.spawnY,g.r+8);
  g.x=safe.x;g.y=safe.y;g.inv=.25;
}

function chooseGuardianTarget(g,dt){
  g.targetCheck-=dt;g.lock=Math.max(0,g.lock-dt);
  const candidates=[player,...bots].filter(e=>!e.jump&&e.x>520*mapScale&&e.x<1620*mapScale&&e.y>360*mapScale&&e.y<820*mapScale);
  if(!candidates.length){g.target=null;return null;}
  if(g.targetCheck<=0){
    g.targetCheck=1.05+Math.random()*.35;
    const load=e=>guardians.filter(x=>x!==g&&x.target===e).length;
    const eligible=candidates.filter(e=>load(e)<2);
    if(!eligible.length){g.target=null;g.lock=0;return null;}
    const nearest=eligible.reduce((a,b)=>dist(g,b)<dist(g,a)?b:a,eligible[0]);
    if(!g.target||!eligible.includes(g.target)||g.lock<=0||dist(g,nearest)<dist(g,g.target)*.75){g.target=nearest;g.lock=1.8;}
  }
  return g.target;
}

function patrolGuardian(g,dt){
  const ty=(585+Math.sin(g.phase*(g.type==='turtle'?.95:1.2))*145)*mapScale;
  if(g.x<620*mapScale||g.x>1510*mapScale)g.dir*=-1;
  moveWithSliding(g,g.dir*g.v*.72*dt,(ty-g.y)*dt*1.7,false);
  g.x=clamp(g.x,580*mapScale,1540*mapScale);g.y=clamp(g.y,405*mapScale,775*mapScale);
}

function maybeGorillaJump(g,target,dt){
  if(g.jumps<g.jumpCap){g.jumpCharge+=dt;if(g.jumpCharge>=g.jumpRecharge){g.jumpCharge=0;g.jumps++;}}
  if(g.jumps<=0||g.jump)return;
  if(!lineClear(g,target,g.r,false)||dist(g,target)>230*mapScale){
    let dx=target.x-g.x,dy=target.y-g.y,l=Math.hypot(dx,dy)||1;dx/=l;dy/=l;
    const landing=findEntityJumpLanding(g.x,g.y,dx,dy,progression.jumpDistance,g.r);
    g.jump={sx:g.x,sy:g.y,ex:landing.x,ey:landing.y,elapsed:0,duration:.36,height:0};g.jumps--;g.jumpCharge=0;g.inv=.5;
  }
}

function updateGuardianJump(g,dt){const j=g.jump;j.elapsed+=dt;const t=Math.min(1,j.elapsed/j.duration);g.x=j.sx+(j.ex-j.sx)*t;g.y=j.sy+(j.ey-j.sy)*t;j.height=Math.sin(Math.PI*t)*48;if(t>=1)g.jump=null;}

function updateElephantFury(g,dt){
  if(!g.fury){g.fury=true;g.furyLane=(Math.random()<.5?280:900)*mapScale;g.furyDir=g.x<WORLD_W/2?1:-1;burst(g.x,g.y,'#ffb36b');shake=12;}
  const tx=g.furyDir>0?WORLD_W-180*mapScale:180*mapScale;
  const ty=g.furyLane;
  destroyNearElephant(g);
  navigateEntity(g,tx,ty,g.v*1.55,dt,false);
  if(Math.abs(g.x-tx)<75*mapScale){g.furyDir*=-1;g.furyLane=(g.furyLane< WORLD_H/2?900:280)*mapScale;}
}
function destroyNearElephant(g){
  for(let i=obstacles.length-1;i>=0;i--){const o=obstacles[i];if(!o.breakable)continue;const cx=clamp(g.x,o.x,o.x+o.w),cy=clamp(g.y,o.y,o.y+o.h);if(Math.hypot(g.x-cx,g.y-cy)<g.r+38*mapScale){burst(cx,cy,'#d8b27b');obstacles.splice(i,1);g.navPath=[];}}
}
function updateParrotFlagDuty(g,dt){
  const f=flag.dropped?flag:homeFlag;
  if(g.carryingFlag){const base=g.carryingFlag.kind==='enemy'?enemyBase:homeBase;navigateEntity(g,base.x+base.w/2,base.y+base.h/2,g.v*1.25,dt,false);g.carryingFlag.x=g.x;g.carryingFlag.y=g.y-25;if(rectCircle(base,g)){returnFlag(g.carryingFlag);g.carryingFlag=null;}}else{navigateEntity(g,f.x,f.y,g.v*1.25,dt,false);if(dist(g,f)<g.r+f.r){g.carryingFlag=f;f.carrier=g;}}
}
function updateSloth(g,dt){
  const perches=[[690,470],[940,680],[1210,470],[1450,680]].map(p=>({x:p[0]*mapScale,y:p[1]*mapScale}));
  if(!g.perch)g.perch=perches[g.perchIndex%perches.length];
  if(dist(g,g.perch)>22*mapScale){g.sleeping=false;navigateEntity(g,g.perch.x,g.perch.y,g.v*.55,dt,true);}else{g.sleeping=true;if(Math.random()<dt*.05){g.perchIndex++;g.perch=perches[g.perchIndex%perches.length];}}
}
function guardianContacts(g){
  if(dist(g,player)<g.r+player.r&&player.inv<=0&&!player.jump)guardianHit(g);
  for(const b of bots)if(!b.jump&&b.inv<=0&&dist(g,b)<g.r+b.r)guardianHitBot(g,b);
}

function guardianHitBot(g,b){
  registerAction('guardian-bot');
  const damage=guardianDamage(g.type);
  if(b.helmet){b.helmet=false;}else if(b.carrying)damageCarrier(b,damage);
  b.speedBoost=0;
  knockbackFrom(b,g,g.type==='elephant'?145:g.type==='turtle'?105:80);
  b.stun=g.type==='sloth'?1.2:.45;b.inv=1;shake=6;burst(b.x,b.y,'#bfe8ff');
}

function collidePlayerBot(b){
  registerAction('player-bot');
  const dx=player.x-b.x,dy=player.y-b.y,l=Math.hypot(dx,dy)||1;
  moveWithSliding(player,dx/l*58,dy/l*58,false);moveWithSliding(b,-dx/l*42,-dy/l*42,false);
  player.inv=.85;b.inv=.85;b.stun=.35;player.speedBoost=0;b.speedBoost=0;shake=8;
  // Choque justo: solo pierde medio corazón quien lleve una bandera; si ambos llevan, ambos pierden.
  if(player.carrying)damageCarrier(player,1);
  if(b.carrying)damageCarrier(b,1);
  burst((player.x+b.x)/2,(player.y+b.y)/2,'#ffe16b');tone(120,.12,'square',.06);
}

function guardianHit(g){
  registerAction('guardian-player');
  const damage=guardianDamage(g.type);
  if(player.helmet){player.helmet=false;}else if(player.carrying)damageCarrier(player,damage);
  player.speedBoost=0;
  knockbackFrom(player,g,g.type==='elephant'?160:g.type==='turtle'?120:85);
  player.stun=g.type==='sloth'?1.1:.25;player.inv=1;stats.hits++;shake=8;burst(player.x,player.y,'#ffd2e6');
}
function guardianDamage(type){return type==='elephant'?4:(type==='gorilla'||type==='turtle')?2:1;}
function knockbackFrom(e,source,amount){const dx=e.x-source.x,dy=e.y-source.y,l=Math.hypot(dx,dy)||1;moveWithSliding(e,dx/l*amount,dy/l*amount,false);}
function damageCarrier(e,amount){
  e.flagHP=Math.max(0,(e.flagHP ?? e.flagMaxHP ?? 6)-amount);
  if(e.flagHP<=0)dropCarriedFlag(e);
}
function dropCarriedFlag(e){
  registerAction('flag-drop');
  const kind=e.carrying;if(!kind)return;const f=(kind==='enemy'||kind==='duel')?flag:homeFlag;e.carrying=null;e.flagHP=0;f.carrier=null;f.dropped=true;f.x=e.x;f.y=e.y;burst(f.x,f.y,'#fff1a3');
}

function checkWorld(){
  for(const b of bananas)if(!b.got&&dist(player,b)<player.r+b.r){
    b.got=true;player.bananas+=b.value;stats.bananas=player.bananas;
    player.recharge=Math.min(progression.recharge,player.recharge+(b.value>1?1.5:.55));
    burst(b.x,b.y,'#ffd72d');tone(880,.08,'triangle',.035);
  }
  for(const b of bots){
    for(const banana of bananas)if(!banana.got&&dist(b,banana)<b.r+banana.r){banana.got=true;b.bananas+=banana.value;b.jumpCharge=Math.min(b.jumpRecharge,b.jumpCharge+(banana.value>1?1.5:.55));}
    for(const o of objects)if(!o.got&&dist(b,o)<b.r+o.r){o.got=true;applyObjectTo(b,o.type);}
  }
  for(const o of objects)if(!o.got&&dist(player,o)<player.r+o.r){o.got=true;applyObjectTo(player,o.type);}
  if(!player.jump)for(const tr of traps)if(dist(player,tr)<player.r+tr.r){if(tr.type==='mud')player.slow=.35;if(tr.type==='log')moveWithSliding(player,-player.vx*28,-player.vy*28,false);if(tr.type==='vine'&&Math.random()<.08)player.slow=.8;}
  if(duelMode){
    if(!player.carrying&&!flag.carrier&&dist(player,flag)<player.r+flag.r){player.carrying='duel';player.flagHP=player.flagMaxHP;flag.carrier=player;flag.dropped=false;tone(523,.12,'triangle',.05);}
    if(player.carrying==='duel'){flag.x=player.x;flag.y=player.y-32-(player.jump?player.jump.height*.2:0);if(rectCircle(homeBase,player))scoreDuel('tina');}
    return;
  }
  if(!player.carrying&&!flag.carrier&&dist(player,flag)<player.r+flag.r){registerAction('flag');player.carrying='enemy';player.flagHP=player.flagMaxHP||6;flag.carrier=player;flag.dropped=false;tone(523,.12,'triangle',.05);tone(659,.12,'triangle',.04,.08);}
  if(player.carrying==='enemy'){flag.x=player.x;flag.y=player.y-32-(player.jump?player.jump.height*.2:0);if(rectCircle(homeBase,player))winLevel();}
  if(homeFlag.dropped&&!homeFlag.carrier&&dist(player,homeFlag)<player.r+homeFlag.r)returnFlag(homeFlag);
}

function applyObject(t){applyObjectTo(player,t);}
function applyObjectTo(e,t){
  if(t==='helmet')e.helmet=true;
  if(t==='skateboard')e.speedBoost=8;
  if(t==='shoes')e.jumpShoes=true;
  if(t==='coconut'){
    if(e===player)e.recharge=Math.min(progression.recharge,e.recharge+1.8);
    else e.jumpCharge=Math.min(e.jumpRecharge,e.jumpCharge+1.8);
  }
  tone(1046,.12,'sine',.04);
}

function dropFlag(){dropCarriedFlag(player);}
function returnFlag(f=flag){f.x=f.homeX;f.y=f.homeY;f.dropped=false;f.carrier=null;}
function botWins(b){
  running=false;stopMusic();
  resultTitle.textContent='💚 ¡Jugaste genial!';
  resultText.innerHTML=`<b>${b.name}</b> logró llevar la bandera, pero la aventura estuvo buenísima.<br>Tiempo: <b>${formatTime(levelElapsed)}</b> · Bananas: <b>${player.bananas}</b> · Saltos: <b>${stats.jumpsUsed}</b> · Golpes: <b>${stats.hits}</b>`;
  upgradeBox.style.display='none';nextBtn.style.display='none';show('result');
}

function winLevel(){
  running=false;stopMusic();
  unlocked=Math.max(unlocked,Math.min(19,level+1));localStorage.setItem('tinaFlagUnlocked',unlocked);
  buildLevelGrid();
  const u=upgrades.find(x=>x.at===level);
  resultTitle.textContent='🌟 ¡Lo hiciste genial!';
  resultText.innerHTML=`Superaste a <b>${CLASSMATES[level-1]}</b> y volviste con la bandera.<br>Tiempo: <b>${formatTime(levelElapsed)}</b> · Bananas: <b>${player.bananas}</b><br>Saltos usados: <b>${stats.jumpsUsed}</b> · Golpes recibidos: <b>${stats.hits}</b><br><br><b>¡Aventura brillante!</b>`;
  upgradeBox.style.display=u?'block':'none';upgradeBox.textContent=u?'🎁 '+u.text:'';
  nextBtn.style.display='block';show('result');winSound();
}
function showFinalVictory(){
  hideAllOverlays();
  const finalVictory=document.getElementById('finalVictory');
  const finalText=document.getElementById('finalVictoryText');
  finalText.innerHTML=`Superaste los 18 desafíos y venciste a Nito en El Gran Duelo.<br>Tiempo del último nivel: <b>${formatTime(levelElapsed)}</b> · Bananas: <b>${player.bananas}</b> · Saltos: <b>${stats.jumpsUsed}</b> · Golpes: <b>${stats.hits}</b>`;
  finalVictory.classList.add('show');
  finalVictory.setAttribute('aria-hidden','false');
  victoryFanfare();
}
function hideFinalVictory(){
  const finalVictory=document.getElementById('finalVictory');
  finalVictory.classList.remove('show');
  finalVictory.setAttribute('aria-hidden','true');
}
function victoryFanfare(){
  if(!musicOn)return;
  initAudio();
  const notes=[60,64,67,69,72,76,79,84];
  notes.forEach((n,i)=>tone(midi(n),i===notes.length-1?.7:.18,i%3===0?'sawtooth':'triangle',i===notes.length-1?.045:.022,i*.105));
  [48,55,52,57].forEach((n,i)=>tone(midi(n),.34,'sine',.018,i*.21));
  [0,.21,.42,.63].forEach((d,i)=>{kick(d,.034);noiseHit(d+.1,i===3?.025:.013,i===3?.22:.06,i===3?4200:1900);});
}

function formatTime(sec){const m=Math.floor(sec/60),s=Math.floor(sec%60);return `${m}:${String(s).padStart(2,'0')}`;}

function finishByTime(){
  running=false;stopMusic();
  const rivalBananas=bots.reduce((s,b)=>s+b.bananas,0);
  const humanWins=player.bananas>=rivalBananas;
  if(humanWins){
    resultTitle.textContent='🌟 ¡Lo hiciste genial!';
    resultText.innerHTML=`El tiempo terminó, pero Tina reunió <b>${player.bananas}</b> bananas y ganó el desempate.<br><b>Rango: ¡Gran estratega!</b>`;
    unlocked=Math.max(unlocked,Math.min(18,level+1));localStorage.setItem('tinaFlagUnlocked',unlocked);
    nextBtn.style.display='block';
  }else{
    resultTitle.textContent='💚 ¡Jugaste genial!';
    resultText.textContent='Esta vez faltó muy poquito. Probá otra ruta o guardá un salto para el regreso.';
    nextBtn.style.display='none';
  }
  upgradeBox.style.display='none';show('result');buildLevelGrid();
}

function updateCamera(dt){
  const tx=clamp(player.x-VIEW_W/2,0,WORLD_W-VIEW_W);
  const ty=clamp(player.y-VIEW_H/2,0,WORLD_H-VIEW_H);
  const k=1-Math.pow(.001,dt);
  camera.x+=(tx-camera.x)*k;
  camera.y+=(ty-camera.y)*k;
}

function draw(){
  ctx.save();
  if(shake>0){ctx.translate((Math.random()-.5)*shake,(Math.random()-.5)*shake);shake*=.85;}
  ctx.clearRect(0,0,VIEW_W,VIEW_H);
  ctx.save();ctx.translate(-camera.x,-camera.y);
  drawWorld();drawEntities();
  ctx.restore();
  if(duelMode)drawDuelScore();
  // Sin HUD: toda la pantalla pertenece al bosque.
  ctx.restore();
  updateJumpUI();
}

function drawWorld(){
  const g=ctx.createLinearGradient(0,0,0,WORLD_H);g.addColorStop(0,'#55ad63');g.addColorStop(1,'#286f43');
  ctx.fillStyle=g;ctx.fillRect(0,0,WORLD_W,WORLD_H);
  drawGroundTexture();
  drawPaths();
  for(const o of obstacles) drawObstacle(o);
  drawBase(homeBase,'#f4cf4f','TINA');
  drawBase(enemyBase,'#db6c57',duelMode?'NITO':CLASSMATES[level-1]);
}

function drawGroundTexture(){
  ctx.fillStyle='rgba(255,255,255,.05)';
  for(let i=0;i<160;i++){
    const x=(i*137)%WORLD_W,y=(i*83)%WORLD_H;
    ctx.beginPath();ctx.arc(x,y,3+(i%4),0,Math.PI*2);ctx.fill();
  }
}

function drawPaths(){
  ctx.strokeStyle='#c4a66e';ctx.lineWidth=116;ctx.lineCap='round';ctx.lineJoin='round';ctx.globalAlpha=.82;
  const paths=[
    [[230,300],[450,260],[700,290],[930,220],[1220,280],[1510,260],[1850,430]],
    [[230,590],[520,590],[800,610],[1080,580],[1370,610],[1850,590]],
    [[230,860],[500,920],[760,850],[1050,940],[1320,875],[1600,900],[1850,760]]
  ];
  for(const p of paths){ctx.beginPath();ctx.moveTo(p[0][0]*mapScale,p[0][1]*mapScale);for(let i=1;i<p.length;i++)ctx.lineTo(p[i][0]*mapScale,p[i][1]*mapScale);ctx.stroke();}
  ctx.globalAlpha=1;
  ctx.strokeStyle='rgba(95,70,38,.25)';ctx.lineWidth=4;
  for(const p of paths){ctx.beginPath();ctx.moveTo(p[0][0]*mapScale,p[0][1]*mapScale);for(let i=1;i<p.length;i++)ctx.lineTo(p[i][0]*mapScale,p[i][1]*mapScale);ctx.stroke();}
}

function drawObstacle(o){
  if(o.type==='log'){
    ctx.fillStyle='#70451f';roundRect(o.x,o.y,o.w,o.h,22,true);ctx.strokeStyle='#3f2815';ctx.lineWidth=5;roundRect(o.x,o.y,o.w,o.h,22,false);
    for(let x=o.x+20;x<o.x+o.w;x+=45){ctx.strokeStyle='#9b6b36';ctx.beginPath();ctx.moveTo(x,o.y+8);ctx.lineTo(x,o.y+o.h-8);ctx.stroke();}
    return;
  }
  if(o.type==='rock'){
    ctx.fillStyle='#61705a';roundRect(o.x,o.y,o.w,o.h,35,true);ctx.fillStyle='#899482';roundRect(o.x+18,o.y+14,o.w*.55,o.h*.34,22,true);return;
  }
  if(o.type==='flowers'){
    ctx.fillStyle='#266d3c';roundRect(o.x,o.y,o.w,o.h,30,true);ctx.font='28px serif';for(let x=o.x+25;x<o.x+o.w;x+=45)ctx.fillText(x%2?'🌼':'🌺',x,o.y+45);return;
  }
  ctx.fillStyle=o.type==='trees'?'#154f2f':'#1f6a3a';roundRect(o.x,o.y,o.w,o.h,28,true);
  ctx.fillStyle='#2d7d43';for(let x=o.x+18;x<o.x+o.w;x+=38){ctx.beginPath();ctx.arc(x,o.y+18,24,0,Math.PI*2);ctx.fill();}
}

function drawBase(r,color,label){
  ctx.fillStyle=color;roundRect(r.x,r.y,r.w,r.h,22,true);ctx.strokeStyle='#4c351c';ctx.lineWidth=6;roundRect(r.x,r.y,r.w,r.h,22,false);
  ctx.save();ctx.translate(r.x+r.w/2,r.y+r.h/2);ctx.rotate(-Math.PI/2);ctx.fillStyle='#253b25';ctx.font='900 19px Arial';ctx.textAlign='center';ctx.fillText(label,0,6);ctx.restore();
}

function drawEntities(){
  for(const tr of traps)drawTrap(tr);for(const b of bananas)if(!b.got)drawBanana(b);for(const o of objects)if(!o.got)drawObject(o);
  for(const g of guardians){drawGuardian(g);if(g.carryingFlag)drawFlag(g.carryingFlag.x,g.carryingFlag.y,g.carryingFlag.kind);}
  for(const b of bots){const bh=b.jump?b.jump.height:0;drawMonkey(b.x,b.y-bh,b.r,'#4d80c7',b.name[0],bh);drawBotJumpDots(b,b.x,b.y-bh);if(b.carrying)drawCarrierHearts(b,b.x,b.y-bh-48);drawBuffIcons(b,b.x,b.y-bh-68);}
  if(!flag.carrier)drawFlag(flag.x,flag.y,'enemy');
  if(!duelMode&&!homeFlag.carrier)drawFlag(homeFlag.x,homeFlag.y,'home');
  const jumpHeight=player.jump?player.jump.height:0;drawMonkey(player.x,player.y-jumpHeight,player.r,'#e95d9b','T',jumpHeight);drawPlayerIndicators(player.x,player.y-jumpHeight);
  if(player.carrying)drawCarrierHearts(player,player.x,player.y-jumpHeight-50);
  if(player.carrying==='enemy'||player.carrying==='duel')drawFlag(flag.x,flag.y-jumpHeight*.35,'enemy');
  drawBuffIcons(player,player.x,player.y-jumpHeight-68);
  for(const b of bots){if(b.carrying==='home')drawFlag(homeFlag.x,homeFlag.y-(b.jump?b.jump.height*.35:0),'home');if(b.carrying==='duel')drawFlag(flag.x,flag.y-(b.jump?b.jump.height*.35:0),'enemy');}
  for(const p of particles){ctx.globalAlpha=p.life;ctx.fillStyle=p.c;ctx.fillRect(p.x,p.y,5,5);}ctx.globalAlpha=1;
}


function drawBuffIcons(e,x,y){
  const icons=[];if(e.helmet)icons.push('🪖');if(e.speedBoost>0)icons.push('🛹');if(e.jumpShoes)icons.push('👟');
  if(!icons.length)return;ctx.save();ctx.font='17px serif';ctx.textAlign='center';icons.forEach((ic,i)=>ctx.fillText(ic,x+(i-(icons.length-1)/2)*19,y));ctx.restore();
}

function drawCarrierHearts(e,x,y){
  const hp=e.flagHP||0;
  const maxHP=e.flagMaxHP||6;
  const heartCount=Math.max(1,Math.ceil(maxHP/2));
  const spacing=17;
  const startX=x-(heartCount-1)*spacing/2;
  ctx.save();
  for(let i=0;i<heartCount;i++)drawTinyHeart(startX+i*spacing,y,clamp((hp-i*2)/2,0,1));
  ctx.restore();
}
function drawTinyHeart(x,y,fill){
  ctx.save();
  ctx.translate(x,y);
  ctx.beginPath();
  ctx.moveTo(0,5);
  ctx.bezierCurveTo(-12,-2,-8,-10,-3,-8);
  ctx.bezierCurveTo(0,-7,0,-4,0,-3);
  ctx.bezierCurveTo(0,-4,0,-7,3,-8);
  ctx.bezierCurveTo(8,-10,12,-2,0,5);
  ctx.closePath();
  ctx.strokeStyle='rgba(45,35,35,.8)';
  ctx.lineWidth=1.5;
  ctx.stroke();
  ctx.save();
  ctx.clip();
  ctx.fillStyle='#e84c5b';
  ctx.fillRect(-12,-12,24*fill,20);
  ctx.restore();
  ctx.restore(); // restaura la traslación: evita que el mapa quede recortado/duplicado
}

function drawMonkey(x,y,r,color,letter,jumpHeight=0){
  ctx.save();
  if(jumpHeight>0){ctx.globalAlpha=.28;ctx.fillStyle='#112819';ctx.beginPath();ctx.ellipse(x,y+jumpHeight+r+8,r*(1-jumpHeight/110),r*.36,0,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;}
  ctx.translate(x,y);
  ctx.fillStyle=color;ctx.strokeStyle='#3b2517';ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.fill();ctx.stroke();
  ctx.fillStyle='#7b4a2b';ctx.beginPath();ctx.arc(0,-3,r*.62,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#edbd79';ctx.beginPath();ctx.ellipse(0,5,r*.42,r*.34,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(-5,-5,3.5,0,Math.PI*2);ctx.arc(5,-5,3.5,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#18231d';ctx.beginPath();ctx.arc(-5,-5,1.5,0,Math.PI*2);ctx.arc(5,-5,1.5,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#fff';ctx.font='900 11px Arial';ctx.textAlign='center';ctx.fillText(letter,0,r+14);ctx.restore();
}

function drawBotJumpDots(b,x,y){
  const spacing=9,start=x-(b.jumpCap-1)*spacing/2;
  for(let i=0;i<b.jumpCap;i++){
    ctx.beginPath();ctx.arc(start+i*spacing,y-b.r-10,2.7,0,Math.PI*2);
    ctx.fillStyle=i<b.jumps?'#dff4ff':'rgba(255,255,255,.18)';ctx.fill();
  }
}

function drawPlayerIndicators(x,y){
  ctx.save();
  const cap=progression.jumpCap,spacing=13,start=x-(cap-1)*spacing/2;
  for(let i=0;i<cap;i++){
    ctx.beginPath();ctx.arc(start+i*spacing,y-38,4.5,0,Math.PI*2);
    ctx.fillStyle=i<player.jumps?'#fff36b':'rgba(255,255,255,.24)';ctx.fill();
    ctx.strokeStyle='rgba(25,51,38,.75)';ctx.lineWidth=1.5;ctx.stroke();
  }
  if(player.jumps<cap){
    const frac=clamp(player.recharge/progression.recharge,0,1);
    ctx.beginPath();ctx.arc(x,y,player.r+8,-Math.PI/2,-Math.PI/2+Math.PI*2*frac);
    ctx.strokeStyle='#8ff6ff';ctx.lineWidth=3;ctx.lineCap='round';ctx.stroke();
  }
  ctx.restore();
}

function drawGuardian(g){const gh=g.jump?g.jump.height:0;const icons={elephant:'🐘',gorilla:'🦍',turtle:'🐢',parrot:'🦜',sloth:'🦥'};ctx.font='46px serif';ctx.textAlign='center';ctx.fillText(icons[g.type],g.x,g.y+15-gh);}
function drawTrap(t){ctx.font='31px serif';ctx.textAlign='center';ctx.fillText(t.type==='mud'?'🟤':t.type==='log'?'🪵':'➰',t.x,t.y+10);}
function drawBanana(b){ctx.font=b.value>1?'32px serif':'25px serif';ctx.textAlign='center';ctx.fillText('🍌',b.x,b.y+8);}
function drawObject(o){const m={helmet:'🪖',skateboard:'🛹',shoes:'👟',coconut:'🥥'};ctx.font='30px serif';ctx.textAlign='center';ctx.fillText(m[o.type],o.x,o.y+8);}
function drawFlag(x,y,kind='enemy'){ctx.save();ctx.translate(x,y);ctx.strokeStyle='#633b1f';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(-8,20);ctx.lineTo(-8,-26);ctx.stroke();ctx.fillStyle=kind==='home'?'#ff8fc5':'#ffd329';ctx.beginPath();ctx.moveTo(-8,-26);ctx.lineTo(34,-18);ctx.lineTo(-8,-4);ctx.closePath();ctx.fill();ctx.font='18px serif';ctx.fillText('🍌',5,-9);ctx.restore();}

function drawTopHud(){}

function drawMiniMap(){
  const mw=210,mh=112,x=VIEW_W-mw-18,y=72;
  ctx.fillStyle='#10291ddd';roundRect(x,y,mw,mh,14,true);
  ctx.strokeStyle='#fff7';ctx.lineWidth=2;roundRect(x,y,mw,mh,14,false);
  const sx=mw/WORLD_W,sy=mh/WORLD_H;
  ctx.fillStyle='#f4cf4f';ctx.fillRect(x+homeBase.x*sx,y+homeBase.y*sy,homeBase.w*sx,homeBase.h*sy);
  ctx.fillStyle='#db6c57';ctx.fillRect(x+enemyBase.x*sx,y+enemyBase.y*sy,enemyBase.w*sx,enemyBase.h*sy);
  ctx.fillStyle='#ff5ea8';ctx.beginPath();ctx.arc(x+player.x*sx,y+player.y*sy,5,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#4d80c7';for(const b of bots){ctx.beginPath();ctx.arc(x+b.x*sx,y+b.y*sy,3.5,0,Math.PI*2);ctx.fill();}
  ctx.strokeStyle='#fff';ctx.strokeRect(x+camera.x*sx,y+camera.y*sy,VIEW_W*sx,VIEW_H*sy);
}

function roundRect(x,y,w,h,r,fill){ctx.beginPath();ctx.roundRect(x,y,w,h,r);fill?ctx.fill():ctx.stroke();}
function burst(x,y,c){for(let i=0;i<14;i++)particles.push({x,y,vx:(Math.random()-.5)*130,vy:(Math.random()-.5)*130,c,life:1});}
function updateParticles(dt){for(const p of particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt*2;}particles=particles.filter(p=>p.life>0);}
function dist(a,b){return Math.hypot(a.x-b.x,a.y-b.y);}
function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
function rectCircle(r,c){return c.x>r.x&&c.x<r.x+r.w&&c.y>r.y&&c.y<r.y+r.h;}

function show(id){document.getElementById(id).classList.add('show');}
function hide(id){document.getElementById(id).classList.remove('show');}
function hideAllOverlays(){['menu','levels','result','help'].forEach(hide);}
function toast(t){}
function buildLevelGrid(){
  levelGrid.innerHTML='';
  for(let i=1;i<=19;i++){
    const b=document.createElement('button');b.textContent=i===19?'★ EL DUELO':i+'\n'+CLASSMATES[i-1];
    if(i>unlocked)b.classList.add('locked');b.disabled=i>unlocked;
    b.onclick=()=>{level=i;hide('levels');startLevel(i);};levelGrid.appendChild(b);
  }
}

addEventListener('keydown',e=>{keys[e.key]=true;if(e.code==='Space'){e.preventDefault();jump();}});
addEventListener('keyup',e=>keys[e.key]=false);
const joyEl=document.getElementById('joystick'),knob=document.getElementById('joyKnob');
function joyMove(e){
  const t=[...e.changedTouches].find(x=>x.identifier===joy.id);if(!t)return;
  const r=joyEl.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2,dx=t.clientX-cx,dy=t.clientY-cy,max=r.width*.33,l=Math.hypot(dx,dy)||1,s=Math.min(1,l/max);
  joy.x=dx/l*s;joy.y=dy/l*s;knob.style.transform=`translate(${joy.x*max}px,${joy.y*max}px)`;
}
joyEl.addEventListener('touchstart',e=>{const t=e.changedTouches[0];joy.id=t.identifier;joy.active=true;joyMove(e);e.preventDefault();},{passive:false});
joyEl.addEventListener('touchmove',e=>{joyMove(e);e.preventDefault();},{passive:false});
joyEl.addEventListener('touchend',e=>{if([...e.changedTouches].some(t=>t.identifier===joy.id)){joy.x=joy.y=0;joy.active=false;joy.id=null;knob.style.transform='translate(0,0)';}},{passive:false});
jumpBtn.addEventListener('pointerdown',e=>{e.preventDefault();jump();});

coverPlay.onclick=()=>{cover.classList.add('hide');setTimeout(()=>cover.style.display='none',380);};
menuPlay.onclick=()=>startLevel(level);
levelsBtn.onclick=()=>{running=false;stopMusic();hide('menu');show('levels');};
menuLevels.onclick=levelsBtn.onclick;
closeLevels.onclick=()=>{hide('levels');show('menu');};
startBtn.onclick=()=>startLevel(level);
musicBtn.onclick=toggleMusic;
helpBtn.onclick=()=>show('help');
closeHelp.onclick=()=>hide('help');
nextBtn.onclick=()=>startLevel(Math.min(19,level+1));
retryBtn.onclick=()=>startLevel(level);
resultLevels.onclick=()=>{hide('result');show('levels');};
playAgainFinal.onclick=()=>{hideFinalVictory();level=1;startLevel(1);};
levelsFinal.onclick=()=>{hideFinalVictory();show('levels');};



function startDuel(){
  duelMode=true;duelScore={tina:0,nito:0};duelRound=1;running=false;stopMusic();
  resetDuelWorld();
  const overlay=document.getElementById('duelCountdown');
  const title=document.getElementById('duelCountdownTitle');
  const num=document.getElementById('duelCountdownNumber');
  overlay.classList.add('show');title.textContent='¿ESTÁS PREPARADO?';num.textContent='';
  let n=5;
  clearInterval(duelCountdownTimer);
  setTimeout(()=>{num.textContent=n;tone(110,.12,'square',.04);duelCountdownTimer=setInterval(()=>{
    n--;if(n>0){num.textContent=n;tone(110+n*10,.12,'square',.04);}else{clearInterval(duelCountdownTimer);overlay.classList.remove('show');beginDuelRound();}
  },850);},900);
}
function resetDuelWorld(){
  level=19;mapScale=1.18;WORLD_W=Math.round(1850*mapScale);WORLD_H=Math.round(980*mapScale);recalcProgression(19);
  homeBase={x:90*mapScale,y:WORLD_H/2-115*mapScale,w:150*mapScale,h:230*mapScale};
  enemyBase={x:WORLD_W-240*mapScale,y:WORLD_H/2-115*mapScale,w:150*mapScale,h:230*mapScale};
  player={id:'tina',x:280*mapScale,y:WORLD_H/2,r:22,vx:1,vy:0,speed:240,jumps:progression.jumpCap,recharge:0,jump:null,inv:0,stun:0,bananas:0,carrying:null,flagHP:0,flagMaxHP:10,slow:0,speedBoost:0};
  const nitoSpawn={x:WORLD_W-280*mapScale,y:WORLD_H/2};
  bots=[{id:'nito',name:'Nito',personality:'duelist',x:nitoSpawn.x,y:nitoSpawn.y,spawnX:nitoSpawn.x,spawnY:nitoSpawn.y,r:22,speed:240,stun:0,inv:0,bananas:0,navPath:[],navTimer:0,stuckTime:0,lastX:nitoSpawn.x,lastY:nitoSpawn.y,jumps:progression.jumpCap,jumpCap:progression.jumpCap,jumpRecharge:progression.recharge,jumpCharge:0,jump:null,vx:-1,vy:0,carrying:null,flagHP:0,flagMaxHP:10,state:'neutral',decisionTimer:0,recoveryTimer:0}];
  guardians=[];traps=[];bananas=[];objects=[];homeFlag={kind:'home',x:-9999,y:-9999,homeX:-9999,homeY:-9999,r:1,carrier:null,dropped:false};
  flag={kind:'enemy',x:WORLD_W/2,y:WORLD_H/2,homeX:WORLD_W/2,homeY:WORLD_H/2,r:20,carrier:null,dropped:false};
  obstacles=makeDuelArena();particles=[];stats={jumpsUsed:0,hits:0,bananas:0};timeLeft=9999;levelElapsed=0;director=null;
  camera.x=clamp(WORLD_W/2-VIEW_W/2,0,WORLD_W-VIEW_W);camera.y=clamp(WORLD_H/2-VIEW_H/2,0,WORLD_H-VIEW_H);draw();
}
function makeDuelArena(){
  const a=[];const add=(x,y,w,h,type='hedge',low=false,breakable=false)=>a.push({x:x*mapScale,y:y*mapScale,w:w*mapScale,h:h*mapScale,type,low,breakable});
  add(0,0,1850,48,'trees');add(0,932,1850,48,'trees');add(0,0,48,980,'trees');add(1802,0,48,980,'trees');
  // Arena completamente simétrica: diagonales y cuatro decisiones alrededor del centro.
  [[410,180,250,62],[1190,180,250,62],[410,738,250,62],[1190,738,250,62],[680,330,90,150,'rock'],[1080,330,90,150,'rock'],[680,500,90,150,'rock'],[1080,500,90,150,'rock'],[870,180,110,90,'flowers'],[870,710,110,90,'flowers']].forEach(x=>add(...x));
  return a;
}
function beginDuelRound(){
  running=true;last=performance.now();startMusic();requestAnimationFrame(loop);
}
function resetDuelRound(){
  player.x=280*mapScale;player.y=WORLD_H/2;player.carrying=null;player.flagHP=0;player.jump=null;player.jumps=progression.jumpCap;player.recharge=0;player.inv=1;
  const n=bots[0];n.x=WORLD_W-280*mapScale;n.y=WORLD_H/2;n.carrying=null;n.flagHP=0;n.jump=null;n.jumps=progression.jumpCap;n.jumpCharge=0;n.inv=1;n.navPath=[];
  flag.x=flag.homeX;flag.y=flag.homeY;flag.carrier=null;flag.dropped=false;duelRound++;
}
function scoreDuel(who){
  if(duelRoundReset>0)return;
  duelScore[who]++;running=false;stopMusic();winSound();
  if(duelScore[who]>=2){
    unlocked=19;localStorage.setItem('tinaFlagUnlocked',19);
    if(who==='tina'){setTimeout(()=>showFinalVictory(),900);}
    else setTimeout(()=>{
      resultTitle.textContent='💚 ¡Lo hiciste genial!';
      resultText.innerHTML='Nito ganó este duelo por muy poquito.<br><b>¡La revancha ya está lista!</b>';
      upgradeBox.style.display='none';nextBtn.style.display='none';retryBtn.textContent='Revancha contra Nito';show('result');
    },700);
    return;
  }
  duelRoundReset=1.5;
  setTimeout(()=>{resetDuelRound();duelRoundReset=0;running=true;last=performance.now();startMusic();requestAnimationFrame(loop);},1500);
}
function drawDuelScore(){
  ctx.save();ctx.font='900 28px Arial';ctx.textAlign='center';ctx.fillStyle='#fff';ctx.strokeStyle='#173326';ctx.lineWidth=6;
  const txt=`TINA ${'★'.repeat(duelScore.tina)}${'☆'.repeat(2-duelScore.tina)}   —   ${'☆'.repeat(2-duelScore.nito)}${'★'.repeat(duelScore.nito)} NITO`;
  ctx.strokeText(txt,VIEW_W/2,48);ctx.fillText(txt,VIEW_W/2,48);ctx.restore();
}

function makeDirector(){
  const base=level===1?Infinity:level<=6?60:level<=12?40:30;
  return {base,remaining:base,warningPlayed:false,wave:0};
}
function registerAction(){
  lastActionAt=levelElapsed;
  if(director&&level>1)director.remaining=director.base;
}
function isMatchContested(){
  if(player.carrying||bots.some(b=>b.carrying)||flag.dropped||homeFlag.dropped)return true;
  return bots.some(b=>dist(player,b)<240*mapScale)||guardians.some(g=>dist(player,g)<210*mapScale);
}
function elephantWarning(){
  // Señal sonora añadida sobre la música existente; no reemplaza ninguna capa musical.
  tone(116,.42,'sawtooth',.055);tone(92,.55,'sawtooth',.04,.16);noiseHit(.05,.025,.35,500);
}
function updateDirector(dt){
  if(!director)return;
  if(level===1){
    if(!director.warningPlayed&&levelElapsed>=20){director.warningPlayed=true;elephantWarning();}
    return;
  }
  // Si la partida está reñida, el Director es más paciente.
  director.remaining-=dt*(isMatchContested()?.55:1);
  if(director.remaining>0)return;
  elephantWarning();
  setTimeout(()=>{if(running)spawnDirectorElephant();},1800);
  director.wave++;
  director.remaining=Math.max(5,director.base/Math.pow(2,director.wave));
}
function spawnDirectorElephant(){
  const fromLeft=Math.random()<.5;
  const lane=(Math.random()<.5?250:930)*mapScale;
  const x=fromLeft?90*mapScale:WORLD_W-90*mapScale;
  const safe=findSafePoint(x,lane,34);
  guardians.push({
    type:'elephant',directorElephant:true,x:safe.x,y:safe.y,spawnX:safe.x,spawnY:safe.y,r:31,
    v:(165+level*3)*Math.pow(1.04,Math.floor((level-1)/3)),dir:fromLeft?1:-1,
    target:null,targetCheck:0,lock:0,navPath:[],navTimer:0,jump:null,jumpCharge:0,phase:0,
    stuckTime:0,lastX:safe.x,lastY:safe.y,recoveryTimer:0,fury:true,furyLane:lane,furyDir:fromLeft?1:-1
  });
  burst(safe.x,safe.y,'#ffb36b');shake=14;registerAction('director-elephant');
}
function initAudio(){if(!audioCtx)audioCtx=new (window.AudioContext||window.webkitAudioContext)();if(audioCtx.state==='suspended')audioCtx.resume();}
function tone(f,d,type='sine',v=.025,delay=0){
  if(!musicOn)return;initAudio();
  const t=audioCtx.currentTime+delay,o=audioCtx.createOscillator(),g=audioCtx.createGain();
  o.type=type;o.frequency.value=f;
  g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(v,t+.015);g.gain.exponentialRampToValueAtTime(.0001,t+d);
  o.connect(g).connect(audioCtx.destination);o.start(t);o.stop(t+d+.05);
}
function midi(n){return 440*Math.pow(2,(n-69)/12);}
function noiseHit(delay=0,volume=.018,duration=.05,highpass=1200){
  if(!musicOn)return;initAudio();
  if(!noiseBuffer){
    noiseBuffer=audioCtx.createBuffer(1,audioCtx.sampleRate*.25,audioCtx.sampleRate);
    const d=noiseBuffer.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;
  }
  const t=audioCtx.currentTime+delay,src=audioCtx.createBufferSource(),filter=audioCtx.createBiquadFilter(),g=audioCtx.createGain();
  src.buffer=noiseBuffer;filter.type='highpass';filter.frequency.value=highpass;
  g.gain.setValueAtTime(volume,t);g.gain.exponentialRampToValueAtTime(.0001,t+duration);
  src.connect(filter).connect(g).connect(audioCtx.destination);src.start(t);src.stop(t+duration+.02);
}
function kick(delay=0,volume=.035){
  if(!musicOn)return;initAudio();const t=audioCtx.currentTime+delay,o=audioCtx.createOscillator(),g=audioCtx.createGain();
  o.type='sine';o.frequency.setValueAtTime(120,t);o.frequency.exponentialRampToValueAtTime(48,t+.11);
  g.gain.setValueAtTime(volume,t);g.gain.exponentialRampToValueAtTime(.0001,t+.13);
  o.connect(g).connect(audioCtx.destination);o.start(t);o.stop(t+.15);
}
const jazzLead=[67,69,72,74,72,69,67,64,65,67,69,72,70,67,65,62];
const jazzBass=[36,43,41,43,36,43,38,45];
const jazzChords=[[60,64,67],[65,69,72],[62,65,69],[67,71,74]];
function musicTick(){
  if(!musicOn)return;
  const tier=Math.floor((level-1)/3); // cada nuevo tipo de mapa suma capas
  const step=musicStep%16,beat=step%4,bar=Math.floor(step/4);
  const lead=jazzLead[step];
  // Base constante: contrabajo caminante y pulso de bombo.
  tone(midi(jazzBass[Math.floor(step/2)%jazzBass.length]),.25,'sine',.016);
  if(beat===0||beat===2)kick(0,.028);
  if(beat===1||beat===3)noiseHit(.01,.012,.045,1800);
  // Desde el segundo diseño: banjo/piano sincopado.
  if(tier>=1){
    const chord=jazzChords[bar%jazzChords.length];
    chord.forEach((n,i)=>tone(midi(n+12),.12,'triangle',.008,i*.008));
    if(step%2===1)tone(midi(55+(bar%2)*2),.09,'square',.005,.06);
  }
  // Desde el tercer diseño: clarinete juguetón.
  if(tier>=2)tone(midi(lead),.19,'triangle',.018,step%4===3?.035:0);
  // Desde el cuarto diseño: trompeta responde a la melodía.
  if(tier>=3&&step%2===0)tone(midi(lead+7),.13,'sawtooth',.009,.09);
  // Desde el quinto diseño: redoblante y platillo más activos.
  if(tier>=4){
    if(step%2===0)noiseHit(.08,.009,.075,3200);
    if(step===15)noiseHit(.12,.018,.18,4500);
  }
  // Últimos tres niveles: sección completa con llamada y respuesta.
  if(tier>=5){
    tone(midi(lead-12),.16,'square',.006,.15);
    if(step%4===2)tone(midi(84),.08,'triangle',.008,.18);
  }
  musicStep++;if(step===15)musicBar++;
}
function startMusic(){
  stopMusic();if(!musicOn)return;initAudio();musicStep=0;musicBar=0;musicTick();
  const interval=Math.max(250,330-Math.floor((level-1)/3)*8);
  musicTimer=setInterval(musicTick,interval);
}
function stopMusic(){if(musicTimer){clearInterval(musicTimer);musicTimer=null;}}
function toggleMusic(){musicOn=!musicOn;musicBtn.textContent='🎵 Música: '+(musicOn?'sí':'no');if(musicOn&&running)startMusic();else stopMusic();}
function winSound(){tone(523,.15,'triangle',.05);tone(659,.15,'triangle',.05,.13);tone(784,.25,'triangle',.055,.26);}

buildLevelGrid();resetLevel(1);draw();
