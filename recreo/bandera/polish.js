
'use strict';

/* V12 — POLISH: vida, sonido y respuesta visual sin cambiar el diseño de Tina */
let polishClock = 0;
let polishDust = [];
let polishLast = new Map();
let polishLastStep = 0;
let polishPulse = 0;
let polishWinLocked = false;
let polishAmbientClock = 2.5;

function polishEntityKey(e){ return e && (e.id || e.name || `${Math.round(e.x)}:${Math.round(e.y)}`); }
function polishEntityAt(x,y,letter){
  if(player && letter==='T') return player;
  let best=null, bd=1e9;
  for(const b of bots||[]){
    const d=Math.hypot(b.x-x,b.y-y);
    if(d<bd){bd=d;best=b;}
  }
  return bd<12 ? best : null;
}
function polishDustBurst(x,y,count=7,strong=false){
  for(let i=0;i<count;i++){
    polishDust.push({
      x:x+(Math.random()-.5)*18,y:y+10+Math.random()*6,
      vx:(Math.random()-.5)*(strong?115:70),vy:-18-Math.random()*(strong?55:28),
      life:.45+Math.random()*.25,size:3+Math.random()*5
    });
  }
}
function polishSfx(kind){
  if(!musicOn)return;
  if(kind==='step'){ noiseHit(0,.006,.025,950); }
  if(kind==='land'){ tone(105,.07,'sine',.025); noiseHit(0,.012,.05,500); }
  if(kind==='hit'){ tone(135,.08,'square',.04); noiseHit(0,.018,.07,800); }
  if(kind==='capture'){ [659,784,988].forEach((f,i)=>tone(f,.18,'triangle',.045,i*.075)); }
  if(kind==='elephant'){ tone(82,.28,'sawtooth',.023); tone(110,.22,'sine',.02,.05); }
  if(kind==='gorilla'){ kick(0,.028); kick(.11,.024); }
  if(kind==='turtle'){ tone(180,.06,'square',.025); }
  if(kind==='parrot'){ tone(1050,.05,'square',.018); tone(1320,.05,'triangle',.014,.06); }
  if(kind==='sloth'){ tone(92,.22,'sine',.014); }
  if(kind==='frog'){ tone(145,.08,'square',.018); tone(100,.09,'sine',.015,.08); }
  if(kind==='penguin'){ tone(480,.06,'triangle',.018); tone(720,.08,'sine',.014,.05); }
  if(kind==='leopard'){ tone(125,.12,'sawtooth',.018); }
}

const _polishUpdate = update;
update = function(dt){
  polishClock += dt;
  polishPulse += dt;
  _polishUpdate(dt);

  const ents=[player,...(bots||[])].filter(Boolean);
  for(const e of ents){
    const key=polishEntityKey(e);
    const prev=polishLast.get(key) || {x:e.x,y:e.y,jump:false,vx:0,vy:0};
    const moving=Math.hypot(e.x-prev.x,e.y-prev.y)>1.8;
    const grounded=!e.jump;
    if(e===player && moving && grounded && polishClock-polishLastStep>.24){
      polishLastStep=polishClock; polishSfx('step');
      if(Math.random()<.7)polishDustBurst(e.x,e.y,2,false);
    }
    if(prev.jump && !e.jump){
      polishDustBurst(e.x,e.y,8,true);
      if(e===player)polishSfx('land');
    }
    if(!moving && Math.hypot(prev.vx||0,prev.vy||0)>2.5 && grounded) polishDustBurst(e.x,e.y,5,false);
    polishLast.set(key,{x:e.x,y:e.y,jump:!!e.jump,vx:e.x-prev.x,vy:e.y-prev.y});
  }

  for(const p of polishDust){
    p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=.94;p.vy+=55*dt;p.life-=dt;
  }
  polishDust=polishDust.filter(p=>p.life>0);

  polishAmbientClock-=dt;
  if(polishAmbientClock<=0 && running && guardians && guardians.length){
    polishAmbientClock=4.5+Math.random()*4.5;
    const g=guardians[Math.floor(Math.random()*guardians.length)];
    if(g && dist(g,player)<720*mapScale) polishSfx(g.type);
  }
};

function polishDrawShadow(x,y,r,jumpHeight){
  ctx.save();
  const h=Math.max(0,jumpHeight||0);
  const scale=Math.max(.35,1-h/150);
  ctx.globalAlpha=.22;
  ctx.fillStyle='#102819';
  ctx.beginPath();ctx.ellipse(x,y+h+r+7,r*1.05*scale,r*.34*scale,0,0,Math.PI*2);ctx.fill();
  ctx.restore();
}

drawMonkey = function(x,y,r,color,letter,jumpHeight=0){
  const e=polishEntityAt(x,y+jumpHeight,letter);
  const idle=e && !e.jump && Math.hypot(e.vx||0,e.vy||0)<.12 && !(e.stun>0);
  const breathe=idle?Math.sin(polishClock*3.1)*1.2:0;
  const blink=(Math.floor((polishClock+(letter.charCodeAt(0)%5))%4.2*20)%84)>=80;
  const hurt=e && (e.stun>0 || (e.inv>0 && e.inv<.65));
  const jumping=e && !!e.jump;
  const victory=polishWinLocked && letter==='T';

  polishDrawShadow(x,y,r,jumpHeight);
  ctx.save();
  ctx.translate(x,y+breathe);
  if(hurt && Math.floor(polishClock*16)%2===0)ctx.globalAlpha=.5;

  ctx.fillStyle=color;ctx.strokeStyle='#3b2517';ctx.lineWidth=3;
  ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.fill();ctx.stroke();
  ctx.fillStyle='#7b4a2b';ctx.beginPath();ctx.arc(0,-3,r*.62,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#edbd79';ctx.beginPath();ctx.ellipse(0,5,r*.42,r*.34,0,0,Math.PI*2);ctx.fill();

  ctx.strokeStyle='#18231d';ctx.fillStyle='#18231d';ctx.lineWidth=2.2;ctx.lineCap='round';
  if(hurt){
    for(const ex of [-5,5]){ctx.beginPath();ctx.moveTo(ex-2,-7);ctx.lineTo(ex+2,-3);ctx.moveTo(ex+2,-7);ctx.lineTo(ex-2,-3);ctx.stroke();}
  }else if(blink){
    ctx.beginPath();ctx.moveTo(-8,-5);ctx.lineTo(-2,-5);ctx.moveTo(2,-5);ctx.lineTo(8,-5);ctx.stroke();
  }else{
    ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(-5,-5,3.5,0,Math.PI*2);ctx.arc(5,-5,3.5,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#18231d';ctx.beginPath();ctx.arc(-5,-5,1.5,0,Math.PI*2);ctx.arc(5,-5,1.5,0,Math.PI*2);ctx.fill();
  }

  ctx.strokeStyle='#4b251f';ctx.lineWidth=2;
  ctx.beginPath();
  if(victory){ctx.arc(0,5,7,0,Math.PI);}
  else if(jumping){ctx.arc(0,7,3.5,0,Math.PI*2);}
  else if(hurt){ctx.arc(0,11,5,Math.PI,Math.PI*2);}
  else if(e && e.carrying){ctx.arc(0,4,6,0,Math.PI);}
  else{ctx.moveTo(-4,6);ctx.quadraticCurveTo(0,9,4,6);}
  ctx.stroke();

  if(victory){
    ctx.font='18px serif';ctx.textAlign='center';ctx.fillText('✨',0,-r-7);
  }
  ctx.fillStyle='#fff';ctx.font='900 11px Arial';ctx.textAlign='center';ctx.fillText(letter,0,r+14);
  ctx.restore();
};

const _polishDrawEntities = drawEntities;
drawEntities = function(){
  _polishDrawEntities();
  ctx.save();
  for(const p of polishDust){
    ctx.globalAlpha=Math.max(0,p.life/.7)*.38;
    ctx.fillStyle='#e6d4a8';
    ctx.beginPath();ctx.arc(p.x,p.y,p.size,0,Math.PI*2);ctx.fill();
  }
  ctx.restore();
};

const _polishDamageCarrier = damageCarrier;
damageCarrier = function(e,amount){
  const before=e?e.flagHP:0;
  _polishDamageCarrier(e,amount);
  if(e && before!==(e.flagHP||0)){
    polishSfx('hit');
    if(e===player){
      canvas.classList.remove('polish-hit');
      void canvas.offsetWidth;
      canvas.classList.add('polish-hit');
    }
  }
};

const _polishWinLevel = winLevel;
winLevel = function(){
  if(polishWinLocked)return;
  polishWinLocked=true;
  running=false;
  polishSfx('capture');
  canvas.classList.add('polish-capture');
  setTimeout(()=>{
    canvas.classList.remove('polish-capture');
    _polishWinLevel();
    setTimeout(()=>{polishWinLocked=false;},300);
  },420);
};

const _polishResetLevel = resetLevel;
resetLevel = function(n=level){
  polishWinLocked=false;polishDust=[];polishLast.clear();
  canvas.classList.remove('polish-capture','polish-hit');
  _polishResetLevel(n);
};

const _polishDraw = draw;
draw = function(){
  _polishDraw();
  if(player && player.carrying && player.flagHP<=2 && player.flagHP>0){
    const s=1+Math.max(0,Math.sin(polishPulse*7))*.18;
    ctx.save();ctx.translate(56,72);ctx.scale(s,s);ctx.font='32px serif';ctx.textAlign='center';ctx.fillText('❤️',0,0);ctx.restore();
  }
};

/* Señal muy visible de que se abrió la versión nueva. */
(function polishVersionSplash(){
  const badge=document.createElement('div');
  badge.className='polish-version-splash';
  badge.innerHTML='<div>✨</div><b>VERSIÓN 12</b><span>¡CLIMA Y FÍSICA COMPLETOS!</span>';
  document.body.appendChild(badge);
  setTimeout(()=>badge.classList.add('hide'),2100);
  setTimeout(()=>badge.remove(),2800);
})();
