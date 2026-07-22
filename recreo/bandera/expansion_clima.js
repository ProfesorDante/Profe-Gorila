'use strict';

/* V14 — IA por personalidad, objetos físicos y lluvia viva. */
let weather='clear', puddles=[], rubble=[], projectiles=[], lightning=[], lightningClock=2.5, pendingItemDrops=[];
let duelWeather='clear', weatherBadge=null, playerDrift={x:0,y:0}, botDrift=new Map();
const CLIMATES={3:'rain',6:'night',8:'rain',10:'snow',12:'night',15:'rain',17:'storm'};
const WNAME={clear:'DESPEJADO',rain:'LLUVIA',storm:'TORMENTA ELÉCTRICA',night:'NOCHE',snow:'NIEVE'};
const WICON={clear:'☀️',rain:'🌧️',storm:'⛈️',night:'🌙',snow:'❄️'};
const IICON={helmet:'🪖',skateboard:'🛹',shoes:'👟',coconut:'🥥',rainboots:'🥾',umbrella:'☂️',raincoat:'🧥',
lightningrod:'⚡',flashlight:'🔦',candle:'🕯️',firefly:'🫙',sled:'🛷',coat:'🧥',snowshoes:'🥾',cocoa:'☕',
hammer:'🔨',bicycle:'🚲',football:'⚽',basketball:'🏀',baseball:'⚾',volleyball:'🏐',rugby:'🏉',softball:'🥎',magnet:'🧲',boomerang:'🪃',kite:'🪁',spring:'🌀',spiral:'💫',shield:'🛡️',bubble:'🫧'};
const BALL_TYPES=new Set(['football','basketball','baseball','volleyball','rugby','softball']);
const PROJECTILE_TYPES=new Set(['boomerang','kite']);
const GEAR_TYPES=new Set(['rainboots','umbrella','raincoat','coat','snowshoes','flashlight','candle','firefly','lightningrod']);

function climateFor(n){return n===19?duelWeather:(CLIMATES[n]||'clear');}
function initExtraEntity(e){
  if(!e)return;
  e.activeGear=null;e.gearTimer=0;e.boostKind=null;e.noJump=false;e.itemLockUntil=0;
  e.hammerReady=false;e.lastAutoItem=null;e.lastAutoItemTimer=0;e.defenseKind=null;e.springReady=false;e.confused=0;e.pendingShoesDrop=false;
}
function ensureExtraUI(){
  const shell=document.querySelector('.gameShell');
  if(!weatherBadge){
    weatherBadge=document.createElement('div');
    weatherBadge.style.cssText='position:absolute;left:18px;top:18px;z-index:8;padding:9px 14px;border-radius:999px;background:#10291ddd;color:#fff;border:2px solid #ffffff66;font:900 15px Arial;pointer-events:none';
    shell.appendChild(weatherBadge);
  }
  refreshExtraUI();
}
function refreshExtraUI(){if(weatherBadge)weatherBadge.textContent=`${WICON[weather]} ${WNAME[weather]}`;}
function setupClimate(){
  puddles=[];rubble=[];projectiles=[];lightning=[];pendingItemDrops=[];lightningClock=2.5;playerDrift={x:0,y:0};botDrift.clear();
  if(weather==='rain')[[560,370],[980,610],[1430,835],[1660,420],[760,910]].forEach(([x,y])=>puddles.push({x:x*mapScale,y:y*mapScale,rx:72*mapScale,ry:35*mapScale}));
}
const _resetLevel=resetLevel;
resetLevel=function(n=level){weather=climateFor(n);_resetLevel(n);setupClimate();initExtraEntity(player);bots.forEach(initExtraEntity);ensureExtraUI();missionText.textContent+=` Clima: ${WNAME[weather].toLowerCase()}.`;};
const _resetDuelWorld=resetDuelWorld;
resetDuelWorld=function(){duelWeather='clear';_resetDuelWorld();weather='clear';setupClimate();initExtraEntity(player);bots.forEach(initExtraEntity);ensureExtraUI();};
const _startDuel=startDuel;
startDuel=function(){_startDuel();setTimeout(()=>{const t=document.getElementById('duelCountdownTitle');if(t)t.textContent=`${WICON[duelWeather]} ${WNAME[duelWeather]} · ¿ESTÁS PREPARADO?`;},40);};

const _makeObjects=makeObjects;
makeObjects=function(){
  const pools={
    clear:['helmet','skateboard','shoes','hammer','football','basketball','baseball','bicycle','shield','spring'],
    rain:['rainboots','umbrella','raincoat','football','volleyball','skateboard','spring'],
    storm:['lightningrod','umbrella','helmet','baseball','football','bubble'],
    night:['flashlight','candle','firefly','helmet','shoes','softball','spiral'],
    snow:['sled','coat','snowshoes','cocoa','hammer','rugby','shield']
  };
  const pts=[[510,260],[770,860],[960,585],[1260,320],[1460,700],[1690,480]];
  const p=pools[climateFor(level)]||pools.clear;
  const out=pts.map(([x,y],i)=>makeWorldItem(x*mapScale,y*mapScale,p[(i+level)%p.length]));
  // Objetos secretos: rutas laterales y rincones. Se revelan solamente al acercarse.
  const secretsByWeather={
    clear:['magnet','spiral'],rain:['boomerang','spring'],storm:['kite','bubble'],night:['boomerang','spiral'],snow:['magnet','shield']
  };
  const s=secretsByWeather[climateFor(level)]||secretsByWeather.clear;
  const sideY1=level%2?170:BASE_WORLD_H-170, sideY2=level%2?BASE_WORLD_H-185:185;
  // Buscamos puntos seguros y, sobre todo, fuera de las bases para que un objeto secreto
  // no parezca formar parte del arco de llegada ni se active apenas empieza el nivel.
  const leftSecret=findSafePoint(520*mapScale,sideY1*mapScale,22);
  const rightSecret=findSafePoint((BASE_WORLD_W-520)*mapScale,sideY2*mapScale,22);
  out.push(makeWorldItem(leftSecret.x,leftSecret.y,s[0],true));
  out.push(makeWorldItem(rightSecret.x,rightSecret.y,s[1],true));
  return out;
};
function makeWorldItem(x,y,type,secret=false){return {x,y,r:BALL_TYPES.has(type)?20:18,type,got:false,ownerLock:null,lockUntil:0,secret,revealed:!secret,vx:0,vy:0,ballCooldown:0,lastKicker:null};}

/* Los objetos se activan al tocarlos: no existe inventario ni botón USAR. */
applyObjectTo=function(e,type){
  if(!e||BALL_TYPES.has(type))return;
  activateItem(e,type);
  tone(520,.08,'triangle',.035);
  // El objeto ya no reaparece donde fue recogido. Se suelta donde termina su efecto.
  // Los efectos instantáneos se depositan apenas concluyen; los buffs esperan su vencimiento o uso.
  if(['magnet','spiral','boomerang','kite'].includes(type)&&!PROJECTILE_TYPES.has(type))leaveUsedItem(e,type,3,e.x,e.y);
};
function leaveUsedItem(e,type,lock=3,x=e.x,y=e.y){
  // Nunca agregamos el objeto mientras checkWorld está recorriendo `objects`.
  // Hacerlo en ese momento permitía recoger la copia recién creada dentro del
  // mismo bucle y multiplicarla hasta congelar la partida.
  const dir=entityDirection(e);
  pendingItemDrops.push({
    ...makeWorldItem(
      clamp(x-dir.x*34,75,WORLD_W-75),
      clamp(y-dir.y*34,75,WORLD_H-75),
      type,
      false
    ),
    ownerLock:e.id,
    lockUntil:levelElapsed+lock
  });
}
function dropActiveItem(e,lock=1){
  if(!e)return;
  let type=null;
  if(e.hammerReady){type='hammer';e.hammerReady=false;}
  else if(e.jumpShoes){type='shoes';e.jumpShoes=false;}
  else if(e.activeGear){type=e.activeGear;e.activeGear=null;e.gearTimer=0;}
  else if(e.boostKind&&e.speedBoost>0){type=e.boostKind;e.speedBoost=0;e.boostKind=null;}
  if(type)leaveUsedItem(e,type,lock,e.x,e.y);
}
function activateItem(e,type){
  const dir=entityDirection(e),fx=dir.x,fy=dir.y;
  if(type==='helmet'){e.helmet=true;e.defenseKind='helmet';return;}
  if(type==='shield'){e.helmet=true;e.defenseKind='shield';return;}
  if(type==='bubble'){e.helmet=true;e.defenseKind='bubble';return;}
  if(type==='spring'){e.springReady=true;e.springTimer=9;return;}
  if(type==='spiral'){
    const rivals=[player,...bots].filter(x=>x&&x!==e).sort((a,b)=>dist(e,a)-dist(e,b));
    const t=rivals[0];if(t){t.confused=2;burst(t.x,t.y,'#d6a8ff');tone(260,.12,'sine',.04);}return;
  }
  if(type==='shoes'){e.jumpShoes=true;e.lastAutoItem='shoes';return;}
  if(type==='hammer'){e.hammerReady=true;e.lastAutoItem='hammer';return;}
  if(type==='skateboard'){e.speedBoost=4;e.boostKind='skateboard';return;}
  if(type==='bicycle'){e.speedBoost=3;e.boostKind='bicycle';return;}
  if(type==='sled'){e.speedBoost=4;e.boostKind='sled';return;}
  if(type==='cocoa'){e.speedBoost=5;e.boostKind='cocoa';return;}
  if(GEAR_TYPES.has(type)){e.activeGear=type;e.gearTimer=type==='lightningrod'?12:10;return;}
  if(type==='magnet'){
    for(const o of objects)if(!o.got&&dist(e,o)<280*mapScale){o.revealed=true;o.x+=(e.x-o.x)*.55;o.y+=(e.y-o.y)*.55;}
    return;
  }
  if(PROJECTILE_TYPES.has(type)){launch(e,type,fx,fy);return;}
  if(type==='coconut'){
    if(e===player)e.recharge=Math.min(progression.recharge,(e.recharge||0)+2);
    else e.jumpCharge=Math.min(e.jumpRecharge,(e.jumpCharge||0)+2);
    leaveUsedItem(e,type,3,e.x,e.y);
  }
}
function entityDirection(e){
  if(e===player){const i=getInputVector();if(i.len>.08)return {x:i.x,y:i.y};}
  const dx=e.vx||1,dy=e.vy||0,l=Math.hypot(dx,dy)||1;return {x:dx/l,y:dy/l};
}
function hammerHit(e){
  shake=12;burst(e.x,e.y,'#ffe391');tone(90,.18,'square',.06);
  for(const t of [player,...bots])if(t!==e&&dist(e,t)<150*mapScale){damageCarrier(t,4);dropActiveItem(t,1);knockbackFrom(t,e,150);}
  for(const g of guardians)if(dist(e,g)<150*mapScale){g.stun=.8;dropGuardianFlag(g);}
}
function launch(e,type,fx,fy){
  // Protección ante direcciones nulas o inválidas: evita que el arco cree un proyectil roto.
  if(!Number.isFinite(fx)||!Number.isFinite(fy)||Math.hypot(fx,fy)<.05){fx=1;fy=0;}
  const len=Math.hypot(fx,fy)||1;fx/=len;fy/=len;
  const sp=type==='kite'?350:390;
  projectiles.push({x:e.x+fx*34,y:e.y+fy*34,vx:fx*sp,vy:fy*sp,type,owner:e,life:type==='boomerang'?1.7:2.2,curve:0,returnItem:true,lockOwnerId:e.id||null,settled:false});
}
function dropGuardianFlag(g){if(g.carryingFlag){const f=g.carryingFlag;g.carryingFlag=null;f.carrier=null;f.dropped=true;f.x=g.x;f.y=g.y;}}

/* Ocultamos temporalmente pelotas y objetos bloqueados al chequeo normal; después aplicamos su física. */
const _checkWorld=checkWorld;
checkWorld=function(){
  const hidden=[];
  for(const o of objects){
    const owner=[player,...bots].find(e=>e.id===o.ownerLock);
    const blocked=owner&&levelElapsed<o.lockUntil&&dist(owner,o)<owner.r+o.r+5;
    if(BALL_TYPES.has(o.type)||blocked||(!o.revealed&&o.secret)){
      hidden.push([o,o.x,o.y,o.got]);o.x=o.y=-99999;o.got=true;
    }else if(o.ownerLock&&levelElapsed>=o.lockUntil)o.ownerLock=null;
  }
  _checkWorld();
  hidden.forEach(([o,x,y,got])=>{o.x=x;o.y=y;o.got=got;});
};

const _guardianHit=guardianHit;
guardianHit=function(g){dropActiveItem(player,1);if(g.type==='penguin'&&player.carrying)dropCarriedFlag(player);_guardianHit(g);};
const _guardianHitBot=guardianHitBot;
guardianHitBot=function(g,b){dropActiveItem(b,1);if(g.type==='penguin'&&b.carrying)dropCarriedFlag(b);_guardianHitBot(g,b);};

const _destroyNearElephant=destroyNearElephant;
destroyNearElephant=function(g){
  for(let i=obstacles.length-1;i>=0;i--){const o=obstacles[i];if(!o.breakable)continue;const cx=clamp(g.x,o.x,o.x+o.w),cy=clamp(g.y,o.y,o.y+o.h);if(Math.hypot(g.x-cx,g.y-cy)<g.r+38*mapScale){rubble.push({x:o.x,y:o.y,w:o.w,h:o.h});burst(cx,cy,'#d8b27b');obstacles.splice(i,1);g.navPath=[];}}
};
updateElephantFury=function(g,dt){
  g.fury=levelElapsed>=5&&((levelElapsed-5)%8)<3;
  if(!g.fury){patrolGuardian(g,dt);return;}
  if(!g.furyLane){g.furyLane=(Math.random()<.5?280:900)*mapScale;g.furyDir=g.x<WORLD_W/2?1:-1;}
  const tx=g.furyDir>0?WORLD_W-180*mapScale:180*mapScale;destroyNearElephant(g);navigateEntity(g,tx,g.furyLane,g.v*1.55,dt,false);
  if(Math.abs(g.x-tx)<75*mapScale){g.furyDir*=-1;g.furyLane=(g.furyLane<WORLD_H/2?900:280)*mapScale;}
};

const _makeGuardians=makeGuardians;
makeGuardians=function(){
  const a=_makeGuardians(), type=(weather==='rain'||weather==='storm')?'frog':weather==='snow'?'penguin':weather==='night'?'leopard':null;
  if(type){const p=findSafePoint(WORLD_W*.52,WORLD_H*.52,28);a.push({type,x:p.x,y:p.y,spawnX:p.x,spawnY:p.y,r:28,v:type==='penguin'?185:type==='leopard'?174:128,phase:0,target:null,targetCheck:0,navPath:[],navTimer:0,stun:0,missileClock:1.4,missile:0,windup:0,tongueClock:1.8,tongueTarget:null});}
  return a;
};
const _updateGuardians=updateGuardians;
updateGuardians=function(dt){
  const special=guardians.filter(g=>['frog','penguin','leopard'].includes(g.type));
  const normal=guardians.filter(g=>!['frog','penguin','leopard'].includes(g.type));
  guardians=normal;
  if(weather==='night'){
    for(const g of normal){g.phase+=dt;if(g.recoveryTimer>0)g.recoveryTimer-=dt;if(g.stun>0){g.stun-=dt;continue;}patrolGuardian(g,dt);guardianContacts(g);}
  }else _updateGuardians(dt);
  guardians=[...normal,...special];
  special.forEach(g=>updateSpecialGuardian(g,dt));
  specialInteractions(dt);
};
function nearestEntity(g){return [player,...bots].reduce((a,b)=>dist(g,b)<dist(g,a)?b:a,player);}
function scoringDistance(e){const b=e===player?homeBase:enemyBase;return Math.hypot(e.x-(b.x+b.w/2),e.y-(b.y+b.h/2));}
function updateSpecialGuardian(g,dt){
  g.phase+=dt;if(g.stun>0){g.stun-=dt;return;}
  if(g.type==='frog'){
    g.tongueClock-=dt;
    if(g.tongueTarget){
      g.tongueTarget.t-=dt;
      if(g.tongueTarget.t<=0){
        const o=g.tongueTarget.item;g.tongueTarget=null;
        if(o){const t=nearestEntity(g),dx=t.x-g.x,dy=t.y-g.y,l=Math.hypot(dx,dy)||1;o.got=true;projectiles.push({x:g.x,y:g.y,vx:dx/l*430,vy:dy/l*430,type:o.type,owner:g,life:2,curve:0,returnItem:true,lockOwnerId:null,settled:false});}
      }
    }else{
      const o=objects.filter(o=>!o.got&&o.revealed&&!BALL_TYPES.has(o.type)&&dist(g,o)<260*mapScale).sort((a,b)=>dist(g,a)-dist(g,b))[0];
      if(o&&g.tongueClock<=0){g.tongueClock=2.3;o.got=true;g.tongueTarget={item:o,t:.28};tone(180,.08,'square',.025);}
    }
    const t=nearestEntity(g);navigateEntity(g,t.x,t.y,g.v,dt,false);
  }else if(g.type==='penguin'){
    g.missileClock-=dt;
    const carriers=[player,...bots].filter(e=>e.carrying),t=(carriers.length?carriers:[player,...bots]).sort((a,b)=>dist(g,a)-dist(g,b))[0];
    if(g.missileClock<=0&&g.windup<=0&&g.missile<=0){g.missileClock=3.2;g.windup=.62;g.target=t;tone(540,.08,'triangle',.03);}
    if(g.windup>0){g.windup-=dt;if(g.windup<=0){g.missile=1.0;tone(760,.08,'sawtooth',.035);}return;}
    if(g.missile>0){g.missile-=dt;const dx=g.target.x-g.x,dy=g.target.y-g.y,l=Math.hypot(dx,dy)||1;moveWithSliding(g,dx/l*g.v*2.9*dt,dy/l*g.v*2.9*dt,false);}
    else{const tx=WORLD_W/2+Math.cos(g.phase*.7)*320*mapScale,ty=WORLD_H/2+Math.sin(g.phase*.9)*220*mapScale;navigateEntity(g,tx,ty,g.v*.65,dt,false);}
  }else{
    const carriers=[player,...bots].filter(e=>e.carrying);let t;
    if(carriers.length===1)t=carriers[0];
    else if(carriers.length>1)t=carriers.reduce((a,b)=>scoringDistance(b)<scoringDistance(a)?b:a,carriers[0]);
    else t=nearestEntity(g);
    navigateEntity(g,t.x,t.y,g.v*(t.carrying?1.22:1),dt,false);
  }
  guardianContacts(g);
}
function specialInteractions(dt){
  const jumpers=[player,...bots].filter(Boolean);
  for(const g of guardians){
    if(g.type==='turtle'&&g.shellShot>0){
      g.shellShot-=dt;moveWithSliding(g,g.shellVX*dt,g.shellVY*dt,false);g.shellVX*=.992;g.shellVY*=.992;
      for(const e of jumpers)if(e.inv<=0&&dist(e,g)<e.r+g.r){if(e.carrying)dropCarriedFlag(e);dropActiveItem(e,1);knockbackFrom(e,g,135);e.stun=.45;e.inv=.8;}
      for(const h of guardians)if(h!==g&&dist(h,g)<h.r+g.r){h.stun=.65;dropGuardianFlag(h);}
    }
    for(const e of jumpers){
      if(!e.jump||dist(e,g)>=e.r+g.r+10)continue;
      if(g.type==='parrot'){dropGuardianFlag(g);g.stun=.9;burst(g.x,g.y,'#fff');tone(980,.06,'square',.025);}
      if(g.type==='turtle'&&!g.shellShot){const dx=g.x-e.x,dy=g.y-e.y,l=Math.hypot(dx,dy)||1;g.shellShot=1.35;g.shellVX=dx/l*560;g.shellVY=dy/l*560;burst(g.x,g.y,'#dff7c5');tone(210,.07,'square',.03);}
    }
    if(g.type==='gorilla')for(const f of [flag,homeFlag])if(f&&f.dropped&&dist(g,f)<g.r+f.r+10){const a=Math.atan2(f.y-g.y,f.x-g.x);f.x=clamp(f.x+Math.cos(a)*170,70,WORLD_W-70);f.y=clamp(f.y+Math.sin(a)*170,70,WORLD_H-70);tone(150,.08,'square',.035);burst(f.x,f.y,'#ffe6a0');}
  }
}

/* Bots: misma pérdida de velocidad y deslizamiento que Tina. */
const _updateBotsClimate=updateBots;
updateBots=function(dt){
  const before=new Map(bots.map(b=>[b.id,{x:b.x,y:b.y,speed:b.speed}]));
  for(const b of bots){if(weather==='snow'&&!['coat','snowshoes'].includes(b.activeGear))b.speed*=.72;if((weather==='rain'||weather==='storm')&&!['rainboots','umbrella'].includes(b.activeGear))b.speed*=.92;}
  _updateBotsClimate(dt);
  for(const b of bots){
    const old=before.get(b.id);b.speed=old.speed;
    const slip=(weather==='rain'||weather==='storm')&&!['rainboots','umbrella'].includes(b.activeGear);
    const inPuddle=weather==='rain'&&isInPuddle(b);
    if(slip&&!b.jump){
      const d=botDrift.get(b.id)||{x:0,y:0};const mx=b.x-old.x,my=b.y-old.y,l=Math.hypot(mx,my);
      if(l>.1){const keep=inPuddle?.982:.94;d.x=d.x*keep+(mx/l)*(1-keep);d.y=d.y*keep+(my/l)*(1-keep);} 
      moveWithSliding(b,d.x*b.speed*dt*(inPuddle?.82:.25),d.y*b.speed*dt*(inPuddle?.82:.25),false);botDrift.set(b.id,d);
    }
  }
};
function isInPuddle(e){return puddles.some(p=>{const x=(e.x-p.x)/p.rx,y=(e.y-p.y)/p.ry;return x*x+y*y<1;});}

const _update=update;
update=function(dt){
  const beforeJump=new Map([player,...bots].filter(Boolean).map(e=>[e.id,!!e.jump]));
  for(const e of [player,...bots])if(e)e.noJump=false;
  updateRubble();climatePhysics(dt);_update(dt);
  // Quitamos los objetos consumidos y recién después incorporamos las caídas
  // pendientes. Así cada uso produce exactamente un objeto en el piso.
  objects=objects.filter(o=>!o.got);
  if(pendingItemDrops.length){objects.push(...pendingItemDrops);pendingItemDrops=[];}
  revealSecrets();updateBalls(dt);updateProjectiles(dt);updateLightning(dt);updateRubble();
  for(const e of [player,...bots])if(e){
    if(e.gearTimer>0){e.gearTimer-=dt;if(e.gearTimer<=0)e.activeGear=null;}
    if(e.boostKind==='bicycle'&&e.speedBoost>0)e.noJump=true;
    if(beforeJump.get(e.id)&&!e.jump&&e.hammerReady){e.hammerReady=false;hammerHit(e);}
  }
};
function revealSecrets(){for(const o of objects)if(o.secret&&!o.revealed&&[player,...bots].some(e=>dist(e,o)<135*mapScale)){o.revealed=true;burst(o.x,o.y,'#fff3a0');tone(1046,.09,'sine',.025);}}
function climatePhysics(dt){
  if(!player)return;const input=getInputVector();
  const slip=(weather==='rain'||weather==='storm')&&!['rainboots','umbrella'].includes(player.activeGear),puddle=weather==='rain'&&isInPuddle(player);
  if(slip&&!player.jump){const keep=puddle?.982:.94;playerDrift.x=playerDrift.x*keep+input.x*(1-keep);playerDrift.y=playerDrift.y*keep+input.y*(1-keep);if(input.len<.05)moveWithSliding(player,playerDrift.x*player.speed*dt*(puddle?1.65:.72),playerDrift.y*player.speed*dt*(puddle?1.65:.72),false);}
  if(weather==='snow'&&!['coat','snowshoes'].includes(player.activeGear))player.slow=Math.max(player.slow,.08);
}
function updateRubble(){for(const e of [player,...bots])if(e&&rubble.some(r=>circleRectCollision(e.x,e.y,e.r,r))){e.slow=Math.max(e.slow||0,.12);e.noJump=true;}}

const BALL_PROPS={
  football:{speed:450,damage:2,push:110,friction:.985,bounce:.55,tone:180,curve:0},
  basketball:{speed:370,damage:1,push:90,friction:.982,bounce:.72,tone:260,curve:.22},
  baseball:{speed:650,damage:2,push:72,friction:.988,bounce:.62,tone:760,curve:0},
  volleyball:{speed:330,damage:1,push:145,friction:.978,bounce:.78,tone:410,curve:.08},
  rugby:{speed:420,damage:2,push:125,friction:.983,bounce:.48,tone:145,curve:.32},
  softball:{speed:520,damage:1,push:92,friction:.986,bounce:.58,tone:620,curve:.10}
};
function kickBall(o,e,fromJump=false){
  if(o.ballCooldown>0)return;
  let d=entityDirection(e);
  if(fromJump){const a=Math.atan2(d.y,d.x)+(Math.random()-.5)*1.2;d={x:Math.cos(a),y:Math.sin(a)};}
  const props=BALL_PROPS[o.type]||BALL_PROPS.football;
  let ang=Math.atan2(d.y,d.x)+(props.curve||0)*(Math.random()<.5?-1:1);
  if(fromJump)ang+=(Math.random()-.5)*1.05;
  o.vx=Math.cos(ang)*props.speed;o.vy=Math.sin(ang)*props.speed;o.ballCooldown=.22;o.lastKicker=e.id;
  tone(props.tone,.06,'square',.025);burst(o.x,o.y,'#fff2a8');
}
function updateBalls(dt){
  const ents=[player,...bots].filter(Boolean);
  for(const o of objects){
    if(!BALL_TYPES.has(o.type)||o.got)continue;
    if(o.ballCooldown>0)o.ballCooldown-=dt;
    const speed=Math.hypot(o.vx||0,o.vy||0);
    if(speed>4){
      const nx=o.x+o.vx*dt,ny=o.y+o.vy*dt;
      const bp=BALL_PROPS[o.type]||BALL_PROPS.football;if(collidesObstacle(nx,ny,o.r,false)){o.vx*=-bp.bounce;o.vy*=-bp.bounce;}else{o.x=clamp(nx,70,WORLD_W-70);o.y=clamp(ny,70,WORLD_H-70);}
      o.vx*=Math.pow(bp.friction,dt*60);o.vy*=Math.pow(bp.friction,dt*60);
      for(const e of ents)if(e.id!==o.lastKicker&&dist(e,o)<e.r+o.r&&speed>150){damageCarrier(e,bp.damage);dropActiveItem(e,1);knockbackFrom(e,o,bp.push);e.inv=.55;o.vx*=.48;o.vy*=.48;o.ballCooldown=.18;}
      for(const g of guardians)if(dist(g,o)<g.r+o.r&&speed>140){g.stun=.65;dropGuardianFlag(g);o.vx*=.5;o.vy*=.5;o.ballCooldown=.18;}
    }
    for(const e of ents){
      if(dist(e,o)>=e.r+o.r+3||o.ballCooldown>0)continue;
      if(e.jump)kickBall(o,e,true);
      else{
        const moving=e===player?getInputVector().len>.1:Math.hypot(e.vx||0,e.vy||0)>.4;
        if(moving)kickBall(o,e,false);
      }
    }
  }
}

function updateLightning(dt){
  if(weather!=='storm')return;
  lightningClock-=dt;if(lightningClock<=0){lightningClock=2.2+Math.random()*1.5;lightning.push({x:(220+Math.random()*(BASE_WORLD_W-440))*mapScale,y:(150+Math.random()*(BASE_WORLD_H-300))*mapScale,t:1.15,hit:false});}
  for(const m of lightning){m.t-=dt;if(m.t<=0&&!m.hit){m.hit=true;shake=13;tone(62,.22,'sawtooth',.07);for(const e of [player,...bots])if(dist(e,m)<115*mapScale){if(e.activeGear==='lightningrod'){e.activeGear=null;e.gearTimer=0;for(const x of [player,...bots])if(x!==e&&dist(x,e)<150*mapScale){damageCarrier(x,6);dropActiveItem(x,1);}}else{damageCarrier(e,6);dropActiveItem(e,1);e.stun=.7;}}}}
  lightning=lightning.filter(m=>m.t>-.28);
}
function settleProjectile(p){if(p.settled||!p.returnItem)return;p.settled=true;objects.push({...makeWorldItem(clamp(p.x,75,WORLD_W-75),clamp(p.y,75,WORLD_H-75),p.type,false),ownerLock:p.lockOwnerId||null,lockUntil:p.lockOwnerId?levelElapsed+3:0});}
function updateProjectiles(dt){
  for(const p of projectiles){
    p.life-=dt;if(p.type==='boomerang'&&p.life<.8&&p.owner){const dx=p.owner.x-p.x,dy=p.owner.y-p.y,l=Math.hypot(dx,dy)||1;p.vx=dx/l*420;p.vy=dy/l*420;}
    const nx=p.x+p.vx*dt,ny=p.y+p.vy*dt;if(collidesObstacle(nx,ny,11,false)){p.vx*=-.65;p.vy*=-.65;p.life-=.25;}else{p.x=nx;p.y=ny;}
    for(const e of [player,...bots])if(e!==p.owner&&dist(e,p)<e.r+13){damageCarrier(e,2);dropActiveItem(e,1);knockbackFrom(e,p,100);p.life=0;}
    for(const g of guardians)if(g!==p.owner&&dist(g,p)<g.r+13){g.stun=.7;dropGuardianFlag(g);p.life=0;}
    if(p.life<=0)settleProjectile(p);
  }
  projectiles=projectiles.filter(p=>p.life>0);
}

const _jump=jump;
jump=function(){if(player&&player.noJump){tone(90,.06,'square',.025);return;}_jump();};

const _drawWorld=drawWorld;
drawWorld=function(){
  _drawWorld();
  if(weather==='rain')for(const p of puddles){ctx.save();ctx.globalAlpha=.5;ctx.fillStyle='#4fa6c8';ctx.beginPath();ctx.ellipse(p.x,p.y,p.rx,p.ry,0,0,Math.PI*2);ctx.fill();for(let i=0;i<3;i++){const ph=(levelElapsed*1.8+i*.33)%1;ctx.globalAlpha=.34*(1-ph);ctx.strokeStyle='#d9f6ff';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(p.x+(i-1)*p.rx*.25,p.y,p.rx*.12+ph*p.rx*.34,p.ry*.10+ph*p.ry*.28,0,0,Math.PI*2);ctx.stroke();}ctx.restore();}
  if(weather==='snow'){ctx.save();ctx.globalAlpha=.42;ctx.fillStyle='#eef8ff';ctx.fillRect(0,0,WORLD_W,WORLD_H);ctx.restore();}
  for(const r of rubble){ctx.fillStyle='#786b5b';roundRect(r.x,r.y,r.w,r.h,16,true);ctx.font='24px serif';for(let x=r.x+18;x<r.x+r.w;x+=40)ctx.fillText('🪨',x,r.y+r.h*.65);}
  if(weather==='storm')for(const m of lightning){ctx.save();ctx.strokeStyle='#fff36b';ctx.lineWidth=6;ctx.beginPath();ctx.arc(m.x,m.y,115*mapScale,0,Math.PI*2);ctx.stroke();ctx.restore();}
};
drawObject=function(o){
  if(o.secret&&!o.revealed)return;
  ctx.save();
  if(o.secret){ctx.globalAlpha=.9+.1*Math.sin(levelElapsed*8);ctx.font='16px serif';ctx.textAlign='center';ctx.fillText('✨',o.x,o.y-19);}
  ctx.font=BALL_TYPES.has(o.type)?'34px serif':'30px serif';ctx.textAlign='center';ctx.fillText(IICON[o.type]||'🎁',o.x,o.y+8);ctx.restore();
};
const _drawEntities=drawEntities;
drawEntities=function(){
  _drawEntities();
  for(const p of projectiles){ctx.font='30px serif';ctx.textAlign='center';ctx.fillText(IICON[p.type]||'●',p.x,p.y+9);}
  for(const o of objects)if(!o.got&&o.ownerLock&&levelElapsed<o.lockUntil){ctx.strokeStyle='#ffffff88';ctx.lineWidth=3;ctx.beginPath();ctx.arc(o.x,o.y,23,0,Math.PI*2);ctx.stroke();}
};
const _drawGuardian=drawGuardian;
drawGuardian=function(g){
  if(g.type==='elephant'&&g.fury){ctx.save();ctx.globalAlpha=.42;ctx.fillStyle='#ff2b2b';ctx.beginPath();ctx.arc(g.x,g.y,41,0,Math.PI*2);ctx.fill();ctx.restore();}
  const m={frog:'🐸',penguin:'🐧',leopard:'🐆'};
  if(m[g.type]){
    ctx.save();
    if(g.type==='penguin'&&g.windup>0){ctx.globalAlpha=.35+.35*Math.sin(levelElapsed*28);ctx.fillStyle='#8ee8ff';ctx.beginPath();ctx.arc(g.x,g.y,45,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;ctx.font='20px serif';ctx.textAlign='center';ctx.fillText('⚠️',g.x,g.y-38);}
    if(g.type==='frog'&&g.tongueTarget){ctx.strokeStyle='#ff7c9b';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(g.x,g.y);ctx.lineTo(g.tongueTarget.item.x,g.tongueTarget.item.y);ctx.stroke();}
    ctx.font='48px serif';ctx.textAlign='center';ctx.fillText(m[g.type],g.x,g.y+16);ctx.restore();return;
  }
  _drawGuardian(g);
};
const _draw=draw;
draw=function(){_draw();ctx.save();if(weather==='night')nightOverlay();if(weather==='rain'||weather==='storm')rainOverlay();if(weather==='snow')snowOverlay();ctx.restore();};
function nightOverlay(){
  const px=player.x-camera.x,py=player.y-camera.y;ctx.fillStyle='rgba(2,8,18,.74)';ctx.fillRect(0,0,VIEW_W,VIEW_H);ctx.globalCompositeOperation='destination-out';ctx.fillStyle='rgba(0,0,0,.34)';ctx.fillRect(0,VIEW_H*.32,VIEW_W,VIEW_H*.36);
  const r=player.activeGear==='candle'?150:player.activeGear==='firefly'?125:84,g=ctx.createRadialGradient(px,py,10,px,py,r);g.addColorStop(0,'rgba(0,0,0,.92)');g.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=g;ctx.beginPath();ctx.arc(px,py,r,0,Math.PI*2);ctx.fill();
  if(player.activeGear==='flashlight'){const a=Math.atan2(player.vy||0,player.vx||1);ctx.translate(px,py);ctx.rotate(a);ctx.fillStyle='rgba(0,0,0,.6)';ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(250,-75);ctx.lineTo(250,75);ctx.closePath();ctx.fill();}
  ctx.globalCompositeOperation='source-over';
}
function rainOverlay(){ctx.strokeStyle='rgba(200,235,255,.42)';ctx.lineWidth=2;for(let i=0;i<110;i++){const x=(i*83+levelElapsed*420)%VIEW_W,y=(i*47+levelElapsed*660)%VIEW_H;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-9,y+20);ctx.stroke();if(i%11===0){ctx.globalAlpha=.35;ctx.beginPath();ctx.arc(x-9,y+20,3+((levelElapsed*8+i)%4),0,Math.PI*2);ctx.stroke();ctx.globalAlpha=1;}}}
function snowOverlay(){ctx.fillStyle='rgba(255,255,255,.8)';for(let i=0;i<75;i++){const x=(i*97+Math.sin(levelElapsed+i)*45)%VIEW_W,y=(i*53+levelElapsed*80)%VIEW_H;ctx.beginPath();ctx.arc(x,y,2+(i%3),0,Math.PI*2);ctx.fill();}}

const hc=document.querySelector('#help .card');
if(hc){const p=document.createElement('p');p.innerHTML='<b>Objetos sin botones:</b> tocá las mejoras para activarlas, empujá las pelotas con el cuerpo y usá el salto para el martillo, las zapatillas, las pelotas y algunos guardianes. Solo necesitás moverte y saltar.';hc.insertBefore(p,hc.querySelector('button'));}


/* --- V14: personalidades de IA y cierre del ciclo de los objetos --- */
const ITEM_PREFS={
  prankster:new Set(['magnet','spring','spiral','boomerang','kite']),
  offensive:new Set([...BALL_TYPES,'hammer']),
  strategist:new Set(['rainboots','umbrella','raincoat','coat','snowshoes','flashlight','candle','firefly','skateboard','bicycle','sled','shoes','cocoa']),
  defensive:new Set(['helmet','shield','bubble','raincoat','coat','lightningrod']),
  standard:new Set(),tutorial:new Set(),duelist:new Set()
};
function nearestPreferredItem(b){
  const pref=ITEM_PREFS[b.personality]||ITEM_PREFS.standard;
  const available=objects.filter(o=>!o.got&&o.revealed&&(!o.ownerLock||o.ownerLock!==b.id||levelElapsed>=o.lockUntil));
  const preferred=available.filter(o=>pref.has(o.type));
  const pool=preferred.length?preferred:available;
  if(!pool.length)return null;
  const nearest=pool.reduce((a,o)=>dist(b,o)<dist(b,a)?o:a,pool[0]);
  const max=preferred.length?360*mapScale:145*mapScale;
  return dist(b,nearest)<=max?nearest:null;
}
const _chooseBotGoalItems=chooseBotGoal;
chooseBotGoal=function(b,dt){
  if(b.confused>0){b.confused-=dt;const g=_chooseBotGoalItems(b,dt);return {x:2*b.x-g.x,y:2*b.y-g.y,speed:g.speed||1};}
  const item=nearestPreferredItem(b);
  if(item&&!b.carrying)return {x:item.x,y:item.y,speed:b.personality==='offensive'?1.22:1.08};
  return _chooseBotGoalItems(b,dt);
};

const _getInputVectorConfused=getInputVector;
getInputVector=function(){const i=_getInputVectorConfused();if(player&&player.confused>0)return {x:-i.y,y:i.x,len:i.len};return i;};

const _guardianDamageV14=guardianDamage;
guardianDamage=function(type){return type==='leopard'?4:_guardianDamageV14(type);};

function finishHeldEffect(e,type,lock=3){
  if(!e||!type)return;
  leaveUsedItem(e,type,lock,e.x,e.y);
}

const _updateV14Lifecycle=update;
update=function(dt){
  const ents=[player,...bots].filter(Boolean);
  const before=new Map(ents.map(e=>[e.id,{gear:e.activeGear,gearTimer:e.gearTimer,boost:e.boostKind,boostTimer:e.speedBoost,hammer:e.hammerReady,jump:!!e.jump,shoes:e.jumpShoes,helmet:e.helmet,defense:e.defenseKind,spring:e.springReady}]));
  _updateV14Lifecycle(dt);
  for(const e of ents){
    const b=before.get(e.id);if(!b)continue;
    if(e.confused>0)e.confused=Math.max(0,e.confused-dt);
    if(e.springTimer>0){e.springTimer-=dt;if(e.springTimer<=0&&e.springReady){e.springReady=false;finishHeldEffect(e,'spring',3);}}
    if(b.gear&&b.gearTimer>0&&!e.activeGear)finishHeldEffect(e,b.gear,3);
    if(b.boost&&b.boostTimer>0&&(!e.boostKind||e.speedBoost<=0))finishHeldEffect(e,b.boost,3);
    if(b.jump&&!e.jump&&e.pendingShoesDrop){e.pendingShoesDrop=false;finishHeldEffect(e,'shoes',3);}
    if(b.helmet&&!e.helmet&&b.defense){finishHeldEffect(e,b.defense,1);e.defenseKind=null;}
  }
  // Resorte: la próxima colisión corporal expulsa al rival y se consume.
  for(const b of bots){
    if(dist(player,b)<player.r+b.r+5){
      if(player.springReady){player.springReady=false;knockbackFrom(b,player,210);b.stun=.55;finishHeldEffect(player,'spring',3);burst(b.x,b.y,'#fff0a8');}
      else if(b.springReady){b.springReady=false;knockbackFrom(player,b,210);player.stun=.55;finishHeldEffect(b,'spring',3);burst(player.x,player.y,'#fff0a8');}
    }
  }
};

const _jumpV14=jump;
jump=function(){if(player&&player.jumpShoes)player.pendingShoesDrop=true;_jumpV14();};
const _startBotJumpV14=startBotJump;
startBotJump=function(b,tx,ty){if(b.jumpShoes)b.pendingShoesDrop=true;_startBotJumpV14(b,tx,ty);if(b.jump&&b.jumpShoes)b.jumpShoes=false;};

/* =====================================================================
   V15 — CIERRE DE MECÁNICAS: guardianes manipulables, IA contextual
   y garantía de objetos alcanzables. A partir de aquí: feature freeze.
   ===================================================================== */

const GUARDIAN_INTERACTION_PREFS={
  offensive:new Set(['turtle','gorilla']),
  defensive:new Set(['parrot','penguin']),
  strategist:new Set(['frog','elephant']),
  prankster:new Set(['sloth','leopard']),
  standard:new Set(['parrot','turtle','frog','gorilla','elephant','penguin','sloth','leopard']),
  tutorial:new Set(),duelist:new Set(['parrot','turtle','frog','gorilla','elephant','penguin','sloth','leopard'])
};
const PERSONALITY_ITEM_FALLBACKS={
  offensive:['football','baseball','hammer'],
  defensive:['shield','bubble','helmet'],
  strategist:['shoes','bicycle','rainboots'],
  prankster:['magnet','spring','spiral'],
  standard:['football','helmet','shoes']
};

function entityTeam(e){return e===player?'player':'bot';}
function validRivalFor(source,target){return source&&target&&source!==target&&entityTeam(source)!==entityTeam(target);}
function nearestRival(source){
  const all=[player,...bots].filter(Boolean).filter(e=>validRivalFor(source,e));
  return all.length?all.reduce((a,b)=>dist(source,b)<dist(source,a)?b:a,all[0]):null;
}
function nearestAnyEntity(source){
  const all=[player,...bots].filter(Boolean).filter(e=>e!==source);
  return all.length?all.reduce((a,b)=>dist(source,b)<dist(source,a)?b:a,all[0]):null;
}
function isDesperateBot(b){
  return !!(b&&((player&&player.carrying)||(homeFlag&&homeFlag.dropped)||(timeLeft<30&&!(b.carrying))));
}
function itemPathExistsForBot(b,o){
  if(!b||!o||o.got||!o.revealed)return false;
  if(collidesObstacle(o.x,o.y,(b.r||20)+5,false))return false;
  if(dist(b,o)<110*mapScale)return true;
  const p=findPath(b.x,b.y,o.x,o.y,(b.r||20)+3,false);
  return p&&p.length>0;
}
function safeReachableItemPoint(x,y,r=22){
  let p=findSafePoint(x,y,r);
  const probes=[
    p,
    findSafePoint(WORLD_W*.50,WORLD_H*.27,r),
    findSafePoint(WORLD_W*.50,WORLD_H*.73,r),
    findSafePoint(WORLD_W*.37,WORLD_H*.50,r),
    findSafePoint(WORLD_W*.63,WORLD_H*.50,r)
  ];
  for(const q of probes){
    if(collidesObstacle(q.x,q.y,r+4,false))continue;
    const reachableFromPlayer=player&&((dist(player,q)<120*mapScale)||findPath(player.x,player.y,q.x,q.y,player.r+3,false).length);
    const reachableFromBot=bots.some(b=>(dist(b,q)<120*mapScale)||findPath(b.x,b.y,q.x,q.y,b.r+3,false).length);
    if(reachableFromPlayer&&reachableFromBot)return q;
  }
  return findSafePoint(WORLD_W*.5,WORLD_H*.5,r);
}

/* Reorganización final: cada personalidad presente recibe al menos un objeto
   preferido y todo objeto se valida contra el mapa de navegación. */
const _makeObjectsV15=makeObjects;
makeObjects=function(){
  let out=_makeObjectsV15();
  const personalities=[...new Set(bots.map(b=>b.personality).filter(Boolean))];
  personalities.forEach((p,i)=>{
    const pref=PERSONALITY_ITEM_FALLBACKS[p]||PERSONALITY_ITEM_FALLBACKS.standard;
    if(!out.some(o=>(ITEM_PREFS[p]||ITEM_PREFS.standard).has(o.type))){
      const replace=out[i%Math.max(1,out.length)];
      if(replace)replace.type=pref[(level+i)%pref.length];
    }
  });
  out.forEach((o,i)=>{
    const q=safeReachableItemPoint(o.x,o.y,(o.r||18)+4);
    o.x=q.x;o.y=q.y;
    if(o.secret){
      // Sigue siendo lateral/oculto, pero nunca encerrado detrás de geometría imposible.
      const lateralX=i%2?WORLD_W*.72:WORLD_W*.28;
      const lateralY=i%3?WORLD_H*.22:WORLD_H*.78;
      const s=safeReachableItemPoint(lateralX,lateralY,(o.r||18)+4);o.x=s.x;o.y=s.y;
    }
  });
  return out;
};

/* Evita que una IA insista con un objeto sin ruta. */
nearestPreferredItem=function(b){
  const pref=ITEM_PREFS[b.personality]||ITEM_PREFS.standard;
  const available=objects.filter(o=>!o.got&&o.revealed&&(!o.ownerLock||o.ownerLock!==b.id||levelElapsed>=o.lockUntil)&&itemPathExistsForBot(b,o));
  const preferred=available.filter(o=>pref.has(o.type));
  const pool=preferred.length?preferred:available;
  if(!pool.length)return null;
  const nearest=pool.reduce((a,o)=>dist(b,o)<dist(b,a)?o:a,pool[0]);
  const max=preferred.length?390*mapScale:150*mapScale;
  return dist(b,nearest)<=max?nearest:null;
};

/* El plantel de guardianes también acompaña a las personalidades sin volver
   exclusivos los mapas. Se reemplaza como máximo un guardián común. */
const _makeGuardiansV15=makeGuardians;
makeGuardians=function(){
  const out=_makeGuardiansV15();
  const desired=[];
  for(const b of bots){
    const pref=[...(GUARDIAN_INTERACTION_PREFS[b.personality]||[])];
    if(pref.length)desired.push(pref[(level+b.id.length)%pref.length]);
  }
  const missing=desired.find(t=>!out.some(g=>g.type===t));
  if(missing){
    const replaceIndex=out.findIndex(g=>!['frog','penguin','leopard'].includes(g.type));
    if(replaceIndex>=0){
      const old=out[replaceIndex], baseV=missing==='elephant'?128:missing==='gorilla'?138:missing==='turtle'?116:missing==='parrot'?108:missing==='sloth'?98:128;
      out[replaceIndex]={...old,type:missing,v:(baseV+level*2.5)*Math.pow(1.05,Math.floor((level-1)/3)),r:missing==='elephant'?31:missing==='gorilla'?29:missing==='turtle'?27:25};
    }
  }
  return out;
};

function setGuardianRage(g,seconds=4){
  if(!g)return;g.rageTimer=Math.max(g.rageTimer||0,seconds);g.stun=0;g.navPath=[];g.targetCheck=0;burst(g.x,g.y,'#ff725e');tone(105,.12,'sawtooth',.05);
}
function triggerElephantStampede(g,source){
  const t=nearestAnyEntity(source)||nearestEntity(g);if(!t)return;
  const dx=t.x-g.x,dy=t.y-g.y,l=Math.hypot(dx,dy)||1;
  g.stampedeTimer=1.15;g.stampedeVX=dx/l*g.v*2.45;g.stampedeVY=dy/l*g.v*2.45;g.fury=true;g.navPath=[];burst(g.x,g.y,'#ffbd75');tone(72,.18,'square',.055);
}
function enrageLeopard(g){g.leopardRage=6;g.navPath=[];burst(g.x,g.y,'#ff5d5d');tone(155,.13,'sawtooth',.045);}
function guardianReactToImpact(g,source,kind){
  if(!g)return;
  if(g.type==='gorilla'&&['ball','turtle','frog'].includes(kind))setGuardianRage(g,4);
  if(g.type==='elephant'&&['ball','turtle','frog','projectile'].includes(kind))triggerElephantStampede(g,source);
  if(g.type==='sloth'&&kind==='ball'){
    const d=entityDirection(source||player);g.slothBounce=2;g.slothVX=d.x*410;g.slothVY=d.y*410;g.sleeping=false;g.stun=0;burst(g.x,g.y,'#d7f4b2');tone(220,.09,'triangle',.035);
  }
  if(g.type==='leopard'&&['ball','turtle','frog','projectile'].includes(kind))enrageLeopard(g);
}

/* Contacto del perezoso: abrazo, no golpe común. */
const _guardianContactsV15=guardianContacts;
guardianContacts=function(g){
  if(g.type!=='sloth'){_guardianContactsV15(g);return;}
  if(g.slothBounce>0||g.hugTarget)return;
  const targets=[player,...bots].filter(Boolean);
  for(const e of targets){
    if(dist(g,e)<g.r+e.r+3&&e.inv<=0&&(e.slothImmune||0)<=0&&!e.jump){
      e.stun=Math.max(e.stun||0,3);e.inv=.35;g.hugTarget=e;g.hugTimer=3;burst(e.x,e.y,'#ffd9a8');tone(190,.08,'sine',.03);break;
    }
  }
};

/* Guardián especial definitivo: el sapo guarda, apunta y dispara. */
updateSpecialGuardian=function(g,dt){
  g.phase+=dt;if(g.stun>0){g.stun-=dt;return;}
  if(g.type==='frog'){
    if(g.frogAimTimer>0&&g.swallowedItem){
      g.frogAimTimer-=dt;
      const t=g.frogTarget&&[player,...bots].includes(g.frogTarget)?g.frogTarget:nearestEntity(g);g.frogTarget=t;
      if(t)navigateEntity(g,t.x,t.y,g.v*.36,dt,false);
      if(g.frogAimTimer<=0)frogSpit(g,t,false);
    }else if(!g.swallowedItem){
      g.tongueClock=(g.tongueClock||0)-dt;
      const o=objects.filter(o=>!o.got&&o.revealed&&!BALL_TYPES.has(o.type)&&dist(g,o)<285*mapScale).sort((a,b)=>dist(g,a)-dist(g,b))[0];
      if(o&&g.tongueClock<=0){
        g.tongueClock=2.1;o.got=true;g.swallowedItem={type:o.type};g.frogAimTimer=2+Math.random()*3;g.frogTarget=nearestEntity(g);tone(175,.08,'square',.03);burst(g.x,g.y,'#9ee776');
      }else{
        const t=nearestEntity(g);if(t)navigateEntity(g,t.x,t.y,g.v*.82,dt,false);
      }
    }
  }else if(g.type==='penguin'){
    g.missileClock=(g.missileClock||0)-dt;
    const carriers=[player,...bots].filter(e=>e.carrying),fallback=[player,...bots].filter(Boolean);
    const t=(carriers.length?carriers:fallback).sort((a,b)=>dist(g,a)-dist(g,b))[0];
    if(g.missileClock<=0&&g.windup<=0&&g.missile<=0){g.missileClock=3.25;g.windup=.68;g.target=t;g.missileClosest=Infinity;tone(540,.08,'triangle',.03);}
    if(g.windup>0){g.windup-=dt;if(g.windup<=0){g.missile=1.05;g.missileClosest=Infinity;tone(760,.08,'sawtooth',.035);}return;}
    if(g.missile>0){
      g.missile-=dt;const target=g.target||t;if(target){const d0=dist(g,target);g.missileClosest=Math.min(g.missileClosest||Infinity,d0);const dx=target.x-g.x,dy=target.y-g.y,l=Math.hypot(dx,dy)||1;moveWithSliding(g,dx/l*g.v*2.9*dt,dy/l*g.v*2.9*dt,false);}
      if(g.missile<=0&&target&&target.jump&&(g.missileClosest||999)<105*mapScale){
        // Esquiva conseguida: el pingüino se recalienta y vuelve contra el objetivo más cercano.
        const n=nearestAnyEntity(target)||target;g.target=n;g.windup=.38;g.missileClock=2.8;burst(g.x,g.y,'#ff7f6c');tone(220,.11,'square',.04);
      }
    }else{const tx=WORLD_W/2+Math.cos(g.phase*.7)*320*mapScale,ty=WORLD_H/2+Math.sin(g.phase*.9)*220*mapScale;navigateEntity(g,tx,ty,g.v*.65,dt,false);}
  }else if(g.type==='leopard'){
    if(g.leopardRage>0){
      g.leopardRage-=dt;const carriers=[player,...bots].filter(e=>e.carrying);
      const t=(carriers.length?carriers:[player,...bots]).sort((a,b)=>dist(g,a)-dist(g,b))[0];if(t)navigateEntity(g,t.x,t.y,g.v*1.65,dt,false);
    }else{
      const carriers=[player,...bots].filter(e=>e.carrying);let t;
      if(carriers.length===1)t=carriers[0];else if(carriers.length>1)t=carriers.reduce((a,b)=>scoringDistance(b)<scoringDistance(a)?b:a,carriers[0]);else t=nearestEntity(g);
      if(t)navigateEntity(g,t.x,t.y,g.v*(t.carrying?1.22:1),dt,false);
    }
  }
  guardianContacts(g);
};

function frogSpit(g,target,forced=false){
  if(!g||!g.swallowedItem)return;
  target=target||nearestEntity(g);if(!target)return;
  const dx=target.x-g.x,dy=target.y-g.y,l=Math.hypot(dx,dy)||1;
  projectiles.push({x:g.x,y:g.y,vx:dx/l*455,vy:dy/l*455,type:g.swallowedItem.type,owner:g,life:2.2,curve:0,returnItem:true,lockOwnerId:null,settled:false,frogShot:true,damage:3,stun:1.5});
  g.swallowedItem=null;g.frogAimTimer=0;g.frogTarget=null;burst(g.x,g.y,'#ff9aad');tone(forced?310:260,.1,'square',.045);
}

/* Interacciones de salto, rebote, estampida y furia. */
const _specialInteractionsV15=specialInteractions;
specialInteractions=function(dt){
  _specialInteractionsV15(dt);
  const ents=[player,...bots].filter(Boolean);
  for(const g of guardians){
    if(g.rageTimer>0){
      g.rageTimer-=dt;const target=nearestEntity(g);if(target)navigateEntity(g,target.x,target.y,g.v*1.48,dt,false);
    }
    if(g.stampedeTimer>0){
      g.stampedeTimer-=dt;destroyNearElephant(g);moveWithSliding(g,g.stampedeVX*dt,g.stampedeVY*dt,false);
      for(const e of ents)if(e.inv<=0&&dist(g,e)<g.r+e.r){damageCarrier(e,4);dropActiveItem(e,1);knockbackFrom(e,g,170);e.stun=.55;e.inv=.9;}
    }
    if(g.slothBounce>0){
      g.slothBounce-=dt;const nx=g.x+g.slothVX*dt,ny=g.y+g.slothVY*dt;
      if(collidesObstacle(nx,ny,g.r,false)){g.slothVX*=-.82;g.slothVY*=-.82;}else{g.x=nx;g.y=ny;}
      if(!g.hugTarget){for(const e of ents)if(e.inv<=0&&(e.slothImmune||0)<=0&&dist(g,e)<g.r+e.r){e.stun=Math.max(e.stun||0,3);e.inv=.35;g.hugTarget=e;g.hugTimer=3;break;}}
    }
    if(g.hugTimer>0&&g.hugTarget){
      const held=g.hugTarget;g.hugTimer-=dt;g.x=held.x-18;g.y=held.y+4;
      if(g.hugTimer<=0){held.stun=0;held.slothImmune=2;held.inv=Math.max(held.inv||0,.45);g.hugTarget=null;const safe=findSafePoint(g.x-72,g.y,g.r+5);g.x=safe.x;g.y=safe.y;burst(held.x,held.y,'#d9f6ff');}
    }
    if(g.type==='frog'&&g.swallowedItem){
      for(const e of ents){if(e.jump&&dist(e,g)<e.r+g.r+11){
        const target=e===player?bots.sort((a,b)=>dist(g,a)-dist(g,b))[0]:player;
        frogSpit(g,target,true);g.stun=.45;break;
      }}
    }
  }
};

/* Pelotas: además del daño, despiertan reacciones propias de cada guardián. */
const _updateBallsV15=updateBalls;
updateBalls=function(dt){
  const before=new Map();
  for(const o of objects)if(BALL_TYPES.has(o.type))before.set(o,{vx:o.vx||0,vy:o.vy||0});
  _updateBallsV15(dt);
  for(const o of objects){
    if(!BALL_TYPES.has(o.type)||o.got)continue;
    const pre=before.get(o),speed=pre?Math.hypot(pre.vx,pre.vy):0;if(speed<140)continue;
    for(const g of guardians)if(dist(g,o)<g.r+o.r+8){
      const kicker=[player,...bots].find(e=>e.id===o.lastKicker)||player;
      guardianReactToImpact(g,kicker,'ball');
    }
  }
};

/* Proyectiles del sapo: 1,5 corazones + 1,5 s de aturdimiento y reacción en guardianes. */
updateProjectiles=function(dt){
  for(const p of projectiles){
    p.life-=dt;if(p.type==='boomerang'&&p.life<.8&&p.owner){const dx=p.owner.x-p.x,dy=p.owner.y-p.y,l=Math.hypot(dx,dy)||1;p.vx=dx/l*420;p.vy=dy/l*420;}
    const nx=p.x+p.vx*dt,ny=p.y+p.vy*dt;if(collidesObstacle(nx,ny,11,false)){p.vx*=-.65;p.vy*=-.65;p.life-=.25;}else{p.x=nx;p.y=ny;}
    for(const e of [player,...bots])if(e!==p.owner&&dist(e,p)<e.r+13){damageCarrier(e,p.damage||2);dropActiveItem(e,1);knockbackFrom(e,p,110);e.stun=Math.max(e.stun||0,p.stun||.45);e.inv=.7;p.life=0;}
    for(const g of guardians)if(g!==p.owner&&dist(g,p)<g.r+13){guardianReactToImpact(g,p.owner,p.frogShot?'frog':'projectile');g.stun=Math.max(g.stun||0,.18);dropGuardianFlag(g);p.life=0;}
    if(p.life<=0)settleProjectile(p);
  }
  projectiles=projectiles.filter(p=>p.life>0);
};

/* Caparazón de tortuga contra guardianes: también activa sus reacciones. */
const _specialInteractionsTurtleV15=specialInteractions;
specialInteractions=function(dt){
  _specialInteractionsTurtleV15(dt);
  for(const t of guardians.filter(g=>g.type==='turtle'&&g.shellShot>0)){
    for(const g of guardians)if(g!==t&&dist(g,t)<g.r+t.r+5)guardianReactToImpact(g,t,'turtle');
  }
};

/* Decisiones de interacción de IA: 10% normal, 22% favorita; +15 puntos
   cuando está perdiendo. Solo se eligen objetivos cercanos y navegables. */
const _chooseBotGoalV15=chooseBotGoal;
chooseBotGoal=function(b,dt){
  b.guardianIdeaClock=(b.guardianIdeaClock||0)-dt;
  if(b.guardianIdeaClock<=0&&!b.carrying){
    b.guardianIdeaClock=.8+Math.random()*.8;
    const prefs=GUARDIAN_INTERACTION_PREFS[b.personality]||GUARDIAN_INTERACTION_PREFS.standard;
    const candidates=guardians.filter(g=>{
      if(dist(b,g)>380*mapScale)return false;
      const path=findPath(b.x,b.y,g.x,g.y,b.r+3,false);return dist(b,g)<100*mapScale||path.length>0;
    });
    if(candidates.length){
      const preferred=candidates.filter(g=>prefs.has(g.type));
      const pool=preferred.length?preferred:candidates;
      const chance=(preferred.length?.22:.10)+(isDesperateBot(b)?.15:0);
      if(Math.random()<chance){
        const g=pool.reduce((a,x)=>dist(b,x)<dist(b,a)?x:a,pool[0]);
        b.guardianPlan={g,until:levelElapsed+1.8};
      }
    }
  }
  if(b.guardianPlan&&levelElapsed<b.guardianPlan.until&&guardians.includes(b.guardianPlan.g)){
    const g=b.guardianPlan.g;
    // Para sapo/loro/tortuga busca caer encima; para los demás busca provocar contacto/impacto.
    if(['frog','parrot','turtle'].includes(g.type)&&dist(b,g)<125*mapScale&&b.jumps>0&&!b.jump)startBotJump(b,g.x,g.y);
    return {x:g.x,y:g.y,speed:1.16};
  }
  b.guardianPlan=null;
  return _chooseBotGoalV15(b,dt);
};

/* Noche corregida: Tina, bots y guardianes conservan una silueta legible. */
nightOverlay=function(){
  // Noche legible: reduce visión sin ocultar el juego. Mucho más liviana para celular.
  ctx.fillStyle='rgba(3,12,24,.40)';ctx.fillRect(0,0,VIEW_W,VIEW_H);
  ctx.globalCompositeOperation='destination-out';
  const lights=[player,...bots].filter(Boolean);
  for(const e of lights){
    const ex=e.x-camera.x,ey=e.y-camera.y;
    let r=e===player?(player.activeGear==='candle'?190:player.activeGear==='firefly'?170:145):112;
    const gr=ctx.createRadialGradient(ex,ey,12,ex,ey,r);gr.addColorStop(0,'rgba(0,0,0,1)');gr.addColorStop(.55,'rgba(0,0,0,.82)');gr.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=gr;ctx.beginPath();ctx.arc(ex,ey,r,0,Math.PI*2);ctx.fill();
  }
  for(const g of guardians){const gx=g.x-camera.x,gy=g.y-camera.y;const gr=ctx.createRadialGradient(gx,gy,5,gx,gy,72);gr.addColorStop(0,'rgba(0,0,0,.9)');gr.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=gr;ctx.beginPath();ctx.arc(gx,gy,72,0,Math.PI*2);ctx.fill();}
  if(player.activeGear==='flashlight'){
    const px=player.x-camera.x,py=player.y-camera.y,a=Math.atan2(player.vy||0,player.vx||1);ctx.save();ctx.translate(px,py);ctx.rotate(a);ctx.fillStyle='rgba(0,0,0,.82)';ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(300,-95);ctx.lineTo(300,95);ctx.closePath();ctx.fill();ctx.restore();
  }
  ctx.globalCompositeOperation='source-over';
};

/* Rediseño visual del sapo: cuerpo completo dibujado, no una carita aislada.
   Además se muestran estados especiales sin texto. */
const _drawGuardianV15=drawGuardian;
drawGuardian=function(g){
  if(g.type==='penguin'&&g.missile>0){
    ctx.save();ctx.translate(g.x,g.y);const t=g.target||player;ctx.rotate(Math.atan2(t.y-g.y,t.x-g.x)+Math.PI/2);ctx.font='46px serif';ctx.textAlign='center';ctx.fillText('🐧',0,15);ctx.restore();return;
  }
  if(g.type==='frog'){
    ctx.save();ctx.translate(g.x,g.y);
    if(g.frogAimTimer>0){ctx.globalAlpha=.22+.12*Math.sin(levelElapsed*10);ctx.fillStyle='#ffcf62';ctx.beginPath();ctx.arc(0,0,42,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;}
    ctx.fillStyle='#4dbb59';ctx.beginPath();ctx.ellipse(0,8,27,22,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#3a9d47';ctx.beginPath();ctx.ellipse(-22,22,16,8,-.35,0,Math.PI*2);ctx.ellipse(22,22,16,8,.35,0,Math.PI*2);ctx.fill();
    ctx.font='32px serif';ctx.textAlign='center';ctx.fillText('🐸',0,1);
    if(g.swallowedItem){ctx.font='20px serif';ctx.fillText(IICON[g.swallowedItem.type]||'●',0,17);}
    if(g.frogAimTimer>0&&g.frogTarget){ctx.strokeStyle='#ff7c9b';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(16,2);const dx=g.frogTarget.x-g.x,dy=g.frogTarget.y-g.y,l=Math.hypot(dx,dy)||1;ctx.lineTo(dx/l*48,dy/l*48);ctx.stroke();}
    ctx.restore();return;
  }
  if(g.type==='gorilla'&&g.rageTimer>0){ctx.save();ctx.globalAlpha=.32;ctx.fillStyle='#ff453a';ctx.beginPath();ctx.arc(g.x,g.y,43,0,Math.PI*2);ctx.fill();ctx.font='20px serif';ctx.textAlign='center';ctx.fillText('😡',g.x,g.y-35);ctx.restore();}
  if(g.type==='elephant'&&g.stampedeTimer>0){ctx.save();ctx.font='22px serif';ctx.textAlign='center';ctx.fillText('💨',g.x-35,g.y-24);ctx.restore();}
  if(g.type==='sloth'&&g.hugTimer>0){ctx.save();ctx.font='22px serif';ctx.textAlign='center';ctx.fillText('🤗',g.x,g.y-34);ctx.restore();}
  if(g.type==='leopard'&&g.leopardRage>0){ctx.save();ctx.globalAlpha=.3;ctx.fillStyle='#ff2f2f';ctx.beginPath();ctx.arc(g.x,g.y,42,0,Math.PI*2);ctx.fill();ctx.font='20px serif';ctx.textAlign='center';ctx.fillText('💢',g.x,g.y-35);ctx.restore();}
  _drawGuardianV15(g);
};

const hc15=document.querySelector('#help .card');
if(hc15){const p=document.createElement('p');p.innerHTML='<b>Guardianes interactivos:</b> saltá sobre el loro, la tortuga o el sapo; usá pelotas y rebotes para provocar al gorila, al elefante, al perezoso y al leopardo. Todo se resuelve moviéndote y saltando.';hc15.insertBefore(p,hc15.querySelector('button'));}


/* =========================================================
   V16 — PULIDO MOBILE, FOCO EN TINA Y DUELO CLIMÁTICO
   ========================================================= */
const V16_MOBILE = matchMedia('(pointer:coarse)').matches || /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);

// En celular, las partículas nunca crecen sin límite.
const _updateParticlesV16=updateParticles;
updateParticles=function(dt){_updateParticlesV16(dt);if(V16_MOBILE&&particles.length>55)particles.splice(0,particles.length-55);};

// Los guardianes que están a más de una pantalla de Tina "duermen" y no calculan rutas.
const _updateGuardiansV16=updateGuardians;
updateGuardians=function(dt){
  if(!V16_MOBILE||duelMode){_updateGuardiansV16(dt);return;}
  const all=guardians,active=[],sleeping=[];
  const wakeDistance=Math.hypot(VIEW_W,VIEW_H)*1.05;
  for(const g of all)(dist(g,player)<=wakeDistance||g.rageTimer>0||g.stampedeTimer>0||g.missile>0||g.hugTarget?active:sleeping).push(g);
  guardians=active;_updateGuardiansV16(dt);guardians=[...active,...sleeping];
};

// La IA piensa a intervalos, pero se mueve cada frame. Tina y la bandera mandan.
const _chooseBotGoalCoreV16=_chooseBotGoalV15;
chooseBotGoal=function(b,dt){
  // Si Tina lleva la bandera, se termina cualquier distracción: todos intentan frenarla.
  if(!duelMode&&player.carrying==='enemy'){
    b.guardianPlan=null;b.v16Goal={x:player.x,y:player.y,speed:1.34};b.v16Think=0;
    return b.v16Goal;
  }
  if(b.guardianPlan&&levelElapsed<b.guardianPlan.until&&guardians.includes(b.guardianPlan.g)){
    const g=b.guardianPlan.g;
    if(['frog','parrot','turtle'].includes(g.type)&&dist(b,g)<125*mapScale&&b.jumps>0&&!b.jump)startBotJump(b,g.x,g.y);
    return {x:g.x,y:g.y,speed:1.15};
  }
  b.guardianPlan=null;
  b.v16Think=(b.v16Think||0)-dt;
  if(b.v16Think>0&&b.v16Goal)return b.v16Goal;
  b.v16Think=(V16_MOBILE?.14:.09)+Math.random()*.05;

  // Un guardián solo interesa si puede usarse contra Tina ahora mismo.
  if(!duelMode&&!b.carrying){
    b.guardianIdeaClock=(b.guardianIdeaClock||0)-Math.max(dt,.1);
    if(b.guardianIdeaClock<=0){
      b.guardianIdeaClock=1.1+Math.random()*.9;
      const prefs=GUARDIAN_INTERACTION_PREFS[b.personality]||GUARDIAN_INTERACTION_PREFS.standard;
      const candidates=guardians.filter(g=>['frog','parrot','turtle'].includes(g.type)&&dist(b,g)<320*mapScale&&dist(player,g)<270*mapScale&&(dist(b,g)<95*mapScale||findPath(b.x,b.y,g.x,g.y,b.r+3,false).length));
      if(candidates.length){
        const preferred=candidates.filter(g=>prefs.has(g.type)),pool=preferred.length?preferred:candidates;
        const chance=(preferred.length?.14:.05)+(isDesperateBot(b)?.08:0);
        if(Math.random()<chance){const g=pool.reduce((a,x)=>dist(b,x)<dist(b,a)?x:a,pool[0]);b.guardianPlan={g,until:levelElapsed+1.25};b.v16Goal={x:g.x,y:g.y,speed:1.15};return b.v16Goal;}
      }
    }
  }
  b.v16Goal=_chooseBotGoalCoreV16(b,Math.max(dt,.09));
  return b.v16Goal;
};

// Gran Duelo: soleado → clima especial → soleado.
const _resetDuelRoundV16=resetDuelRound;
resetDuelRound=function(){
  _resetDuelRoundV16();
  weather=duelRound===2?['rain','night','snow','storm'][Math.floor(Math.random()*4)]:'clear';
  duelWeather=weather;setupClimate();initExtraEntity(player);bots.forEach(initExtraEntity);ensureExtraUI();
};

/* =========================================================
   V17 — DECISIONES HUMANAS, CLIMAS LEGIBLES Y PORTADA MÓVIL
   ========================================================= */

/* La IA no busca siempre la jugada óptima: elige una intención y se compromete
   por un rato. La personalidad cambia las probabilidades, no impone un patrón. */
const _chooseBotGoalBeforeV17=chooseBotGoal;

function v17WeightedPick(entries){
  const valid=entries.filter(e=>e&&e.weight>0);
  const total=valid.reduce((s,e)=>s+e.weight,0);
  if(!valid.length||total<=0)return null;
  let roll=Math.random()*total;
  for(const e of valid){roll-=e.weight;if(roll<=0)return e.key;}
  return valid[valid.length-1].key;
}

function v17AnyReachableItem(b,preferDenial=false){
  const available=objects.filter(o=>!o.got&&o.revealed&&(!o.ownerLock||o.ownerLock!==b.id||levelElapsed>=o.lockUntil)&&itemPathExistsForBot(b,o));
  if(!available.length)return null;
  const pref=ITEM_PREFS[b.personality]||ITEM_PREFS.standard;
  const scored=available.map(o=>{
    let score=dist(b,o);
    if(pref.has(o.type))score-=170*mapScale;
    if(preferDenial&&dist(player,o)<220*mapScale)score-=190*mapScale;
    return {o,score};
  }).sort((a,c)=>a.score-c.score);
  const chosen=scored[0].o;
  return dist(b,chosen)<430*mapScale?chosen:null;
}

function v17GuardianOpportunity(b){
  const prefs=GUARDIAN_INTERACTION_PREFS[b.personality]||GUARDIAN_INTERACTION_PREFS.standard;
  const candidates=guardians.filter(g=>{
    if(dist(b,g)>350*mapScale||dist(player,g)>300*mapScale)return false;
    return dist(b,g)<100*mapScale||findPath(b.x,b.y,g.x,g.y,b.r+3,false).length>0;
  });
  if(!candidates.length)return null;
  const preferred=candidates.filter(g=>prefs.has(g.type));
  const pool=preferred.length?preferred:candidates;
  return pool.reduce((a,g)=>dist(b,g)<dist(b,a)?g:a,pool[0]);
}

function v17DecisionWeights(b){
  const carrying=b.carrying==='home';
  const tinaHasFlag=player.carrying==='enemy';
  const nearTina=dist(b,player)<300*mapScale;
  const nearScore=carrying&&dist(b,{x:enemyBase.x+enemyBase.w/2,y:enemyBase.y+enemyBase.h/2})<360*mapScale;
  const p=b.personality;

  if(carrying){
    // Todas quieren marcar, pero no todas resisten la tentación de hacer otra cosa.
    const weights={score:62,attack:10,item:8,guardian:5,feint:15};
    if(p==='offensive'){weights.score=43;weights.attack=32;weights.feint=17;}
    if(p==='strategist'){weights.score=64;weights.item=20;weights.attack=5;weights.guardian=4;}
    if(p==='defensive'){weights.score=76;weights.feint=16;weights.attack=3;weights.guardian=2;}
    if(p==='prankster'){weights.score=48;weights.attack=15;weights.item=16;weights.guardian=14;}
    if(p==='standard'){weights.score=66;weights.attack=10;weights.item=8;weights.feint=11;}
    if(nearScore){weights.score+=45;weights.attack*=.25;weights.item*=.2;weights.guardian*=.2;}
    if(!nearTina)weights.attack*=.35;
    return weights;
  }

  const weights={objective:48,attack:14,item:15,guardian:8,defend:15};
  if(p==='offensive'){weights.objective=30;weights.attack=38;weights.item=16;weights.guardian=10;weights.defend=6;}
  if(p==='strategist'){weights.objective=42;weights.attack=8;weights.item=29;weights.guardian=13;weights.defend=8;}
  if(p==='defensive'){weights.objective=30;weights.attack=10;weights.item=18;weights.guardian=7;weights.defend=35;}
  if(p==='prankster'){weights.objective=29;weights.attack=16;weights.item=25;weights.guardian=23;weights.defend=7;}
  if(p==='tutorial'){weights.objective=58;weights.attack=6;weights.item=10;weights.guardian=3;weights.defend=23;}
  if(tinaHasFlag){weights.attack+=34;weights.defend+=14;weights.objective-=18;weights.item-=5;weights.guardian+=4;}
  if(!nearTina)weights.attack*=.55;
  return weights;
}

function v17MakeDecision(b){
  const weights=v17DecisionWeights(b);
  const item=v17AnyReachableItem(b,b.personality==='strategist');
  const guardian=v17GuardianOpportunity(b);
  if(!item)weights.item=0;
  if(!guardian)weights.guardian=0;
  const choices=Object.entries(weights).map(([key,weight])=>({key,weight}));
  const type=v17WeightedPick(choices)|| (b.carrying?'score':'objective');
  const duration=.75+Math.random()*1.45;
  return {type,item,guardian,until:levelElapsed+duration};
}

function v17GoalFromDecision(b,d){
  const baseCenter={x:enemyBase.x+enemyBase.w/2,y:enemyBase.y+enemyBase.h/2};
  switch(d.type){
    case 'score': {
      const lane=nearestQuietLane(b)+(Math.random()-.5)*55*mapScale;
      return {x:baseCenter.x,y:clamp(lane,100,WORLD_H-100),speed:1.18};
    }
    case 'attack':
      return {x:player.x+(player.vx||0)*45,y:player.y+(player.vy||0)*45,speed:b.personality==='offensive'?1.3:1.14};
    case 'item':
      if(d.item&&!d.item.got)return {x:d.item.x,y:d.item.y,speed:1.1};
      break;
    case 'guardian':
      if(d.guardian&&guardians.includes(d.guardian)){
        const g=d.guardian;
        if(['frog','parrot','turtle'].includes(g.type)&&dist(b,g)<125*mapScale&&b.jumps>0&&!b.jump)startBotJump(b,g.x,g.y);
        return {x:g.x,y:g.y,speed:1.13};
      }
      break;
    case 'defend':
      if(player.carrying==='enemy')return {x:player.x,y:player.y,speed:1.22};
      return {x:enemyBase.x-150*mapScale,y:clamp(player.y,120,WORLD_H-120),speed:.9};
    case 'feint': {
      // Amaga hacia Tina o hacia un lateral, pero no durante demasiado tiempo.
      if(dist(b,player)<230*mapScale)return {x:player.x,y:player.y,speed:1.12};
      return {x:b.x-70*mapScale,y:clamp(b.y+(Math.random()<.5?-1:1)*120*mapScale,100,WORLD_H-100),speed:1.05};
    }
    case 'objective':
    default:
      return {x:homeFlag.x,y:homeFlag.y,speed:1.06};
  }
  b.v17Decision=null;
  return b.carrying?{x:baseCenter.x,y:WORLD_H/2,speed:1.16}:{x:homeFlag.x,y:homeFlag.y,speed:1.05};
}

chooseBotGoal=function(b,dt){
  if(duelMode)return _chooseBotGoalBeforeV17(b,dt);
  if(b.confused>0){
    b.confused=Math.max(0,b.confused-dt);
    const g=_chooseBotGoalBeforeV17(b,dt);
    return {x:2*b.x-g.x,y:2*b.y-g.y,speed:g.speed||1};
  }
  if(!b.v17Decision||levelElapsed>=b.v17Decision.until||
     (b.v17Decision.item&&b.v17Decision.item.got)||
     (b.v17Decision.guardian&&!guardians.includes(b.v17Decision.guardian))){
    b.v17Decision=v17MakeDecision(b);
  }
  return v17GoalFromDecision(b,b.v17Decision);
};

/* Noche: funciona igual en PC y celular. Reduce información, nunca visibilidad básica. */
nightOverlay=function(){
  ctx.save();
  ctx.fillStyle='rgba(5,14,25,.24)';
  ctx.fillRect(0,0,VIEW_W,VIEW_H);
  ctx.globalCompositeOperation='destination-out';
  const lights=[player,...bots,...guardians].filter(Boolean);
  for(const e of lights){
    const ex=e.x-camera.x,ey=e.y-camera.y;
    const isPlayer=e===player;
    const radius=isPlayer?(player.activeGear==='candle'?245:player.activeGear==='firefly'?225:195):145;
    const gr=ctx.createRadialGradient(ex,ey,8,ex,ey,radius);
    gr.addColorStop(0,'rgba(0,0,0,.96)');
    gr.addColorStop(.58,'rgba(0,0,0,.72)');
    gr.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=gr;ctx.beginPath();ctx.arc(ex,ey,radius,0,Math.PI*2);ctx.fill();
  }
  if(player.activeGear==='flashlight'){
    const px=player.x-camera.x,py=player.y-camera.y,a=Math.atan2(player.vy||0,player.vx||1);
    ctx.save();ctx.translate(px,py);ctx.rotate(a);ctx.fillStyle='rgba(0,0,0,.9)';ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(380,-125);ctx.lineTo(380,125);ctx.closePath();ctx.fill();ctx.restore();
  }
  ctx.globalCompositeOperation='source-over';
  ctx.restore();
};

/* Lluvia visible pero barata: la mecánica nunca se apaga en celular. */
rainOverlay=function(){
  ctx.save();
  const count=V16_MOBILE?42:78;
  ctx.strokeStyle='rgba(205,240,255,.68)';ctx.lineWidth=V16_MOBILE?2.2:2;
  for(let i=0;i<count;i++){
    const x=(i*97+levelElapsed*510)%VIEW_W;
    const y=(i*61+levelElapsed*760)%VIEW_H;
    ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-11,y+25);ctx.stroke();
    if(i%9===0){ctx.globalAlpha=.42;ctx.beginPath();ctx.ellipse(x-11,y+25,8,3,0,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=1;}
  }
  ctx.restore();
};

/* Recalcular portada y canvas cuando cambian las barras u orientación móvil. */
function v17RefreshViewport(){
  document.documentElement.style.setProperty('--real-vh',`${window.innerHeight}px`);
}
v17RefreshViewport();
addEventListener('resize',v17RefreshViewport,{passive:true});
addEventListener('orientationchange',()=>setTimeout(v17RefreshViewport,120),{passive:true});


/* =========================================================
   V18 — NOCHE CORRECTA: máscara oscura con ventanas de luz
   ========================================================= */
let v18NightCanvas=null, v18NightCtx=null;
nightOverlay=function(){
  if(!v18NightCanvas){
    v18NightCanvas=document.createElement('canvas');
    v18NightCtx=v18NightCanvas.getContext('2d');
  }
  if(v18NightCanvas.width!==VIEW_W||v18NightCanvas.height!==VIEW_H){
    v18NightCanvas.width=VIEW_W;v18NightCanvas.height=VIEW_H;
  }
  const nctx=v18NightCtx;
  nctx.clearRect(0,0,VIEW_W,VIEW_H);
  // El mapa queda oscuro; las zonas alrededor de los personajes recuperan su color real.
  nctx.globalCompositeOperation='source-over';
  nctx.fillStyle='rgba(4,12,24,.48)';
  nctx.fillRect(0,0,VIEW_W,VIEW_H);
  nctx.globalCompositeOperation='destination-out';
  const lights=[player,...bots,...guardians].filter(Boolean);
  for(const e of lights){
    const ex=e.x-camera.x,ey=e.y-camera.y;
    const isPlayer=e===player;
    const radius=isPlayer?(player.activeGear==='candle'?250:player.activeGear==='firefly'?230:205):150;
    const gr=nctx.createRadialGradient(ex,ey,12,ex,ey,radius);
    gr.addColorStop(0,'rgba(0,0,0,1)');
    gr.addColorStop(.55,'rgba(0,0,0,.86)');
    gr.addColorStop(1,'rgba(0,0,0,0)');
    nctx.fillStyle=gr;nctx.beginPath();nctx.arc(ex,ey,radius,0,Math.PI*2);nctx.fill();
  }
  if(player.activeGear==='flashlight'){
    const px=player.x-camera.x,py=player.y-camera.y,a=Math.atan2(player.vy||0,player.vx||1);
    nctx.save();nctx.translate(px,py);nctx.rotate(a);nctx.fillStyle='rgba(0,0,0,.92)';
    nctx.beginPath();nctx.moveTo(0,0);nctx.lineTo(390,-130);nctx.lineTo(390,130);nctx.closePath();nctx.fill();nctx.restore();
  }
  nctx.globalCompositeOperation='source-over';
  ctx.drawImage(v18NightCanvas,0,0);
};

/* =========================================================
   V20 — NOCHE TOTAL: TINA SOLO VE SU PROPIO HALO
   ========================================================= */
nightOverlay=function(){
  if(!v18NightCanvas){
    v18NightCanvas=document.createElement('canvas');
    v18NightCtx=v18NightCanvas.getContext('2d');
  }
  if(v18NightCanvas.width!==VIEW_W||v18NightCanvas.height!==VIEW_H){
    v18NightCanvas.width=VIEW_W;v18NightCanvas.height=VIEW_H;
  }
  const nctx=v18NightCtx;
  nctx.clearRect(0,0,VIEW_W,VIEW_H);
  nctx.globalCompositeOperation='source-over';

  // Noche cerrada: fuera del alcance visual de Tina apenas se distingue el mapa.
  // El jaguar sigue viendo con normalidad por su IA, pero NO revela su posición
  // mediante un halo visible para el jugador.
  nctx.fillStyle='rgba(1,5,13,.88)';
  nctx.fillRect(0,0,VIEW_W,VIEW_H);
  nctx.globalCompositeOperation='destination-out';

  const px=player.x-camera.x,py=player.y-camera.y;
  let radius=184;
  if(player.activeGear==='candle')radius=240;
  else if(player.activeGear==='firefly')radius=220;

  // Única ventana de visión: el halo de Tina.
  const gr=nctx.createRadialGradient(px,py,12,px,py,radius);
  gr.addColorStop(0,'rgba(0,0,0,1)');
  gr.addColorStop(.52,'rgba(0,0,0,.98)');
  gr.addColorStop(.80,'rgba(0,0,0,.62)');
  gr.addColorStop(1,'rgba(0,0,0,0)');
  nctx.fillStyle=gr;
  nctx.beginPath();nctx.arc(px,py,radius,0,Math.PI*2);nctx.fill();

  // La linterna amplía la visión hacia la dirección en la que se mueve Tina.
  if(player.activeGear==='flashlight'){
    const a=Math.atan2(player.vy||0,player.vx||1);
    nctx.save();nctx.translate(px,py);nctx.rotate(a);
    const cone=nctx.createLinearGradient(0,0,430,0);
    cone.addColorStop(0,'rgba(0,0,0,.98)');
    cone.addColorStop(.72,'rgba(0,0,0,.78)');
    cone.addColorStop(1,'rgba(0,0,0,0)');
    nctx.fillStyle=cone;
    nctx.beginPath();nctx.moveTo(0,0);nctx.lineTo(430,-138);nctx.lineTo(430,138);nctx.closePath();nctx.fill();
    nctx.restore();
  }

  nctx.globalCompositeOperation='source-over';
  ctx.drawImage(v18NightCanvas,0,0);
};

rainOverlay=function(){
  ctx.save();
  if(V16_MOBILE){
    // En celular se conserva toda la jugabilidad de lluvia (charcos, sapo,
    // deslizamiento y objetos), pero se elimina la cortina de gotas que
    // podía tapar personajes y objetos en algunos navegadores móviles.
    ctx.fillStyle='rgba(65,82,88,.10)';
    ctx.fillRect(0,0,VIEW_W,VIEW_H);
    ctx.restore();
    return;
  }
  const count=78;
  ctx.strokeStyle='rgba(205,240,255,.68)';ctx.lineWidth=2;
  for(let i=0;i<count;i++){
    const x=(i*97+levelElapsed*510)%VIEW_W;
    const y=(i*61+levelElapsed*760)%VIEW_H;
    ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-11,y+25);ctx.stroke();
    if(i%9===0){ctx.globalAlpha=.42;ctx.beginPath();ctx.ellipse(x-11,y+25,8,3,0,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=1;}
  }
  ctx.restore();
};
