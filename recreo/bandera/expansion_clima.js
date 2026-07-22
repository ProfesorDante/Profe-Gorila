
'use strict';

/* V12 — EXPANSIÓN COMPLETA: clima, física y guardianes especiales */
let weather='clear', puddles=[], rubble=[], projectiles=[], lightning=[], lightningClock=2.5;
let duelWeather='clear', useBtn=null, weatherBadge=null, drift={x:0,y:0};
const CLIMATES={3:'rain',6:'night',8:'rain',10:'snow',12:'night',15:'rain',17:'storm'};
const WNAME={clear:'DESPEJADO',rain:'LLUVIA',storm:'TORMENTA ELÉCTRICA',night:'NOCHE',snow:'NIEVE'};
const WICON={clear:'☀️',rain:'🌧️',storm:'⛈️',night:'🌙',snow:'❄️'};
const IICON={helmet:'🪖',skateboard:'🛹',shoes:'👟',coconut:'🥥',rainboots:'🥾',umbrella:'☂️',raincoat:'🧥',
lightningrod:'⚡',flashlight:'🔦',candle:'🕯️',firefly:'🫙',sled:'🛷',coat:'🧥',snowshoes:'🥾',cocoa:'☕',
hammer:'🔨',bicycle:'🚲',football:'⚽',basketball:'🏀',tennis:'🎾',magnet:'🧲',boomerang:'🪃',kite:'🪁',bow:'🏹'};

function climateFor(n){return n===19?duelWeather:(CLIMATES[n]||'clear');}
function initExtraEntity(e){if(!e)return;e.heldItem=null;e.activeGear=null;e.gearTimer=0;e.boostKind=null;e.noJump=false;e.itemLockUntil=0;}
function ensureExtraUI(){
  const shell=document.querySelector('.gameShell');
  if(!weatherBadge){
    weatherBadge=document.createElement('div');weatherBadge.style.cssText='position:absolute;left:18px;top:18px;z-index:8;padding:9px 14px;border-radius:999px;background:#10291ddd;color:#fff;border:2px solid #ffffff66;font:900 15px Arial;pointer-events:none';
    shell.appendChild(weatherBadge);
  }
  if(!useBtn){
    useBtn=document.createElement('button');useBtn.style.cssText='position:absolute;right:132px;bottom:24px;z-index:8;width:92px;height:92px;border-radius:50%;border:5px solid #fff8;background:#2f6f50e8;color:#fff;font:900 30px Arial;box-shadow:0 7px 18px #0007;display:flex;flex-direction:column;align-items:center;justify-content:center;touch-action:none';
    useBtn.innerHTML='<b>—</b><small style="font-size:11px">USAR</small>';useBtn.onpointerdown=e=>{e.preventDefault();useItem(player)};shell.appendChild(useBtn);
  }
  refreshExtraUI();
}
function refreshExtraUI(){
  if(weatherBadge)weatherBadge.textContent=`${WICON[weather]} ${WNAME[weather]}`;
  if(useBtn&&player){useBtn.querySelector('b').textContent=player.heldItem?(IICON[player.heldItem]||'🎁'):'—';useBtn.style.opacity=player.heldItem?'1':'.45';}
}
function setupClimate(){
  puddles=[];rubble=[];projectiles=[];lightning=[];lightningClock=2.5;drift={x:0,y:0};
  if(weather==='rain')[[560,370],[980,610],[1430,835],[1660,420],[760,910]].forEach(([x,y])=>puddles.push({x:x*mapScale,y:y*mapScale,rx:72*mapScale,ry:35*mapScale}));
}
const _resetLevel=resetLevel;
resetLevel=function(n=level){weather=climateFor(n);_resetLevel(n);setupClimate();initExtraEntity(player);bots.forEach(initExtraEntity);ensureExtraUI();missionText.textContent+=` Clima: ${WNAME[weather].toLowerCase()}.`;};
const _resetDuelWorld=resetDuelWorld;
resetDuelWorld=function(){const a=['clear','rain','night','snow','storm'];duelWeather=a[Math.floor(Math.random()*a.length)];_resetDuelWorld();weather=duelWeather;setupClimate();initExtraEntity(player);bots.forEach(initExtraEntity);ensureExtraUI();};
const _startDuel=startDuel;
startDuel=function(){_startDuel();setTimeout(()=>{const t=document.getElementById('duelCountdownTitle');if(t)t.textContent=`${WICON[duelWeather]} ${WNAME[duelWeather]} · ¿ESTÁS PREPARADO?`;},40);};

const _makeObjects=makeObjects;
makeObjects=function(){
  const pools={
    clear:['helmet','skateboard','shoes','hammer','football','basketball','tennis','bicycle','bow','magnet'],
    rain:['rainboots','umbrella','raincoat','football','skateboard','boomerang','kite'],
    storm:['lightningrod','umbrella','helmet','tennis','kite','bow'],
    night:['flashlight','candle','firefly','helmet','shoes','boomerang','bow'],
    snow:['sled','coat','snowshoes','cocoa','hammer','tennis','magnet']
  };
  const pts=[[510,260],[770,860],[960,585],[1260,320],[1460,700],[1690,480]];
  const p=pools[climateFor(level)]||pools.clear;
  return pts.map(([x,y],i)=>({x:x*mapScale,y:y*mapScale,r:18,type:p[(i+level)%p.length],got:false,ownerLock:null,lockUntil:0}));
};

const _applyObjectTo=applyObjectTo;
applyObjectTo=function(e,type){if(!('heldItem'in e))initExtraEntity(e);if(e.heldItem)dropItem(e,1);e.heldItem=type;tone(520,.08,'triangle',.035);if(e===player)refreshExtraUI();};
function dropItem(e,lock=1){
  if(!e||!e.heldItem)return;const type=e.heldItem;e.heldItem=null;
  objects.push({x:e.x-30*(e.vx||1),y:e.y-30*(e.vy||0),r:18,type,got:false,ownerLock:e.id,lockUntil:levelElapsed+lock});
  if(e===player)refreshExtraUI();
}
function leaveUsedItem(e,type){objects.push({x:e.x-34*(e.vx||1),y:e.y-34*(e.vy||0),r:18,type,got:false,ownerLock:e.id,lockUntil:levelElapsed+3});}
function useItem(e){
  if(!e||!e.heldItem||!running)return;
  const type=e.heldItem;e.heldItem=null;
  const throwable=['football','basketball','tennis','boomerang','bow','kite'].includes(type);
  activateItem(e,type);
  // Los objetos equipables vuelven al piso al usarse. Los proyectiles vuelven al piso al terminar su recorrido.
  if(!throwable)leaveUsedItem(e,type);
  if(e===player)refreshExtraUI();
}
function activateItem(e,type){
  const dx=e.vx||1,dy=e.vy||0,l=Math.hypot(dx,dy)||1,fx=dx/l,fy=dy/l;
  if(type==='helmet'){e.helmet=true;return;}
  if(type==='shoes'){e.jumpShoes=true;return;}
  if(type==='skateboard'){e.speedBoost=4;e.boostKind='skateboard';return;}
  if(type==='bicycle'){e.speedBoost=3;e.boostKind='bicycle';return;}
  if(type==='sled'){e.speedBoost=4;e.boostKind='sled';return;}
  if(type==='cocoa'){e.speedBoost=5;e.boostKind='cocoa';return;}
  if(['rainboots','umbrella','raincoat','coat','snowshoes','flashlight','candle','firefly','lightningrod'].includes(type)){e.activeGear=type;e.gearTimer=type==='lightningrod'?12:10;return;}
  if(type==='hammer'){hammerHit(e);return;}
  if(type==='magnet'){for(const o of objects)if(!o.got&&dist(e,o)<280*mapScale){o.x+=(e.x-o.x)*.55;o.y+=(e.y-o.y)*.55;}return;}
  if(['football','basketball','tennis','boomerang','bow','kite'].includes(type)){launch(e,type,fx,fy);return;}
  if(type==='coconut'){e.recharge=Math.min(progression.recharge,(e.recharge||0)+2);}
}
function hammerHit(e){
  shake=12;burst(e.x,e.y,'#ffe391');tone(90,.18,'square',.06);
  for(const t of [player,...bots])if(t!==e&&dist(e,t)<150*mapScale){damageCarrier(t,4);dropItem(t,1);knockbackFrom(t,e,150);}
  for(const g of guardians)if(dist(e,g)<150*mapScale){g.stun=.8;if(g.carryingFlag){const f=g.carryingFlag;g.carryingFlag=null;f.carrier=null;f.dropped=true;f.x=g.x;f.y=g.y;}}
}
function launch(e,type,fx,fy){
  const sp=type==='tennis'?570:type==='bow'?510:type==='football'?390:330;
  projectiles.push({x:e.x+fx*34,y:e.y+fy*34,vx:fx*sp,vy:fy*sp,type,owner:e,life:type==='boomerang'?1.7:2.2,curve:type==='basketball'?.95:0,returnItem:true,lockOwnerId:e.id,settled:false});
}
const _checkWorld=checkWorld;
checkWorld=function(){
  const hidden=[];
  for(const o of objects){const owner=[player,...bots].find(e=>e.id===o.ownerLock);if(owner&&levelElapsed<o.lockUntil&&dist(owner,o)<owner.r+o.r){hidden.push([o,o.x,o.y]);o.x=o.y=-99999;}else if(o.ownerLock&&levelElapsed>=o.lockUntil)o.ownerLock=null;}
  _checkWorld();hidden.forEach(([o,x,y])=>{o.x=x;o.y=y;});
  for(const b of bots){if(b.heldItem&&(b.carrying||dist(b,player)<260*mapScale||Math.random()<.002))useItem(b);}
};
const _guardianHit=guardianHit;guardianHit=function(g){dropItem(player,1);if(g.type==='penguin'&&player.carrying)dropCarriedFlag(player);_guardianHit(g);};
const _guardianHitBot=guardianHitBot;guardianHitBot=function(g,b){dropItem(b,1);if(g.type==='penguin'&&b.carrying)dropCarriedFlag(b);_guardianHitBot(g,b);};

const _destroyNearElephant=destroyNearElephant;
destroyNearElephant=function(g){
  for(let i=obstacles.length-1;i>=0;i--){const o=obstacles[i];if(!o.breakable)continue;const cx=clamp(g.x,o.x,o.x+o.w),cy=clamp(g.y,o.y,o.y+o.h);if(Math.hypot(g.x-cx,g.y-cy)<g.r+38*mapScale){rubble.push({x:o.x,y:o.y,w:o.w,h:o.h});burst(cx,cy,'#d8b27b');obstacles.splice(i,1);g.navPath=[];}}
};
updateElephantFury=function(g,dt){
  g.fury=(levelElapsed%5)<3;
  if(!g.fury){patrolGuardian(g,dt);return;}
  if(!g.furyLane){g.furyLane=(Math.random()<.5?280:900)*mapScale;g.furyDir=g.x<WORLD_W/2?1:-1;}
  const tx=g.furyDir>0?WORLD_W-180*mapScale:180*mapScale;destroyNearElephant(g);navigateEntity(g,tx,g.furyLane,g.v*1.55,dt,false);
  if(Math.abs(g.x-tx)<75*mapScale){g.furyDir*=-1;g.furyLane=(g.furyLane<WORLD_H/2?900:280)*mapScale;}
};

const _makeGuardians=makeGuardians;
makeGuardians=function(){
  const a=_makeGuardians(), type=(weather==='rain'||weather==='storm')?'frog':weather==='snow'?'penguin':weather==='night'?'leopard':null;
  if(type){const p=findSafePoint(WORLD_W*.52,WORLD_H*.52,28);a.push({type,x:p.x,y:p.y,spawnX:p.x,spawnY:p.y,r:28,v:type==='penguin'?185:type==='leopard'?174:128,phase:0,target:null,targetCheck:0,navPath:[],navTimer:0,stun:0,missileClock:1.4,tongueClock:1.8});}
  return a;
};
const _updateGuardians=updateGuardians;
updateGuardians=function(dt){
  const special=guardians.filter(g=>['frog','penguin','leopard'].includes(g.type));
  const normal=guardians.filter(g=>!['frog','penguin','leopard'].includes(g.type));
  guardians=normal;
  if(weather==='night'){
    // De noche, los guardianes comunes no pueden ver: patrullan. El leopardo es el único cazador.
    for(const g of normal){
      g.phase+=dt;if(g.recoveryTimer>0)g.recoveryTimer-=dt;
      if(g.stun>0){g.stun-=dt;continue;}
      patrolGuardian(g,dt);guardianContacts(g);
    }
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
    g.tongueClock-=dt;const o=objects.filter(o=>!o.got&&dist(g,o)<260*mapScale).sort((a,b)=>dist(g,a)-dist(g,b))[0];
    if(o&&g.tongueClock<=0){g.tongueClock=2.3;o.got=true;setTimeout(()=>{if(running){o.got=false;const t=nearestEntity(g),dx=t.x-g.x,dy=t.y-g.y,l=Math.hypot(dx,dy)||1;projectiles.push({x:g.x,y:g.y,vx:dx/l*430,vy:dy/l*430,type:o.type,owner:g,life:2,curve:0});}},260);}
    const t=nearestEntity(g);navigateEntity(g,t.x,t.y,g.v,dt,false);
  }else if(g.type==='penguin'){
    g.missileClock-=dt;const carriers=[player,...bots].filter(e=>e.carrying),t=(carriers.length?carriers:[player,...bots]).sort((a,b)=>dist(g,a)-dist(g,b))[0];
    if(g.missileClock<=0){g.missileClock=2.7;g.missile=.95;g.target=t;}
    if(g.missile>0){g.missile-=dt;const dx=g.target.x-g.x,dy=g.target.y-g.y,l=Math.hypot(dx,dy)||1;moveWithSliding(g,dx/l*g.v*2.9*dt,dy/l*g.v*2.9*dt,false);}
    else{const tx=WORLD_W/2+Math.cos(g.phase*.7)*320*mapScale,ty=WORLD_H/2+Math.sin(g.phase*.9)*220*mapScale;navigateEntity(g,tx,ty,g.v*.65,dt,false);}
  }else{
    const carriers=[player,...bots].filter(e=>e.carrying);let t;
    if(carriers.length===1)t=carriers[0];else if(carriers.length>1)t=carriers.reduce((a,b)=>scoringDistance(b)<scoringDistance(a)?b:a,carriers[0]);else t=nearestEntity(g);
    navigateEntity(g,t.x,t.y,g.v*(t.carrying?1.22:1),dt,false);
  }
  guardianContacts(g);
}
function specialInteractions(dt){
  const jumpers=[player,...bots].filter(Boolean);
  for(const g of guardians){
    // Actualización física de la tortuga-caparázon fuera del render.
    if(g.type==='turtle'&&g.shellShot>0){
      g.shellShot-=dt;
      moveWithSliding(g,g.shellVX*dt,g.shellVY*dt,false);
      g.shellVX*=.992;g.shellVY*=.992;
      for(const e of jumpers){
        if(e.inv<=0&&dist(e,g)<e.r+g.r){
          if(e.carrying)dropCarriedFlag(e);dropItem(e,1);knockbackFrom(e,g,135);e.stun=.45;e.inv=.8;
        }
      }
      for(const h of guardians)if(h!==g&&dist(h,g)<h.r+g.r){h.stun=.65;if(h.carryingFlag){const f=h.carryingFlag;h.carryingFlag=null;f.carrier=null;f.dropped=true;f.x=h.x;f.y=h.y;}}
    }
    for(const e of jumpers){
      if(!e.jump||dist(e,g)>=e.r+g.r+10)continue;
      if(g.type==='parrot'){
        if(g.carryingFlag){const f=g.carryingFlag;g.carryingFlag=null;f.carrier=null;f.dropped=true;f.x=g.x;f.y=g.y;}
        g.stun=.9;burst(g.x,g.y,'#fff');tone(980,.06,'square',.025);
      }
      if(g.type==='turtle'&&!g.shellShot){
        const dx=g.x-e.x,dy=g.y-e.y,l=Math.hypot(dx,dy)||1;
        g.shellShot=1.35;g.shellVX=dx/l*560;g.shellVY=dy/l*560;burst(g.x,g.y,'#dff7c5');tone(210,.07,'square',.03);
      }
    }
    if(g.type==='gorilla')for(const f of [flag,homeFlag])if(f&&f.dropped&&dist(g,f)<g.r+f.r+10){
      const a=Math.atan2(f.y-g.y,f.x-g.x);f.x=clamp(f.x+Math.cos(a)*170,70,WORLD_W-70);f.y=clamp(f.y+Math.sin(a)*170,70,WORLD_H-70);tone(150,.08,'square',.035);burst(f.x,f.y,'#ffe6a0');
    }
  }
}

const _updateBotsClimate=updateBots;
updateBots=function(dt){const saved=bots.map(b=>b.speed);for(const b of bots){if(weather==='snow'&&!['coat','snowshoes'].includes(b.activeGear))b.speed*=.72;if((weather==='rain'||weather==='storm')&&!['rainboots','umbrella'].includes(b.activeGear))b.speed*=.92;} _updateBotsClimate(dt);bots.forEach((b,i)=>b.speed=saved[i]);};

const _update=update;
update=function(dt){
  for(const e of [player,...bots])if(e)e.noJump=false;
  updateRubble();
  climatePhysics(dt);
  _update(dt);
  updateProjectiles(dt);updateLightning(dt);updateRubble();
  for(const e of [player,...bots])if(e){
    if(e.gearTimer>0){e.gearTimer-=dt;if(e.gearTimer<=0)e.activeGear=null;}
    if(e.boostKind==='bicycle'&&e.speedBoost>0)e.noJump=true;
  }
};
function climatePhysics(dt){
  if(!player)return;
  const input=getInputVector();
  const slip=(weather==='rain'||weather==='storm')&&!['rainboots','umbrella'].includes(player.activeGear);
  const puddle=weather==='rain'&&puddles.some(p=>{const x=(player.x-p.x)/p.rx,y=(player.y-p.y)/p.ry;return x*x+y*y<1;});
  if(slip&&!player.jump){
    const keep=puddle?.965:.88;drift.x=drift.x*keep+input.x*(1-keep);drift.y=drift.y*keep+input.y*(1-keep);
    if(input.len<.05)moveWithSliding(player,drift.x*player.speed*dt*(puddle?1.2:.45),drift.y*player.speed*dt*(puddle?1.2:.45),false);
  }
  if(weather==='snow'&&!['coat','snowshoes'].includes(player.activeGear))player.slow=Math.max(player.slow,.08);
}
function updateRubble(){
  for(const e of [player,...bots])if(e&&rubble.some(r=>circleRectCollision(e.x,e.y,e.r,r))){e.slow=Math.max(e.slow||0,.12);e.noJump=true;}
}
function updateLightning(dt){
  if(weather!=='storm')return;lightningClock-=dt;if(lightningClock<=0){lightningClock=2.2+Math.random()*1.5;lightning.push({x:(220+Math.random()*(BASE_WORLD_W-440))*mapScale,y:(150+Math.random()*(BASE_WORLD_H-300))*mapScale,t:1.15,hit:false});}
  for(const m of lightning){m.t-=dt;if(m.t<=0&&!m.hit){m.hit=true;shake=13;tone(62,.22,'sawtooth',.07);for(const e of [player,...bots])if(dist(e,m)<115*mapScale){if(e.activeGear==='lightningrod'){for(const x of [player,...bots])if(x!==e&&dist(x,e)<150*mapScale){damageCarrier(x,6);dropItem(x,1);}}else{damageCarrier(e,6);dropItem(e,1);e.stun=.7;}}}}
  lightning=lightning.filter(m=>m.t>-.28);
}
function settleProjectile(p){
  if(p.settled||!p.returnItem)return;p.settled=true;
  objects.push({x:clamp(p.x,75,WORLD_W-75),y:clamp(p.y,75,WORLD_H-75),r:18,type:p.type,got:false,ownerLock:p.lockOwnerId||null,lockUntil:p.lockOwnerId?levelElapsed+3:0});
}
function updateProjectiles(dt){
  for(const p of projectiles){
    p.life-=dt;
    if(p.curve){const a=p.curve*dt,c=Math.cos(a),s=Math.sin(a),vx=p.vx*c-p.vy*s,vy=p.vx*s+p.vy*c;p.vx=vx;p.vy=vy;}
    if(p.type==='boomerang'&&p.life<.8&&p.owner){const dx=p.owner.x-p.x,dy=p.owner.y-p.y,l=Math.hypot(dx,dy)||1;p.vx=dx/l*420;p.vy=dy/l*420;}
    const nx=p.x+p.vx*dt,ny=p.y+p.vy*dt;
    if(collidesObstacle(nx,ny,11,false)){p.vx*=-.65;p.vy*=-.65;p.life-=.25;}else{p.x=nx;p.y=ny;}
    for(const e of [player,...bots])if(e!==p.owner&&dist(e,p)<e.r+13){
      damageCarrier(e,p.type==='tennis'?2:4);dropItem(e,1);knockbackFrom(e,p,100);p.life=0;
    }
    for(const g of guardians)if(g!==p.owner&&dist(g,p)<g.r+13){
      g.stun=.7;if(g.carryingFlag){const f=g.carryingFlag;g.carryingFlag=null;f.carrier=null;f.dropped=true;f.x=g.x;f.y=g.y;}p.life=0;
    }
    if(p.life<=0)settleProjectile(p);
  }
  projectiles=projectiles.filter(p=>p.life>0);
}

const _jump=jump;jump=function(){if(player&&player.noJump){tone(90,.06,'square',.025);return;}_jump();};

const _drawWorld=drawWorld;
drawWorld=function(){_drawWorld();if(weather==='rain')for(const p of puddles){ctx.save();ctx.globalAlpha=.5;ctx.fillStyle='#4fa6c8';ctx.beginPath();ctx.ellipse(p.x,p.y,p.rx,p.ry,0,0,Math.PI*2);ctx.fill();ctx.restore();}if(weather==='snow'){ctx.save();ctx.globalAlpha=.42;ctx.fillStyle='#eef8ff';ctx.fillRect(0,0,WORLD_W,WORLD_H);ctx.restore();}for(const r of rubble){ctx.fillStyle='#786b5b';roundRect(r.x,r.y,r.w,r.h,16,true);ctx.font='24px serif';for(let x=r.x+18;x<r.x+r.w;x+=40)ctx.fillText('🪨',x,r.y+r.h*.65);}if(weather==='storm')for(const m of lightning){ctx.save();ctx.strokeStyle='#fff36b';ctx.lineWidth=6;ctx.beginPath();ctx.arc(m.x,m.y,115*mapScale,0,Math.PI*2);ctx.stroke();ctx.restore();}};
drawObject=function(o){ctx.font='30px serif';ctx.textAlign='center';ctx.fillText(IICON[o.type]||'🎁',o.x,o.y+8);};
const _drawEntities=drawEntities;
drawEntities=function(){_drawEntities();for(const p of projectiles){ctx.font='30px serif';ctx.textAlign='center';ctx.fillText(IICON[p.type]||'●',p.x,p.y+9);}for(const o of objects)if(!o.got&&o.ownerLock&&levelElapsed<o.lockUntil){ctx.strokeStyle='#ffffff88';ctx.lineWidth=3;ctx.beginPath();ctx.arc(o.x,o.y,23,0,Math.PI*2);ctx.stroke();}};
const _drawGuardian=drawGuardian;
drawGuardian=function(g){if(g.type==='elephant'&&g.fury){ctx.save();ctx.globalAlpha=.42;ctx.fillStyle='#ff2b2b';ctx.beginPath();ctx.arc(g.x,g.y,41,0,Math.PI*2);ctx.fill();ctx.restore();}const m={frog:'🐸',penguin:'🐧',leopard:'🐆'};if(m[g.type]){ctx.font='48px serif';ctx.textAlign='center';ctx.fillText(m[g.type],g.x,g.y+16);return;}_drawGuardian(g);};
const _draw=draw;
draw=function(){_draw();ctx.save();if(weather==='night')nightOverlay();if(weather==='rain'||weather==='storm')rainOverlay();if(weather==='snow')snowOverlay();ctx.restore();};
function nightOverlay(){const px=player.x-camera.x,py=player.y-camera.y;ctx.fillStyle='rgba(2,8,18,.74)';ctx.fillRect(0,0,VIEW_W,VIEW_H);ctx.globalCompositeOperation='destination-out';ctx.fillStyle='rgba(0,0,0,.34)';ctx.fillRect(0,VIEW_H*.32,VIEW_W,VIEW_H*.36);const r=player.activeGear==='candle'?150:player.activeGear==='firefly'?125:84,g=ctx.createRadialGradient(px,py,10,px,py,r);g.addColorStop(0,'rgba(0,0,0,.92)');g.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=g;ctx.beginPath();ctx.arc(px,py,r,0,Math.PI*2);ctx.fill();if(player.activeGear==='flashlight'){const a=Math.atan2(player.vy||0,player.vx||1);ctx.translate(px,py);ctx.rotate(a);ctx.fillStyle='rgba(0,0,0,.6)';ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(250,-75);ctx.lineTo(250,75);ctx.closePath();ctx.fill();}ctx.globalCompositeOperation='source-over';}
function rainOverlay(){ctx.strokeStyle='rgba(200,235,255,.38)';ctx.lineWidth=2;for(let i=0;i<90;i++){const x=(i*83+levelElapsed*380)%VIEW_W,y=(i*47+levelElapsed*610)%VIEW_H;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-9,y+20);ctx.stroke();}}
function snowOverlay(){ctx.fillStyle='rgba(255,255,255,.8)';for(let i=0;i<75;i++){const x=(i*97+Math.sin(levelElapsed+i)*45)%VIEW_W,y=(i*53+levelElapsed*80)%VIEW_H;ctx.beginPath();ctx.arc(x,y,2+(i%3),0,Math.PI*2);ctx.fill();}}
addEventListener('keydown',e=>{if((e.key==='e'||e.key==='E'||e.key==='Enter')&&running)useItem(player);});
const hc=document.querySelector('#help .card');if(hc){const p=document.createElement('p');p.innerHTML='<b>Objetos:</b> recogé uno y usalo con <b>E/Enter</b> o el botón USAR. Cada objeto vuelve a caer. Quien lo usó espera 3 segundos; si lo perdió por un golpe, espera 1 segundo.';hc.insertBefore(p,hc.querySelector('button'));}
