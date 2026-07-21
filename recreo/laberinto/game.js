/* ===== Bloque JavaScript original 1 ===== */

'use strict';
const canvas=document.getElementById('game'),ctx=canvas.getContext('2d');
const levelLabel=document.getElementById('levelLabel'),bananaLabel=document.getElementById('bananaLabel'),bananaTotal=document.getElementById('bananaTotal'),stepsLabel=document.getElementById('stepsLabel');
const TOTAL_LEVELS=20,DIRS=[{dx:0,dy:-1,key:'up'},{dx:1,dy:0,key:'right'},{dx:0,dy:1,key:'down'},{dx:-1,dy:0,key:'left'}];
const CLASSMATES=['Franchu','Martu','Lucy','Jose','Samy','Ori','Rousy','Vicky chiquita','Vicky grande','Anto','Vitti','Ramirito','Santi','Francis','Leandrus','Feli','Beltru','Lauti'];
const SPECIAL_EVENTS={3:{type:'radio',label:'Radio de la Selva',icon:'📻'},6:{type:'glasses',label:'Anteojos Arcoíris',icon:'🌈'},9:{type:'trumpet',label:'Trompeta del Gran Árbol',icon:'🎺'},12:{type:'radio',label:'Radio Veloz',icon:'📻'},15:{type:'glasses',label:'Anteojos Nocturnos',icon:'🕶️'},18:{type:'trumpet',label:'Trompeta Dorada',icon:'🎺'}};
const PALETTES={normal:{sky1:'#bfe9ef',sky2:'#8dcf74',cell1:'#c9e9a0',cell2:'#c3e397',wall:'#35643f',board:'#d8efb4',outline:'#527b45'},rainbow:{sky1:'#f6c7ef',sky2:'#a9d7ff',cell1:'#ffe5a7',cell2:'#c6f0d1',wall:'#6f5aa6',board:'#f8e8bd',outline:'#8a6ab1'},night:{sky1:'#27335f',sky2:'#476b72',cell1:'#9fc5a0',cell2:'#7aa989',wall:'#294c47',board:'#b9cfaa',outline:'#42645a'}};
let level=1,maze=null,cols=9,rows=7,player={x:0,y:0},levelStart={x:0,y:0},exit={x:0,y:0},bananas=[],friend=null,collected=0,steps=0,playing=false,moveLock=false,unlocked=Math.max(1,Number(localStorage.getItem('nitoUnlocked')||1)),audioCtx=null;
let animTime=0,musicTimer=null,musicStep=0,musicOn=true;let levelsReturnTo='start';let foundClassmates=JSON.parse(localStorage.getItem('nitoFoundClassmates')||'[]');let specialItem=null,specialActive=false,currentPalette='normal',musicTempo=1;
function seededRandom(seed){let s=seed>>>0;return()=>{s+=0x6D2B79F5;let t=s;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296}}
function dimensionsForLevel(n){const band=Math.floor((n-1)/4);return{cols:7+band*2,rows:7+band*2}}
function generateMaze(c,r,seed){const rand=seededRandom(seed),grid=Array.from({length:r},()=>Array.from({length:c},()=>({visited:false,walls:{up:true,right:true,down:true,left:true}})));const stack=[{x:0,y:0}];grid[0][0].visited=true;while(stack.length){const cur=stack[stack.length-1],opts=[];DIRS.forEach(d=>{const nx=cur.x+d.dx,ny=cur.y+d.dy;if(nx>=0&&ny>=0&&nx<c&&ny<r&&!grid[ny][nx].visited)opts.push({...d,nx,ny})});if(!opts.length){stack.pop();continue}const p=opts[Math.floor(rand()*opts.length)],opp={up:'down',down:'up',left:'right',right:'left'};grid[cur.y][cur.x].walls[p.key]=false;grid[p.ny][p.nx].walls[opp[p.key]]=false;grid[p.ny][p.nx].visited=true;stack.push({x:p.nx,y:p.ny})}return grid}
function farthestCell(sx,sy){const q=[{x:sx,y:sy,d:0}],seen=new Set([sx+','+sy]);let best=q[0];while(q.length){const cur=q.shift();if(cur.d>best.d)best=cur;for(const d of DIRS){if(!maze[cur.y][cur.x].walls[d.key]){const nx=cur.x+d.dx,ny=cur.y+d.dy,k=nx+','+ny;if(!seen.has(k)){seen.add(k);q.push({x:nx,y:ny,d:cur.d+1})}}}}return best}
function randomOpenCells(count,seed,forbidden){const rand=seededRandom(seed),cells=[];for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){const k=x+','+y;if(!forbidden.has(k))cells.push({x,y})}for(let i=cells.length-1;i>0;i--){const j=Math.floor(rand()*(i+1));[cells[i],cells[j]]=[cells[j],cells[i]]}return cells.slice(0,count)}
function buildLevel(n){level=n;const d=dimensionsForLevel(n);cols=d.cols;rows=d.rows;maze=generateMaze(cols,rows,8241+n*9973);player={x:0,y:0};exit=farthestCell(0,0);const forbidden=new Set(['0,0',exit.x+','+exit.y]),bananaCount=Math.min(2+Math.floor(n/3),7),hasClassmate=n<=18,hasSpecial=Boolean(SPECIAL_EVENTS[n]),cells=randomOpenCells(bananaCount+(hasClassmate?1:0)+(hasSpecial?1:0),441+n*331,forbidden);bananas=cells.slice(0,bananaCount).map(c=>({...c,got:false}));let idx=bananaCount;friend=hasClassmate?{...cells[idx++],found:false,name:CLASSMATES[n-1]}:null;specialItem=hasSpecial?{...cells[idx++],got:false,...SPECIAL_EVENTS[n]}:null;specialActive=false;currentPalette='normal';musicTempo=1;applyRunRotationToBaseLevel();updateEventHud();collected=0;steps=0;playing=true;updateHud();draw()}
function updateHud(){levelLabel.textContent=level;bananaLabel.textContent=collected;bananaTotal.textContent=bananas.length;stepsLabel.textContent=steps}
function cellMetrics(){const margin=30,cw=(canvas.width-margin*2)/cols,ch=(canvas.height-margin*2)/rows,size=Math.min(cw,ch),boardW=size*cols,boardH=size*rows;return{size,ox:(canvas.width-boardW)/2,oy:(canvas.height-boardH)/2}}
function roundRect(x,y,w,h,r,fill,stroke){ctx.beginPath();ctx.roundRect(x,y,w,h,r);if(fill){ctx.fillStyle=fill;ctx.fill()}if(stroke){ctx.strokeStyle=stroke;ctx.stroke()}}
function draw(){ctx.clearRect(0,0,canvas.width,canvas.height);drawBackground();if(!maze)return;const{size,ox,oy}=cellMetrics(),pal=PALETTES[currentPalette];roundRect(ox-10,oy-10,size*cols+20,size*rows+20,18,pal.board,pal.outline);for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){const px=ox+x*size,py=oy+y*size;ctx.fillStyle=((x+y)%2===0)?pal.cell1:pal.cell2;ctx.fillRect(px,py,size,size);drawTinyLeaves(px,py,size,x,y)}ctx.lineWidth=Math.max(5,size*.11);ctx.lineCap='round';ctx.strokeStyle=pal.wall;for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){const c=maze[y][x],px=ox+x*size,py=oy+y*size;ctx.beginPath();if(c.walls.up){ctx.moveTo(px,py);ctx.lineTo(px+size,py)}if(c.walls.right){ctx.moveTo(px+size,py);ctx.lineTo(px+size,py+size)}if(c.walls.down){ctx.moveTo(px,py+size);ctx.lineTo(px+size,py+size)}if(c.walls.left){ctx.moveTo(px,py);ctx.lineTo(px,py+size)}ctx.stroke();drawHedgeDetails(c,px,py,size,x,y)}drawExit(exit.x,exit.y,size,ox,oy);bananas.forEach((b,i)=>{if(!b.got)drawBanana(b.x,b.y,size,ox,oy,i)});if(friend&&!friend.found)drawFriend(friend.x,friend.y,size,ox,oy,friend.name);if(specialItem&&!specialItem.got)drawSpecialItem(specialItem,size,ox,oy);drawNito(player.x,player.y,size,ox,oy)}
function drawBackground(){const pal=PALETTES[currentPalette],g=ctx.createLinearGradient(0,0,0,canvas.height);g.addColorStop(0,pal.sky1);g.addColorStop(1,pal.sky2);ctx.fillStyle=g;ctx.fillRect(0,0,canvas.width,canvas.height);ctx.fillStyle=currentPalette==='night'?'rgba(215,245,255,.10)':'rgba(39,103,55,.15)';for(let i=0;i<22;i++){const x=(i*83+37)%canvas.width,y=40+(i*59)%canvas.height;ctx.beginPath();ctx.arc(x,y,18+(i%3)*8,0,Math.PI*2);ctx.fill()}for(let i=0;i<8;i++){const x=(i*137+animTime*8*(i%2?1:-1)+1200)%1100-100,y=45+(i*67)%500+Math.sin(animTime*1.4+i)*10;drawButterfly(x,y,5+(i%3))}for(let i=0;i<10;i++){const x=(i*91+40)%canvas.width,y=70+(i*53)%canvas.height;ctx.fillStyle=currentPalette==='night'?`rgba(180,225,255,${.25+.2*Math.sin(animTime*2+i)})`:`rgba(255,245,140,${.25+.2*Math.sin(animTime*2+i)})`;ctx.beginPath();ctx.arc(x,y,2.2,0,Math.PI*2);ctx.fill()}}
function drawButterfly(x,y,s){ctx.save();ctx.translate(x,y);const flap=.55+.45*Math.sin(animTime*7+x);ctx.fillStyle='rgba(255,190,76,.75)';ctx.beginPath();ctx.ellipse(-s*.45,0,s*.55*flap,s*.34,-.4,0,Math.PI*2);ctx.ellipse(s*.45,0,s*.55*flap,s*.34,.4,0,Math.PI*2);ctx.fill();ctx.fillStyle='#5f4730';ctx.fillRect(-1,-s*.25,2,s*.5);ctx.restore()}
function drawHedgeDetails(c,px,py,size,x,y){if((x*13+y*7)%3!==0)return;ctx.fillStyle='#4e8a4e';const r=Math.max(2,size*.035);if(c.walls.up){ctx.beginPath();ctx.arc(px+size*.3,py,r,0,Math.PI*2);ctx.arc(px+size*.7,py,r,0,Math.PI*2);ctx.fill()}if(c.walls.left){ctx.beginPath();ctx.arc(px,py+size*.35,r,0,Math.PI*2);ctx.arc(px,py+size*.72,r,0,Math.PI*2);ctx.fill()}if((x+y)%7===0){ctx.fillStyle='#f5d36a';ctx.beginPath();ctx.arc(px+size*.18,py+size*.82,r*.65,0,Math.PI*2);ctx.fill()}}
function drawTinyLeaves(px,py,size,x,y){if((x*7+y*11)%6!==0)return;ctx.save();ctx.translate(px+size*.72,py+size*.28);ctx.rotate((x+y)*.4);ctx.fillStyle='rgba(48,116,56,.18)';ctx.beginPath();ctx.ellipse(0,0,size*.10,size*.045,0,0,Math.PI*2);ctx.fill();ctx.restore()}
function drawNito(x,y,size,ox,oy){const cx=ox+x*size+size/2,cy=oy+y*size+size/2+Math.sin(animTime*4)*size*.018,s=size*.34;ctx.save();ctx.translate(cx,cy);ctx.fillStyle='#7a4b2a';ctx.beginPath();ctx.arc(0,0,s*.55,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(-s*.52,-s*.12,s*.23,0,Math.PI*2);ctx.arc(s*.52,-s*.12,s*.23,0,Math.PI*2);ctx.fill();ctx.fillStyle='#d7a46b';ctx.beginPath();ctx.ellipse(0,s*.09,s*.40,s*.33,0,0,Math.PI*2);ctx.fill();const blink=Math.sin(animTime*.9)>0.985;ctx.strokeStyle='#17251f';ctx.fillStyle='#fff';ctx.lineWidth=2;if(blink){ctx.beginPath();ctx.moveTo(-s*.27,-s*.13);ctx.lineTo(-s*.08,-s*.13);ctx.moveTo(s*.08,-s*.13);ctx.lineTo(s*.27,-s*.13);ctx.stroke()}else{ctx.beginPath();ctx.arc(-s*.17,-s*.13,s*.10,0,Math.PI*2);ctx.arc(s*.17,-s*.13,s*.10,0,Math.PI*2);ctx.fill();ctx.fillStyle='#17251f';ctx.beginPath();ctx.arc(-s*.17,-s*.13,s*.045,0,Math.PI*2);ctx.arc(s*.17,-s*.13,s*.045,0,Math.PI*2);ctx.fill()}ctx.strokeStyle='#5d3c25';ctx.lineWidth=Math.max(2,s*.05);ctx.beginPath();ctx.arc(0,s*.09,s*.20,.18,Math.PI-.18);ctx.stroke();ctx.restore()}
function drawBanana(x,y,size,ox,oy,i=0){const cx=ox+x*size+size/2,cy=oy+y*size+size/2+Math.sin(animTime*3+i)*size*.055;ctx.save();ctx.translate(cx,cy);ctx.rotate(-.48);ctx.shadowColor='rgba(255,224,70,.95)';ctx.shadowBlur=Math.max(7,size*.16);ctx.strokeStyle='#8f6810';ctx.lineWidth=Math.max(9,size*.19);ctx.beginPath();ctx.arc(0,0,size*.20,.18,2.42);ctx.stroke();ctx.strokeStyle='#ffd83d';ctx.lineWidth=Math.max(7,size*.145);ctx.stroke();ctx.shadowBlur=0;ctx.strokeStyle='#fff29a';ctx.lineWidth=Math.max(2,size*.035);ctx.stroke();ctx.fillStyle='#5d4315';ctx.beginPath();ctx.arc(size*.19*Math.cos(.18),size*.19*Math.sin(.18),Math.max(2,size*.035),0,Math.PI*2);ctx.arc(size*.19*Math.cos(2.42),size*.19*Math.sin(2.42),Math.max(2,size*.035),0,Math.PI*2);ctx.fill();ctx.restore()}
function drawFriend(x,y,size,ox,oy,name){const cx=ox+x*size+size/2,cy=oy+y*size+size/2+Math.sin(animTime*3.2)*size*.025,s=size*.28;ctx.save();ctx.translate(cx,cy);ctx.rotate(Math.sin(animTime*3)*.025);ctx.fillStyle='#8d5a34';ctx.beginPath();ctx.arc(0,0,s*.55,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(-s*.48,-s*.1,s*.2,0,Math.PI*2);ctx.arc(s*.48,-s*.1,s*.2,0,Math.PI*2);ctx.fill();ctx.fillStyle='#f2c17f';ctx.beginPath();ctx.ellipse(0,s*.08,s*.38,s*.29,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(-s*.13,-s*.12,s*.08,0,Math.PI*2);ctx.arc(s*.13,-s*.12,s*.08,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#7a4b2a';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(s*.35,s*.18);ctx.lineTo(s*.62,s*(.02+.1*Math.sin(animTime*6)));ctx.stroke();ctx.restore();ctx.font=`900 ${Math.max(11,size*.16)}px Arial`;ctx.textAlign='center';ctx.fillStyle='#225c35';ctx.fillText(name,cx,cy-size*.38)}
function drawExit(x,y,size,ox,oy){const px=ox+x*size,py=oy+y*size;ctx.save();ctx.translate(px+size/2,py+size/2);ctx.fillStyle='#8b5a2b';ctx.fillRect(-size*.28,-size*.18,size*.56,size*.38);ctx.fillStyle='#f7e4b1';ctx.fillRect(-size*.18,-size*.08,size*.36,size*.26);ctx.fillStyle='#a43f3f';ctx.beginPath();ctx.moveTo(-size*.34,-size*.18);ctx.lineTo(0,-size*.45);ctx.lineTo(size*.34,-size*.18);ctx.closePath();ctx.fill();ctx.fillStyle='#4b79a8';ctx.fillRect(-size*.07,size*.02,size*.14,size*.16);ctx.restore()}

function drawSpecialItem(item,size,ox,oy){const cx=ox+item.x*size+size/2,cy=oy+item.y*size+size/2+Math.sin(animTime*3)*size*.045;ctx.save();ctx.translate(cx,cy);ctx.font=`${Math.max(24,size*.45)}px Arial`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(item.icon,0,0);ctx.font=`900 ${Math.max(10,size*.14)}px Arial`;ctx.fillStyle='#5b421d';ctx.fillText(item.label,0,-size*.32);ctx.restore()}
function updateEventHud(){const p=document.getElementById('eventPill'),l=document.getElementById('eventLabel');if(specialActive&&specialItem){p.style.display='block';l.textContent=specialItem.icon+' '+specialItem.label}else{p.style.display='none';l.textContent=''}}
function activateSpecial(){if(!specialItem||specialItem.got)return;specialItem.got=true;specialActive=true;if(specialItem.type==='radio'){musicTempo=1.25;restartMusic();radioSound();showToast('📻 ¡La música se puso más alegre!')}else if(specialItem.type==='trumpet'){trumpetFanfare();showToast('🎺 ¡La trompeta acompaña a Nito!')}else{currentPalette=level===15?'night':'rainbow';glassesSound();showToast('🌈 ¡El laberinto cambió de colores!')}updateEventHud()}
function restartMusic(){if(musicTimer){clearInterval(musicTimer);musicTimer=null}startMusic()}
function radioSound(){tone(523,.12,'square',.035);tone(659,.12,'square',.035,.10);tone(784,.22,'square',.04,.20)}
function trumpetFanfare(){tone(392,.18,'sawtooth',.035);tone(523,.18,'sawtooth',.04,.16);tone(659,.30,'sawtooth',.045,.32)}
function glassesSound(){tone(440,.12,'sine',.03);tone(554,.12,'sine',.03,.10);tone(659,.18,'sine',.035,.20)}

function tryMove(dx,dy){if(!playing||moveLock)return;const key=dx===1?'right':dx===-1?'left':dy===1?'down':'up',cell=maze[player.y][player.x];if(cell.walls[key]){bumpSound();return}player.x+=dx;player.y+=dy;steps++;moveLock=true;setTimeout(()=>moveLock=false,70);checkCell();updateHud();draw()}
function checkCell(){for(const b of bananas){if(!b.got&&b.x===player.x&&b.y===player.y){b.got=true;collected++;pluckSound()}}if(friend&&!friend.found&&friend.x===player.x&&friend.y===player.y){friend.found=true;friendSound();if(!foundClassmates.includes(friend.name)){foundClassmates.push(friend.name);localStorage.setItem('nitoFoundClassmates',JSON.stringify(foundClassmates))}showToast(`¡Encontraste a ${friend.name}!`)}if(specialItem&&!specialItem.got&&specialItem.x===player.x&&specialItem.y===player.y)activateSpecial();if(player.x===exit.x&&player.y===exit.y)finishLevel()}
function finishLevel(){playing=false;winSound();if(level<TOTAL_LEVELS){unlocked=Math.max(unlocked,level+1);localStorage.setItem('nitoUnlocked',unlocked)}const all=collected===bananas.length,thisFriend=friend?(friend.found?`Encontraste a <strong>${friend.name}</strong>.`:`<strong>${friend.name}</strong> todavía espera en este laberinto.`):'En este nivel no había un compañero nuevo.',foundNow=CLASSMATES.filter(n=>foundClassmates.includes(n)),missingNow=CLASSMATES.filter(n=>!foundClassmates.includes(n)),eventText=specialItem?(specialItem.got?`<br>Evento: <strong>${specialItem.icon} ${specialItem.label}</strong>.`:`<br>Quedó un objeto especial por descubrir.`):'';document.getElementById('messageTitle').textContent=level===TOTAL_LEVELS?'🏫 ¡Nito llegó a la escuela!':'🌿 ¡Camino encontrado!';document.getElementById('messageText').innerHTML=`Bananas: <strong>${collected}/${bananas.length}</strong> · Pasos: <strong>${steps}</strong>.<br>${all?'¡Encontraste todas las bananas!':'Podés volver para buscar las que faltan.'}<br>${thisFriend}${eventText}<div class="roster"><strong>Compañeros encontrados:</strong><br><span class="found-names">${foundNow.length?foundNow.join(', '):'Todavía ninguno'}</span><br><br><strong>Compañeros que faltan:</strong><br><span class="missing-names">${missingNow.length?missingNow.join(', '):'¡Ya están todos!'}</span></div>`;const box=document.getElementById('messageButtons');box.innerHTML='';if(level<TOTAL_LEVELS)box.appendChild(makeButton('Siguiente nivel',()=>{hideMessage();startGame(level+1)}));else box.appendChild(makeButton('Jugar otra vez',()=>{hideMessage();startGame(1)}));box.appendChild(makeButton('Elegir nivel',()=>{hideMessage();showLevels('message')},'secondary'));document.getElementById('messageOverlay').style.display='flex'}
function makeButton(text,fn,cls=''){const b=document.createElement('button');b.textContent=text;b.onclick=fn;if(cls)b.className=cls;return b}
function showToast(text){const el=document.createElement('div');el.textContent=text;Object.assign(el.style,{position:'absolute',left:'50%',top:'18px',transform:'translateX(-50%)',background:'#fff8df',color:'#285d3a',padding:'10px 16px',borderRadius:'999px',fontWeight:'900',border:'3px solid #8b5a2b',zIndex:5,boxShadow:'0 5px #5d3a1f'});document.querySelector('.game-wrap').appendChild(el);setTimeout(()=>el.remove(),1500)}
function startGame(n){document.getElementById('startOverlay').style.display='none';document.getElementById('levelsOverlay').style.display='none';document.getElementById('messageOverlay').style.display='none';initAudio();startMusic();buildLevel(n)}
function hideMessage(){document.getElementById('messageOverlay').style.display='none'}
function showLevels(returnTo='start'){
  levelsReturnTo=returnTo;
  const grid=document.getElementById('levelGrid');
  grid.innerHTML='';
  for(let i=1;i<=TOTAL_LEVELS;i++){
    const b=document.createElement('button');
    b.className='level-btn'+(i>unlocked?' locked':'');
    b.textContent=i;
    b.disabled=i>unlocked;
    b.onclick=()=>beginBananaRun(i);
    grid.appendChild(b);
  }
  document.getElementById('levelsOverlay').style.display='flex';
}
function hideLevels(){
  document.getElementById('levelsOverlay').style.display='none';
  if(levelsReturnTo==='message'){
    document.getElementById('messageOverlay').style.display='flex';
  }else{
    document.getElementById('startOverlay').style.display='flex';
  }
}
function initAudio(){if(!audioCtx)audioCtx=new(window.AudioContext||window.webkitAudioContext)();if(audioCtx.state==='suspended')audioCtx.resume()}
function tone(freq,dur,type='sine',vol=.05,delay=0){initAudio();const t=audioCtx.currentTime+delay,o=audioCtx.createOscillator(),g=audioCtx.createGain();o.type=type;o.frequency.setValueAtTime(freq,t);g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(vol,t+.01);g.gain.exponentialRampToValueAtTime(.0001,t+dur);o.connect(g).connect(audioCtx.destination);o.start(t);o.stop(t+dur+.05)}
function pluckSound(){tone(660,.12,'triangle',.05);tone(880,.15,'triangle',.04,.08)}function friendSound(){tone(392,.15,'sine',.04);tone(523,.2,'sine',.05,.12)}function bumpSound(){tone(110,.08,'square',.025)}function winSound(){tone(523,.16,'triangle',.06);tone(659,.16,'triangle',.06,.14);tone(784,.28,'triangle',.06,.28)}
function midi(n){return 440*Math.pow(2,(n-69)/12)}

/* Piano sintetizado suave: cada nota combina dos armónicos y una caída lenta. */
function pianoNote(note,dur=.8,vol=.018,delay=0){
  if(!musicOn)return;
  initAudio();
  const t=audioCtx.currentTime+delay;
  const master=audioCtx.createGain();
  const filter=audioCtx.createBiquadFilter();
  filter.type='lowpass';
  filter.frequency.setValueAtTime(2300,t);
  master.gain.setValueAtTime(.0001,t);
  master.gain.exponentialRampToValueAtTime(vol,t+.025);
  master.gain.exponentialRampToValueAtTime(.0001,t+dur);

  const fundamental=audioCtx.createOscillator();
  const harmonic=audioCtx.createOscillator();
  const harmonicGain=audioCtx.createGain();
  fundamental.type='triangle';
  harmonic.type='sine';
  fundamental.frequency.setValueAtTime(midi(note),t);
  harmonic.frequency.setValueAtTime(midi(note)*2,t);
  harmonic.detune.setValueAtTime(3,t);
  harmonicGain.gain.value=.16;

  fundamental.connect(filter);
  harmonic.connect(harmonicGain).connect(filter);
  filter.connect(master).connect(audioCtx.destination);
  fundamental.start(t); harmonic.start(t);
  fundamental.stop(t+dur+.08); harmonic.stop(t+dur+.08);
}

/*
  Blues-jazz de bosque generado en tiempo real.
  Usa la forma tradicional de 12 compases del blues y una instrumentación
  inspirada en pequeñas bandas de Nueva Orleans de los años treinta.
  No utiliza ni copia ninguna grabación ni arreglo existente.
*/
const nocturneMeasures=[
  {root:48,chord:'I'}, {root:48,chord:'I'}, {root:48,chord:'I'}, {root:48,chord:'I'},
  {root:53,chord:'IV'},{root:53,chord:'IV'},{root:48,chord:'I'}, {root:48,chord:'I'},
  {root:55,chord:'V'}, {root:53,chord:'IV'},{root:48,chord:'I'}, {root:55,chord:'V'}
];

/* Se conservan estos nombres para no afectar las capas musicales ya existentes. */
const NOCTURNE_BEAT=.38;
const NOCTURNE_MEASURE_SECONDS=NOCTURNE_BEAT*4;
const JAZZ_MASTER_VOLUME=2;

function jazzTone(note,dur=.25,vol=.018,delay=0,type='sawtooth',cutoff=1850){
  if(!musicOn)return;
  initAudio();
  const t=audioCtx.currentTime+delay;
  const o=audioCtx.createOscillator(),g=audioCtx.createGain(),f=audioCtx.createBiquadFilter();
  o.type=type;o.frequency.setValueAtTime(midi(note),t);
  f.type='lowpass';f.frequency.setValueAtTime(cutoff,t);
  g.gain.setValueAtTime(.0001,t);
  g.gain.exponentialRampToValueAtTime(vol*JAZZ_MASTER_VOLUME,t+.018);
  g.gain.exponentialRampToValueAtTime(.0001,t+dur);
  o.connect(f).connect(g).connect(audioCtx.destination);o.start(t);o.stop(t+dur+.05);
}
function jazzNoise(dur=.06,vol=.008,delay=0){
  if(!musicOn)return;initAudio();
  const length=Math.max(1,Math.floor(audioCtx.sampleRate*dur));
  const buffer=audioCtx.createBuffer(1,length,audioCtx.sampleRate),data=buffer.getChannelData(0);
  for(let i=0;i<length;i++)data[i]=(Math.random()*2-1)*(1-i/length);
  const src=audioCtx.createBufferSource(),f=audioCtx.createBiquadFilter(),g=audioCtx.createGain();
  const t=audioCtx.currentTime+delay;src.buffer=buffer;f.type='highpass';f.frequency.value=1500;
  g.gain.setValueAtTime(vol*JAZZ_MASTER_VOLUME,t);g.gain.exponentialRampToValueAtTime(.0001,t+dur);
  src.connect(f).connect(g).connect(audioCtx.destination);src.start(t);
}
function chordNotes(root,kind){
  const base=kind==='IV'?root:kind==='V'?root:root;
  return [base,base+4,base+7,base+10];
}
function playNocturneMeasure(){
  if(!audioCtx||!musicOn)return;
  const bar=musicStep%nocturneMeasures.length;
  const measure=nocturneMeasures[bar];
  const beat=NOCTURNE_BEAT;
  const root=measure.root;

  /* Contrabajo: walking bass de cuatro pulsos. */
  const walk=[root-12,root-5,root-3,root-1];
  walk.forEach((n,i)=>jazzTone(n,beat*.78,.012,i*beat,'triangle',850));

  /* Piano/banjo sincopado en los contratiempos. */
  const chord=chordNotes(root,measure.chord);
  [0,1,2,3].forEach(i=>{
    const d=i*beat+beat*.58;
    chord.forEach((n,k)=>jazzTone(n+(k===0?0:12),beat*.28,.0048,d,'triangle',2100));
  });

  /* Melodía alegre de clarinete con swing; cambia en cada compás. */
  const phrases=[
    [12,15,17,18,17,15], [12,15,17,19,18,17], [12,10,8,7,8,10],
    [12,15,18,17,15,12], [12,15,17,18,20,18], [17,15,12,10,12,15]
  ];
  const phrase=phrases[bar%phrases.length];
  const offsets=[0,.66,1,1.66,2,3];
  phrase.forEach((off,i)=>jazzTone(root+off,beat*(i%2===0?.48:.26),.0105,offsets[i]*beat,'sine',2600));

  /* Bombo suave y redoblante/platillo, sin resultar invasivos. */
  jazzTone(31,beat*.20,.011,0,'sine',500);
  jazzNoise(.055,.0058,beat);
  jazzTone(31,beat*.17,.0085,beat*2,'sine',500);
  jazzNoise(.07,.0065,beat*3);

  /* La trompeta encontrada agrega respuestas cortas. */
  if(specialActive&&specialItem&&specialItem.type==='trumpet'){
    jazzTone(root+19,beat*.34,.012,beat*.18,'sawtooth',1550);
    jazzTone(root+17,beat*.32,.011,beat*2.22,'sawtooth',1550);
  }
  musicStep=(musicStep+1)%nocturneMeasures.length;
}

function startMusic(){
  if(musicTimer)return;
  initAudio();
  musicStep=0;
  playNocturneMeasure();
  musicTimer=setInterval(playNocturneMeasure,Math.round((NOCTURNE_MEASURE_SECONDS*1000)/musicTempo));
}
function animate(t){animTime=t/1000;draw();requestAnimationFrame(animate)}
window.addEventListener('keydown',e=>{const map={ArrowUp:[0,-1],w:[0,-1],W:[0,-1],ArrowDown:[0,1],s:[0,1],S:[0,1],ArrowLeft:[-1,0],a:[-1,0],A:[-1,0],ArrowRight:[1,0],d:[1,0],D:[1,0]};if(map[e.key]){e.preventDefault();tryMove(...map[e.key])}});

let holdTimer=null;
let holdDelayTimer=null;
let heldButton=null;

function stopHeldMove(){
  if(holdTimer){clearInterval(holdTimer);holdTimer=null}
  if(holdDelayTimer){clearTimeout(holdDelayTimer);holdDelayTimer=null}
  if(heldButton){heldButton.classList.remove('pressed');heldButton=null}
}

function startHeldMove(button,dx,dy,e){
  e.preventDefault();
  stopHeldMove();
  heldButton=button;
  button.classList.add('pressed');

  // Primer movimiento inmediato.
  tryMove(dx,dy);

  // Después de una pausa corta, continúa mientras se mantiene apretado.
  holdDelayTimer=setTimeout(()=>{
    holdTimer=setInterval(()=>tryMove(dx,dy),115);
  },260);

  try{
    button.setPointerCapture(e.pointerId);
  }catch(_){}
}

[['up',0,-1],['down',0,1],['left',-1,0],['right',1,0]].forEach(([id,dx,dy])=>{
  const button=document.getElementById(id);
  button.addEventListener('pointerdown',e=>startHeldMove(button,dx,dy,e));
  button.addEventListener('pointerup',stopHeldMove);
  button.addEventListener('pointercancel',stopHeldMove);
  button.addEventListener('lostpointercapture',stopHeldMove);
  button.addEventListener('contextmenu',e=>e.preventDefault());
});

window.addEventListener('pointerup',stopHeldMove);
window.addEventListener('pointercancel',stopHeldMove);
window.addEventListener('blur',stopHeldMove);
document.addEventListener('selectstart',e=>{
  if(e.target.closest('.controls,.control,canvas'))e.preventDefault();
});
document.addEventListener('dragstart',e=>{
  if(e.target.closest('.controls,.control,canvas'))e.preventDefault();
});

function resizeCanvasForViewport(){
  const mobile=window.innerWidth<=700;
  const portrait=window.innerHeight>=window.innerWidth;
  const targetW=mobile&&portrait?620:900;
  const targetH=mobile&&portrait?820:620;
  if(canvas.width!==targetW||canvas.height!==targetH){
    canvas.width=targetW;
    canvas.height=targetH;
  }
  draw();
}
window.addEventListener('resize',resizeCanvasForViewport);
window.addEventListener('orientationchange',()=>setTimeout(resizeCanvasForViewport,80));
resizeCanvasForViewport();
requestAnimationFrame(animate);


/* ===== Bloque JavaScript original 2 ===== */

'use strict';

/* =========================================================
   NITO Y EL LABERINTO — AVENTURA 2.0
   Nuevas mecánicas progresivas, sin assets externos.
   ========================================================= */

const ADVENTURE_CLASSMATES=[
  'Franchu','Martu','Lucy','Jose','Samy','Ori','Rousy','Vicky chiquita',
  'Vicky grande','Anto','Vitti','Ramirito','Santi','Francis','Leandrus',
  'Feli','Beltru','Lauti','Profe Mona','Seño Lila'
];

const BOSS_LEVELS={
  7:{icon:'🦍',name:'Gorila Dormilón',message:'El Gorila Dormilón te llevó con cuidado al comienzo.'},
  13:{icon:'🐘',name:'Guardián Demoledor',message:'El Elefante Paseandero te acompañó de vuelta al inicio.'},
  19:{icon:'🐢',name:'Tortuga Gigante',message:'La Tortuga Gigante cerró el paso. ¡Probemos otra ruta!'}
};

const WHIRLPOOL_LEVELS=new Set([8,16,20]);
const DARK_LEVELS=new Set([11,17]);
const FALSE_HOUSE_LEVELS=new Set([14,18,20]);
const SECRET_LEVELS=new Set([4,5,6,9,10,12,15,18,20]);

let secretLinks=[];
let whirlpool=null;
let controlsReversed=false;
let falseExit=null;
let guardian=null;
let guardianStepAt=0;
let guardianDir=1;
let adventureNoticeShown=false;

function cellKey(c){return c.x+','+c.y}
function sameCell(a,b){return a&&b&&a.x===b.x&&a.y===b.y}
function neighborsOf(x,y){
  const out=[];
  for(const d of DIRS){
    if(!maze[y][x].walls[d.key]) out.push({x:x+d.dx,y:y+d.dy,key:d.key});
  }
  return out;
}
function shortestPath(start,target){
  const q=[start],parent=new Map([[cellKey(start),null]]);
  while(q.length){
    const cur=q.shift();
    if(sameCell(cur,target)) break;
    for(const n of neighborsOf(cur.x,cur.y)){
      const k=cellKey(n);
      if(!parent.has(k)){parent.set(k,cur);q.push(n)}
    }
  }
  const path=[];let cur=target;
  if(!parent.has(cellKey(target))) return path;
  while(cur){path.push(cur);cur=parent.get(cellKey(cur))}
  return path.reverse();
}
function distancesFrom(start){
  const q=[start],dist=new Map([[cellKey(start),0]]);
  while(q.length){
    const cur=q.shift(),d0=dist.get(cellKey(cur));
    for(const n of neighborsOf(cur.x,cur.y)){
      const k=cellKey(n);
      if(!dist.has(k)){dist.set(k,d0+1);q.push(n)}
    }
  }
  return dist;
}
function allCells(){
  const a=[];for(let y=0;y<rows;y++)for(let x=0;x<cols;x++)a.push({x,y});return a;
}
function isOuter(c){return c.x===0||c.y===0||c.x===cols-1||c.y===rows-1}
function occupiedKeys(){
  const s=new Set([cellKey(levelStart),cellKey(exit)]);
  bananas.forEach(b=>s.add(cellKey(b)));
  if(friend)s.add(cellKey(friend));
  if(specialItem)s.add(cellKey(specialItem));
  return s;
}

/* Coloca al compañero fuera del camino principal, preferentemente
   en un callejón secundario que obliga a explorar. */
function placeFriendInDetour(){
  if(!friend) return;
  const main=shortestPath(levelStart,exit);
  const mainSet=new Set(main.map(cellKey));
  const dist=distancesFrom(levelStart);
  let candidates=allCells().filter(c=>{
    const degree=neighborsOf(c.x,c.y).length;
    return !mainSet.has(cellKey(c)) && degree===1 && (dist.get(cellKey(c))||0)>2;
  });
  if(!candidates.length){
    candidates=allCells().filter(c=>!mainSet.has(cellKey(c))&&(dist.get(cellKey(c))||0)>2);
  }
  candidates.sort((a,b)=>(dist.get(cellKey(b))||0)-(dist.get(cellKey(a))||0));
  if(candidates.length){
    friend.x=candidates[0].x;friend.y=candidates[0].y;
    friend.name=ADVENTURE_CLASSMATES[level-1]||friend.name;
  }
}

/* Abre una segunda entrada cerca del ramal del compañero.
   El laberinto deja de ser un árbol perfecto y aparece un pequeño circuito. */
function createSecretPassage(){
  secretLinks=[];
  if(!SECRET_LEVELS.has(level)||!friend)return;
  const pathToFriend=shortestPath(levelStart,friend);
  const branchSet=new Set(pathToFriend.map(cellKey));
  const dirs=[
    {dx:1,dy:0,a:'right',b:'left'},
    {dx:-1,dy:0,a:'left',b:'right'},
    {dx:0,dy:1,a:'down',b:'up'},
    {dx:0,dy:-1,a:'up',b:'down'}
  ];
  const nearby=pathToFriend.slice(Math.max(1,pathToFriend.length-5));
  for(const c of nearby.reverse()){
    for(const d of dirs){
      const nx=c.x+d.dx,ny=c.y+d.dy;
      if(nx<0||ny<0||nx>=cols||ny>=rows)continue;
      if(!maze[c.y][c.x].walls[d.a])continue;
      const n={x:nx,y:ny};
      if(branchSet.has(cellKey(n)))continue;
      const alt=shortestPath(n,friend);
      if(alt.length>=2){
        maze[c.y][c.x].walls[d.a]=false;
        maze[ny][nx].walls[d.b]=false;
        secretLinks=[{x:c.x,y:c.y},{x:nx,y:ny}];
        return;
      }
    }
  }
}

function placeWhirlpool(){
  whirlpool=null;controlsReversed=false;
  if(!WHIRLPOOL_LEVELS.has(level))return;
  const main=shortestPath(levelStart,exit);
  const forbidden=occupiedKeys();
  const options=allCells().filter(c=>!forbidden.has(cellKey(c))&&!sameCell(c,exit)&&!sameCell(c,levelStart));
  options.sort((a,b)=>{
    const ai=main.findIndex(p=>sameCell(p,a)),bi=main.findIndex(p=>sameCell(p,b));
    return (bi<0?-1:bi)-(ai<0?-1:ai);
  });
  if(options.length)whirlpool={...options[Math.floor(options.length*.42)],used:false};
}

function placeFalseHouse(){
  falseExit=null;
  if(!FALSE_HOUSE_LEVELS.has(level))return;
  const mainSet=new Set(shortestPath(levelStart,exit).map(cellKey));
  const forbidden=occupiedKeys();
  let options=allCells().filter(c=>!forbidden.has(cellKey(c))&&!mainSet.has(cellKey(c))&&neighborsOf(c.x,c.y).length===1);
  if(!options.length)options=allCells().filter(c=>!forbidden.has(cellKey(c))&&!mainSet.has(cellKey(c)));
  if(options.length)falseExit={...options[options.length-1]};
}

function guardianRoute(){
  const cells=allCells().filter(isOuter);
  const usable=cells.filter(c=>neighborsOf(c.x,c.y).length>0&&!sameCell(c,levelStart)&&!sameCell(c,exit));
  if(!usable.length)return [];
  const main=shortestPath(levelStart,exit);
  let start=usable.find(c=>main.some(p=>sameCell(p,c)))||usable[0];
  const route=[start];
  let prev=null,cur=start;
  for(let i=0;i<5;i++){
    const opts=neighborsOf(cur.x,cur.y).filter(n=>!prev||!sameCell(n,prev));
    const next=opts.find(isOuter)||opts[0];
    if(!next)break;
    route.push(next);prev=cur;cur=next;
  }
  return route;
}
function placeGuardian(){
  guardian=null;guardianDir=1;guardianStepAt=performance.now()+900;
  const cfg=BOSS_LEVELS[level];
  if(!cfg)return;
  const route=guardianRoute();
  if(route.length>=2)guardian={...cfg,route,index:0,x:route[0].x,y:route[0].y};
}
function resetToStart(message){
  player=levelStart;steps++;moveLock=true;
  setTimeout(()=>moveLock=false,240);
  bumpSound();showToast(message);updateHud();draw();
}
function checkGuardianCollision(){
  if(guardianCanCapture223(guardian)){
    resetToStart(guardian.message);
  }
}
function advanceGuardian(t){
  if(!guardian||!playing||t<guardianStepAt)return;
  guardianStepAt=t+760;
  let next=guardian.index+guardianDir;
  if(next>=guardian.route.length||next<0){guardianDir*=-1;next=guardian.index+guardianDir}
  guardian.index=next;
  guardian.x=guardian.route[next].x;guardian.y=guardian.route[next].y;
  checkGuardianCollision();
}
function mechanicLabel(){
  if(level<=3)return '🌿 Paseo tranquilo';
  const parts=[];
  if(SECRET_LEVELS.has(level))parts.push('✨ pasaje');
  if(WHIRLPOOL_LEVELS.has(level))parts.push('🌪️ remolino');
  if(DARK_LEVELS.has(level))parts.push('🔦 oscuridad');
  if(FALSE_HOUSE_LEVELS.has(level))parts.push('🏠 dos casas');
  if(BOSS_LEVELS[level])parts.push(BOSS_LEVELS[level].icon+' guardián');
  return parts.join(' · ')||'🧭 exploración';
}
function updateMechanicHud(){
  let pill=document.getElementById('mechanicPill');
  if(!pill){
    pill=document.createElement('div');pill.id='mechanicPill';pill.className='pill';
    document.querySelector('.hud').appendChild(pill);
  }
  pill.textContent=mechanicLabel();
}

const originalBuildLevel=buildLevel;
buildLevel=function(n){
  originalBuildLevel(n);
  if(!friend){
    friend={x:0,y:0,found:false,name:ADVENTURE_CLASSMATES[n-1]||('Compañero '+n)};
  }else{
    friend.name=ADVENTURE_CLASSMATES[n-1]||friend.name;
  }
  placeFriendInDetour();
  createSecretPassage();
  placeWhirlpool();
  placeFalseHouse();
  placeGuardian();
  updateMechanicHud();
  adventureNoticeShown=false;
  updateHud();draw();
};

/* La salida solo se habilita después de encontrar al compañero. */
const originalFinishLevel=finishLevel;
finishLevel=function(){
  if(friend&&!friend.found){
    showToast(`🐒 ${friend.name} todavía está esperando en un desvío.`);
    bumpSound();
    return;
  }
  originalFinishLevel();
};

/* Eventos de celda adicionales. */
const originalCheckCell=checkCell;
checkCell=function(){
  if(falseExit&&sameCell(player,falseExit)){
    resetToStart('🏠 ¡Esta era la casita equivocada! La escuela está en otro camino.');
    return;
  }
  if(whirlpool&&!whirlpool.used&&sameCell(player,whirlpool)){
    whirlpool.used=true;controlsReversed=!controlsReversed;
    glassesSound();
    showToast('🌪️ ¡Remolino travieso! Los controles quedaron invertidos.');
  }
  checkGuardianCollision();
  if(sameCell(player,levelStart)&&guardian)return;
  originalCheckCell();
};

/* Invierte el sentido cuando el remolino fue activado. */
const originalTryMove=tryMove;
tryMove=function(dx,dy){
  if(controlsReversed){dx*=-1;dy*=-1}
  originalTryMove(dx,dy);
};

/* Dibujo de las nuevas mecánicas sobre el tablero original. */
const originalDraw=draw;
draw=function(){
  originalDraw();
  if(!maze)return;
  const {size,ox,oy}=cellMetrics();

  if(secretLinks.length===2){
    ctx.save();
    ctx.strokeStyle=`rgba(255,244,133,${.55+.25*Math.sin(animTime*5)})`;
    ctx.lineWidth=Math.max(3,size*.07);
    ctx.setLineDash([size*.12,size*.08]);
    ctx.beginPath();
    ctx.moveTo(ox+(secretLinks[0].x+.5)*size,oy+(secretLinks[0].y+.5)*size);
    ctx.lineTo(ox+(secretLinks[1].x+.5)*size,oy+(secretLinks[1].y+.5)*size);
    ctx.stroke();ctx.restore();
  }

  if(whirlpool&&!whirlpool.used){
    const cx=ox+(whirlpool.x+.5)*size,cy=oy+(whirlpool.y+.5)*size;
    ctx.save();ctx.translate(cx,cy);ctx.rotate(animTime*2.8);
    ctx.strokeStyle='#7d5ac7';ctx.lineWidth=Math.max(3,size*.055);
    for(let r=.08;r<.34;r+=.08){ctx.beginPath();ctx.arc(0,0,size*r,0,Math.PI*1.55);ctx.stroke();ctx.rotate(.8)}
    ctx.restore();
  }

  if(falseExit)drawFalseHouse(falseExit.x,falseExit.y,size,ox,oy);

  if(guardian){
    const cx=ox+(guardian.x+.5)*size,cy=oy+(guardian.y+.5)*size;
    ctx.save();ctx.translate(cx,cy+Math.sin(animTime*4)*size*.04);
    ctx.font=`${Math.max(24,size*.58)}px Arial`;ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText(guardian.icon,0,0);
    ctx.font=`900 ${Math.max(9,size*.13)}px Arial`;ctx.fillStyle='#5a3e25';
    ctx.fillText(guardian.name,0,-size*.35);ctx.restore();
  }

  if(DARK_LEVELS.has(level)){
    const cx=ox+(player.x+.5)*size,cy=oy+(player.y+.5)*size;
    ctx.save();
    const radius=size*(typeof visionRadius==='number'?visionRadius:2.15);
    const grad=ctx.createRadialGradient(cx,cy,size*.45,cx,cy,radius);
    grad.addColorStop(0,'rgba(3,10,18,0)');
    grad.addColorStop(.55,'rgba(3,10,18,.20)');
    grad.addColorStop(1,'rgba(3,10,18,.93)');
    ctx.fillStyle=grad;ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.restore();
  }
};

function drawFalseHouse(x,y,size,ox,oy){
  /* La casa falsa es visualmente creíble: no tiene signo, brillo ni pista. */
  const px=ox+x*size,py=oy+y*size;
  ctx.save();ctx.translate(px+size/2,py+size/2);
  ctx.fillStyle='#8b5a2b';ctx.fillRect(-size*.28,-size*.18,size*.56,size*.38);
  ctx.fillStyle='#f7e4b1';ctx.fillRect(-size*.18,-size*.08,size*.36,size*.26);
  ctx.fillStyle='#a43f3f';ctx.beginPath();ctx.moveTo(-size*.34,-size*.18);ctx.lineTo(0,-size*.45);ctx.lineTo(size*.34,-size*.18);ctx.closePath();ctx.fill();
  ctx.fillStyle='#4b79a8';ctx.fillRect(-size*.07,size*.02,size*.14,size*.16);
  ctx.restore();
}

/* Reemplaza el bucle de animación para mover guardianes. */
animate=function(t){
  animTime=t/1000;
  advanceGuardian(t);
  draw();
  requestAnimationFrame(animate);
};


/* ===== Bloque JavaScript original 3 ===== */

'use strict';

/* =========================================================
   NITO Y EL LABERINTO — LÓGICA 3.0
   Menos carteles, más deducción visual.
   ========================================================= */

const LOGIC_LEVELS={
  6:{kind:'water',itemIcon:'🚣',itemName:'Bote',obstacleIcon:'💧'},
  9:{kind:'lock',itemIcon:'🗝️',itemName:'Llave',obstacleIcon:'🔒'},
  10:{kind:'bridge',itemIcon:'🪵',itemName:'Tabla',obstacleIcon:'🕳️'},
  12:{kind:'water',itemIcon:'🚣',itemName:'Bote',obstacleIcon:'💧'},
  16:{kind:'lock',itemIcon:'🗝️',itemName:'Llave',obstacleIcon:'🔒'},
  18:{kind:'water',itemIcon:'🚣',itemName:'Bote',obstacleIcon:'💧'},
  19:{kind:'bridge',itemIcon:'🪵',itemName:'Tabla',obstacleIcon:'🕳️'},
  20:{kind:'lock',itemIcon:'🗝️',itemName:'Llave',obstacleIcon:'🔒'}
};

let logicChallenge=null;
let carriedItem=null;
let schoolGlowAt=0;
let guardianPauseUntil=0;

/* El contador de pasos deja de formar parte de la experiencia. */
(function simplifyHud(){
  const stepsPill=stepsLabel&&stepsLabel.closest('.pill');
  if(stepsPill)stepsPill.remove();
  let friendPill=document.getElementById('friendPill');
  if(!friendPill){
    friendPill=document.createElement('div');
    friendPill.id='friendPill';friendPill.className='pill';
    document.querySelector('.hud').appendChild(friendPill);
  }
  let itemPill=document.getElementById('itemPill');
  if(!itemPill){
    itemPill=document.createElement('div');
    itemPill.id='itemPill';itemPill.className='pill';
    document.querySelector('.hud').appendChild(itemPill);
  }
  const mechanic=document.getElementById('mechanicPill');
  if(mechanic)mechanic.remove();
})();

function updateLogicHud(){
  const fp=document.getElementById('friendPill');
  const ip=document.getElementById('itemPill');
  if(fp)fp.textContent=friend&&friend.found?'🐒 ✓':'🐒 ?';
  if(ip){
    if(logicChallenge)ip.textContent=carriedItem?carriedItem.itemIcon:'🎒 —';
    else ip.textContent='🎒 —';
  }
}

const updateHudBeforeLogic=updateHud;
updateHud=function(){
  updateHudBeforeLogic();
  updateLogicHud();
};

function directionBetween(a,b){
  const dx=b.x-a.x,dy=b.y-a.y;
  if(dx===1)return{from:'right',to:'left'};
  if(dx===-1)return{from:'left',to:'right'};
  if(dy===1)return{from:'down',to:'up'};
  return{from:'up',to:'down'};
}

function findChallengeItemCell(mainPath,forbidden){
  const mainSet=new Set(mainPath.map(cellKey));
  const dist=distancesFrom(levelStart);
  let options=allCells().filter(c=>
    !forbidden.has(cellKey(c)) && !mainSet.has(cellKey(c)) &&
    neighborsOf(c.x,c.y).length===1 && (dist.get(cellKey(c))||0)>3
  );
  if(!options.length){
    options=allCells().filter(c=>!forbidden.has(cellKey(c))&&!mainSet.has(cellKey(c)));
  }
  options.sort((a,b)=>(dist.get(cellKey(b))||0)-(dist.get(cellKey(a))||0));
  return options[0]||null;
}

function setupLogicChallenge(){
  logicChallenge=null;carriedItem=null;
  const cfg=LOGIC_LEVELS[level];
  if(!cfg)return;
  const path=shortestPath(levelStart,exit);
  if(path.length<5)return;
  const edgeIndex=Math.max(2,path.length-3);
  const a=path[edgeIndex-1],b=path[edgeIndex];
  const forbidden=occupiedKeys();
  forbidden.add(cellKey(a));forbidden.add(cellKey(b));
  if(falseExit)forbidden.add(cellKey(falseExit));
  if(whirlpool)forbidden.add(cellKey(whirlpool));
  const itemCell=findChallengeItemCell(path,forbidden);
  if(!itemCell)return;
  logicChallenge={...cfg,a:{...a},b:{...b},item:{...itemCell},collected:false,solved:false};
}

/* Guardianes: patrullan un ramal secundario, se mueven más despacio y
   nunca avanzan sobre Nito. Así desafían sin cerrar el único camino. */
function safeGuardianRoute(){
  if(!friend)return[];
  const mainSet=new Set(shortestPath(levelStart,exit).map(cellKey));
  const toFriend=shortestPath(levelStart,friend);
  const branch=toFriend.filter(c=>!mainSet.has(cellKey(c)));
  if(branch.length>=3)return branch.slice(Math.max(0,branch.length-3));
  const offMain=allCells().filter(c=>!mainSet.has(cellKey(c))&&neighborsOf(c.x,c.y).length>0);
  if(offMain.length<2)return[];
  const start=offMain[0];
  const n=neighborsOf(start.x,start.y).find(c=>!mainSet.has(cellKey(c)));
  return n?[start,n]:[];
}

placeGuardian=function(){
  guardian=null;guardianDir=1;guardianPauseUntil=0;
  const cfg=BOSS_LEVELS[level];
  if(!cfg)return;
  const route=safeGuardianRoute();
  if(route.length>=2){
    guardian={...cfg,route,index:0,x:route[0].x,y:route[0].y};
    guardianStepAt=performance.now()+1800;
  }
};

advanceGuardian=function(t){
  if(!guardian||!playing||t<guardianStepAt||t<guardianPauseUntil)return;
  guardianStepAt=t+1450;
  let next=guardian.index+guardianDir;
  if(next>=guardian.route.length||next<0){
    guardianDir*=-1;next=guardian.index+guardianDir;
    guardianPauseUntil=t+650;
  }
  const target=guardian.route[next];
  if(target&&sameCell(target,player))return; // jamás cae encima del jugador.
  guardian.index=next;guardian.x=target.x;guardian.y=target.y;
};

resetToStart=function(){
  player=levelStart;moveLock=true;
  setTimeout(()=>moveLock=false,260);
  bumpSound();showToast('↩️');updateHud();draw();
};

/* Menos texto: los primeros niveles no muestran anuncios y los demás
   tampoco revelan la mecánica antes de que el niño la descubra. */
updateMechanicHud=function(){
  const p=document.getElementById('mechanicPill');
  if(p)p.remove();
};

/* Los objetos-evento conservan su efecto, pero ya no interrumpen con carteles. */
activateSpecial=function(){
  if(!specialItem||specialItem.got)return;
  specialItem.got=true;specialActive=true;
  if(specialItem.type==='radio'){musicTempo=1.25;restartMusic();radioSound()}
  else if(specialItem.type==='trumpet'){trumpetFanfare()}
  else{currentPalette=level===15?'night':'rainbow';glassesSound()}
  updateEventHud();
};

const buildLevelLogicBase=buildLevel;
buildLevel=function(n){
  buildLevelLogicBase(n);
  setupLogicChallenge();
  updateLogicHud();
  draw();
};

/* El compañero ya no genera un cartel. La escuela se ilumina y el sonido
   confirma el descubrimiento. */
function collectQuietly(){
  for(const b of bananas){
    if(!b.got&&sameCell(player,b)){b.got=true;collected++;pluckSound()}
  }
  if(friend&&!friend.found&&sameCell(player,friend)){
    friend.found=true;friendSound();schoolGlowAt=performance.now();
    if(!foundClassmates.includes(friend.name)){
      foundClassmates.push(friend.name);
      localStorage.setItem('nitoFoundClassmates',JSON.stringify(foundClassmates));
    }
  }
  if(specialItem&&!specialItem.got&&sameCell(player,specialItem))activateSpecial();
  if(logicChallenge&&!logicChallenge.collected&&sameCell(player,logicChallenge.item)){
    logicChallenge.collected=true;
    carriedItem=logicChallenge;
    pluckSound();
  }
}

function edgeMatches(a,b,x1,y1,x2,y2){
  return (a.x===x1&&a.y===y1&&b.x===x2&&b.y===y2)||
         (b.x===x1&&b.y===y1&&a.x===x2&&a.y===y2);
}

const rawMove=originalTryMove;
tryMove=function(dx,dy){
  if(!playing||moveLock)return;
  if(controlsReversed){dx*=-1;dy*=-1}
  const nx=player.x+dx,ny=player.y+dy;
  if(logicChallenge&&!logicChallenge.solved&&
     edgeMatches(logicChallenge.a,logicChallenge.b,player.x,player.y,nx,ny)){
    if(carriedItem===logicChallenge){
      logicChallenge.solved=true;carriedItem=null;
      glassesSound();updateLogicHud();draw();
    }else{
      bumpSound();
      return;
    }
  }
  rawMove(dx,dy);
};

checkCell=function(){
  if(falseExit&&sameCell(player,falseExit)){resetToStart();return}
  if(whirlpool&&!whirlpool.used&&sameCell(player,whirlpool)){
    whirlpool.used=true;controlsReversed=!controlsReversed;glassesSound();
  }
  if(guardianCanCapture223(guardian)){resetToStart();return}
  collectQuietly();
  updateHud();
  if(sameCell(player,exit)){
    if(friend&&!friend.found){bumpSound();return}
    finishLevel();
  }
};

/* Resultado breve: sin lista extensa ni contador de pasos. */
finishLevel=function(){
  if(friend&&!friend.found){bumpSound();return}
  playing=false;winSound();
  if(level<TOTAL_LEVELS){
    unlocked=Math.max(unlocked,level+1);
    localStorage.setItem('nitoUnlocked',unlocked);
  }
  document.getElementById('messageTitle').textContent=level===TOTAL_LEVELS?'🏫 ¡Llegamos!':'🌿 ¡Nivel superado!';
  document.getElementById('messageText').innerHTML=`🍌 <strong>${collected}/${bananas.length}</strong>`;
  const box=document.getElementById('messageButtons');box.innerHTML='';
  if(level<TOTAL_LEVELS)box.appendChild(makeButton('Siguiente nivel',()=>{hideMessage();startGame(level+1)}));
  else box.appendChild(makeButton('Jugar otra vez',()=>{hideMessage();startGame(1)}));
  box.appendChild(makeButton('Elegir nivel',()=>{hideMessage();showLevels('message')},'secondary'));
  document.getElementById('messageOverlay').style.display='flex';
};

/* Escuela apagada hasta encontrar al compañero; después se enciende. */
drawExit=function(x,y,size,ox,oy){
  const unlockedSchool=!friend||friend.found;
  const px=ox+x*size,py=oy+y*size;
  ctx.save();ctx.translate(px+size/2,py+size/2);
  if(unlockedSchool){
    const pulse=.5+.5*Math.sin(animTime*5);
    ctx.shadowColor='rgba(255,226,83,.95)';ctx.shadowBlur=size*(.12+.10*pulse);
  }
  ctx.fillStyle=unlockedSchool?'#8b5a2b':'#6f746f';ctx.fillRect(-size*.28,-size*.18,size*.56,size*.38);
  ctx.fillStyle=unlockedSchool?'#f7e4b1':'#aeb4ae';ctx.fillRect(-size*.18,-size*.08,size*.36,size*.26);
  ctx.fillStyle=unlockedSchool?'#a43f3f':'#555d5a';ctx.beginPath();ctx.moveTo(-size*.34,-size*.18);ctx.lineTo(0,-size*.45);ctx.lineTo(size*.34,-size*.18);ctx.closePath();ctx.fill();
  ctx.fillStyle=unlockedSchool?'#4b79a8':'#444b49';ctx.fillRect(-size*.07,size*.02,size*.14,size*.16);
  if(!unlockedSchool){
    ctx.shadowColor='transparent';ctx.font=`${Math.max(16,size*.30)}px Arial`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('🔒',0,size*.02);
  }
  ctx.restore();
};

function drawLogicChallenge(size,ox,oy){
  if(!logicChallenge)return;
  if(!logicChallenge.collected){
    const cx=ox+(logicChallenge.item.x+.5)*size,cy=oy+(logicChallenge.item.y+.5)*size;
    ctx.save();ctx.translate(cx,cy+Math.sin(animTime*3)*size*.04);
    ctx.textAlign='center';ctx.textBaseline='middle';
    if(logicChallenge.kind==='bridge'){
      ctx.rotate(-.12);
      ctx.fillStyle='#9a622f';ctx.strokeStyle='#5f3a1f';ctx.lineWidth=Math.max(2,size*.035);
      for(const off of [-.10,.10]){
        ctx.beginPath();ctx.roundRect(-size*.30,off*size-size*.065,size*.60,size*.13,size*.035);ctx.fill();ctx.stroke();
        ctx.strokeStyle='#d4a05f';ctx.lineWidth=Math.max(1,size*.018);
        ctx.beginPath();ctx.moveTo(-size*.22,off*size);ctx.lineTo(size*.22,off*size);ctx.stroke();ctx.strokeStyle='#5f3a1f';
      }
    }else{
      ctx.font=`${Math.max(24,size*.48)}px Arial`;ctx.fillText(logicChallenge.itemIcon,0,0);
    }
    ctx.restore();
  }
  if(!logicChallenge.solved){
    const ax=ox+(logicChallenge.a.x+.5)*size,ay=oy+(logicChallenge.a.y+.5)*size;
    const bx=ox+(logicChallenge.b.x+.5)*size,by=oy+(logicChallenge.b.y+.5)*size;
    const cx=(ax+bx)/2,cy=(ay+by)/2;
    ctx.save();ctx.translate(cx,cy);
    const vertical=Math.abs(ax-bx)<1;
    if(logicChallenge.kind==='water'){
      ctx.strokeStyle='#4d9bd1';ctx.lineWidth=Math.max(5,size*.16);ctx.lineCap='round';
      ctx.beginPath();ctx.moveTo(vertical?-size*.34:0,vertical?0:-size*.34);ctx.lineTo(vertical?size*.34:0,vertical?0:size*.34);ctx.stroke();
      ctx.font=`${Math.max(15,size*.25)}px Arial`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('💧',0,0);
    }else if(logicChallenge.kind==='bridge'){
      ctx.fillStyle='#342d2a';
      if(vertical)ctx.fillRect(-size*.38,-size*.12,size*.76,size*.24);else ctx.fillRect(-size*.12,-size*.38,size*.24,size*.76);
      ctx.font=`${Math.max(15,size*.24)}px Arial`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('⚠️',0,0);
    }else{
      ctx.font=`${Math.max(22,size*.38)}px Arial`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('🔒',0,0);
    }
    ctx.restore();
  }
}

const drawLogicBase=draw;
draw=function(){
  drawLogicBase();
  if(!maze)return;
  const {size,ox,oy}=cellMetrics();
  drawLogicChallenge(size,ox,oy);
  /* Los objetos también quedan dentro del cono de luz. */
  if(DARK_LEVELS.has(level)){
    const cx=ox+(player.x+.5)*size,cy=oy+(player.y+.5)*size;
    ctx.save();
    const radius=size*(typeof visionRadius==='number'?visionRadius:2.15);
    const grad=ctx.createRadialGradient(cx,cy,size*.45,cx,cy,radius);
    grad.addColorStop(0,'rgba(3,10,18,0)');
    grad.addColorStop(.55,'rgba(3,10,18,.20)');
    grad.addColorStop(1,'rgba(3,10,18,.93)');
    ctx.fillStyle=grad;ctx.fillRect(0,0,canvas.width,canvas.height);ctx.restore();
  }
};

/* Corrige también el texto inicial para no explicar de más. */
const startCard=document.querySelector('#startOverlay .card');
if(startCard){
  startCard.querySelector('h1').textContent='🌳 Nito y el Laberinto';
  const ps=startCard.querySelectorAll('p');
  if(ps[0])ps[0].textContent='Explorá la selva y encontrá el camino a la escuela.';
  if(ps[1])ps[1].remove();
}

updateLogicHud();


/* === ACTUALIZACIÓN 3.1: ATAJOS DE AMISTAD Y PAREDES FALSAS === */
let friendShortcut=null;
let falseWallEdges=new Set();
const OPPOSITE={up:'down',down:'up',left:'right',right:'left'};

function edgeId(x1,y1,x2,y2){
  return x1< x2 || (x1===x2&&y1<y2)
    ? `${x1},${y1}|${x2},${y2}`
    : `${x2},${y2}|${x1},${y1}`;
}
function directionBetween(a,b){
  if(b.x===a.x+1&&b.y===a.y)return 'right';
  if(b.x===a.x-1&&b.y===a.y)return 'left';
  if(b.y===a.y+1&&b.x===a.x)return 'down';
  if(b.y===a.y-1&&b.x===a.x)return 'up';
  return null;
}
function setEdgeOpen(a,b,open){
  const dir=directionBetween(a,b); if(!dir)return;
  maze[a.y][a.x].walls[dir]=!open;
  maze[b.y][b.x].walls[OPPOSITE[dir]]=!open;
}
function pathLength(a,b){const p=shortestPath(a,b);return p.length?p.length-1:Infinity}

function setupFriendShortcut(){
  friendShortcut=null;
  if(level<4||!friend)return;
  const before=pathLength(friend,exit);
  const candidates=[];
  for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
    for(const d of [{dx:1,dy:0,key:'right'},{dx:0,dy:1,key:'down'}]){
      const nx=x+d.dx,ny=y+d.dy;
      if(nx>=cols||ny>=rows||!maze[y][x].walls[d.key])continue;
      const a={x,y},b={x:nx,y:ny};
      if((a.x===0&&a.y===0)||(b.x===0&&b.y===0))continue;
      if(sameCell(a,exit)||sameCell(b,exit))continue;
      setEdgeOpen(a,b,true);
      const after=pathLength(friend,exit);
      setEdgeOpen(a,b,false);
      const near=Math.min(Math.abs(a.x-friend.x)+Math.abs(a.y-friend.y),Math.abs(b.x-friend.x)+Math.abs(b.y-friend.y));
      const gain=before-after;
      if(Number.isFinite(after)&&gain>=2)candidates.push({a,b,gain,near});
    }
  }
  candidates.sort((u,v)=>(v.gain-u.gain)||(u.near-v.near));
  const chosen=candidates[0];
  if(chosen)friendShortcut={a:chosen.a,b:chosen.b,opened:false};
}

function openFriendShortcut(){
  if(!friendShortcut||friendShortcut.opened)return;
  setEdgeOpen(friendShortcut.a,friendShortcut.b,true);
  friendShortcut.opened=true;
  glassesSound();
}

function setupFalseWalls(){
  falseWallEdges=new Set();
  if(level<10)return;
  const rand=seededRandom(91873+level*1777);
  const candidates=[];
  for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
    for(const d of [{dx:1,dy:0,key:'right'},{dx:0,dy:1,key:'down'}]){
      const nx=x+d.dx,ny=y+d.dy;
      if(nx>=cols||ny>=rows||!maze[y][x].walls[d.key])continue;
      const a={x,y},b={x:nx,y:ny};
      if(friendShortcut&&edgeMatches(friendShortcut.a,friendShortcut.b,a.x,a.y,b.x,b.y))continue;
      if(logicChallenge&&edgeMatches(logicChallenge.a,logicChallenge.b,a.x,a.y,b.x,b.y))continue;
      if(sameCell(a,exit)||sameCell(b,exit)||sameCell(a,levelStart)||sameCell(b,levelStart))continue;
      candidates.push({a,b,score:rand()});
    }
  }
  candidates.sort((a,b)=>b.score-a.score);
  const amount=level>=17?3:(level>=14?2:1);
  for(const c of candidates.slice(0,amount))falseWallEdges.add(edgeId(c.a.x,c.a.y,c.b.x,c.b.y));
}

function isFalseWallMove(x,y,nx,ny){return falseWallEdges.has(edgeId(x,y,nx,ny))}

/* El guardián nunca patrulla el camino obligatorio al compañero ni el regreso
   principal hacia la escuela. Si no existe un ramal seguro, ese nivel queda sin guardián. */
safeGuardianRoute=function(){
  if(!friend)return[];
  const protectedCells=new Set([
    ...shortestPath(levelStart,friend).map(cellKey),
    ...shortestPath(friend,exit).map(cellKey)
  ]);
  const allowed=allCells().filter(c=>!protectedCells.has(cellKey(c))&&neighborsOf(c.x,c.y).length>0);
  for(const start of allowed){
    const route=[start];
    let cur=start;
    for(let i=0;i<3;i++){
      const next=neighborsOf(cur.x,cur.y).find(n=>!protectedCells.has(cellKey(n))&&!route.some(r=>sameCell(r,n)));
      if(!next)break;
      route.push(next);cur=next;
    }
    if(route.length>=2)return route;
  }
  return[];
};

const buildLevel31Base=buildLevel;
buildLevel=function(n){
  buildLevel31Base(n);
  setupFriendShortcut();
  setupFalseWalls();
  placeGuardian();
  draw();
};

const collectQuietly31Base=collectQuietly;
collectQuietly=function(){
  const wasMissing=friend&&!friend.found;
  collectQuietly31Base();
  if(wasMissing&&friend&&friend.found)openFriendShortcut();
};

const tryMove31Base=tryMove;
tryMove=function(dx,dy){
  if(!playing||moveLock)return;
  const effectiveDx=controlsReversed?-dx:dx;
  const effectiveDy=controlsReversed?-dy:dy;
  const nx=player.x+effectiveDx,ny=player.y+effectiveDy;
  if(nx<0||ny<0||nx>=cols||ny>=rows){bumpSound();return}
  if(!isFalseWallMove(player.x,player.y,nx,ny)){
    tryMove31Base(dx,dy);return;
  }
  const a={x:player.x,y:player.y},b={x:nx,y:ny};
  setEdgeOpen(a,b,true);
  tryMove31Base(dx,dy);
  setEdgeOpen(a,b,false);
  draw();
};



/* === ACTUALIZACIÓN 3.2: EXPLORACIÓN, BANANAS Y MÚSICA VIVA === */
let visionRadius=2.15;
let visionGlasses=[];
let bananaGate=null;
let permanentBananas=0;
let foundBananaIds=new Set();
let musicDiscoveries=new Set(JSON.parse(localStorage.getItem('nitoMusicDiscoveries')||'[]'));

const BANANA_GATE_LEVELS={8:5,12:8,16:12,19:16};
const MUSIC_LAYER_BY_EVENT={radio:'bass',trumpet:'clarinet',glasses:'strings'};

function saveBananas(){
  /* Las bananas pertenecen a la partida actual y no se guardan en el navegador. */
}
function updateBananaHud32(){
  if(bananaLabel)bananaLabel.textContent=permanentBananas;
  if(bananaTotal)bananaTotal.textContent='';
  const slash=bananaTotal&&bananaTotal.previousSibling;
  if(slash&&slash.nodeType===Node.TEXT_NODE)slash.textContent='';
}

/* Anteojos de exploración: uno en el nivel 11 y tres en el 17. */
function setupVisionGlasses(){
  visionGlasses=[];visionRadius=2.15;
  const amount=level===11?1:(level===17?3:0);
  if(!amount)return;
  const dist=distancesFrom(levelStart);
  const forbidden=occupiedKeys();
  if(logicChallenge)forbidden.add(cellKey(logicChallenge.item));
  let cells=allCells().filter(c=>!forbidden.has(cellKey(c))&&!sameCell(c,exit)&&!sameCell(c,friend));
  cells.sort((a,b)=>(dist.get(cellKey(b))||0)-(dist.get(cellKey(a))||0));
  const chosen=[];
  for(const c of cells){
    if(chosen.every(q=>Math.abs(q.x-c.x)+Math.abs(q.y-c.y)>=Math.max(3,Math.floor((cols+rows)/7))))chosen.push(c);
    if(chosen.length===amount)break;
  }
  visionGlasses=chosen.map(c=>({...c,got:false}));
}

/* Acceso opcional: abre un atajo, nunca el único camino. */
function setupBananaGate(){
  bananaGate=null;
  const required=BANANA_GATE_LEVELS[level];
  if(!required)return;
  const normal=pathLength(levelStart,exit);
  const candidates=[];
  for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
    for(const d of [{dx:1,dy:0,key:'right'},{dx:0,dy:1,key:'down'}]){
      const nx=x+d.dx,ny=y+d.dy;
      if(nx>=cols||ny>=rows||!maze[y][x].walls[d.key])continue;
      const a={x,y},b={x:nx,y:ny};
      if(sameCell(a,levelStart)||sameCell(b,levelStart)||sameCell(a,exit)||sameCell(b,exit))continue;
      if(friendShortcut&&edgeMatches(friendShortcut.a,friendShortcut.b,a.x,a.y,b.x,b.y))continue;
      if(logicChallenge&&edgeMatches(logicChallenge.a,logicChallenge.b,a.x,a.y,b.x,b.y))continue;
      setEdgeOpen(a,b,true);const shorter=pathLength(levelStart,exit);setEdgeOpen(a,b,false);
      const gain=normal-shorter;
      if(Number.isFinite(shorter)&&gain>=3)candidates.push({a,b,gain});
    }
  }
  candidates.sort((u,v)=>v.gain-u.gain);
  if(candidates[0])bananaGate={...candidates[0],required,opened:false};
}
function gateEdgeMatches(x1,y1,x2,y2){
  return bananaGate&&edgeMatches(bananaGate.a,bananaGate.b,x1,y1,x2,y2);
}

/* Ruta larga del guardián: paseo de profundidad que visita cerca del 75 % del mapa.
   No se queda quieto en la entrada, la escuela ni sobre el compañero. */
safeGuardianRoute=function(){
  const forbidden=new Set([cellKey(levelStart),cellKey(exit)]);if(friend)forbidden.add(cellKey(friend));
  const candidates=allCells().filter(c=>!forbidden.has(cellKey(c))&&neighborsOf(c.x,c.y).length>0);
  if(!candidates.length)return[];
  const start=candidates[Math.floor(candidates.length*.42)];
  const target=Math.max(8,Math.floor(cols*rows*.75));
  const route=[start],visited=new Set([cellKey(start)]);
  function walk(cur){
    if(visited.size>=target)return true;
    const ns=neighborsOf(cur.x,cur.y).filter(n=>!forbidden.has(cellKey(n))).sort((a,b)=>{
      const av=visited.has(cellKey(a))?1:0,bv=visited.has(cellKey(b))?1:0;return av-bv;
    });
    for(const n of ns){
      if(!visited.has(cellKey(n))){
        visited.add(cellKey(n));route.push(n);
        if(walk(n))return true;
        route.push(cur);
      }
    }
    return false;
  }
  walk(start);
  return route.length>=6?route:[];
};
placeGuardian=function(){
  guardian=null;guardianDir=1;guardianPauseUntil=0;
  const cfg=BOSS_LEVELS[level];if(!cfg)return;
  const route=safeGuardianRoute();
  if(route.length>=6){guardian={...cfg,route,index:0,x:route[0].x,y:route[0].y};guardianStepAt=performance.now()+1800}
};
advanceGuardian=function(t){
  if(!guardian||!playing||t<guardianStepAt||t<guardianPauseUntil)return;
  guardianStepAt=t+1100;
  let next=guardian.index+1;if(next>=guardian.route.length){next=0;guardianPauseUntil=t+550}
  const target=guardian.route[next];
  if(target&&sameCell(target,player)){guardianStepAt=t+400;return}
  guardian.index=next;guardian.x=target.x;guardian.y=target.y;
};

/* Construcción final de cada nivel. */
const buildLevel32Base=buildLevel;
buildLevel=function(n){
  buildLevel32Base(n);
  bananas.forEach((b,i)=>{b.persistId=`L${n}B${i}`;b.got=false});
  collected=0;
  setupVisionGlasses();setupBananaGate();placeGuardian();updateBananaHud32();draw();
};

/* Recolección persistente, anteojos y eventos musicales permanentes. */
const activateSpecial32Base=activateSpecial;
activateSpecial=function(){
  if(!specialItem||specialItem.got)return;
  const layer=MUSIC_LAYER_BY_EVENT[specialItem.type];
  if(layer){musicDiscoveries.add(layer);localStorage.setItem('nitoMusicDiscoveries',JSON.stringify([...musicDiscoveries]))}
  activateSpecial32Base();restartMusic();
};
const collectQuietly32Base=collectQuietly;
collectQuietly=function(){
  const before=new Set(bananas.filter(b=>b.got).map(b=>b.persistId));
  collectQuietly32Base();
  for(const b of bananas){
    if(b.got&&b.persistId&&!before.has(b.persistId)){
      permanentBananas++;
    }
  }
  for(const g of visionGlasses){
    if(!g.got&&sameCell(player,g)){
      g.got=true;visionRadius*=1.30;glassesSound();
    }
  }
  updateBananaHud32();
};

/* El mono guardián de bananas solo abre un atajo si se demuestra la cantidad.
   Si no alcanza, el recorrido normal continúa disponible. */
const tryMove32Base=tryMove;
tryMove=function(dx,dy){
  if(!playing||moveLock)return;
  const ex=controlsReversed?-dx:dx,ey=controlsReversed?-dy:dy;
  const nx=player.x+ex,ny=player.y+ey;
  if(gateEdgeMatches(player.x,player.y,nx,ny)&&bananaGate&&!bananaGate.opened){
    if(permanentBananas>=bananaGate.required){
      bananaGate.opened=true;setEdgeOpen(bananaGate.a,bananaGate.b,true);friendSound();draw();
    }else{bumpSound();return}
  }
  tryMove32Base(dx,dy);
};

function drawVisionGlasses(size,ox,oy){
  for(const g of visionGlasses){if(g.got)continue;
    const cx=ox+(g.x+.5)*size,cy=oy+(g.y+.5)*size;
    ctx.save();ctx.translate(cx,cy+Math.sin(animTime*3)*size*.035);
    ctx.font=`${Math.max(23,size*.46)}px Arial`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('👓',0,0);ctx.restore();
  }
}
function drawBananaGate(size,ox,oy){
  if(!bananaGate||bananaGate.opened)return;
  const ax=ox+(bananaGate.a.x+.5)*size,ay=oy+(bananaGate.a.y+.5)*size;
  const bx=ox+(bananaGate.b.x+.5)*size,by=oy+(bananaGate.b.y+.5)*size;
  const cx=(ax+bx)/2,cy=(ay+by)/2;
  ctx.save();ctx.translate(cx,cy);
  ctx.font=`${Math.max(20,size*.38)}px Arial`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('👮🐒',0,-size*.10);
  ctx.font=`900 ${Math.max(10,size*.15)}px Arial`;ctx.fillStyle='#5b421d';ctx.fillText(`🍌 ${bananaGate.required}`,0,size*.22);ctx.restore();
}
const draw32Base=draw;
draw=function(){
  draw32Base();if(!maze)return;
  const {size,ox,oy}=cellMetrics();drawVisionGlasses(size,ox,oy);drawBananaGate(size,ox,oy);
  /* El cono de luz base ya usa visionRadius; los anteojos amplían ese valor. */
};

/* La música crece cada cuatro niveles. Los objetos hallados adelantan y conservan capas. */
function musicTier(){return Math.min(4,Math.floor((level-1)/4))}
function layerActive(name,tier){
  const order={bass:1,clarinet:2,strings:3,flute:4};
  return tier>=order[name]||musicDiscoveries.has(name);
}
const playNocturneMeasure32Base=playNocturneMeasure;
playNocturneMeasure=function(){
  playNocturneMeasure32Base();
  if(!audioCtx||!musicOn)return;
  const tier=musicTier(),m=musicStep%nocturneMeasures.length;
  if(layerActive('bass',tier))pianoNote(27+(m%4)*2,NOCTURNE_BEAT*3.4,.006,0);
  if(layerActive('clarinet',tier))tone(midi(55+[0,3,5,7][m%4]),NOCTURNE_BEAT*1.7,'sine',.006,.18);
  if(layerActive('strings',tier)){
    const chord=[[51,55,58],[53,56,60],[55,58,62],[48,55,60]][m%4];
    chord.forEach((n,i)=>tone(midi(n),NOCTURNE_BEAT*2.8,'sine',.0038,.05+i*.03));
  }
  if(layerActive('flute',tier))tone(midi(79-[0,2,4,7][m%4]),NOCTURNE_BEAT*1.25,'triangle',.0048,.34);
};

const updateHud32Base=updateHud;
updateHud=function(){updateHud32Base();updateBananaHud32();};
updateBananaHud32();
/* === ACTUALIZACIÓN 3.3: HABITANTES, VEHÍCULOS Y RUTA DEL GRAN EXPLORADOR === */
const GUARDIAN_PERSONALITIES={
  gorilla1:{icon:'🦍',name:'Gorila curioso',step:1450,pause:700,canUseSecrets:false,mode:'patrol'},
  parrot:{icon:'🦜',name:'Loro explorador',step:760,pause:160,canUseSecrets:false,mode:'fly'},
  elephant:{icon:'🐘',name:'Guardián Demoledor',step:1700,pause:900,canUseSecrets:false,mode:'patrol'},
  sloth:{icon:'🦥',name:'Perezoso soñador',step:2100,pause:2300,canUseSecrets:false,mode:'patrol'},
  gorilla2:{icon:'🦍',name:'Gorila ágil',step:900,pause:250,canUseSecrets:true,mode:'chase'},
  turtle:{icon:'🐢',name:'Tortuga gigante',step:1850,pause:350,canUseSecrets:false,mode:'chase'}
};
const GUARDIAN_PLAN={7:['gorilla1'],12:['parrot'],13:['elephant'],15:['sloth'],16:['gorilla1'],17:['gorilla2'],18:['parrot'],19:['turtle'],20:['gorilla2','turtle']};
const VEHICLE_PLAN={7:{type:'skates',icon:'🛼',name:'Patines',speed:.74},13:{type:'bike',icon:'🚲',name:'Bicicleta',speed:.55},19:{type:'skateboard',icon:'🛹',name:'Patineta',speed:.62},20:{type:'skates',icon:'🛼',name:'Patines',speed:.72}};
let extraGuardian=null;
let vehicleItem=null;
let currentVehicle=null;
let turtleDash=null;
let explorerRoute=null;
let levelSecretFound=false;

function cumulativeBananasThrough(n){let total=0;for(let i=1;i<=n;i++)total+=Math.min(2+Math.floor(i/3),7);return total}
function pickSafeCell(seedOffset=0,avoid=new Set()){
  const dist=distancesFrom(levelStart);
  const list=allCells().filter(c=>!avoid.has(cellKey(c))&&!sameCell(c,exit)&&(!friend||!sameCell(c,friend)));
  list.sort((a,b)=>(dist.get(cellKey(b))||0)-(dist.get(cellKey(a))||0));
  return list[(seedOffset*7+level*3)%Math.max(1,list.length)]||null;
}
function guardianRouteFor(cfg,offset=0){
  const forbidden=new Set([cellKey(levelStart),cellKey(exit)]);if(friend)forbidden.add(cellKey(friend));
  const cells=allCells().filter(c=>!forbidden.has(cellKey(c))&&neighborsOf(c.x,c.y).length>0);
  if(!cells.length)return[];
  let start=cells[(Math.floor(cells.length*(.22+offset*.31))+level)%cells.length];
  const target=Math.max(9,Math.floor(cols*rows*(cfg.mode==='fly'?.65:.75)));
  const route=[start],visited=new Set([cellKey(start)]),stack=[start];
  while(stack.length&&visited.size<target){
    const cur=stack[stack.length-1];
    let ns;
    if(cfg.mode==='fly'){
      ns=DIRS.map(d=>({x:cur.x+d.dx,y:cur.y+d.dy})).filter(n=>n.x>=0&&n.y>=0&&n.x<cols&&n.y<rows&&!forbidden.has(cellKey(n)));
    }else ns=neighborsOf(cur.x,cur.y).filter(n=>!forbidden.has(cellKey(n)));
    ns.sort((a,b)=>(visited.has(cellKey(a))?1:0)-(visited.has(cellKey(b))?1:0));
    const next=ns.find(n=>!visited.has(cellKey(n)));
    if(next){visited.add(cellKey(next));route.push(next);stack.push(next)}else{stack.pop();if(stack.length)route.push(stack[stack.length-1])}
  }
  return route.length>=6?route:[];
}
function makeGuardian(kind,offset=0){
  const cfg=GUARDIAN_PERSONALITIES[kind],route=guardianRouteFor(cfg,offset);if(!route.length)return null;
  return {...cfg,kind,route,index:0,x:route[0].x,y:route[0].y,nextAt:performance.now()+1500+offset*450,pauseUntil:0};
}
placeGuardian=function(){
  guardian=null;extraGuardian=null;turtleDash=null;
  const plan=GUARDIAN_PLAN[level]||[];
  guardian=plan[0]?makeGuardian(plan[0],0):null;
  extraGuardian=plan[1]?makeGuardian(plan[1],1):null;
};
function chooseGuardianNext(g){
  if(!g)return null;
  if(g.mode==='chase'){
    const path=shortestPath({x:g.x,y:g.y},player);
    if(path.length>1)return path[1];
  }
  g.index=(g.index+1)%g.route.length;return g.route[g.index];
}
function moveOneGuardian(g,t){
  if(!g||!playing||t<g.nextAt||t<g.pauseUntil)return;
  if(g.kind==='turtle'&&turtleDash){
    const d=turtleDash.dir,nx=g.x+d.dx,ny=g.y+d.dy;
    const key=d.key;
    if(nx<0||ny<0||nx>=cols||ny>=rows||maze[g.y][g.x].walls[key]){
      vehicleItem={x:g.x,y:g.y,...VEHICLE_PLAN[19],got:false};turtleDash=null;g.nextAt=t+650;return;
    }
    g.x=nx;g.y=ny;g.nextAt=t+115;return;
  }
  const next=chooseGuardianNext(g);if(!next)return;
  if(sameCell(next,player)){g.nextAt=t+350;return}
  g.x=next.x;g.y=next.y;g.nextAt=t+g.step;g.pauseUntil=t+g.pause;
  if(g.kind==='turtle'&&vehicleItem&&!vehicleItem.got&&vehicleItem.type==='skateboard'&&sameCell(g,vehicleItem)){
    const d=DIRS.find(d=>!maze[g.y][g.x].walls[d.key])||DIRS[1];
    vehicleItem.got=true;turtleDash={dir:d};friendSound();
  }
}
advanceGuardian=function(t){moveOneGuardian(guardian,t);moveOneGuardian(extraGuardian,t)};

function setupVehicle(){
  currentVehicle=null;vehicleItem=null;
  const cfg=VEHICLE_PLAN[level];if(!cfg)return;
  const avoid=occupiedKeys();if(logicChallenge)avoid.add(cellKey(logicChallenge.item));
  const cell=pickSafeCell(2,avoid);if(cell)vehicleItem={...cell,...cfg,got:false};
}
function setupExplorerRoute(){
  explorerRoute=null;if(level<18)return;
  const required=cumulativeBananasThrough(level-1);
  const normal=pathLength(levelStart,exit),walls=[];
  for(let y=0;y<rows;y++)for(let x=0;x<cols;x++)for(const d of [{dx:1,dy:0,key:'right'},{dx:0,dy:1,key:'down'}]){
    const nx=x+d.dx,ny=y+d.dy;if(nx>=cols||ny>=rows||!maze[y][x].walls[d.key])continue;
    const a={x,y},b={x:nx,y:ny};setEdgeOpen(a,b,true);const len=pathLength(levelStart,exit);setEdgeOpen(a,b,false);
    if(Number.isFinite(len)&&normal-len>=2)walls.push({a,b,gain:normal-len});
  }
  walls.sort((a,b)=>b.gain-a.gain);explorerRoute={required,opened:false,walls:walls.slice(0,3)};
}
function openExplorerRoute(){
  if(!explorerRoute||explorerRoute.opened||permanentBananas<explorerRoute.required)return false;
  explorerRoute.opened=true;explorerRoute.walls.forEach(w=>setEdgeOpen(w.a,w.b,true));
  if(guardian)guardian.step*=1.35;if(extraGuardian)extraGuardian.step*=1.35;
  friendSound();draw();return true;
}

const buildLevel33Base=buildLevel;
buildLevel=function(n){buildLevel33Base(n);levelSecretFound=false;setupVehicle();setupExplorerRoute();placeGuardian();draw()};

const collectQuietly33Base=collectQuietly;
collectQuietly=function(){
  collectQuietly33Base();
  if(vehicleItem&&!vehicleItem.got&&sameCell(player,vehicleItem)){
    vehicleItem.got=true;currentVehicle=vehicleItem;pluckSound();
  }
};

const tryMove33Base=tryMove;
tryMove=function(dx,dy){
  const wasLocked=moveLock;tryMove33Base(dx,dy);
  if(!wasLocked&&currentVehicle&&moveLock)setTimeout(()=>{moveLock=false},Math.max(20,Math.round(70*currentVehicle.speed)));
  if(guardianCanCapture223()){resetToStart();return}
  if(explorerRoute&&!explorerRoute.opened&&permanentBananas>=explorerRoute.required&&sameCell(player,levelStart))openExplorerRoute();
};

function drawGuardian33(g,size,ox,oy){if(!g)return;const cx=ox+(g.x+.5)*size,cy=oy+(g.y+.5)*size;ctx.save();ctx.translate(cx,cy+Math.sin(animTime*3)*size*.025);ctx.font=`${Math.max(23,size*.48)}px Arial`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(g.icon,0,0);ctx.restore()}
function drawVehicle33(size,ox,oy){if(!vehicleItem||vehicleItem.got)return;const cx=ox+(vehicleItem.x+.5)*size,cy=oy+(vehicleItem.y+.5)*size;ctx.save();ctx.translate(cx,cy+Math.sin(animTime*4)*size*.03);ctx.font=`${Math.max(24,size*.46)}px Arial`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(vehicleItem.icon,0,0);ctx.restore()}
function drawExplorerRoute33(size,ox,oy){if(!explorerRoute||explorerRoute.opened)return;const cx=ox+size*.68,cy=oy+size*.68;ctx.save();ctx.translate(cx,cy);ctx.fillStyle='#f7df72';ctx.strokeStyle='#7a5426';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,size*.32,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.font=`900 ${Math.max(10,size*.14)}px Arial`;ctx.fillStyle='#4f381d';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(`🍌 ${explorerRoute.required}`,0,0);ctx.restore()}
const draw33Base=draw;
draw=function(){draw33Base();if(!maze)return;const {size,ox,oy}=cellMetrics();drawGuardian33(extraGuardian,size,ox,oy);drawVehicle33(size,ox,oy);drawExplorerRoute33(size,ox,oy)};

/* Revelación discreta al final: confirma que atravesar una pared no fue un error. */
const isFalseWallMove33Base=isFalseWallMove;
isFalseWallMove=function(x1,y1,x2,y2){const yes=isFalseWallMove33Base(x1,y1,x2,y2);if(yes)levelSecretFound=true;return yes};
const finishLevel33Base=finishLevel;
finishLevel=function(){
  finishLevel33Base();
  if(levelSecretFound){const p=document.getElementById('messageText');if(p)p.innerHTML+=`<div style="margin-top:8px;font-weight:900;color:#397448">🌿 Descubriste un pasadizo secreto.</div>`}
};


/* === ACTUALIZACIÓN 3.4: PROGRESIÓN Y VARIANTE DE AVENTURA ===
   La orientación se elige una sola vez al cargar el juego:
   2 de cada 3 partidas conservan el mapa original; la restante usa
   una rotación segura de 90, 180 o 270 grados. Se mantiene durante
   los 20 niveles y no cambia al volver al inicio de una pantalla. */
const RUN_ROTATION_TURNS=0; // Rotación eliminada: todos los niveles conservan su orientación original.

function rotatePointForRun(c,turns,size){
  if(!c)return c;
  let x=c.x,y=c.y;
  for(let i=0;i<turns;i++) [x,y]=[size-1-y,x];
  return {...c,x,y};
}
function rotateWallsForRun(walls,turns){
  let w={...walls};
  for(let i=0;i<turns;i++)w={up:w.left,right:w.up,down:w.right,left:w.down};
  return w;
}
function applyRunRotationToBaseLevel(){
  const turns=RUN_ROTATION_TURNS;
  if(!turns||!maze||cols!==rows||level>6){levelStart={...player};return;}
  const size=cols;
  const rotated=Array.from({length:size},()=>Array(size));
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const np=rotatePointForRun({x,y},turns,size);
    rotated[np.y][np.x]={...maze[y][x],walls:rotateWallsForRun(maze[y][x].walls,turns)};
  }
  maze=rotated;
  player=rotatePointForRun(player,turns,size);
  exit=rotatePointForRun(exit,turns,size);
  bananas=bananas.map(b=>rotatePointForRun(b,turns,size));
  if(friend)friend=rotatePointForRun(friend,turns,size);
  if(specialItem)specialItem=rotatePointForRun(specialItem,turns,size);
  levelStart={...player};
}

/* Si una ruta compleja no llega a generarse, crea una patrulla válida
   sobre un camino real. Esto garantiza la presencia del guardián del 17. */
const makeGuardian34Base=makeGuardian;
makeGuardian=function(kind,offset=0){
  let g=makeGuardian34Base(kind,offset);
  if(g)return g;
  const cfg=GUARDIAN_PERSONALITIES[kind];
  const forbidden=new Set([cellKey(levelStart),cellKey(exit)]);
  if(friend)forbidden.add(cellKey(friend));
  const candidates=allCells().filter(c=>!forbidden.has(cellKey(c))&&neighborsOf(c.x,c.y).length>0);
  let best=[];
  for(let i=0;i<candidates.length;i+=Math.max(1,Math.floor(candidates.length/12))){
    for(let j=i+1;j<candidates.length;j+=Math.max(1,Math.floor(candidates.length/12))){
      const path=shortestPath(candidates[i],candidates[j]).filter(c=>!forbidden.has(cellKey(c)));
      if(path.length>best.length)best=path;
    }
  }
  if(best.length<2)return null;
  return {...cfg,kind,route:best,index:0,x:best[0].x,y:best[0].y,nextAt:performance.now()+1500+offset*450,pauseUntil:0};
};

/* ACTUALIZACIÓN 3.5 — DOS CASAS INDISTINGUIBLES
   Mientras falta el compañero, ambas casas están grises y cerradas.
   Al encontrarlo, las dos se iluminan y se desbloquean al mismo tiempo. */
drawFalseHouse=function(x,y,size,ox,oy){
  const unlockedSchool=!friend||friend.found;
  const px=ox+x*size,py=oy+y*size;
  ctx.save();ctx.translate(px+size/2,py+size/2);
  if(unlockedSchool){
    const pulse=.5+.5*Math.sin(animTime*5);
    ctx.shadowColor='rgba(255,226,83,.95)';
    ctx.shadowBlur=size*(.12+.10*pulse);
  }
  ctx.fillStyle=unlockedSchool?'#8b5a2b':'#6f746f';
  ctx.fillRect(-size*.28,-size*.18,size*.56,size*.38);
  ctx.fillStyle=unlockedSchool?'#f7e4b1':'#aeb4ae';
  ctx.fillRect(-size*.18,-size*.08,size*.36,size*.26);
  ctx.fillStyle=unlockedSchool?'#a43f3f':'#555d5a';
  ctx.beginPath();
  ctx.moveTo(-size*.34,-size*.18);
  ctx.lineTo(0,-size*.45);
  ctx.lineTo(size*.34,-size*.18);
  ctx.closePath();ctx.fill();
  ctx.fillStyle=unlockedSchool?'#4b79a8':'#444b49';
  ctx.fillRect(-size*.07,size*.02,size*.14,size*.16);
  if(!unlockedSchool){
    ctx.shadowColor='transparent';
    ctx.font=`${Math.max(16,size*.30)}px Arial`;
    ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText('🔒',0,size*.02);
  }
  ctx.restore();
};

/* Antes de encontrar al compañero, ambas casas se comportan igual:
   simplemente están cerradas. Solo después se revela cuál era la falsa. */
const checkCell34Base=checkCell;
checkCell=function(){
  if(falseExit&&sameCell(player,falseExit)){
    if(friend&&!friend.found){bumpSound();return}
    resetToStart();return;
  }
  checkCell34Base();
};



/* === ACTUALIZACIÓN 3.6: EXPLORACIÓN INTENCIONAL ===
   - Los anteojos aparecen con tiempo suficiente para aprovecharlos.
   - Las bananas quedan fuera del recorrido obligatorio.
   - El nivel 5 presenta un guardián lento y predecible.
   - Los atajos de amistad solo se aceptan si reducen claramente el regreso. */

GUARDIAN_PERSONALITIES.gorilla0={
  icon:'🦍',name:'Gorila tranquilo',step:1850,pause:1050,
  canUseSecrets:false,mode:'patrol'
};
GUARDIAN_PLAN[5]=['gorilla0'];

function uniqueCells36(cells){
  const seen=new Set();
  return cells.filter(c=>{const k=cellKey(c);if(seen.has(k))return false;seen.add(k);return true});
}

function requiredRouteKeys36(){
  const route=[];
  if(friend){
    route.push(...shortestPath(levelStart,friend));
    route.push(...shortestPath(friend,exit));
  }else route.push(...shortestPath(levelStart,exit));
  return new Set(uniqueCells36(route).map(cellKey));
}

function staticForbiddenKeys36(){
  const s=new Set([cellKey(levelStart),cellKey(exit)]);
  if(friend)s.add(cellKey(friend));
  if(specialItem)s.add(cellKey(specialItem));
  if(falseExit)s.add(cellKey(falseExit));
  if(logicChallenge&&logicChallenge.item)s.add(cellKey(logicChallenge.item));
  if(vehicleItem)s.add(cellKey(vehicleItem));
  for(const g of visionGlasses||[])s.add(cellKey(g));
  return s;
}

/* Las bananas enseñan a desviarse: ninguna queda en la ruta obligatoria.
   Se priorizan callejones y celdas alejadas del recorrido principal. */
function repositionBananas36(){
  if(!bananas.length)return;
  const route=requiredRouteKeys36();
  const forbidden=staticForbiddenKeys36();
  const routeCells=[...route].map(k=>{const [x,y]=k.split(',').map(Number);return{x,y}});
  const branchDistance=c=>routeCells.length?Math.min(...routeCells.map(r=>Math.abs(r.x-c.x)+Math.abs(r.y-c.y))):0;
  let candidates=allCells().filter(c=>!route.has(cellKey(c))&&!forbidden.has(cellKey(c)));
  candidates.sort((a,b)=>{
    const deadA=neighborsOf(a.x,a.y).length===1?1:0,deadB=neighborsOf(b.x,b.y).length===1?1:0;
    const da=branchDistance(a),db=branchDistance(b);
    const startA=pathLength(levelStart,a),startB=pathLength(levelStart,b);
    return (deadB-deadA)||(db-da)||(startB-startA);
  });
  /* En mapas excepcionalmente lineales, se conserva fuera al menos del camino
     directo a la casa, pero nunca se impide construir el nivel. */
  if(candidates.length<bananas.length){
    const direct=new Set(shortestPath(levelStart,exit).map(cellKey));
    const extra=allCells().filter(c=>!direct.has(cellKey(c))&&!forbidden.has(cellKey(c))&&!candidates.some(q=>sameCell(q,c)));
    candidates.push(...extra);
  }
  const chosen=[];
  for(const c of candidates){
    const spacing=chosen.every(q=>Math.abs(q.x-c.x)+Math.abs(q.y-c.y)>=2);
    if(spacing)chosen.push(c);
    if(chosen.length===bananas.length)break;
  }
  for(const c of candidates){
    if(chosen.length===bananas.length)break;
    if(!chosen.some(q=>sameCell(q,c)))chosen.push(c);
  }
  bananas.forEach((b,i)=>{if(chosen[i]){b.x=chosen[i].x;b.y=chosen[i].y}});
}

/* Anteojos útiles: nunca junto a la casa y preferentemente en un ramal
   alcanzable durante la primera mitad o zona media de la exploración. */
setupVisionGlasses=function(){
  visionGlasses=[];visionRadius=2.15;
  const amount=level===11?1:(level===17?3:0);
  if(!amount)return;
  const fromStart=distancesFrom(levelStart);
  const fromExit=distancesFrom(exit);
  const mainLength=Math.max(1,pathLength(levelStart,exit));
  const route=requiredRouteKeys36();
  const forbidden=staticForbiddenKeys36();
  bananas.forEach(b=>forbidden.add(cellKey(b)));
  let candidates=allCells().filter(c=>{
    const ds=fromStart.get(cellKey(c))??Infinity;
    const de=fromExit.get(cellKey(c))??Infinity;
    return !forbidden.has(cellKey(c)) && de>=Math.max(4,Math.floor(mainLength*.32)) && ds>=3;
  });
  candidates.sort((a,b)=>{
    const branchA=route.has(cellKey(a))?0:1,branchB=route.has(cellKey(b))?0:1;
    const da=fromStart.get(cellKey(a))||0,db=fromStart.get(cellKey(b))||0;
    const target=mainLength*.48;
    return (branchB-branchA)||(Math.abs(da-target)-Math.abs(db-target));
  });
  const chosen=[];
  for(const c of candidates){
    if(chosen.every(q=>pathLength(q,c)>=Math.max(4,Math.floor((cols+rows)/6))))chosen.push(c);
    if(chosen.length===amount)break;
  }
  for(const c of candidates){
    if(chosen.length===amount)break;
    if(!chosen.some(q=>sameCell(q,c)))chosen.push(c);
  }
  visionGlasses=chosen.map(c=>({...c,got:false}));
};

/* Atajo de amistad: debe sentirse como una recompensa verdadera.
   Se exige una reducción importante y se favorece una abertura cerca del
   compañero que conecte con una zona claramente más próxima a la escuela. */
setupFriendShortcut=function(){
  friendShortcut=null;
  if(level<4||!friend)return;
  const before=pathLength(friend,exit);
  if(!Number.isFinite(before)||before<4)return;
  const distFriend=distancesFrom(friend),distExit=distancesFrom(exit);
  const candidates=[];
  for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
    for(const d of [{dx:1,dy:0,key:'right'},{dx:0,dy:1,key:'down'}]){
      const nx=x+d.dx,ny=y+d.dy;
      if(nx>=cols||ny>=rows||!maze[y][x].walls[d.key])continue;
      const a={x,y},b={x:nx,y:ny};
      if(sameCell(a,levelStart)||sameCell(b,levelStart)||sameCell(a,exit)||sameCell(b,exit))continue;
      setEdgeOpen(a,b,true);const after=pathLength(friend,exit);setEdgeOpen(a,b,false);
      if(!Number.isFinite(after))continue;
      const gain=before-after;
      const near=Math.min(distFriend.get(cellKey(a))??999,distFriend.get(cellKey(b))??999);
      const exitDelta=Math.abs((distExit.get(cellKey(a))??999)-(distExit.get(cellKey(b))??999));
      const ratio=gain/before;
      if(gain>=Math.max(3,Math.ceil(before*.22))&&near<=Math.max(5,Math.floor(before*.38))){
        candidates.push({a,b,gain,ratio,near,exitDelta,score:gain*12+ratio*25+exitDelta*2-near});
      }
    }
  }
  candidates.sort((u,v)=>v.score-u.score);
  if(candidates[0])friendShortcut={a:candidates[0].a,b:candidates[0].b,opened:false,gain:candidates[0].gain};
};

/* Última pasada de construcción: conserva identificadores persistentes,
   pero reubica visualmente bananas y anteojos con las nuevas reglas. */
const buildLevel36Base=buildLevel;
buildLevel=function(n){
  buildLevel36Base(n);
  repositionBananas36();
  setupVisionGlasses();
  setupFriendShortcut();
  setupBananaGate();
  setupVehicle();
  placeGuardian();
  updateBananaHud32();
  draw();
};



/* === CORRECCIÓN 3.8: INICIO ROTADO Y OBJETOS VISIBLES === */
function nearestFreeCellFromStart38(forbidden){
  const q=[{...levelStart}],seen=new Set([cellKey(levelStart)]);
  while(q.length){
    const cur=q.shift();
    if(!forbidden.has(cellKey(cur)))return cur;
    for(const n of neighborsOf(cur.x,cur.y)){
      const k=cellKey(n);if(!seen.has(k)){seen.add(k);q.push(n)}
    }
  }
  return null;
}
function preventStartOverlaps38(){
  const occupied=new Set([cellKey(levelStart),cellKey(exit)]);
  if(friend){
    if(sameCell(friend,levelStart)||sameCell(friend,exit)){
      const c=nearestFreeCellFromStart38(occupied);if(c){friend.x=c.x;friend.y=c.y}
    }
    occupied.add(cellKey(friend));
  }
  for(const b of bananas){
    if(occupied.has(cellKey(b))){
      const c=nearestFreeCellFromStart38(occupied);if(c){b.x=c.x;b.y=c.y}
    }
    occupied.add(cellKey(b));
  }
}
const buildLevel38Base=buildLevel;
buildLevel=function(n){
  buildLevel38Base(n);
  levelStart={...player};
  preventStartOverlaps38();
  draw();
};

/* === FINAL DE LA AVENTURA 3.7 ===
   La imagen se aloja fuera del HTML, en /img/laberintofinal.png.
   Como el juego está dentro de una carpeta del sitio, se carga con ../img/. */
const FINAL_MEMORY_URL='../../img/laberintofinal.png';

function showFinalAdventure(){
  const overlay=document.getElementById('finalAdventureOverlay');
  const img=document.getElementById('finalAdventureImage');
  if(img&&img.getAttribute('src')!==FINAL_MEMORY_URL)img.src=FINAL_MEMORY_URL;
  document.getElementById('messageOverlay').style.display='none';
  overlay.style.display='flex';
  overlay.setAttribute('aria-hidden','false');
}

function hideFinalAdventure(){
  const overlay=document.getElementById('finalAdventureOverlay');
  overlay.style.display='none';
  overlay.setAttribute('aria-hidden','true');
}

async function downloadFinalMemory(){
  try{
    const response=await fetch(FINAL_MEMORY_URL,{cache:'no-store'});
    if(!response.ok)throw new Error('No se pudo cargar la imagen');
    const blob=await response.blob();
    const objectUrl=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=objectUrl;a.download='laberintofinal.png';
    document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(objectUrl),1500);
  }catch(error){
    const a=document.createElement('a');
    a.href=FINAL_MEMORY_URL;a.download='laberintofinal.png';a.target='_blank';
    document.body.appendChild(a);a.click();a.remove();
  }
}

function replayAfterFinal(){
  hideFinalAdventure();
  hideMessage();
  beginBananaRun(1);
}

function chooseLevelAfterFinal(){
  hideFinalAdventure();
  hideMessage();
  showLevels('start');
}

const finishLevelFinal37Base=finishLevel;
finishLevel=function(){
  finishLevelFinal37Base();
  if(level===TOTAL_LEVELS){
    setTimeout(showFinalAdventure,420);
  }
};



/* === ACTUALIZACIÓN 4.0: SIN ROTACIÓN + MECÁNICAS DE INTRODUCCIÓN ===
   Todos los niveles conservan su orientación original. Esto evita que
   guardianes, llaves, compañeros y demás objetos se superpongan al inicio. */
let level3Button=null;
let level3GateOpen=false;
let level4Trampoline=null;
let level4Landing=null;
let trampolineBusy=false;

function occupiedForIntro39(){
  const s=new Set([cellKey(levelStart),cellKey(exit)]);
  bananas.forEach(b=>s.add(cellKey(b)));
  if(friend)s.add(cellKey(friend));
  if(specialItem)s.add(cellKey(specialItem));
  if(vehicleItem)s.add(cellKey(vehicleItem));
  for(const g of visionGlasses||[])s.add(cellKey(g));
  return s;
}

function setupLevel3Button39(){
  level3Button=null;level3GateOpen=false;
  if(level!==3)return;
  const occupied=occupiedForIntro39();
  const path=shortestPath(levelStart,exit);
  let candidates=allCells().filter(c=>!occupied.has(cellKey(c))&&neighborsOf(c.x,c.y).length===1);
  const dist=distancesFrom(levelStart);
  candidates.sort((a,b)=>{
    const target=Math.max(3,Math.floor(path.length*.42));
    return Math.abs((dist.get(cellKey(a))||0)-target)-Math.abs((dist.get(cellKey(b))||0)-target);
  });
  let chosen=candidates[0];
  if(!chosen&&path.length>4){
    const idx=Math.max(2,Math.min(path.length-2,Math.floor(path.length*.42)));
    if(!occupied.has(cellKey(path[idx])))chosen=path[idx];
  }
  if(!chosen){
    chosen=allCells().find(c=>!occupied.has(cellKey(c))&&!sameCell(c,exit));
  }
  if(chosen)level3Button={...chosen,pressed:false};
}

function setupLevel4Trampoline39(){
  level4Trampoline=null;level4Landing=null;trampolineBusy=false;
  if(level!==4)return;
  const occupied=occupiedForIntro39();
  const path=shortestPath(levelStart,exit);
  if(path.length<6)return;
  const sourceOptions=path.slice(2,Math.max(3,Math.floor(path.length*.45))).filter(c=>!occupied.has(cellKey(c)));
  let source=sourceOptions[Math.floor(sourceOptions.length*.55)]||sourceOptions[0];
  if(!source)source=allCells().find(c=>!occupied.has(cellKey(c))&&pathLength(levelStart,c)>=3);
  if(!source)return;
  occupied.add(cellKey(source));
  const distFromSource=distancesFrom(source);
  const distFromExit=distancesFrom(exit);
  let landings=allCells().filter(c=>{
    const ds=distFromSource.get(cellKey(c))??0;
    const de=distFromExit.get(cellKey(c))??0;
    return !occupied.has(cellKey(c))&&ds>=Math.max(5,Math.floor((cols+rows)/3))&&de>=2;
  });
  landings.sort((a,b)=>(distFromSource.get(cellKey(b))||0)-(distFromSource.get(cellKey(a))||0));
  let landing=landings[0];
  if(!landing){
    landing=path.slice(Math.floor(path.length*.62),-1).find(c=>!occupied.has(cellKey(c)));
  }
  if(landing){level4Trampoline={...source};level4Landing={...landing};}
}

function moveHazardAwayFromStart39(g){
  if(!g||!sameCell(g,levelStart))return;
  if(Array.isArray(g.route)){
    const safeIndex=g.route.findIndex(c=>!sameCell(c,levelStart)&&!sameCell(c,exit)&&(!friend||!sameCell(c,friend)));
    if(safeIndex>=0){g.index=safeIndex;g.x=g.route[safeIndex].x;g.y=g.route[safeIndex].y;return;}
  }
  const forbidden=occupiedForIntro39();
  const c=allCells().find(c=>!forbidden.has(cellKey(c))&&pathLength(levelStart,c)>=3);
  if(c){g.x=c.x;g.y=c.y;}
}

function sanitizeDynamicStarts39(){
  moveHazardAwayFromStart39(guardian);
  moveHazardAwayFromStart39(extraGuardian);
  const occupied=new Set([cellKey(levelStart),cellKey(exit)]);
  if(friend)occupied.add(cellKey(friend));
  bananas.forEach(b=>occupied.add(cellKey(b)));
  const movable=[specialItem,vehicleItem];
  for(const item of movable){
    if(item&&sameCell(item,levelStart)){
      const c=allCells().find(c=>!occupied.has(cellKey(c))&&pathLength(levelStart,c)>=2);
      if(c){item.x=c.x;item.y=c.y;occupied.add(cellKey(c));}
    }
  }
}

const buildLevel39Base=buildLevel;
buildLevel=function(n){
  buildLevel39Base(n);
  levelStart={...player};
  sanitizeDynamicStarts39();
  setupLevel3Button39();
  setupLevel4Trampoline39();
  updateMechanicHud();
  draw();
};

const mechanicLabel39Base=mechanicLabel;
mechanicLabel=function(){
  if(level===3)return '🔘 botón de entrada';
  if(level===4)return '🟣 trampolín selvático';
  return mechanicLabel39Base();
};

const checkCell39Base=checkCell;
checkCell=function(){
  if(level===3&&level3Button&&!level3Button.pressed&&sameCell(player,level3Button)){
    level3Button.pressed=true;level3GateOpen=true;
    friendSound();showToast('🔘 ¡Botón activado! La entrada de la escuela se abrió.');
  }
  if(level===4&&level4Trampoline&&level4Landing&&!trampolineBusy&&sameCell(player,level4Trampoline)){
    trampolineBusy=true;
    player={...level4Landing};
    steps++;
    tone(330,.10,'sine',.035);tone(523,.18,'triangle',.045,.08);
    showToast('🟣 ¡Boing! El trampolín llevó a Nito a otro rincón del mapa.');
    setTimeout(()=>trampolineBusy=false,320);
  }
  checkCell39Base();
};

const finishLevel39Base=finishLevel;
finishLevel=function(){
  if(level===3&&!level3GateOpen){
    bumpSound();showToast('🔒 La entrada está cerrada. Buscá el botón de la selva.');
    return;
  }
  finishLevel39Base();
};

function drawIntroMechanics39(size,ox,oy){
  if(level===3){
    if(level3Button){
      const cx=ox+(level3Button.x+.5)*size,cy=oy+(level3Button.y+.5)*size;
      ctx.save();ctx.translate(cx,cy);
      ctx.shadowColor=level3Button.pressed?'rgba(120,255,140,.9)':'rgba(255,229,92,.95)';
      ctx.shadowBlur=size*.16;
      ctx.fillStyle=level3Button.pressed?'#55b967':'#e9c63b';
      ctx.strokeStyle='#654b1f';ctx.lineWidth=Math.max(2,size*.04);
      ctx.beginPath();ctx.arc(0,0,size*.19,0,Math.PI*2);ctx.fill();ctx.stroke();
      ctx.fillStyle='#fff8cf';ctx.beginPath();ctx.arc(-size*.045,-size*.055,size*.055,0,Math.PI*2);ctx.fill();
      ctx.restore();
    }
    if(!level3GateOpen){
      const cx=ox+(exit.x+.5)*size,cy=oy+(exit.y+.5)*size;
      ctx.save();ctx.translate(cx,cy);
      ctx.fillStyle='rgba(39,83,43,.92)';ctx.fillRect(-size*.34,-size*.08,size*.68,size*.16);
      ctx.fillStyle='#305f37';
      for(let i=-2;i<=2;i++){ctx.beginPath();ctx.arc(i*size*.12,0,size*.10,0,Math.PI*2);ctx.fill();}
      ctx.font=`${Math.max(17,size*.30)}px Arial`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('🔒',0,-size*.22);
      ctx.restore();
    }
  }
  if(level===4&&level4Trampoline){
    const cx=ox+(level4Trampoline.x+.5)*size,cy=oy+(level4Trampoline.y+.5)*size;
    ctx.save();ctx.translate(cx,cy+Math.sin(animTime*5)*size*.025);
    ctx.shadowColor='rgba(186,102,255,.9)';ctx.shadowBlur=size*.16;
    ctx.fillStyle='#9551cf';ctx.strokeStyle='#4f2d72';ctx.lineWidth=Math.max(3,size*.05);
    ctx.beginPath();ctx.ellipse(0,size*.08,size*.28,size*.13,0,0,Math.PI*2);ctx.fill();ctx.stroke();
    ctx.strokeStyle='#d9b6ff';ctx.lineWidth=Math.max(2,size*.035);
    for(let i=-1;i<=1;i++){ctx.beginPath();ctx.moveTo(i*size*.10,-size*.13);ctx.lineTo(i*size*.10,size*.02);ctx.stroke();}
    ctx.fillStyle='#f1ddff';ctx.fillRect(-size*.30,-size*.17,size*.60,size*.10);
    ctx.restore();
  }
}

const draw39Base=draw;
draw=function(){
  draw39Base();
  if(!maze)return;
  const {size,ox,oy}=cellMetrics();
  drawIntroMechanics39(size,ox,oy);
};


/* === ESTABILIZACIÓN 4.0: INICIO LIMPIO Y BANANAS VISIBLES === */
function updateBananaHud40(){
  /* Muestra el total acumulado únicamente durante la partida actual. */
  if(bananaLabel)bananaLabel.textContent=String(permanentBananas||0);
  if(bananaTotal)bananaTotal.textContent='';
  const slash=bananaTotal&&bananaTotal.previousSibling;
  if(slash&&slash.nodeType===Node.TEXT_NODE)slash.textContent='';
}

/* Un único modelo de banana, grande, relleno y con contorno oscuro. */
drawBanana=function(x,y,size,ox,oy,i=0){
  const cx=ox+(x+.5)*size;
  const cy=oy+(y+.5)*size+Math.sin(animTime*3+i)*size*.035;
  const r=Math.max(10,size*.23);
  ctx.save();
  ctx.translate(cx,cy);
  ctx.rotate(-.48);
  ctx.shadowColor='rgba(77,53,6,.38)';
  ctx.shadowBlur=Math.max(3,size*.07);
  ctx.shadowOffsetY=Math.max(2,size*.03);
  ctx.strokeStyle='#6f5008';
  ctx.lineWidth=Math.max(8,size*.17);
  ctx.beginPath();ctx.arc(0,0,r,.18,2.45);ctx.stroke();
  ctx.shadowColor='rgba(255,226,50,.85)';
  ctx.shadowBlur=Math.max(4,size*.10);
  ctx.strokeStyle='#ffd52f';
  ctx.lineWidth=Math.max(6,size*.125);
  ctx.stroke();
  ctx.shadowBlur=0;
  ctx.strokeStyle='#fff3a0';
  ctx.lineWidth=Math.max(2,size*.028);
  ctx.stroke();
  ctx.fillStyle='#5d4315';
  ctx.beginPath();
  ctx.arc(r*Math.cos(.18),r*Math.sin(.18),Math.max(2,size*.032),0,Math.PI*2);
  ctx.arc(r*Math.cos(2.45),r*Math.sin(2.45),Math.max(2,size*.032),0,Math.PI*2);
  ctx.fill();
  ctx.restore();
};

/* Refuerzo final de construcción: ninguna banana queda marcada al iniciar. */
const buildLevel40Base=buildLevel;
buildLevel=function(n){
  buildLevel40Base(n);
  /* Cada nivel estrena sus bananas, pero conserva el total de esta partida. */
  for(const b of bananas)b.got=false;
  collected=0;
  updateBananaHud40();
  draw();
};

/* Comienza una partida nueva. Solo aquí se borra el acumulado de bananas. */
function beginBananaRun(firstLevel=1){
  permanentBananas=0;
  collected=0;
  if(foundBananaIds&&typeof foundBananaIds.clear==='function')foundBananaIds.clear();
  updateBananaHud40();
  startGame(firstLevel);
}

/* El HUD se actualiza siempre con las bananas de la pantalla actual. */
const updateHud40Base=updateHud;
updateHud=function(){
  updateHud40Base();
  updateBananaHud40();
};

/* Estado inicial inequívoco: nunca mostrar la victoria al cargar la página. */
(function initializeCleanScreen40(){
  try{
    localStorage.removeItem('nitoBananaBank');
    localStorage.removeItem('nitoBananaIds');
  }catch(_){ }
  permanentBananas=0;
  if(foundBananaIds&&typeof foundBananaIds.clear==='function')foundBananaIds.clear();
  const finalOverlay=document.getElementById('finalAdventureOverlay');
  const startOverlay=document.getElementById('startOverlay');
  const messageOverlay=document.getElementById('messageOverlay');
  const levelsOverlay=document.getElementById('levelsOverlay');
  if(finalOverlay){finalOverlay.style.display='none';finalOverlay.setAttribute('aria-hidden','true');}
  if(startOverlay)startOverlay.style.display='flex';
  if(messageOverlay)messageOverlay.style.display='none';
  if(levelsOverlay)levelsOverlay.style.display='none';
  collected=0;
  updateBananaHud40();
})();



/* ===== Bloque JavaScript original 4 ===== */

'use strict';

/* === AJUSTE 4.1: DESCUBRIMIENTO SIN CARTELES + EXPLORACIÓN + VUELO === */

/* Las mecánicas se descubren jugando: no aparecen avisos explicativos. */
showToast=function(){ };
const updateMechanicHud41Base=updateMechanicHud;
updateMechanicHud=function(){
  updateMechanicHud41Base();
  const pill=document.getElementById('mechanicPill');
  if(pill)pill.style.display='none';
  const eventPill=document.getElementById('eventPill');
  if(eventPill)eventPill.style.display='none';
};

/* El botón del nivel 3 siempre queda fuera del camino directo a la escuela. */
function placeLevel3ButtonOffMainPath41(){
  if(level!==3)return;
  level3GateOpen=false;
  const mainPath=shortestPath(levelStart,exit);
  const mainSet=new Set(mainPath.map(cellKey));
  const occupied=occupiedForIntro39();
  if(level3Button)occupied.delete(cellKey(level3Button));
  const dist=distancesFrom(levelStart);

  let candidates=allCells().filter(c=>
    !mainSet.has(cellKey(c)) &&
    !occupied.has(cellKey(c)) &&
    neighborsOf(c.x,c.y).length===1 &&
    (dist.get(cellKey(c))||0)>=3
  );

  if(!candidates.length){
    candidates=allCells().filter(c=>
      !mainSet.has(cellKey(c)) &&
      !occupied.has(cellKey(c)) &&
      (dist.get(cellKey(c))||0)>=3
    );
  }

  candidates.sort((a,b)=>(dist.get(cellKey(b))||0)-(dist.get(cellKey(a))||0));
  if(candidates.length)level3Button={...candidates[0],pressed:false};
}

const buildLevel41Base=buildLevel;
buildLevel=function(n){
  buildLevel41Base(n);
  placeLevel3ButtonOffMainPath41();
  updateMechanicHud();
  draw();
};

/* Vuelo animado del trampolín. */
let trampolineFlight41=null;
const drawNito41Base=drawNito;
drawNito=function(x,y,size,ox,oy){
  if(trampolineFlight41)return;
  drawNito41Base(x,y,size,ox,oy);
};

function trampolineSound41(){
  tone(190,.10,'sine',.055);
  tone(290,.12,'triangle',.05,.07);
  tone(520,.16,'triangle',.055,.15);
  tone(760,.12,'sine',.035,.27);
}

function startTrampolineFlight41(){
  if(!level4Trampoline||!level4Landing||trampolineBusy)return;
  trampolineBusy=true;
  moveLock=true;
  steps++;
  trampolineSound41();
  trampolineFlight41={
    from:{...level4Trampoline},
    to:{...level4Landing},
    start:performance.now(),
    duration:820
  };
  updateHud();
  setTimeout(()=>{
    player={...level4Landing};
    trampolineFlight41=null;
    trampolineBusy=false;
    moveLock=false;
    checkCell41Base();
    updateHud();
    draw();
    tone(250,.08,'square',.028);
    tone(150,.12,'sine',.035,.05);
  },820);
}

const checkCell41Base=checkCell;
checkCell=function(){
  if(level===4&&level4Trampoline&&level4Landing&&!trampolineBusy&&sameCell(player,level4Trampoline)){
    startTrampolineFlight41();
    return;
  }
  checkCell41Base();
};

/* Redibujo de las mecánicas introductorias. */
drawIntroMechanics39=function(size,ox,oy){
  if(level===3){
    if(level3Button){
      const cx=ox+(level3Button.x+.5)*size,cy=oy+(level3Button.y+.5)*size;
      const press=level3Button.pressed?size*.045:0;
      ctx.save();ctx.translate(cx,cy+press);
      ctx.shadowColor=level3Button.pressed?'rgba(100,220,120,.75)':'rgba(255,225,70,.85)';
      ctx.shadowBlur=size*.12;
      ctx.fillStyle='#6a4a22';
      ctx.beginPath();ctx.ellipse(0,size*.11,size*.25,size*.10,0,0,Math.PI*2);ctx.fill();
      ctx.fillStyle=level3Button.pressed?'#4da65d':'#e8c438';
      ctx.strokeStyle='#5c431e';ctx.lineWidth=Math.max(2,size*.04);
      ctx.beginPath();ctx.ellipse(0,0,size*.20,size*.13,0,0,Math.PI*2);ctx.fill();ctx.stroke();
      ctx.fillStyle='rgba(255,255,220,.75)';
      ctx.beginPath();ctx.ellipse(-size*.055,-size*.035,size*.06,size*.032,-.35,0,Math.PI*2);ctx.fill();
      ctx.restore();
    }
    if(!level3GateOpen){
      const cx=ox+(exit.x+.5)*size,cy=oy+(exit.y+.5)*size;
      ctx.save();ctx.translate(cx,cy);
      ctx.fillStyle='#315f38';
      for(let i=-3;i<=3;i++){
        ctx.beginPath();ctx.arc(i*size*.09,Math.sin(i)*size*.025,size*.095,0,Math.PI*2);ctx.fill();
      }
      ctx.strokeStyle='#214a2b';ctx.lineWidth=Math.max(3,size*.045);
      ctx.beginPath();ctx.moveTo(-size*.32,-size*.08);ctx.lineTo(size*.32,size*.08);ctx.stroke();
      ctx.restore();
    }
  }

  if(level===4&&level4Trampoline){
    const cx=ox+(level4Trampoline.x+.5)*size,cy=oy+(level4Trampoline.y+.5)*size;
    const active=trampolineFlight41!==null;
    const squash=active?.55:(.92+.08*Math.sin(animTime*4));
    ctx.save();ctx.translate(cx,cy);

    /* Patas y resortes visibles. */
    ctx.strokeStyle='#5a3b70';ctx.lineWidth=Math.max(3,size*.045);
    for(const sx of [-.17,.17]){
      ctx.beginPath();
      ctx.moveTo(size*sx,size*.19);
      ctx.lineTo(size*sx,size*.10);
      ctx.lineTo(size*(sx-.055),size*.03);
      ctx.lineTo(size*(sx+.055),-size*.04);
      ctx.lineTo(size*sx,-size*.11);
      ctx.stroke();
    }

    ctx.fillStyle='#59356f';
    ctx.beginPath();ctx.ellipse(0,size*.22,size*.31,size*.10,0,0,Math.PI*2);ctx.fill();
    ctx.shadowColor='rgba(210,120,255,.85)';ctx.shadowBlur=size*.15;
    ctx.scale(1,squash);
    ctx.fillStyle='#b564e6';ctx.strokeStyle='#4d2768';ctx.lineWidth=Math.max(3,size*.05);
    ctx.beginPath();ctx.ellipse(0,-size*.08,size*.31,size*.15,0,0,Math.PI*2);ctx.fill();ctx.stroke();
    ctx.strokeStyle='#efd8ff';ctx.lineWidth=Math.max(2,size*.025);
    ctx.beginPath();ctx.ellipse(0,-size*.08,size*.23,size*.09,0,0,Math.PI*2);ctx.stroke();
    ctx.restore();
  }
};

const draw41Base=draw;
draw=function(){
  draw41Base();
  if(!maze||!trampolineFlight41)return;
  const {size,ox,oy}=cellMetrics();
  const now=performance.now();
  const p=Math.min(1,(now-trampolineFlight41.start)/trampolineFlight41.duration);
  const ease=p<.5?2*p*p:1-Math.pow(-2*p+2,2)/2;
  const x=trampolineFlight41.from.x+(trampolineFlight41.to.x-trampolineFlight41.from.x)*ease;
  const baseY=trampolineFlight41.from.y+(trampolineFlight41.to.y-trampolineFlight41.from.y)*ease;
  const arc=Math.sin(Math.PI*p)*Math.max(1.15,Math.min(2.8,(cols+rows)/9));
  const y=baseY-arc;

  ctx.save();
  const shadowX=ox+(x+.5)*size;
  const shadowY=oy+(baseY+.78)*size;
  ctx.fillStyle=`rgba(40,45,35,${.24*(1-Math.sin(Math.PI*p)*.55)})`;
  ctx.beginPath();ctx.ellipse(shadowX,shadowY,size*.22,size*.07,0,0,Math.PI*2);ctx.fill();
  ctx.restore();

  drawNito41Base(x,y,size,ox,oy);

  /* Pequeñas líneas de velocidad para que el vuelo se entienda sin texto. */
  ctx.save();
  ctx.strokeStyle='rgba(255,255,235,.75)';
  ctx.lineWidth=Math.max(2,size*.025);ctx.lineCap='round';
  const cx=ox+(x+.5)*size,cy=oy+(y+.5)*size;
  for(let i=0;i<3;i++){
    ctx.beginPath();
    ctx.moveTo(cx-size*(.28+i*.07),cy+size*(.04+i*.05));
    ctx.lineTo(cx-size*(.43+i*.08),cy+size*(.08+i*.05));
    ctx.stroke();
  }
  ctx.restore();
};

/* Oculta cualquier cartel ya creado al cargar esta versión. */
(function cleanMechanicLabels41(){
  const pill=document.getElementById('mechanicPill');
  if(pill)pill.style.display='none';
  const eventPill=document.getElementById('eventPill');
  if(eventPill)eventPill.style.display='none';
})();


/* ===== Bloque JavaScript original 5 ===== */

'use strict';
/* === AJUSTE 4.2: NIVEL 9, LINTERNAS, BOTÓN Y CONTROLES === */

let flashlightItem42=null;
let flashlightOwned42=false;
let level9Trampoline42=null;
let level9Landing42=null;
let lastFacing42={dx:1,dy:0};
let darknessCanvas42=null;
let darknessCtx42=null;

/* El nivel 17 usa nuestra oscuridad direccional; el 11 conserva la original. */
if(typeof DARK_LEVELS!=='undefined')DARK_LEVELS.delete(17);

/* Un anteojo en el 11 y uno en el 17. */
setupVisionGlasses=function(){
  visionGlasses=[];visionRadius=2.15;
  const amount=(level===11||level===17)?1:0;
  if(!amount)return;
  const dist=distancesFrom(levelStart);
  const forbidden=occupiedKeys();
  if(logicChallenge)forbidden.add(cellKey(logicChallenge.item));
  let cells=allCells().filter(c=>!forbidden.has(cellKey(c))&&!sameCell(c,exit)&&(!friend||!sameCell(c,friend)));
  cells.sort((a,b)=>(dist.get(cellKey(b))||0)-(dist.get(cellKey(a))||0));
  if(cells.length)visionGlasses=[{...cells[0],got:false}];
};

function placeFlashlight42(){
  flashlightItem42=null;flashlightOwned42=false;
  if(level!==9&&level!==17)return;
  const forbidden=occupiedForIntro39();
  if(level9Trampoline42)forbidden.add(cellKey(level9Trampoline42));
  if(level9Landing42)forbidden.add(cellKey(level9Landing42));
  const dist=distancesFrom(levelStart);
  let cells=allCells().filter(c=>
    !forbidden.has(cellKey(c)) && !sameCell(c,exit) &&
    (!friend||!sameCell(c,friend)) && (dist.get(cellKey(c))||0)>=3
  );
  /* Que pueda encontrarse explorando, sin quedar pegada al comienzo. */
  cells.sort((a,b)=>{
    const da=dist.get(cellKey(a))||0,db=dist.get(cellKey(b))||0;
    const branchA=neighborsOf(a.x,a.y).length===1?5:0;
    const branchB=neighborsOf(b.x,b.y).length===1?5:0;
    return (db+branchB)-(da+branchA);
  });
  if(cells.length)flashlightItem42={...cells[Math.min(2,cells.length-1)],got:false};
}

function setupLevel9Trampoline42(){
  level9Trampoline42=null;level9Landing42=null;
  if(level!==9)return;
  const occupied=occupiedForIntro39();
  const path=shortestPath(levelStart,exit);
  if(path.length<7)return;
  const sourceBand=path.slice(2,Math.max(4,Math.floor(path.length*.48))).filter(c=>!occupied.has(cellKey(c)));
  const source=sourceBand[Math.floor(sourceBand.length*.58)]||sourceBand[0];
  if(!source)return;
  occupied.add(cellKey(source));
  const fromSource=distancesFrom(source);
  const fromExit=distancesFrom(exit);
  let landings=allCells().filter(c=>
    !occupied.has(cellKey(c)) &&
    (fromSource.get(cellKey(c))||0)>=Math.max(6,Math.floor((cols+rows)/3)) &&
    (fromExit.get(cellKey(c))||0)>=3
  );
  landings.sort((a,b)=>(fromSource.get(cellKey(b))||0)-(fromSource.get(cellKey(a))||0));
  const landing=landings[0]||path.slice(Math.floor(path.length*.65),-1).find(c=>!occupied.has(cellKey(c)));
  if(landing){level9Trampoline42={...source};level9Landing42={...landing};}
}

/* Botón del nivel 3: arriba y a la derecha, siempre fuera de la ruta directa. */
function placeLevel3ButtonUpperRight42(){
  if(level!==3)return;
  level3GateOpen=false;
  const mainSet=new Set(shortestPath(levelStart,exit).map(cellKey));
  const occupied=occupiedForIntro39();
  if(level3Button)occupied.delete(cellKey(level3Button));
  const dist=distancesFrom(levelStart);
  let candidates=allCells().filter(c=>
    !mainSet.has(cellKey(c)) && !occupied.has(cellKey(c)) &&
    c.x>=Math.floor(cols*.55) && c.y<=Math.floor(rows*.45) &&
    (dist.get(cellKey(c))||0)>=3
  );
  if(!candidates.length)candidates=allCells().filter(c=>
    !mainSet.has(cellKey(c))&&!occupied.has(cellKey(c))&&(dist.get(cellKey(c))||0)>=3
  );
  candidates.sort((a,b)=>{
    const deadA=neighborsOf(a.x,a.y).length===1?8:0;
    const deadB=neighborsOf(b.x,b.y).length===1?8:0;
    const scoreA=a.x*3-a.y*3+deadA+(dist.get(cellKey(a))||0)*.15;
    const scoreB=b.x*3-b.y*3+deadB+(dist.get(cellKey(b))||0)*.15;
    return scoreB-scoreA;
  });
  if(candidates.length)level3Button={...candidates[0],pressed:false};
}

const buildLevel42Base=buildLevel;
buildLevel=function(n){
  buildLevel42Base(n);
  setupLevel9Trampoline42();
  placeFlashlight42();
  placeLevel3ButtonUpperRight42();
  draw();
};

function flashlightSound42(){
  tone(240,.08,'square',.025);
  tone(520,.16,'sine',.045,.05);
  tone(760,.18,'triangle',.035,.14);
}

function startTrampolineFlight42(source,landing){
  if(!source||!landing||trampolineBusy||trampolineFlight41)return;
  trampolineBusy=true;moveLock=true;steps++;
  trampolineSound41();
  trampolineFlight41={from:{...source},to:{...landing},start:performance.now(),duration:860};
  updateHud();
  setTimeout(()=>{
    player={...landing};
    trampolineFlight41=null;trampolineBusy=false;moveLock=false;
    checkCell42Base();updateHud();draw();
    tone(250,.08,'square',.028);tone(150,.12,'sine',.035,.05);
  },860);
}

const checkCell42Base=checkCell;
checkCell=function(){
  if(level===9&&level9Trampoline42&&level9Landing42&&!trampolineBusy&&sameCell(player,level9Trampoline42)){
    startTrampolineFlight42(level9Trampoline42,level9Landing42);return;
  }
  if(flashlightItem42&&!flashlightItem42.got&&sameCell(player,flashlightItem42)){
    flashlightItem42.got=true;flashlightOwned42=true;flashlightSound42();
  }
  checkCell42Base();
};

/* La linterna apunta hacia la última flecha o tecla direccional presionada. */
const tryMove42Base=tryMove;
tryMove=function(dx,dy){
  if(dx||dy)lastFacing42={dx,dy};
  tryMove42Base(dx,dy);
};

function drawFlashlight42(size,ox,oy){
  if(!flashlightItem42||flashlightItem42.got)return;
  const cx=ox+(flashlightItem42.x+.5)*size;
  const cy=oy+(flashlightItem42.y+.5)*size+Math.sin(animTime*3.2)*size*.035;
  ctx.save();ctx.translate(cx,cy);ctx.rotate(-.45);
  ctx.shadowColor='rgba(255,235,120,.9)';ctx.shadowBlur=size*.14;
  ctx.fillStyle='#f3c94c';ctx.strokeStyle='#5d4b19';ctx.lineWidth=Math.max(2,size*.035);
  ctx.beginPath();ctx.roundRect(-size*.20,-size*.09,size*.27,size*.18,size*.05);ctx.fill();ctx.stroke();
  ctx.fillStyle='#dfe8ef';
  ctx.beginPath();ctx.moveTo(size*.06,-size*.13);ctx.lineTo(size*.22,-size*.18);ctx.lineTo(size*.22,size*.18);ctx.lineTo(size*.06,size*.13);ctx.closePath();ctx.fill();ctx.stroke();
  ctx.fillStyle='#fff7ae';ctx.beginPath();ctx.arc(size*.20,0,size*.065,0,Math.PI*2);ctx.fill();
  ctx.restore();
}

function drawTrampoline42(item,size,ox,oy){
  if(!item)return;
  const cx=ox+(item.x+.5)*size,cy=oy+(item.y+.5)*size;
  const active=trampolineFlight41!==null;
  const squash=active?.55:(.92+.08*Math.sin(animTime*4));
  ctx.save();ctx.translate(cx,cy);
  ctx.strokeStyle='#5a3b70';ctx.lineWidth=Math.max(3,size*.045);
  for(const sx of [-.17,.17]){
    ctx.beginPath();ctx.moveTo(size*sx,size*.19);ctx.lineTo(size*sx,size*.10);
    ctx.lineTo(size*(sx-.055),size*.03);ctx.lineTo(size*(sx+.055),-size*.04);
    ctx.lineTo(size*sx,-size*.11);ctx.stroke();
  }
  ctx.fillStyle='#59356f';ctx.beginPath();ctx.ellipse(0,size*.22,size*.31,size*.10,0,0,Math.PI*2);ctx.fill();
  ctx.shadowColor='rgba(210,120,255,.85)';ctx.shadowBlur=size*.15;
  ctx.scale(1,squash);ctx.fillStyle='#b564e6';ctx.strokeStyle='#4d2768';ctx.lineWidth=Math.max(3,size*.05);
  ctx.beginPath();ctx.ellipse(0,-size*.08,size*.31,size*.15,0,0,Math.PI*2);ctx.fill();ctx.stroke();
  ctx.strokeStyle='#efd8ff';ctx.lineWidth=Math.max(2,size*.025);
  ctx.beginPath();ctx.ellipse(0,-size*.08,size*.23,size*.09,0,0,Math.PI*2);ctx.stroke();ctx.restore();
}

function ensureDarkCanvas42(){
  if(!darknessCanvas42){darknessCanvas42=document.createElement('canvas');darknessCtx42=darknessCanvas42.getContext('2d');}
  if(darknessCanvas42.width!==canvas.width||darknessCanvas42.height!==canvas.height){
    darknessCanvas42.width=canvas.width;darknessCanvas42.height=canvas.height;
  }
}

function drawDirectionalDarkness42(size,ox,oy){
  if(level!==9&&level!==17)return;
  ensureDarkCanvas42();
  const dctx=darknessCtx42,w=darknessCanvas42.width,h=darknessCanvas42.height;
  const cx=ox+(player.x+.5)*size,cy=oy+(player.y+.5)*size;
  dctx.clearRect(0,0,w,h);
  dctx.globalCompositeOperation='source-over';
  dctx.fillStyle='rgba(3,9,17,.94)';dctx.fillRect(0,0,w,h);
  dctx.globalCompositeOperation='destination-out';

  /* Pequeña claridad alrededor de Nito; el anteojo del 17 la amplía. */
  const baseRadius=size*(level===17?visionRadius:1.25);
  const radial=dctx.createRadialGradient(cx,cy,size*.30,cx,cy,baseRadius);
  radial.addColorStop(0,'rgba(0,0,0,1)');radial.addColorStop(.65,'rgba(0,0,0,.88)');radial.addColorStop(1,'rgba(0,0,0,0)');
  dctx.fillStyle=radial;dctx.beginPath();dctx.arc(cx,cy,baseRadius,0,Math.PI*2);dctx.fill();

  if(flashlightOwned42){
    const angle=Math.atan2(lastFacing42.dy,lastFacing42.dx);
    const length=size*(level===17?5.2:4.8),half=.46;
    const cone=dctx.createRadialGradient(cx,cy,size*.35,cx,cy,length);
    cone.addColorStop(0,'rgba(0,0,0,1)');cone.addColorStop(.72,'rgba(0,0,0,.92)');cone.addColorStop(1,'rgba(0,0,0,0)');
    dctx.fillStyle=cone;dctx.beginPath();dctx.moveTo(cx,cy);
    dctx.arc(cx,cy,length,angle-half,angle+half);dctx.closePath();dctx.fill();
  }
  dctx.globalCompositeOperation='source-over';
  ctx.drawImage(darknessCanvas42,0,0);
}

const draw42Base=draw;
draw=function(){
  draw42Base();
  if(!maze)return;
  const {size,ox,oy}=cellMetrics();
  if(level===9)drawTrampoline42(level9Trampoline42,size,ox,oy);
  drawFlashlight42(size,ox,oy);
  drawDirectionalDarkness42(size,ox,oy);
};


/* ===== Bloque JavaScript original 6 ===== */

'use strict';
/* === VERSIÓN 2.1 — ESTABILIDAD, REMOLINO TEMPORAL Y PROTECCIÓN === */

let nitoInvulnerableUntil21=0;
let whirlpoolEffectUntil21=0;
let whirlpoolTimer21=null;
const INVULNERABILITY_MS_21=2000;
const WHIRLPOOL_DURATION_MS_21=10000;

function now21(){return performance.now()}
function nitoIsInvulnerable21(){return now21()<nitoInvulnerableUntil21}

/* Toda devolución al inicio activa dos segundos de protección.
   Esto intercepta también las llamadas antiguas de los guardianes. */
resetToStart=function(){
  if(nitoIsInvulnerable21())return;
  player={...levelStart};
  nitoInvulnerableUntil21=now21()+INVULNERABILITY_MS_21;
  moveLock=true;
  setTimeout(()=>{moveLock=false},220);
  bumpSound();
  updateHud();
  draw();
};

function clearWhirlpoolEffect21(){
  controlsReversed=false;
  whirlpoolEffectUntil21=0;
  if(whirlpoolTimer21){clearTimeout(whirlpoolTimer21);whirlpoolTimer21=null}
}
function activateWhirlpoolEffect21(){
  controlsReversed=true;
  whirlpoolEffectUntil21=now21()+WHIRLPOOL_DURATION_MS_21;
  if(whirlpoolTimer21)clearTimeout(whirlpoolTimer21);
  whirlpoolTimer21=setTimeout(()=>{
    clearWhirlpoolEffect21();
    glassesSound();
    draw();
  },WHIRLPOOL_DURATION_MS_21);
  glassesSound();
}

/* Reinicio limpio al entrar a cualquier nivel. */
const buildLevel21Base=buildLevel;
buildLevel=function(n){
  clearWhirlpoolEffect21();
  nitoInvulnerableUntil21=0;
  buildLevel21Base(n);
};

/* Intercepta el remolino antes de la lógica anterior para que el efecto
   dure diez segundos y no permanezca invertido durante todo el nivel. */
const checkCell21Base=checkCell;
checkCell=function(){
  if(whirlpool&&!whirlpool.used&&sameCell(player,whirlpool)){
    whirlpool.used=true;
    activateWhirlpoolEffect21();
  }
  checkCell21Base();
};

/* Las versiones antiguas alternaban el estado al tocar el remolino.
   Restauramos explícitamente el estado temporal después de cada chequeo. */
const tryMove21Base=tryMove;
tryMove=function(dx,dy){
  if(whirlpoolEffectUntil21&&now21()>=whirlpoolEffectUntil21)clearWhirlpoolEffect21();
  tryMove21Base(dx,dy);
};

/* Colisión permanente y fiable: se revisa al mover a Nito y también
   después de cada paso de cualquier guardián. */
function guardianTouchesNito21(){
  if(nitoIsInvulnerable21())return false;
  return Boolean((guardian&&sameCell(player,guardian))||(extraGuardian&&sameCell(player,extraGuardian)));
}
const advanceGuardian21Base=advanceGuardian;
advanceGuardian=function(t){
  advanceGuardian21Base(t);
  if(guardianTouchesNito21())resetToStart();
};
const tryMoveCollision21Base=tryMove;
tryMove=function(dx,dy){
  tryMoveCollision21Base(dx,dy);
  if(guardianTouchesNito21())resetToStart();
};

/* Nito titila durante la invulnerabilidad. */
const drawNito21Base=drawNito;
drawNito=function(x,y,size,ox,oy){
  if(nitoIsInvulnerable21()&&Math.floor(now21()/95)%2===0)return;
  drawNito21Base(x,y,size,ox,oy);
};

/* El círculo fijo de la esquina superior izquierda pertenecía al indicador
   del atajo por bananas. Se elimina: el mapa debe explicarse jugando. */
drawExplorerRoute33=function(){};

/* Señal visual del remolino: tres estrellas que desaparecen de a una cada cinco segundos.
   No usa texto ni explica la mecánica. */
function drawWhirlpoolStars21(size,ox,oy){
  if(!whirlpoolEffectUntil21)return;
  const left=Math.max(0,whirlpoolEffectUntil21-now21());
  if(left<=0){clearWhirlpoolEffect21();return}
  const count=Math.max(1,Math.ceil(left/5000));
  const cx=ox+(player.x+.5)*size;
  const cy=oy+(player.y+.5)*size-size*.36;
  ctx.save();
  ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.font=`${Math.max(12,size*.17)}px Arial`;
  for(let i=0;i<count;i++){
    const a=animTime*4+i*(Math.PI*2/3);
    const r=size*(.28+.025*Math.sin(animTime*5+i));
    ctx.save();ctx.translate(cx+Math.cos(a)*r,cy+Math.sin(a)*r*.42);
    ctx.rotate(-a*.35);ctx.fillText('⭐',0,0);ctx.restore();
  }
  ctx.restore();
}

const draw21Base=draw;
draw=function(){
  draw21Base();
  if(!maze)return;
  const {size,ox,oy}=cellMetrics();
  drawWhirlpoolStars21(size,ox,oy);
};

/* Los trampolines quedan disponibles siempre. No se marca ninguno como usado.
   La única limitación es esperar a que termine el vuelo actual. */
function keepTrampolinesReusable21(){
  if(level4Trampoline&&'used' in level4Trampoline)delete level4Trampoline.used;
  if(level9Trampoline42&&'used' in level9Trampoline42)delete level9Trampoline42.used;
}
const buildLevelReusable21Base=buildLevel;
buildLevel=function(n){buildLevelReusable21Base(n);keepTrampolinesReusable21()};


/* ===== Bloque JavaScript original 7 ===== */

'use strict';
/* === VERSIÓN 2.2.1 — GORILA CURIOSO ===
   Interacción secreta: si Nito alterna rápidamente izquierda/derecha
   o arriba/abajo dentro de la visión recta de un gorila, este investiga
   el lugar del movimiento. No hay explicación escrita. */

const TAUNT_WINDOW_MS_221=1350;
const TAUNT_ALERT_MS_221=850;
const TAUNT_SEARCH_MS_221=6500;
let tauntInputs221=[];

function isGorilla221(g){return Boolean(g&&(g.kind==='gorilla1'||g.kind==='gorilla2'||g.icon==='🦍'))}
function directionToken221(dx,dy){
  if(dx<0)return 'L';if(dx>0)return 'R';if(dy<0)return 'U';if(dy>0)return 'D';return '';
}
function isAlternatingTaunt221(tokens){
  if(tokens.length<6)return false;
  const a=tokens.slice(-6).join('');
  return a==='LRLRLR'||a==='RLRLRL'||a==='UDUDUD'||a==='DUDUDU';
}
function guardianSeesPlayerStraight221(g){
  if(!g)return false;
  if(g.x===player.x){
    const step=player.y>g.y?1:-1;
    const key=step>0?'down':'up';
    for(let y=g.y;y!==player.y;y+=step){if(maze[y][g.x].walls[key])return false}
    return true;
  }
  if(g.y===player.y){
    const step=player.x>g.x?1:-1;
    const key=step>0?'right':'left';
    for(let x=g.x;x!==player.x;x+=step){if(maze[g.y][x].walls[key])return false}
    return true;
  }
  return false;
}
function awakenGorilla221(g){
  if(!isGorilla221(g)||!guardianSeesPlayerStraight221(g))return false;
  const t=performance.now();
  g.tauntTarget221={x:player.x,y:player.y};
  g.tauntUntil221=t+TAUNT_SEARCH_MS_221;
  g.alertUntil221=t+TAUNT_ALERT_MS_221;
  g.questionUntil221=0;
  g.nextAt=Math.min(g.nextAt||t,t+120);
  tone(196,.08,'square',.025);tone(247,.10,'square',.022,.06);
  return true;
}
function registerTauntInput221(dx,dy){
  const token=directionToken221(dx,dy);if(!token)return;
  const t=performance.now();
  tauntInputs221.push({token,t});
  tauntInputs221=tauntInputs221.filter(e=>t-e.t<=TAUNT_WINDOW_MS_221).slice(-8);
  const tokens=tauntInputs221.map(e=>e.token);
  if(!isAlternatingTaunt221(tokens))return;
  const reacted=awakenGorilla221(guardian)|awakenGorilla221(extraGuardian);
  if(reacted)tauntInputs221=[];
}

/* Se registra la intención original del jugador, antes de cualquier inversión
   producida por el remolino. */
const tryMove221Base=tryMove;
tryMove=function(dx,dy){registerTauntInput221(dx,dy);tryMove221Base(dx,dy)};

/* Durante la investigación el gorila abandona su patrulla y camina hasta
   la última casilla donde vio el movimiento. Luego vuelve solo a su ruta. */
const chooseGuardianNext221Base=chooseGuardianNext;
chooseGuardianNext=function(g){
  if(isGorilla221(g)&&g.tauntTarget221){
    const t=performance.now();
    if(t<g.tauntUntil221){
      if(sameCell(g,g.tauntTarget221)){
        g.tauntTarget221=null;g.questionUntil221=t+900;
      }else{
        const path=shortestPath({x:g.x,y:g.y},g.tauntTarget221);
        if(path.length>1)return path[1];
        g.tauntTarget221=null;g.questionUntil221=t+900;
      }
    }else{
      g.tauntTarget221=null;g.questionUntil221=t+900;
    }
  }
  return chooseGuardianNext221Base(g);
};

function drawGorillaState221(g,size,ox,oy){
  if(!isGorilla221(g))return;
  const t=performance.now();
  const cx=ox+(g.x+.5)*size,cy=oy+(g.y+.5)*size;
  ctx.save();
  if(t<(g.alertUntil221||0)){
    ctx.globalAlpha=.30+.12*Math.sin(animTime*18);
    ctx.fillStyle='#ef3d2f';ctx.beginPath();ctx.arc(cx,cy,size*.34,0,Math.PI*2);ctx.fill();
    ctx.globalAlpha=1;ctx.font=`900 ${Math.max(15,size*.27)}px Arial`;
    ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('❗',cx,cy-size*.48);
  }else if(t<(g.questionUntil221||0)){
    ctx.font=`900 ${Math.max(14,size*.24)}px Arial`;
    ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('❓',cx,cy-size*.46);
  }
  ctx.restore();
}
const draw221Base=draw;
draw=function(){
  draw221Base();if(!maze)return;
  const {size,ox,oy}=cellMetrics();
  drawGorillaState221(guardian,size,ox,oy);
  drawGorillaState221(extraGuardian,size,ox,oy);
};

const buildLevel221Base=buildLevel;
buildLevel=function(n){tauntInputs221=[];buildLevel221Base(n)};


/* ===== Bloque JavaScript original 8 ===== */

'use strict';
/* === VERSIÓN 2.2.2 — PEREZOSO SOÑADOR Y PÁJAROS TRAVIESOS ===
   Todo se comunica con movimiento, Zzz, vuelo y remolinos. Sin carteles. */

const SLOTH_SLEEP_MS_222=4000;
const SLOTH_AWAKE_MS_222=4000;
const BIRD_LEVELS_222=new Set([12,18]);
const BIRD_FIRST_DELAY_MS_222=5500;
const BIRD_REPEAT_MS_222=18000;
const BIRD_FLIGHT_MS_222=4200;
const BIRD_WHIRLPOOL_LIFE_MS_222=10000;

let birdEvent222=null;
let birdNextAt222=0;
let birdWhirlpools222=[];

function isSloth222(g){return Boolean(g&&(g.kind==='sloth'||g.icon==='🦥'))}
function slothSleeping222(g,t=performance.now()){
  if(!isSloth222(g))return false;
  if(typeof g.slothCycleStart222!=='number')g.slothCycleStart222=t;
  const phase=(t-g.slothCycleStart222)%(SLOTH_SLEEP_MS_222+SLOTH_AWAKE_MS_222);
  return phase<SLOTH_SLEEP_MS_222;
}

/* El perezoso queda quieto cuatro segundos y camina cuatro segundos. */
const moveOneGuardian222Base=moveOneGuardian;
moveOneGuardian=function(g,t){
  if(isSloth222(g)&&slothSleeping222(g,t)){
    g.nextAt=Math.max(g.nextAt||0,t+120);
    return;
  }
  moveOneGuardian222Base(g,t);
};

/* Dormido no atrapa a Nito y se lo puede atravesar. */
function activeGuardianTouch222(g){
  return Boolean(g&&sameCell(player,g)&&!(isSloth222(g)&&slothSleeping222(g)));
}
guardianTouchesNito21=function(){
  if(nitoIsInvulnerable21())return false;
  return activeGuardianTouch222(guardian)||activeGuardianTouch222(extraGuardian);
};

function drawSlothDream222(g,size,ox,oy){
  if(!g||!isSloth222(g)||!slothSleeping222(g))return;
  const cx=ox+(g.x+.5)*size,cy=oy+(g.y+.5)*size;
  ctx.save();
  ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillStyle='#4d5f8a';ctx.font=`900 ${Math.max(10,size*.14)}px Arial`;
  for(let i=0;i<3;i++){
    const drift=(animTime*18+i*9)%26;
    ctx.globalAlpha=.9-i*.18;
    ctx.fillText('Z',cx+size*(.20+i*.10),cy-size*(.28+i*.12)-drift*.12);
  }
  ctx.restore();
}

function safeBirdDropCell222(seed){
  const avoid=occupiedKeys();
  avoid.add(cellKey(levelStart));avoid.add(cellKey(exit));
  if(guardian)avoid.add(cellKey(guardian));
  if(extraGuardian)avoid.add(cellKey(extraGuardian));
  for(const w of birdWhirlpools222)avoid.add(cellKey(w));
  const dist=distancesFrom(levelStart);
  const cells=allCells().filter(c=>!avoid.has(cellKey(c))&&neighborsOf(c.x,c.y).length>0&&(dist.get(cellKey(c))||0)>2);
  if(!cells.length)return null;
  cells.sort((a,b)=>((a.x*17+a.y*31+seed)%97)-((b.x*17+b.y*31+seed)%97));
  return cells[Math.floor(cells.length*.55)]||cells[0];
}

function startBirdEvent222(t){
  const fromLeft=((level+Math.floor(t/1000))%2===0);
  const drop=safeBirdDropCell222(level*37+Math.floor(t/1000));
  if(!drop){birdNextAt222=t+BIRD_REPEAT_MS_222;return}
  birdEvent222={start:t,fromLeft,drop,dropped:false};
  birdNextAt222=t+BIRD_REPEAT_MS_222;
}

function updateBirds222(t){
  birdWhirlpools222=birdWhirlpools222.filter(w=>w.expiresAt>t);
  if(!playing||!BIRD_LEVELS_222.has(level))return;
  if(!birdEvent222&&t>=birdNextAt222)startBirdEvent222(t);
  if(!birdEvent222)return;
  const progress=(t-birdEvent222.start)/BIRD_FLIGHT_MS_222;
  if(!birdEvent222.dropped&&progress>=.52){
    birdEvent222.dropped=true;
    birdWhirlpools222.push({...birdEvent222.drop,expiresAt:t+BIRD_WHIRLPOOL_LIFE_MS_222,used:false});
    tone(740,.08,'triangle',.025);tone(520,.12,'triangle',.02,.07);
  }
  if(progress>=1)birdEvent222=null;
}

function drawBirdEvent222(size,ox,oy){
  if(!birdEvent222)return;
  const p=Math.max(0,Math.min(1,(performance.now()-birdEvent222.start)/BIRD_FLIGHT_MS_222));
  const startX=birdEvent222.fromLeft?ox-size:ox+cols*size+size;
  const endX=birdEvent222.fromLeft?ox+cols*size+size:ox-size;
  const x=startX+(endX-startX)*p;
  const y=oy+size*(.55+Math.sin(p*Math.PI)*.35);
  ctx.save();ctx.translate(x,y);if(!birdEvent222.fromLeft)ctx.scale(-1,1);
  ctx.rotate(Math.sin(animTime*8)*.05);
  ctx.font=`${Math.max(25,size*.52)}px Arial`;ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText('🐦',0,0);ctx.restore();
}

function drawBirdWhirlpools222(size,ox,oy){
  const now=performance.now();
  for(const w of birdWhirlpools222){
    const cx=ox+(w.x+.5)*size,cy=oy+(w.y+.5)*size;
    const life=Math.max(0,Math.min(1,(w.expiresAt-now)/BIRD_WHIRLPOOL_LIFE_MS_222));
    ctx.save();ctx.translate(cx,cy);ctx.rotate(animTime*3.2);
    ctx.globalAlpha=Math.min(1,life*2.5);
    ctx.strokeStyle='#7654c7';ctx.lineWidth=Math.max(3,size*.055);
    for(let r=.09;r<.35;r+=.075){ctx.beginPath();ctx.arc(0,0,size*r,0,Math.PI*1.55);ctx.stroke();ctx.rotate(.78)}
    ctx.restore();
  }
}

/* Tocar un remolino dejado por un pájaro produce el mismo efecto de 10 s. */
const checkCell222Base=checkCell;
checkCell=function(){
  const t=performance.now();
  for(const w of birdWhirlpools222){
    if(!w.used&&w.expiresAt>t&&sameCell(player,w)){
      w.used=true;
      activateWhirlpoolEffect21();
      w.expiresAt=0;
      break;
    }
  }
  checkCell222Base();
};

const buildLevel222Base=buildLevel;
buildLevel=function(n){
  birdEvent222=null;birdWhirlpools222=[];
  birdNextAt222=performance.now()+BIRD_FIRST_DELAY_MS_222;
  buildLevel222Base(n);
  for(const g of [guardian,extraGuardian])if(isSloth222(g))g.slothCycleStart222=performance.now();
};

/* Se integra al bucle existente sin crear un segundo requestAnimationFrame. */
const advanceGuardian222Base=advanceGuardian;
advanceGuardian=function(t){updateBirds222(t);advanceGuardian222Base(t)};

const draw222Base=draw;
draw=function(){
  draw222Base();
  if(!maze)return;
  const {size,ox,oy}=cellMetrics();
  drawSlothDream222(guardian,size,ox,oy);
  drawSlothDream222(extraGuardian,size,ox,oy);
  drawBirdWhirlpools222(size,ox,oy);
  drawBirdEvent222(size,ox,oy);
};


/* ===== Bloque JavaScript original 9 ===== */

'use strict';
/* === VERSIÓN 2.2.3 — SUEÑO REAL DEL PEREZOSO ===
   Corrige todas las colisiones antiguas que todavía podían atraparlo dormido. */

function guardianCanCapture223(g=null){
  if(typeof nitoIsInvulnerable21==='function'&&nitoIsInvulnerable21())return false;
  const canCapture=target=>Boolean(
    target&&sameCell(player,target)&&
    !(typeof isSloth222==='function'&&isSloth222(target)&&slothSleeping222(target))
  );
  return g?canCapture(g):canCapture(guardian)||canCapture(extraGuardian);
}

/* Todas las comprobaciones modernas pasan por una única regla. */
guardianTouchesNito21=function(){return guardianCanCapture223()};
activeGuardianTouch222=function(g){return guardianCanCapture223(g)};

/* Aviso visual breve al despertar: ojos/alerta, sin palabras ni tutorial. */
function slothWakeProgress223(g,t=performance.now()){
  if(!g||!isSloth222(g)||typeof g.slothCycleStart222!=='number')return -1;
  const sleep=SLOTH_SLEEP_MS_222,cycle=sleep+SLOTH_AWAKE_MS_222;
  const phase=(t-g.slothCycleStart222)%cycle;
  if(phase<sleep||phase>sleep+700)return -1;
  return (phase-sleep)/700;
}
function drawSlothWake223(g,size,ox,oy){
  const p=slothWakeProgress223(g);
  if(p<0)return;
  const cx=ox+(g.x+.5)*size,cy=oy+(g.y+.5)*size-size*.42;
  ctx.save();
  ctx.globalAlpha=Math.sin(Math.PI*Math.min(1,p));
  ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.font=`900 ${Math.max(14,size*.24)}px Arial`;
  ctx.fillText('❗',cx,cy);
  ctx.restore();
}
const draw223Base=draw;
draw=function(){
  draw223Base();
  if(!maze)return;
  const {size,ox,oy}=cellMetrics();
  drawSlothWake223(guardian,size,ox,oy);
  drawSlothWake223(extraGuardian,size,ox,oy);
};


/* ===== Bloque JavaScript original 10 ===== */

'use strict';
/* === VERSIÓN 2.2.4 — PERSONALIDADES Y REORGANIZACIÓN DE GUARDIANES ===
   La campaña queda preparada por nivel sin explicar mecánicas al jugador. */

/* Plan completo de campaña. Las propiedades de luz, colores y cantidades de
   trampolines/remolinos se usarán en las próximas versiones. No se muestran. */
const CAMPAIGN_PLAN_224={
  1:{guardians:[]},2:{guardians:[]},3:{guardians:[],doorButton:true},
  4:{guardians:[],trampolines:1},5:{guardians:[]},6:{guardians:[],trampolines:2},
  7:{guardians:['gorilla1']},8:{guardians:[],lightButtons:true},
  9:{guardians:[],trampolines:1,dark:true,flashlight:true},
  10:{guardians:[],primaryButtons:true},11:{guardians:[],dark:true},
  12:{guardians:['parrot']},13:{guardians:['elephant'],secondaryButtons:true},
  14:{guardians:[],trampolines:2,whirlpools:2},
  15:{guardians:['sloth','sloth','sloth']},
  16:{guardians:['gorilla1'],whirlpools:3,primaryButtons:true},
  17:{guardians:['gorilla2'],trampolines:3,lightButtons:true},
  18:{guardians:['parrot','gorilla1']},
  19:{guardians:['turtle','elephant'],trampolines:3,lightButtons:true},
  20:{guardians:['gorilla2','turtle','elephant'],trampolines:4,whirlpools:2,lightButtons:true}
};

/* Se actualiza el plan antiguo para que cualquier sistema previo consulte
   las mismas decisiones de campaña. */
for(const k of Object.keys(GUARDIAN_PLAN))delete GUARDIAN_PLAN[k];
for(const [n,cfg] of Object.entries(CAMPAIGN_PLAN_224)){
  if(cfg.guardians&&cfg.guardians.length)GUARDIAN_PLAN[n]=[...cfg.guardians];
}

/* Personalidades más claras. */
GUARDIAN_PERSONALITIES.elephant.step=1780;
GUARDIAN_PERSONALITIES.elephant.pause=1050; // pasos largos y pausados
GUARDIAN_PERSONALITIES.turtle.step=1850;
GUARDIAN_PERSONALITIES.turtle.pause=0;      // lenta, pero nunca se detiene

let thirdGuardian224=null;

function allGuardians224(){return [guardian,extraGuardian,thirdGuardian224].filter(Boolean)}
function guardianStartOccupied224(g,others){return others.some(o=>o&&sameCell(g,o))}
function shiftGuardianStart224(g,others){
  if(!g||!g.route||!g.route.length)return;
  for(let i=0;i<g.route.length;i++){
    const p=g.route[i];
    if(sameCell(p,levelStart)||sameCell(p,exit)||guardianStartOccupied224(p,others))continue;
    g.index=i;g.x=p.x;g.y=p.y;return;
  }
}

/* Hasta tres guardianes simultáneos, con comienzos separados. */
placeGuardian=function(){
  guardian=null;extraGuardian=null;thirdGuardian224=null;turtleDash=null;
  const plan=(CAMPAIGN_PLAN_224[level]&&CAMPAIGN_PLAN_224[level].guardians)||[];
  guardian=plan[0]?makeGuardian(plan[0],0):null;
  if(guardian)shiftGuardianStart224(guardian,[]);
  extraGuardian=plan[1]?makeGuardian(plan[1],1):null;
  if(extraGuardian)shiftGuardianStart224(extraGuardian,[guardian]);
  thirdGuardian224=plan[2]?makeGuardian(plan[2],2):null;
  if(thirdGuardian224)shiftGuardianStart224(thirdGuardian224,[guardian,extraGuardian]);
  const t=performance.now();
  for(const g of allGuardians224()){
    g.nextAt=t+1450+(g===extraGuardian?350:g===thirdGuardian224?700:0);
    if(typeof isSloth222==='function'&&isSloth222(g))g.slothCycleStart222=t;
  }
};

/* El tercer guardián participa del movimiento y de las colisiones. */
const advanceGuardian224Base=advanceGuardian;
advanceGuardian=function(t){
  advanceGuardian224Base(t);
  if(thirdGuardian224)moveOneGuardian(thirdGuardian224,t);
  if(typeof guardianTouchesNito21==='function'&&guardianTouchesNito21())resetToStart();
};

guardianCanCapture223=function(g=null){
  if(typeof nitoIsInvulnerable21==='function'&&nitoIsInvulnerable21())return false;
  const canCapture=target=>Boolean(
    target&&sameCell(player,target)&&
    !(typeof isSloth222==='function'&&isSloth222(target)&&slothSleeping222(target))
  );
  return g?canCapture(g):allGuardians224().some(canCapture);
};
guardianTouchesNito21=function(){return guardianCanCapture223()};
activeGuardianTouch222=function(g){return guardianCanCapture223(g)};

/* El taunt también puede llamar la atención de cualquier gorila adicional. */
registerTauntInput221=function(dx,dy){
  const token=directionToken221(dx,dy);if(!token)return;
  const t=performance.now();
  tauntInputs221.push({token,t});
  tauntInputs221=tauntInputs221.filter(e=>t-e.t<=TAUNT_WINDOW_MS_221).slice(-8);
  if(!isAlternatingTaunt221(tauntInputs221.map(e=>e.token)))return;
  let reacted=false;
  for(const g of allGuardians224())reacted=awakenGorilla221(g)||reacted;
  if(reacted)tauntInputs221=[];
};

/* Estados visuales compartidos y tercer guardián. */
function drawThirdGuardian224(size,ox,oy){
  if(!thirdGuardian224)return;
  drawGuardian33(thirdGuardian224,size,ox,oy);
  if(typeof drawGorillaState221==='function')drawGorillaState221(thirdGuardian224,size,ox,oy);
  if(typeof drawSlothDream222==='function')drawSlothDream222(thirdGuardian224,size,ox,oy);
  if(typeof drawSlothWake223==='function')drawSlothWake223(thirdGuardian224,size,ox,oy);
}

/* El elefante marca su pausa con una pequeña mirada; la tortuga no muestra
   pausa porque su comportamiento distintivo es seguir avanzando siempre. */
function drawGuardianMood224(g,size,ox,oy){
  if(!g)return;
  const cx=ox+(g.x+.5)*size,cy=oy+(g.y+.5)*size-size*.43;
  if(g.kind==='elephant'&&performance.now()<(g.pauseUntil||0)){
    ctx.save();ctx.globalAlpha=.7;ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.font=`${Math.max(12,size*.19)}px Arial`;ctx.fillText('•••',cx,cy);ctx.restore();
  }
}

const draw224Base=draw;
draw=function(){
  draw224Base();if(!maze)return;
  const {size,ox,oy}=cellMetrics();
  drawThirdGuardian224(size,ox,oy);
  for(const g of allGuardians224())drawGuardianMood224(g,size,ox,oy);
};

/* Cada construcción termina aplicando una sola vez el plan definitivo. */
const buildLevel224Base=buildLevel;
buildLevel=function(n){
  buildLevel224Base(n);
  placeGuardian();
  draw();
};


/* ===== Bloque JavaScript original 11 ===== */

'use strict';
/* === VERSIÓN 2.2.5 — ELEFANTE DEMOLEDOR Y TORTUGA IMPARABLE === */

const ELEPHANT_BREAK_MS_225=15000;
let elephantBursts225=[];

function internalDirection225(g,d){
  const nx=g.x+d.dx,ny=g.y+d.dy;
  return nx>=0&&ny>=0&&nx<cols&&ny<rows;
}
function oppositeKey225(key){return({up:'down',down:'up',left:'right',right:'left'})[key]}
function directionScore225(g,d){
  const nx=g.x+d.dx,ny=g.y+d.dy;
  return Math.abs(player.x-nx)+Math.abs(player.y-ny);
}
function elephantBreakDirection225(g){
  if(!g||!maze||!maze[g.y]||!maze[g.y][g.x])return null;
  const preferred=[];
  const dx=player.x-g.x,dy=player.y-g.y;
  if(Math.abs(dx)>=Math.abs(dy)){
    if(dx)preferred.push(dx>0?DIRS[1]:DIRS[3]);
    if(dy)preferred.push(dy>0?DIRS[2]:DIRS[0]);
  }else{
    if(dy)preferred.push(dy>0?DIRS[2]:DIRS[0]);
    if(dx)preferred.push(dx>0?DIRS[1]:DIRS[3]);
  }
  const rest=DIRS.filter(d=>!preferred.includes(d)).sort((a,b)=>directionScore225(g,a)-directionScore225(g,b));
  return [...preferred,...rest].find(d=>internalDirection225(g,d)&&maze[g.y][g.x].walls[d.key])||null;
}
function elephantBoomSound225(){
  tone(92,.22,'square',.045);
  tone(61,.34,'sawtooth',.035,.05);
  tone(145,.16,'triangle',.025,.10);
}
function breakWallForElephant225(g,t){
  if(!g||g.kind!=='elephant'||!playing)return;
  if(typeof g.nextWallBreak225!=='number')g.nextWallBreak225=t+ELEPHANT_BREAK_MS_225;
  if(t<g.nextWallBreak225)return;
  g.nextWallBreak225=t+ELEPHANT_BREAK_MS_225;
  const d=elephantBreakDirection225(g);if(!d)return;
  const nx=g.x+d.dx,ny=g.y+d.dy;
  maze[g.y][g.x].walls[d.key]=false;
  maze[ny][nx].walls[oppositeKey225(d.key)]=false;
  g.alertSymbol224='!';g.alertUntil224=t+850;
  g.pauseUntil=t+700;g.nextAt=Math.max(g.nextAt||0,t+720);
  elephantBursts225.push({x:g.x+d.dx*.5,y:g.y+d.dy*.5,start:t,duration:900,dx:d.dx,dy:d.dy});
  elephantBoomSound225();
}

/* La tortuga jamás espera frente a Nito: avanza y la colisión se resuelve. */
const moveOneGuardian225Base=moveOneGuardian;
moveOneGuardian=function(g,t){
  if(!g||g.kind!=='turtle')return moveOneGuardian225Base(g,t);
  if(!playing||t<g.nextAt)return;
  const next=chooseGuardianNext(g);if(!next){g.nextAt=t+g.step;return}
  g.x=next.x;g.y=next.y;
  g.pauseUntil=0;
  g.nextAt=t+g.step;
  if(typeof guardianCanCapture223==='function'&&guardianCanCapture223(g))resetToStart();
};

const advanceGuardian225Base=advanceGuardian;
advanceGuardian=function(t){
  advanceGuardian225Base(t);
  const herd=typeof allGuardians224==='function'?allGuardians224():[guardian,extraGuardian].filter(Boolean);
  for(const g of herd)breakWallForElephant225(g,t);
  elephantBursts225=elephantBursts225.filter(b=>t-b.start<b.duration);
};

function drawElephantBurst225(size,ox,oy,b){
  const p=Math.min(1,(performance.now()-b.start)/b.duration);
  const cx=ox+(b.x+.5)*size,cy=oy+(b.y+.5)*size;
  ctx.save();ctx.translate(cx,cy);
  ctx.globalAlpha=1-p;
  for(let i=0;i<9;i++){
    const a=(Math.PI*2*i/9)+i*.31;
    const dist=size*(.08+p*.42)*(1+(i%3)*.18);
    const x=Math.cos(a)*dist,y=Math.sin(a)*dist;
    ctx.fillStyle=i%2?'#6e4c2b':'#9c7040';
    ctx.fillRect(x-size*.035,y-size*.025,size*.07,size*.05);
  }
  ctx.strokeStyle=`rgba(255,235,170,${1-p})`;ctx.lineWidth=Math.max(2,size*.05);
  ctx.beginPath();ctx.arc(0,0,size*(.12+p*.36),0,Math.PI*2);ctx.stroke();
  ctx.restore();
}

const draw225Base=draw;
draw=function(){
  draw225Base();if(!maze)return;
  const {size,ox,oy}=cellMetrics();
  for(const b of elephantBursts225)drawElephantBurst225(size,ox,oy,b);
  const herd=typeof allGuardians224==='function'?allGuardians224():[guardian,extraGuardian].filter(Boolean);
  const now=performance.now();
  for(const g of herd){
    if(g&&g.kind==='elephant'&&now<(g.alertUntil224||0)){
      const cx=ox+(g.x+.5)*size,cy=oy+(g.y+.5)*size-size*.5;
      ctx.save();ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`900 ${Math.max(15,size*.25)}px Arial`;
      ctx.fillStyle='#d33';ctx.fillText('!',cx,cy);ctx.restore();
    }
  }
};

const buildLevel225Base=buildLevel;
buildLevel=function(n){
  buildLevel225Base(n);
  const t=performance.now();
  const herd=typeof allGuardians224==='function'?allGuardians224():[guardian,extraGuardian].filter(Boolean);
  for(const g of herd)if(g&&g.kind==='elephant')g.nextWallBreak225=t+ELEPHANT_BREAK_MS_225;
  elephantBursts225=[];
  draw();
};


/* ===== Bloque JavaScript original 12 ===== */

'use strict';
/* === VERSIÓN 2.3.0 — LUZ Y PUERTAS DE COLORES === */

/* El nivel 17 deja de usar la oscuridad fija: ahora depende de sus botones. */
if(typeof DARK_LEVELS!=='undefined')DARK_LEVELS.delete(17);

const LIGHT_LEVELS_230=new Set([8,17,19,20]);
const PRIMARY_COLOR_LEVELS_230=new Set([10,16]);
const SECONDARY_COLOR_LEVELS_230=new Set([13]);
const LIGHT_STUN_MS_230=2500;

let lightOn230=true;
let lightButtons230=[];
let lightButtonCooldown230=0;
let colorButtons230=[];
let colorGates230=[];
let pressedColors230=new Set();
let lightPulse230=0;

function cellBlocked230(c){
  if(!c)return true;
  if(sameCell(c,levelStart)||sameCell(c,exit)||sameCell(c,player))return true;
  if(friend&&!friend.found&&sameCell(c,friend))return true;
  if(specialItem&&!specialItem.got&&sameCell(c,specialItem))return true;
  if(bananas.some(b=>!b.got&&sameCell(c,b)))return true;
  const herd=typeof allGuardians224==='function'?allGuardians224():[];
  return herd.some(g=>sameCell(c,g));
}
function availableCells230(){return allCells().filter(c=>!cellBlocked230(c))}
function farCells230(){
  const dist=distancesFrom(levelStart);
  return availableCells230().sort((a,b)=>(dist.get(cellKey(b))||0)-(dist.get(cellKey(a))||0));
}
function placeLightButtons230(){
  lightButtons230=[];lightOn230=true;lightPulse230=0;
  if(!LIGHT_LEVELS_230.has(level))return;
  const cells=farCells230();
  if(!cells.length)return;
  const off=cells[0];
  let on=cells.find(c=>!sameCell(c,off)&&Math.abs(c.x-off.x)+Math.abs(c.y-off.y)>=Math.max(3,Math.floor((cols+rows)/4)));
  if(!on)on=cells[Math.min(cells.length-1,Math.floor(cells.length*.55))];
  lightButtons230=[{...off,type:'off',pressed:false},{...on,type:'on',pressed:false}];
}
function lightSound230(on){
  if(on){tone(330,.08,'square',.025);tone(660,.16,'triangle',.035,.07)}
  else{tone(260,.12,'sine',.03);tone(130,.22,'triangle',.025,.08)}
}
function setLight230(on){
  if(lightOn230===on)return;
  lightOn230=on;lightPulse230=performance.now()+500;lightSound230(on);
  const herd=typeof allGuardians224==='function'?allGuardians224():[];
  const now=performance.now();
  for(const g of herd){
    if(on){
      g.stunnedUntil230=now+LIGHT_STUN_MS_230;
      g.alertSymbol230='!!!';g.alertUntil230=now+900;
      g.nextAt=Math.max(g.nextAt||0,g.stunnedUntil230);
    }else{
      g.alertSymbol230='???';g.alertUntil230=Infinity;
      if(g.tauntPath221)g.tauntPath221=[];
      g.tauntUntil221=0;
    }
  }
}

function closedInteriorEdges230(){
  const edges=[];
  for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
    const c=maze[y][x];
    if(x<cols-1&&c.walls.right)edges.push({x,y,key:'right',nx:x+1,ny:y,opp:'left'});
    if(y<rows-1&&c.walls.down)edges.push({x,y,key:'down',nx:x,ny:y+1,opp:'up'});
  }
  return edges;
}
function gateFarScore230(e){
  return Math.min(
    Math.abs(e.x-levelStart.x)+Math.abs(e.y-levelStart.y),
    Math.abs(e.nx-levelStart.x)+Math.abs(e.ny-levelStart.y)
  );
}
function chooseGates230(count){
  const edges=closedInteriorEdges230().sort((a,b)=>gateFarScore230(b)-gateFarScore230(a));
  const chosen=[];
  for(const e of edges){
    if(chosen.some(q=>Math.abs(q.x-e.x)+Math.abs(q.y-e.y)<2))continue;
    chosen.push(e);if(chosen.length>=count)break;
  }
  return chosen;
}
function openGate230(g){
  if(!g||g.open)return;
  g.open=true;
  maze[g.y][g.x].walls[g.key]=false;
  maze[g.ny][g.nx].walls[g.opp]=false;
  tone(150,.18,'square',.035);tone(95,.28,'triangle',.03,.08);
}
function placeColorSystems230(){
  colorButtons230=[];colorGates230=[];pressedColors230=new Set();
  if(PRIMARY_COLOR_LEVELS_230.has(level)){
    const colors=[['red','#e54848'],['yellow','#f0c928'],['blue','#3d75d6']];
    const gates=chooseGates230(3),cells=farCells230();
    colors.forEach((c,i)=>{
      if(gates[i])colorGates230.push({...gates[i],id:c[0],color:c[1],requires:[c[0]],open:false});
      if(cells[i*2])colorButtons230.push({...cells[i*2],id:c[0],color:c[1],pressed:false});
    });
  }else if(SECONDARY_COLOR_LEVELS_230.has(level)){
    const prim=[['red','#e54848'],['yellow','#f0c928'],['blue','#3d75d6']];
    const secondary=[
      ['orange','#e88931',['red','yellow']],
      ['green','#43a65b',['yellow','blue']],
      ['violet','#8856c7',['red','blue']]
    ];
    const gates=chooseGates230(3),cells=farCells230();
    prim.forEach((c,i)=>{if(cells[i*2])colorButtons230.push({...cells[i*2],id:c[0],color:c[1],pressed:false})});
    secondary.forEach((c,i)=>{if(gates[i])colorGates230.push({...gates[i],id:c[0],color:c[1],requires:c[2],open:false})});
  }
}
function pressColor230(btn){
  if(!btn||btn.pressed)return;
  btn.pressed=true;pressedColors230.add(btn.id);
  tone(420,.08,'square',.025);tone(620,.12,'triangle',.03,.06);
  for(const g of colorGates230){
    if(!g.open&&g.requires.every(c=>pressedColors230.has(c)))openGate230(g);
  }
}

function drawFloorButton230(b,size,ox,oy){
  const cx=ox+(b.x+.5)*size,cy=oy+(b.y+.5)*size;
  ctx.save();ctx.translate(cx,cy);
  const depressed=b.pressed?size*.035:0;
  ctx.fillStyle='rgba(60,40,25,.35)';ctx.beginPath();ctx.ellipse(0,size*.12,size*.28,size*.12,0,0,Math.PI*2);ctx.fill();
  ctx.translate(0,depressed);
  if(b.type){
    const isOn=b.type==='on';
    ctx.fillStyle=isOn?'#f7dc4d':'#343b4e';
    ctx.strokeStyle=isOn?'#fff2a6':'#8d95aa';
  }else{ctx.fillStyle=b.color;ctx.strokeStyle='rgba(255,255,255,.8)'}
  ctx.lineWidth=Math.max(2,size*.045);ctx.beginPath();ctx.ellipse(0,0,size*.23,size*.15,0,0,Math.PI*2);ctx.fill();ctx.stroke();
  if(b.type){
    ctx.fillStyle=isOn?'#fffbd1':'#d8def1';ctx.font=`900 ${Math.max(13,size*.22)}px Arial`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(isOn?'☀':'☾',0,0);
  }
  ctx.restore();
}
function drawColorGate230(g,size,ox,oy){
  if(g.open)return;
  const x1=ox+g.x*size,y1=oy+g.y*size;
  ctx.save();ctx.strokeStyle=g.color;ctx.lineWidth=Math.max(7,size*.15);ctx.lineCap='round';
  ctx.shadowColor=g.color;ctx.shadowBlur=Math.max(6,size*.12);ctx.beginPath();
  if(g.key==='right'){ctx.moveTo(x1+size,y1+size*.08);ctx.lineTo(x1+size,y1+size*.92)}
  else{ctx.moveTo(x1+size*.08,y1+size);ctx.lineTo(x1+size*.92,y1+size)}
  ctx.stroke();ctx.shadowBlur=0;ctx.strokeStyle='rgba(255,255,255,.7)';ctx.lineWidth=Math.max(2,size*.035);ctx.stroke();ctx.restore();
}
function drawLightDarkness230(size,ox,oy){
  if(!LIGHT_LEVELS_230.has(level)||lightOn230)return;
  ctx.save();ctx.fillStyle='rgba(2,7,15,.84)';ctx.fillRect(0,0,canvas.width,canvas.height);
  const cx=ox+(player.x+.5)*size,cy=oy+(player.y+.5)*size;
  ctx.globalCompositeOperation='destination-out';
  const grad=ctx.createRadialGradient(cx,cy,size*.15,cx,cy,size*1.25);
  grad.addColorStop(0,'rgba(0,0,0,1)');grad.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=grad;ctx.beginPath();ctx.arc(cx,cy,size*1.25,0,Math.PI*2);ctx.fill();ctx.restore();
}
function drawGuardianLightState230(g,size,ox,oy){
  if(!g)return;const now=performance.now();
  let symbol='';
  if(now<(g.stunnedUntil230||0))symbol='✦';
  else if(!lightOn230&&LIGHT_LEVELS_230.has(level))symbol='???';
  else if(now<(g.alertUntil230||0))symbol=g.alertSymbol230||'';
  if(!symbol)return;
  const cx=ox+(g.x+.5)*size,cy=oy+(g.y+.5)*size-size*.48;
  ctx.save();ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`900 ${Math.max(13,size*.22)}px Arial`;
  ctx.fillStyle=symbol==='???'?'#d8e7ff':symbol==='✦'?'#ffe36b':'#ffdf57';ctx.fillText(symbol,cx,cy);ctx.restore();
}

const buildLevel230Base=buildLevel;
buildLevel=function(n){
  buildLevel230Base(n);
  placeLightButtons230();placeColorSystems230();
  draw();
};

const checkCell230Base=checkCell;
checkCell=function(){
  const now=performance.now();
  for(const b of lightButtons230){
    if(sameCell(player,b)&&now>=lightButtonCooldown230){
      b.pressed=true;lightButtonCooldown230=now+300;setLight230(b.type==='on');
      setTimeout(()=>{b.pressed=false},180);
    }
  }
  for(const b of colorButtons230)if(sameCell(player,b))pressColor230(b);
  checkCell230Base();
};

/* En oscuridad los guardianes pierden a Nito; al encender quedan aturdidos. */
const guardianCanCapture230Base=guardianCanCapture223;
guardianCanCapture223=function(g=null){
  if(LIGHT_LEVELS_230.has(level)&&!lightOn230)return false;
  const stunned=x=>x&&performance.now()<(x.stunnedUntil230||0);
  if(g&&stunned(g))return false;
  if(!g){
    const herd=typeof allGuardians224==='function'?allGuardians224():[];
    if(herd.some(stunned)){
      const active=herd.filter(x=>!stunned(x));
      if(!active.length)return false;
      return active.some(x=>guardianCanCapture230Base(x));
    }
  }
  return guardianCanCapture230Base(g);
};
guardianTouchesNito21=function(){return guardianCanCapture223()};
activeGuardianTouch222=function(g){return guardianCanCapture223(g)};

const registerTauntInput230Base=registerTauntInput221;
registerTauntInput221=function(dx,dy){
  if(LIGHT_LEVELS_230.has(level)&&!lightOn230)return;
  registerTauntInput230Base(dx,dy);
};

const draw230Base=draw;
draw=function(){
  draw230Base();if(!maze)return;
  const {size,ox,oy}=cellMetrics();
  for(const g of colorGates230)drawColorGate230(g,size,ox,oy);
  for(const b of colorButtons230)drawFloorButton230(b,size,ox,oy);
  for(const b of lightButtons230)drawFloorButton230(b,size,ox,oy);
  drawLightDarkness230(size,ox,oy);
  const herd=typeof allGuardians224==='function'?allGuardians224():[];
  for(const g of herd)drawGuardianLightState230(g,size,ox,oy);
  if(performance.now()<lightPulse230){
    ctx.save();ctx.fillStyle=`rgba(255,245,180,${.18*(lightPulse230-performance.now())/500})`;ctx.fillRect(0,0,canvas.width,canvas.height);ctx.restore();
  }
};


/* ===== Bloque JavaScript original 13 ===== */

'use strict';
/* === VERSIÓN 2.3.1 — VELOCIDAD TEMPORAL Y REMOLINO DE 10 SEGUNDOS === */
const VEHICLE_BOOST_DURATION_MS_231=10000;
let vehicleBoostUntil231=0;

function clearVehicleBoost231(){
  vehicleBoostUntil231=0;
  currentVehicle=null;
}
function vehicleBoostActive231(){
  return Boolean(currentVehicle&&performance.now()<vehicleBoostUntil231);
}

/* Cada nivel comienza sin conservar la velocidad del anterior. */
const buildLevel231Base=buildLevel;
buildLevel=function(n){
  clearVehicleBoost231();
  buildLevel231Base(n);
};

/* Al recoger patines, bicicleta o patineta, la ventaja dura diez segundos. */
const collectQuietly231Base=collectQuietly;
collectQuietly=function(){
  const previousVehicle=currentVehicle;
  collectQuietly231Base();
  if(currentVehicle&&currentVehicle!==previousVehicle){
    vehicleBoostUntil231=performance.now()+VEHICLE_BOOST_DURATION_MS_231;
    tone(880,.07,'triangle',.028);
    tone(1175,.11,'triangle',.025,.06);
  }
};

/* La velocidad se apaga sola, sin penalidad ni cartel. */
const tryMove231Base=tryMove;
tryMove=function(dx,dy){
  if(currentVehicle&&performance.now()>=vehicleBoostUntil231)clearVehicleBoost231();
  tryMove231Base(dx,dy);
};

function drawVehicleBoost231(size,ox,oy){
  if(!vehicleBoostActive231())return;
  const remain=Math.max(0,vehicleBoostUntil231-performance.now());
  const life=remain/VEHICLE_BOOST_DURATION_MS_231;
  const cx=ox+(player.x+.5)*size,cy=oy+(player.y+.5)*size;
  ctx.save();
  ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.globalAlpha=Math.min(1,life*3);
  ctx.font=`${Math.max(16,size*.28)}px Arial`;
  ctx.fillText(currentVehicle.icon,cx,cy-size*.42);
  ctx.strokeStyle='rgba(255,255,255,.72)';
  ctx.lineWidth=Math.max(2,size*.025);
  for(let i=0;i<3;i++){
    const drift=(animTime*70+i*size*.28)%(size*.85);
    ctx.beginPath();
    ctx.moveTo(cx-size*.25-drift*.35,cy+size*(.15+i*.09));
    ctx.lineTo(cx-size*.45-drift*.35,cy+size*(.15+i*.09));
    ctx.stroke();
  }
  ctx.restore();
}

const draw231Base=draw;
draw=function(){
  if(currentVehicle&&performance.now()>=vehicleBoostUntil231)clearVehicleBoost231();
  draw231Base();
  if(!maze)return;
  const {size,ox,oy}=cellMetrics();
  drawVehicleBoost231(size,ox,oy);
};


/* ===== Bloque JavaScript original 14 ===== */

'use strict';
/* === VERSIÓN 2.4.0 — PULIDO Y RESPUESTA VISUAL === */
let polishParticles240=[];
let schoolEntry240=null;
let trampolineWasFlying240=false;
let lastAmbient240=0;

function addPolishBurst240(x,y,type='spark',count=7){
  const now=performance.now();
  for(let i=0;i<count;i++){
    const a=(Math.PI*2*i/count)+(Math.random()-.5)*.55;
    const speed=.18+Math.random()*.24;
    polishParticles240.push({x:x+.5,y:y+.5,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed-.12,start:now,life:520+Math.random()*260,type});
  }
}
function updateAndDrawParticles240(size,ox,oy){
  const now=performance.now();
  polishParticles240=polishParticles240.filter(p=>now-p.start<p.life);
  for(const p of polishParticles240){
    const t=(now-p.start)/p.life;
    const x=ox+(p.x+p.vx*t*5)*size;
    const y=oy+(p.y+(p.vy*t*5)+1.4*t*t)*size;
    ctx.save();ctx.globalAlpha=1-t;
    if(p.type==='dust'){
      ctx.fillStyle='rgba(245,235,200,.8)';ctx.beginPath();ctx.arc(x,y,size*(.035+.055*t),0,Math.PI*2);ctx.fill();
    }else{
      ctx.translate(x,y);ctx.rotate(t*5+iSafe240(p));ctx.fillStyle='#fff29a';
      const r=size*.055;ctx.beginPath();
      for(let i=0;i<8;i++){const rr=i%2?r*.36:r;const aa=i*Math.PI/4;ctx.lineTo(Math.cos(aa)*rr,Math.sin(aa)*rr)}
      ctx.closePath();ctx.fill();
    }
    ctx.restore();
  }
}
function iSafe240(p){return ((p.x*13+p.y*17)%7)*.2}

/* Destello periódico de las bananas, sin alterar su diseño principal. */
function drawBananaSparkles240(size,ox,oy){
  bananas.forEach((b,i)=>{
    if(b.got)return;
    const phase=(animTime*1.4+i*.73)%4.6;
    if(phase>1.15)return;
    const alpha=Math.sin(Math.PI*phase/1.15)*.85;
    const cx=ox+(b.x+.5)*size+Math.cos(i*2.1)*size*.22;
    const cy=oy+(b.y+.5)*size-size*.22;
    ctx.save();ctx.globalAlpha=alpha;ctx.translate(cx,cy);ctx.rotate(animTime*1.8);
    ctx.strokeStyle='#fffbd0';ctx.lineWidth=Math.max(1.5,size*.025);
    ctx.beginPath();ctx.moveTo(-size*.08,0);ctx.lineTo(size*.08,0);ctx.moveTo(0,-size*.08);ctx.lineTo(0,size*.08);ctx.stroke();ctx.restore();
  });
}

/* Los compañeros saludan cuando Nito está cerca. */
function drawFriendWave240(size,ox,oy){
  if(!friend||friend.found)return;
  const d=Math.abs(player.x-friend.x)+Math.abs(player.y-friend.y);
  if(d>2)return;
  const cx=ox+(friend.x+.5)*size,cy=oy+(friend.y+.5)*size;
  ctx.save();ctx.translate(cx+size*.27,cy-size*.22);ctx.rotate(Math.sin(animTime*8)*.35);
  ctx.font=`${Math.max(14,size*.25)}px Arial`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('👋',0,0);ctx.restore();
}

/* En los últimos dos segundos, el vehículo titila sin mostrar números. */
function drawVehicleEnding240(size,ox,oy){
  if(typeof vehicleBoostActive231!=='function'||!vehicleBoostActive231())return;
  const remain=vehicleBoostUntil231-performance.now();
  if(remain>2000)return;
  if(Math.floor(performance.now()/145)%2===0)return;
  const cx=ox+(player.x+.5)*size,cy=oy+(player.y+.5)*size;
  ctx.save();ctx.globalAlpha=.42;ctx.fillStyle='#fff7b0';ctx.beginPath();ctx.arc(cx,cy,size*.38,0,Math.PI*2);ctx.fill();ctx.restore();
}

/* Entrada animada a la escuela antes del resultado. */
function canEnterSchool240(){
  if(!playing||!sameCell(player,exit))return false;
  if(friend&&!friend.found)return false;
  if(level===3&&typeof level3GateOpen!=='undefined'&&!level3GateOpen)return false;
  return true;
}
const finishLevel240Base=finishLevel;
finishLevel=function(){
  if(schoolEntry240){return}
  if(!canEnterSchool240()){finishLevel240Base();return}
  const now=performance.now();
  schoolEntry240={start:now,duration:720,from:{...player}};
  playing=false;moveLock=true;
  tone(523,.10,'triangle',.032);tone(659,.12,'triangle',.032,.09);tone(784,.18,'sine',.036,.18);
  setTimeout(()=>{
    schoolEntry240=null;moveLock=false;
    finishLevel240Base();
  },720);
};

function drawSchoolEntry240(size,ox,oy){
  if(!schoolEntry240)return;
  const t=Math.min(1,(performance.now()-schoolEntry240.start)/schoolEntry240.duration);
  const cx=ox+(exit.x+.5)*size,cy=oy+(exit.y+.5)*size;
  /* puerta abriéndose */
  ctx.save();ctx.translate(cx,cy+size*.08);
  ctx.fillStyle='#2e507b';ctx.fillRect(-size*.07,-size*.08,size*.14,size*.20);
  ctx.fillStyle='#f3c85a';ctx.fillRect(-size*.07,-size*.08,size*.14*(1-t),size*.20);
  ctx.restore();
  /* Nito se acerca, se achica y desaparece dentro. */
  const yy=cy+size*(.22-.18*t);
  ctx.save();ctx.globalAlpha=1-Math.max(0,(t-.62)/.38);ctx.translate(cx,yy);ctx.scale(1-.48*t,1-.48*t);
  drawNito240Base(0,0,size, -size/2,-size/2);
  ctx.restore();
}
const drawNito240Base=drawNito;
drawNito=function(x,y,size,ox,oy){
  if(schoolEntry240)return;
  drawNito240Base(x,y,size,ox,oy);
};

/* Detecta el aterrizaje del trampolín para sumar polvo y una vibración breve. */
function trampolineImpact240(){
  addPolishBurst240(player.x,player.y,'dust',10);
  const c=document.getElementById('game');
  c.style.transform='translate(2px,1px)';
  setTimeout(()=>c.style.transform='translate(-2px,0)',45);
  setTimeout(()=>c.style.transform='',105);
}

/* Partículas al recoger bananas y al rescatar compañeros. */
const checkCell240Base=checkCell;
checkCell=function(){
  const beforeBananas=new Set(bananas.filter(b=>b.got).map(cellKey));
  const friendWasFound=friend?friend.found:true;
  checkCell240Base();
  for(const b of bananas){
    if(b.got&&!beforeBananas.has(cellKey(b)))addPolishBurst240(b.x,b.y,'spark',9);
  }
  if(friend&&!friendWasFound&&friend.found)addPolishBurst240(friend.x,friend.y,'spark',12);
};

/* Ambiente muy espaciado y suave, sin tapar la música. */
function ambientTick240(){
  const now=performance.now();
  if(!playing||!audioCtx||now-lastAmbient240<9000)return;
  lastAmbient240=now+Math.random()*7000;
  const choice=Math.floor(Math.random()*3);
  if(choice===0){tone(1250,.08,'sine',.006);tone(1510,.07,'sine',.005,.11)}
  else if(choice===1){tone(180,.12,'sine',.004);tone(145,.16,'sine',.003,.10)}
  else{tone(760,.05,'triangle',.004);tone(920,.06,'triangle',.004,.08)}
}

const buildLevel240Base=buildLevel;
buildLevel=function(n){
  polishParticles240=[];schoolEntry240=null;trampolineWasFlying240=false;lastAmbient240=performance.now()+5000;
  buildLevel240Base(n);
};

const draw240Base=draw;
draw=function(){
  const wasFlying=trampolineWasFlying240;
  trampolineWasFlying240=Boolean(typeof trampolineFlight41!=='undefined'&&trampolineFlight41);
  if(wasFlying&&!trampolineWasFlying240)trampolineImpact240();
  ambientTick240();
  draw240Base();
  if(!maze)return;
  const {size,ox,oy}=cellMetrics();
  drawBananaSparkles240(size,ox,oy);
  drawFriendWave240(size,ox,oy);
  drawVehicleEnding240(size,ox,oy);
  updateAndDrawParticles240(size,ox,oy);
  drawSchoolEntry240(size,ox,oy);
};


/* ===== Bloque JavaScript original 15 ===== */

'use strict';
/* === VERSIÓN 2.5 — PASADA 1/2: CAMPAÑA COMPLETA ===
   Activa las cantidades definitivas de trampolines y remolinos por nivel.
   Todo se comunica de forma visual y sonora, sin tutoriales nuevos. */

const FINAL_TRAMPOLINE_COUNTS_250={6:2,14:2,17:3,19:3,20:4};
const FINAL_WHIRLPOOL_COUNTS_250={14:2,16:3,20:2};
let campaignTrampolines250=[];
let campaignWhirlpools250=[];
let campaignFlightBusy250=false;

function campaignOccupied250(){
  const s=new Set([cellKey(levelStart),cellKey(exit)]);
  bananas.forEach(b=>{if(!b.got)s.add(cellKey(b))});
  if(friend&&!friend.found)s.add(cellKey(friend));
  if(specialItem&&!specialItem.got)s.add(cellKey(specialItem));
  if(typeof level3Button!=='undefined'&&level3Button)s.add(cellKey(level3Button));
  if(typeof level4Trampoline!=='undefined'&&level4Trampoline)s.add(cellKey(level4Trampoline));
  if(typeof level4Landing!=='undefined'&&level4Landing)s.add(cellKey(level4Landing));
  if(typeof level9Trampoline42!=='undefined'&&level9Trampoline42)s.add(cellKey(level9Trampoline42));
  if(typeof level9Landing42!=='undefined'&&level9Landing42)s.add(cellKey(level9Landing42));
  if(typeof flashlightItem42!=='undefined'&&flashlightItem42&&!flashlightItem42.got)s.add(cellKey(flashlightItem42));
  if(typeof vehicleItem!=='undefined'&&vehicleItem&&!vehicleItem.got)s.add(cellKey(vehicleItem));
  if(typeof visionGlasses!=='undefined')visionGlasses.forEach(v=>{if(!v.got)s.add(cellKey(v))});
  if(typeof lightButtons230!=='undefined')lightButtons230.forEach(b=>s.add(cellKey(b)));
  if(typeof colorButtons230!=='undefined')colorButtons230.forEach(b=>s.add(cellKey(b)));
  if(typeof falseExit!=='undefined'&&falseExit)s.add(cellKey(falseExit));
  if(typeof allGuardians224==='function')allGuardians224().forEach(g=>s.add(cellKey(g)));
  return s;
}

function sortedCampaignCells250(occupied){
  const distStart=distancesFrom(levelStart);
  const distExit=distancesFrom(exit);
  return allCells().filter(c=>
    !occupied.has(cellKey(c)) &&
    !sameCell(c,levelStart) &&
    !sameCell(c,exit)
  ).sort((a,b)=>{
    const da=(distStart.get(cellKey(a))||0)+(distExit.get(cellKey(a))||0);
    const db=(distStart.get(cellKey(b))||0)+(distExit.get(cellKey(b))||0);
    const branchA=neighborsOf(a.x,a.y).length===1?4:0;
    const branchB=neighborsOf(b.x,b.y).length===1?4:0;
    return (db+branchB)-(da+branchA);
  });
}

function setupCampaignTrampolines250(){
  campaignTrampolines250=[];
  const count=FINAL_TRAMPOLINE_COUNTS_250[level]||0;
  if(!count)return;
  const occupied=campaignOccupied250();
  const cells=sortedCampaignCells250(occupied);
  for(let i=0;i<count;i++){
    const source=cells.find(c=>!occupied.has(cellKey(c)));
    if(!source)break;
    occupied.add(cellKey(source));

    const distances=distancesFrom(source);
    const landing=allCells().filter(c=>
      !occupied.has(cellKey(c)) &&
      !sameCell(c,source) &&
      (distances.get(cellKey(c))||0)>=Math.max(4,Math.floor((cols+rows)/4))
    ).sort((a,b)=>(distances.get(cellKey(b))||0)-(distances.get(cellKey(a))||0))[0];

    if(!landing)continue;
    occupied.add(cellKey(landing));
    campaignTrampolines250.push({
      x:source.x,y:source.y,
      to:{x:landing.x,y:landing.y},
      bouncePhase:i*.8
    });
  }
}

function setupCampaignWhirlpools250(){
  campaignWhirlpools250=[];
  const count=FINAL_WHIRLPOOL_COUNTS_250[level]||0;
  if(!count)return;

  /* En estos niveles reemplazamos el remolino antiguo por la cantidad exacta. */
  if(typeof whirlpool!=='undefined')whirlpool=null;

  const occupied=campaignOccupied250();
  campaignTrampolines250.forEach(p=>{
    occupied.add(cellKey(p));
    occupied.add(cellKey(p.to));
  });
  const cells=sortedCampaignCells250(occupied);
  for(let i=0;i<count;i++){
    const c=cells.find(p=>!occupied.has(cellKey(p)));
    if(!c)break;
    occupied.add(cellKey(c));
    campaignWhirlpools250.push({...c,used:false,phase:i*1.7});
  }
}

function drawCampaignTrampoline250(p,size,ox,oy){
  const cx=ox+(p.x+.5)*size;
  const cy=oy+(p.y+.5)*size;
  const squash=campaignFlightBusy250&&sameCell(player,p)?0.72:1;
  ctx.save();ctx.translate(cx,cy+size*.08);
  ctx.fillStyle='rgba(55,38,75,.30)';
  ctx.beginPath();ctx.ellipse(0,size*.18,size*.31,size*.11,0,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle='#60506d';ctx.lineWidth=Math.max(3,size*.055);
  for(let i=-1;i<=1;i+=2){
    ctx.beginPath();
    ctx.moveTo(i*size*.15,size*.10);
    ctx.lineTo(i*size*.09,size*.22);
    ctx.lineTo(i*size*.17,size*.31);
    ctx.stroke();
  }
  ctx.scale(1,squash);
  const pulse=.94+.06*Math.sin(animTime*4+p.bouncePhase);
  ctx.scale(pulse,pulse);
  ctx.fillStyle='#8d5ed1';ctx.strokeStyle='#f0d9ff';ctx.lineWidth=Math.max(3,size*.045);
  ctx.beginPath();ctx.roundRect(-size*.31,-size*.12,size*.62,size*.25,size*.09);ctx.fill();ctx.stroke();
  ctx.fillStyle='#c9a6ff';ctx.beginPath();ctx.roundRect(-size*.22,-size*.08,size*.44,size*.08,size*.04);ctx.fill();
  ctx.restore();
}

function drawCampaignWhirlpool250(w,size,ox,oy){
  if(w.used)return;
  const cx=ox+(w.x+.5)*size,cy=oy+(w.y+.5)*size;
  ctx.save();ctx.translate(cx,cy);ctx.rotate(animTime*3.1+w.phase);
  ctx.strokeStyle='#7653c6';ctx.lineWidth=Math.max(3,size*.055);ctx.lineCap='round';
  ctx.shadowColor='#c9b6ff';ctx.shadowBlur=Math.max(5,size*.09);
  for(let r=.09;r<=.34;r+=.075){
    ctx.beginPath();ctx.arc(0,0,size*r,0,Math.PI*1.55);ctx.stroke();ctx.rotate(.72);
  }
  ctx.restore();
}

function startCampaignTrampoline250(p){
  if(!p||campaignFlightBusy250||trampolineFlight41)return;
  campaignFlightBusy250=true;trampolineBusy=true;moveLock=true;steps++;
  trampolineSound41();
  trampolineFlight41={
    from:{x:p.x,y:p.y},
    to:{...p.to},
    start:performance.now(),
    duration:820
  };
  updateHud();
  setTimeout(()=>{
    player={...p.to};
    trampolineFlight41=null;
    campaignFlightBusy250=false;trampolineBusy=false;moveLock=false;
    checkCell250Base();
    updateHud();draw();
    tone(250,.08,'square',.028);tone(150,.12,'sine',.035,.05);
  },820);
}

const buildLevel250Base=buildLevel;
buildLevel=function(n){
  campaignTrampolines250=[];campaignWhirlpools250=[];campaignFlightBusy250=false;
  buildLevel250Base(n);
  setupCampaignTrampolines250();
  setupCampaignWhirlpools250();
  draw();
};

const checkCell250Base=checkCell;
checkCell=function(){
  if(!campaignFlightBusy250){
    const pad=campaignTrampolines250.find(p=>sameCell(player,p));
    if(pad){startCampaignTrampoline250(p);return}
  }
  const spin=campaignWhirlpools250.find(w=>!w.used&&sameCell(player,w));
  if(spin){
    spin.used=true;
    if(typeof activateWhirlpoolEffect21==='function')activateWhirlpoolEffect21();
  }
  checkCell250Base();
};

const draw250Base=draw;
draw=function(){
  draw250Base();
  if(!maze)return;
  const {size,ox,oy}=cellMetrics();
  campaignWhirlpools250.forEach(w=>drawCampaignWhirlpool250(w,size,ox,oy));
  campaignTrampolines250.forEach(p=>drawCampaignTrampoline250(p,size,ox,oy));
};

/* Limpieza defensiva para que efectos temporales no crucen de nivel. */
const startGame250Base=startGame;
startGame=function(n){
  if(typeof clearWhirlpoolEffect21==='function')clearWhirlpoolEffect21();
  campaignFlightBusy250=false;
  startGame250Base(n);
};


/* ===== Bloque JavaScript original 16 ===== */

'use strict';
/* === VERSIÓN 2.5 — PASADA FINAL: ESTABILIDAD DE CAMPAÑA ===
   Revisión defensiva de estados temporales, apariciones y superposiciones.
   No incorpora tutoriales ni cambia las reglas de las mecánicas. */

let levelGeneration251=0;

function clearTransientState251(){
  levelGeneration251++;
  if(typeof clearWhirlpoolEffect21==='function')clearWhirlpoolEffect21();
  if(typeof clearVehicleBoost231==='function')clearVehicleBoost231();
  if(typeof stopHeldMove==='function')stopHeldMove();
  if(typeof birdEvent222!=='undefined')birdEvent222=null;
  if(typeof birdWhirlpools222!=='undefined')birdWhirlpools222=[];
  if(typeof elephantBursts225!=='undefined')elephantBursts225=[];
  if(typeof polishParticles240!=='undefined')polishParticles240=[];
  if(typeof schoolEntry240!=='undefined')schoolEntry240=null;
  if(typeof trampolineFlight41!=='undefined')trampolineFlight41=null;
  if(typeof campaignFlightBusy250!=='undefined')campaignFlightBusy250=false;
  if(typeof trampolineBusy!=='undefined')trampolineBusy=false;
  if(typeof moveLock!=='undefined')moveLock=false;
  const c=document.getElementById('game');
  if(c)c.style.transform='';
  document.querySelectorAll('.game-wrap > div:not(.overlay)').forEach(el=>{
    if(el.style&&el.style.position==='absolute')el.remove();
  });
}

function inBounds251(c){
  return Boolean(c&&Number.isFinite(c.x)&&Number.isFinite(c.y)&&c.x>=0&&c.y>=0&&c.x<cols&&c.y<rows);
}
function freeCell251(used,preferFar=true){
  const dist=distancesFrom(levelStart);
  const cells=allCells().filter(c=>!used.has(cellKey(c))&&neighborsOf(c.x,c.y).length>0);
  cells.sort((a,b)=>preferFar
    ?(dist.get(cellKey(b))||0)-(dist.get(cellKey(a))||0)
    :(dist.get(cellKey(a))||0)-(dist.get(cellKey(b))||0));
  return cells[0]||null;
}
function reserveObject251(obj,used,preferFar=true){
  if(!obj)return;
  let k=inBounds251(obj)?cellKey(obj):'';
  if(!k||used.has(k)){
    const c=freeCell251(used,preferFar);
    if(c){obj.x=c.x;obj.y=c.y;k=cellKey(obj)}
  }
  if(k)used.add(k);
}
function reserveGuardian251(g,used){
  if(!g)return;
  let placed=false;
  if(Array.isArray(g.route)){
    for(let i=0;i<g.route.length;i++){
      const p=g.route[i];
      if(inBounds251(p)&&!used.has(cellKey(p))){
        g.index=i;g.x=p.x;g.y=p.y;placed=true;break;
      }
    }
  }
  if(!placed){
    const c=freeCell251(used,true);
    if(c){g.x=c.x;g.y=c.y}
  }
  if(inBounds251(g))used.add(cellKey(g));
}

/* Último control de seguridad después de que todas las capas terminaron de
   colocar sus objetos. Evita apariciones dobles sin cambiar el diseño. */
function sanitizeLevel251(){
  if(!maze)return;
  const used=new Set();
  used.add(cellKey(levelStart));
  used.add(cellKey(exit));

  reserveObject251(friend,used,true);
  for(const b of bananas)if(!b.got)reserveObject251(b,used,true);
  if(specialItem&&!specialItem.got)reserveObject251(specialItem,used,true);
  if(typeof vehicleItem!=='undefined'&&vehicleItem&&!vehicleItem.got)reserveObject251(vehicleItem,used,true);
  if(typeof visionGlasses!=='undefined')for(const v of visionGlasses)if(!v.got)reserveObject251(v,used,true);
  if(typeof flashlightItem42!=='undefined'&&flashlightItem42&&!flashlightItem42.got)reserveObject251(flashlightItem42,used,true);
  if(typeof level3Button!=='undefined'&&level3Button)reserveObject251(level3Button,used,true);
  if(typeof level4Trampoline!=='undefined'&&level4Trampoline)reserveObject251(level4Trampoline,used,true);
  if(typeof level4Landing!=='undefined'&&level4Landing)reserveObject251(level4Landing,used,true);
  if(typeof level9Trampoline42!=='undefined'&&level9Trampoline42)reserveObject251(level9Trampoline42,used,true);
  if(typeof level9Landing42!=='undefined'&&level9Landing42)reserveObject251(level9Landing42,used,true);
  if(typeof lightButtons230!=='undefined')for(const b of lightButtons230)reserveObject251(b,used,true);
  if(typeof colorButtons230!=='undefined')for(const b of colorButtons230)reserveObject251(b,used,true);

  if(typeof campaignTrampolines250!=='undefined'){
    for(const p of campaignTrampolines250){
      reserveObject251(p,used,true);
      reserveObject251(p.to,used,true);
    }
  }
  if(typeof campaignWhirlpools250!=='undefined')for(const w of campaignWhirlpools250)reserveObject251(w,used,true);
  if(typeof whirlpool!=='undefined'&&whirlpool)reserveObject251(whirlpool,used,true);
  if(typeof falseExit!=='undefined'&&falseExit)reserveObject251(falseExit,used,true);

  const herd=typeof allGuardians224==='function'?allGuardians224():[guardian,extraGuardian].filter(Boolean);
  for(const g of herd)reserveGuardian251(g,used);

  player={...levelStart};
  updateHud();
}

function verifyCampaign251(){
  const expectedPads=(typeof FINAL_TRAMPOLINE_COUNTS_250!=='undefined'&&FINAL_TRAMPOLINE_COUNTS_250[level])||0;
  const expectedSpins=(typeof FINAL_WHIRLPOOL_COUNTS_250!=='undefined'&&FINAL_WHIRLPOOL_COUNTS_250[level])||0;
  const actualPads=typeof campaignTrampolines250!=='undefined'?campaignTrampolines250.length:0;
  const actualSpins=typeof campaignWhirlpools250!=='undefined'?campaignWhirlpools250.length:0;
  if(actualPads<expectedPads||actualSpins<expectedSpins){
    console.warn('Nito: el nivel no pudo colocar todos los elementos previstos.',{
      level,expectedPads,actualPads,expectedSpins,actualSpins
    });
  }
}

const buildLevel251Base=buildLevel;
buildLevel=function(n){
  clearTransientState251();
  buildLevel251Base(n);
  sanitizeLevel251();
  verifyCampaign251();
  draw();
};

/* La selección de nivel y el reinicio siempre parten de una pantalla limpia. */
const startGame251Base=startGame;
startGame=function(n){
  clearTransientState251();
  const finalOverlay=document.getElementById('finalAdventureOverlay');
  if(finalOverlay){finalOverlay.style.display='none';finalOverlay.setAttribute('aria-hidden','true')}
  startGame251Base(n);
};

/* Protección final: ningún guardián puede capturar durante un salto ni durante
   la entrada animada a la escuela. */
const guardianCanCapture251Base=guardianCanCapture223;
guardianCanCapture223=function(g=null){
  if((typeof trampolineFlight41!=='undefined'&&trampolineFlight41)||
     (typeof schoolEntry240!=='undefined'&&schoolEntry240))return false;
  return guardianCanCapture251Base(g);
};
guardianTouchesNito21=function(){return guardianCanCapture223()};
activeGuardianTouch222=function(g){return guardianCanCapture223(g)};

/* Si el efecto temporal termina mientras el jugador permanece quieto, el
   dibujo también lo limpia sin esperar una nueva pulsación. */
const draw251Base=draw;
draw=function(){
  if(typeof whirlpoolEffectUntil21!=='undefined'&&whirlpoolEffectUntil21&&
     performance.now()>=whirlpoolEffectUntil21&&typeof clearWhirlpoolEffect21==='function'){
    clearWhirlpoolEffect21();
  }
  if(typeof vehicleBoostUntil231!=='undefined'&&vehicleBoostUntil231&&
     performance.now()>=vehicleBoostUntil231&&typeof clearVehicleBoost231==='function'){
    clearVehicleBoost231();
  }
  draw251Base();
};

/* Estado inicial limpio incluso si el navegador restaura el documento. */
window.addEventListener('pageshow',()=>{
  const finalOverlay=document.getElementById('finalAdventureOverlay');
  if(!playing&&finalOverlay&&finalOverlay.getAttribute('aria-hidden')!=='false'){
    finalOverlay.style.display='none';
  }
});


/* ===== Bloque JavaScript original 17 ===== */

'use strict';
/* === VERSIÓN 2.5.1 — AJUSTES DEL PLAYTEST ===
   Nivel 5 con gorila, nivel 6 sin trampolines decorativos,
   nivel 8 estabilizado, nivel 10 con atajos tempranos y elefante agresivo. */

/* Nivel 5: primer encuentro opcional con un gorila. */
if(typeof CAMPAIGN_PLAN_224!=='undefined'){
  CAMPAIGN_PLAN_224[5]={...(CAMPAIGN_PLAN_224[5]||{}),guardians:['gorilla1']};
}
if(typeof GUARDIAN_PLAN!=='undefined')GUARDIAN_PLAN[5]=['gorilla1'];

/* Nivel 6: se eliminan los dos trampolines que quedaban fuera del recorrido
   y no aportaban una decisión interesante. */
if(typeof FINAL_TRAMPOLINE_COUNTS_250!=='undefined')FINAL_TRAMPOLINE_COUNTS_250[6]=0;

/* Nivel 8: queda dedicado al primer remolino. Se desactiva aquí el sistema
   de luz, que era la capa que producía el dibujo parcial/duplicado. */
if(typeof LIGHT_LEVELS_230!=='undefined')LIGHT_LEVELS_230.delete(8);

/* Nivel 10: botones cerca del comienzo y paredes que abren atajos reales. */
function occupiedForLevel10Fix251(){
  const used=new Set([cellKey(levelStart),cellKey(exit)]);
  if(friend&&!friend.found)used.add(cellKey(friend));
  for(const b of bananas)if(!b.got)used.add(cellKey(b));
  if(specialItem&&!specialItem.got)used.add(cellKey(specialItem));
  if(typeof vehicleItem!=='undefined'&&vehicleItem&&!vehicleItem.got)used.add(cellKey(vehicleItem));
  return used;
}
function closedShortcutEdges251(){
  const dist=distancesFrom(levelStart),edges=[];
  for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
    const c=maze[y][x];
    if(x<cols-1&&c.walls.right){
      const a={x,y},b={x:x+1,y};
      edges.push({x,y,key:'right',nx:x+1,ny:y,opp:'left',gap:Math.abs((dist.get(cellKey(a))||0)-(dist.get(cellKey(b))||0)),near:Math.min(dist.get(cellKey(a))||0,dist.get(cellKey(b))||0)});
    }
    if(y<rows-1&&c.walls.down){
      const a={x,y},b={x,y:y+1};
      edges.push({x,y,key:'down',nx:x,ny:y+1,opp:'up',gap:Math.abs((dist.get(cellKey(a))||0)-(dist.get(cellKey(b))||0)),near:Math.min(dist.get(cellKey(a))||0,dist.get(cellKey(b))||0)});
    }
  }
  return edges.filter(e=>e.gap>=4&&e.near>=3).sort((a,b)=>b.gap-a.gap||a.near-b.near);
}
function rebuildLevel10ColorLayout251(){
  if(level!==10||typeof colorButtons230==='undefined'||typeof colorGates230==='undefined')return;
  const colors=[['red','#e54848'],['yellow','#f0c928'],['blue','#3d75d6']];
  const dist=distancesFrom(levelStart),used=occupiedForLevel10Fix251();
  const nearby=allCells().filter(c=>{
    const d=dist.get(cellKey(c));
    return d>=2&&d<=Math.max(7,Math.floor((cols+rows)/2))&&!used.has(cellKey(c))&&neighborsOf(c.x,c.y).length>0;
  }).sort((a,b)=>(dist.get(cellKey(a))||0)-(dist.get(cellKey(b))||0));

  colorButtons230=[];pressedColors230=new Set();
  for(let i=0;i<colors.length;i++){
    const targetDistance=2+i*2;
    let idx=nearby.findIndex(c=>(dist.get(cellKey(c))||0)>=targetDistance&&!used.has(cellKey(c)));
    if(idx<0)idx=nearby.findIndex(c=>!used.has(cellKey(c)));
    if(idx<0)break;
    const c=nearby[idx],spec=colors[i];used.add(cellKey(c));
    colorButtons230.push({...c,id:spec[0],color:spec[1],pressed:false});
  }

  const edges=closedShortcutEdges251(),picked=[];
  for(const e of edges){
    if(picked.some(q=>Math.abs(q.x-e.x)+Math.abs(q.y-e.y)<3))continue;
    picked.push(e);if(picked.length===3)break;
  }
  colorGates230=[];
  colors.forEach((spec,i)=>{
    const e=picked[i];if(e)colorGates230.push({...e,id:spec[0],color:spec[1],requires:[spec[0]],open:false});
  });
}

/* Elefante: golpe cada 5 segundos, abre la pared que mejor lo acerca a Nito
   y avanza inmediatamente por el hueco recién creado. */
const ELEPHANT_BREAK_MS_251=5000;
breakWallForElephant225=function(g,t){
  if(!g||g.kind!=='elephant'||!playing)return;
  if(typeof g.nextWallBreak225!=='number')g.nextWallBreak225=t+ELEPHANT_BREAK_MS_251;
  if(t<g.nextWallBreak225)return;
  g.nextWallBreak225=t+ELEPHANT_BREAK_MS_251;
  const d=elephantBreakDirection225(g);if(!d)return;
  const nx=g.x+d.dx,ny=g.y+d.dy;
  maze[g.y][g.x].walls[d.key]=false;
  maze[ny][nx].walls[oppositeKey225(d.key)]=false;
  g.alertSymbol224='!';g.alertUntil224=t+800;
  elephantBursts225.push({x:g.x+d.dx*.5,y:g.y+d.dy*.5,start:t,duration:900,dx:d.dx,dy:d.dy});
  elephantBoomSound225();
  g.x=nx;g.y=ny;
  g.pauseUntil=0;
  g.nextAt=t+Math.min(g.step||900,900);
  if(typeof guardianCanCapture223==='function'&&guardianCanCapture223(g))resetToStart();
};
if(typeof GUARDIAN_PERSONALITIES!=='undefined'&&GUARDIAN_PERSONALITIES.elephant){
  GUARDIAN_PERSONALITIES.elephant.step=900;
  GUARDIAN_PERSONALITIES.elephant.pause=150;
}

const buildLevel251FixBase=buildLevel;
buildLevel=function(n){
  buildLevel251FixBase(n);
  if(level===6&&typeof campaignTrampolines250!=='undefined')campaignTrampolines250=[];
  if(level===8){
    if(typeof lightButtons230!=='undefined')lightButtons230=[];
    if(typeof lightOn230!=='undefined')lightOn230=true;
  }
  if(level===10)rebuildLevel10ColorLayout251();
  const herd=typeof allGuardians224==='function'?allGuardians224():[guardian,extraGuardian].filter(Boolean);
  const now=performance.now();
  for(const g of herd)if(g&&g.kind==='elephant')g.nextWallBreak225=now+ELEPHANT_BREAK_MS_251;
  if(typeof sanitizeLevel251==='function')sanitizeLevel251();
  draw();
};


/* ===== Bloque JavaScript original 18 ===== */

'use strict';
/* =========================================================
   GUARDIÁN DEMOLEDOR — VERSIÓN 1
   Persecución oculta por proximidad, sin señales visuales.
   ========================================================= */
const DEMOLISHER_CHASE_DISTANCE_V1=5;
const DEMOLISHER_ESCAPE_DISTANCE_V1=7;

function demolisherDistanceV1(g){
  return g ? Math.abs(g.x-player.x)+Math.abs(g.y-player.y) : Infinity;
}

function updateDemolisherStateV1(g){
  if(!g||g.kind!=='elephant')return;
  const distance=demolisherDistanceV1(g);
  if(!g.demolisherChasingV1&&distance<=DEMOLISHER_CHASE_DISTANCE_V1){
    g.demolisherChasingV1=true;
  }else if(g.demolisherChasingV1&&distance>DEMOLISHER_ESCAPE_DISTANCE_V1){
    g.demolisherChasingV1=false;
  }
}

const chooseGuardianNextDemolisherV1Base=chooseGuardianNext;
chooseGuardianNext=function(g){
  if(g&&g.kind==='elephant'){
    updateDemolisherStateV1(g);
    if(g.demolisherChasingV1){
      const path=shortestPath({x:g.x,y:g.y},player);
      if(path.length>1)return path[1];
    }
  }
  return chooseGuardianNextDemolisherV1Base(g);
};

const makeGuardianDemolisherV1Base=makeGuardian;
makeGuardian=function(kind,offset=0){
  const g=makeGuardianDemolisherV1Base(kind,offset);
  if(g&&g.kind==='elephant'){
    g.name='Guardián Demoledor';
    g.demolisherChasingV1=false;
  }
  return g;
};

/* El golpe sigue orientándose hacia Nito, pero la persecución solo se activa
   dentro del radio oculto de cinco casillas. */
const moveOneGuardianDemolisherV1Base=moveOneGuardian;
moveOneGuardian=function(g,t){
  if(g&&g.kind==='elephant')updateDemolisherStateV1(g);
  moveOneGuardianDemolisherV1Base(g,t);
};


/* ===== Bloque JavaScript original 19 ===== */

'use strict';
/* =========================================================
   GUARDIANES 3.0 — PERSONALIDAD DEFINITIVA
   Atento: sospecha gradual por movimiento.
   Demoledor: demolición útil + zancada sin teletransportes.
   Del Viento: serie móvil de tres remolinos.
   ========================================================= */

/* Nombres coherentes y descriptivos. */
if(typeof GUARDIAN_PERSONALITIES!=='undefined'){
  if(GUARDIAN_PERSONALITIES.gorilla1)GUARDIAN_PERSONALITIES.gorilla1.name='Guardián Atento';
  if(GUARDIAN_PERSONALITIES.gorilla2)GUARDIAN_PERSONALITIES.gorilla2.name='Guardián Atento';
  if(GUARDIAN_PERSONALITIES.elephant)GUARDIAN_PERSONALITIES.elephant.name='Guardián Demoledor';
  if(GUARDIAN_PERSONALITIES.sloth)GUARDIAN_PERSONALITIES.sloth.name='Guardián Dormilón';
  if(GUARDIAN_PERSONALITIES.turtle)GUARDIAN_PERSONALITIES.turtle.name='Guardián Incansable';
  if(GUARDIAN_PERSONALITIES.parrot)GUARDIAN_PERSONALITIES.parrot.name='Guardián del Viento';
}

/* ---------- GUARDIÁN ATENTO ---------- */
const ATTENTIVE_INVESTIGATE_30=30;
const ATTENTIVE_CHASE_30=65;
const ATTENTIVE_DECAY_PER_SEC_30=9;
let attentiveLastInput30={key:'',at:0};

function isAttentive30(g){return Boolean(g&&(g.kind==='gorilla1'||g.kind==='gorilla2'||g.icon==='🦍'))}
function initAttentive30(g){
  if(!isAttentive30(g))return;
  if(typeof g.suspicion30!=='number')g.suspicion30=0;
  if(typeof g.suspicionUpdated30!=='number')g.suspicionUpdated30=performance.now();
  g.name='Guardián Atento';
}
function straightVision30(g){
  if(!g)return null;
  const dx=player.x-g.x,dy=player.y-g.y;
  if(dx!==0&&dy!==0)return null;
  if(dx===0&&dy===0)return {distance:0,max:1};
  const sx=Math.sign(dx),sy=Math.sign(dy);
  const key=sx===1?'right':sx===-1?'left':sy===1?'down':'up';
  let x=g.x,y=g.y,max=0;
  while(true){
    if(maze[y][x].walls[key])break;
    x+=sx;y+=sy;max++;
    if(x<0||y<0||x>=cols||y>=rows)break;
  }
  const distance=Math.abs(dx)+Math.abs(dy);
  if(distance>max)return null;
  return {distance,max:Math.max(1,max)};
}
function addSuspicion30(g,dirKey,moved){
  initAttentive30(g);
  const vision=straightVision30(g);if(!vision)return;
  const ratio=vision.distance/vision.max;
  let amount=ratio>.60?1:ratio>.30?3:6;
  const now=performance.now();
  const rapid=attentiveLastInput30.key&&attentiveLastInput30.key!==dirKey&&(now-attentiveLastInput30.at)<520;
  if(rapid)amount+=4;
  if(!moved)amount+=2; // golpear una pared también hace ruido.
  g.suspicion30=Math.min(100,g.suspicion30+amount);
  g.lastSeen30={x:player.x,y:player.y};
  g.suspicionUpdated30=now;
  if(g.suspicion30>=ATTENTIVE_CHASE_30){g.alertSymbol224='!';g.alertUntil224=now+450}
  else if(g.suspicion30>=ATTENTIVE_INVESTIGATE_30){g.questionUntil221=now+420}
}
function decaySuspicion30(g,t){
  if(!isAttentive30(g))return;
  initAttentive30(g);
  const dt=Math.max(0,t-g.suspicionUpdated30)/1000;
  if(dt>0){
    g.suspicion30=Math.max(0,g.suspicion30-dt*ATTENTIVE_DECAY_PER_SEC_30);
    g.suspicionUpdated30=t;
    if(g.suspicion30<20)g.lastSeen30=null;
  }
}

const tryMoveGuardians30Base=tryMove;
tryMove=function(dx,dy){
  const before={x:player.x,y:player.y};
  const key=dx===1?'right':dx===-1?'left':dy===1?'down':'up';
  tryMoveGuardians30Base(dx,dy);
  const moved=before.x!==player.x||before.y!==player.y;
  const herd=typeof allGuardians224==='function'?allGuardians224():[guardian,extraGuardian].filter(Boolean);
  for(const g of herd)if(isAttentive30(g))addSuspicion30(g,key,moved);
  attentiveLastInput30={key,at:performance.now()};
};

/* ---------- GUARDIÁN DEMOLEDOR ---------- */
function isElephant30(g){return Boolean(g&&g.kind==='elephant')}
function openNeighbors30(g){return neighborsOf(g.x,g.y).map(n=>({x:n.x,y:n.y}))}
function safePatrolStep30(g){
  const ns=openNeighbors30(g);if(!ns.length)return null;
  if(!g.patrolMemory30)g.patrolMemory30=[];
  ns.sort((a,b)=>{
    const av=g.patrolMemory30.includes(cellKey(a))?1:0,bv=g.patrolMemory30.includes(cellKey(b))?1:0;
    return av-bv||Math.abs(b.x-player.x)+Math.abs(b.y-player.y)-Math.abs(a.x-player.x)-Math.abs(a.y-player.y);
  });
  const n=ns[0];g.patrolMemory30.push(cellKey(n));if(g.patrolMemory30.length>10)g.patrolMemory30.shift();return n;
}
function elephantBestBreak30(g){
  const dirs=[
    {dx:1,dy:0,key:'right',opp:'left'}, {dx:-1,dy:0,key:'left',opp:'right'},
    {dx:0,dy:1,key:'down',opp:'up'}, {dx:0,dy:-1,key:'up',opp:'down'}
  ];
  const currentPath=shortestPath({x:g.x,y:g.y},player);
  const currentLen=currentPath.length?currentPath.length-1:Infinity;
  const dist=Math.abs(g.x-player.x)+Math.abs(g.y-player.y);
  const candidates=[];
  for(const d of dirs){
    const nx=g.x+d.dx,ny=g.y+d.dy;
    if(nx<0||ny<0||nx>=cols||ny>=rows||!maze[g.y][g.x].walls[d.key])continue;
    maze[g.y][g.x].walls[d.key]=false;maze[ny][nx].walls[d.opp]=false;
    const p=shortestPath({x:g.x,y:g.y},player);
    const newLen=p.length?p.length-1:Infinity;
    maze[g.y][g.x].walls[d.key]=true;maze[ny][nx].walls[d.opp]=true;
    candidates.push({...d,nx,ny,newLen,saving:currentLen-newLen,manhattan:Math.abs(nx-player.x)+Math.abs(ny-player.y)});
  }
  if(!candidates.length)return null;
  candidates.sort((a,b)=>b.saving-a.saving||a.manhattan-b.manhattan);
  if(dist>5)return candidates[0]; // lejos: demoler es obligatorio.
  return candidates[0].saving>=1?candidates[0]:null; // cerca: rompe si ahorra al menos un paso.
}

/* Reemplazo estable: nunca restaura una posición antigua de patrulla. */
const chooseGuardianNextGuardians30Base=chooseGuardianNext;
chooseGuardianNext=function(g){
  if(isElephant30(g)){
    updateDemolisherStateV1(g);
    if(g.demolisherChasingV1){
      const path=shortestPath({x:g.x,y:g.y},player);
      if(path.length>1)return path[1];
    }
    return safePatrolStep30(g);
  }
  if(isAttentive30(g)){
    initAttentive30(g);
    const target=g.suspicion30>=ATTENTIVE_CHASE_30?player:
      (g.suspicion30>=ATTENTIVE_INVESTIGATE_30?g.lastSeen30:null);
    if(target){
      const path=shortestPath({x:g.x,y:g.y},target);
      if(path.length>1)return path[1];
    }
  }
  return chooseGuardianNextGuardians30Base(g);
};

/* Demolición cada cinco segundos con la regla acordada. */
breakWallForElephant225=function(g,t){
  if(!isElephant30(g)||!playing)return;
  if(typeof g.nextWallBreak225!=='number')g.nextWallBreak225=t+5000;
  if(t<g.nextWallBreak225)return;
  g.nextWallBreak225=t+5000;
  const d=elephantBestBreak30(g);if(!d)return;
  maze[g.y][g.x].walls[d.key]=false;maze[d.ny][d.nx].walls[d.opp]=false;
  elephantBursts225.push({x:g.x+d.dx*.5,y:g.y+d.dy*.5,start:t,duration:900,dx:d.dx,dy:d.dy});
  elephantBoomSound225();
  g.x=d.nx;g.y=d.ny;g.pauseUntil=0;g.nextAt=t+Math.min(g.step||900,900);
  if(typeof guardianCanCapture223==='function'&&guardianCanCapture223(g))resetToStart();
};

/* Cada cuatro movimientos reales, una segunda casilla continua la misma decisión.
   No usa índices viejos, por lo que no puede teletransportarse. */
const moveOneGuardianGuardians30Base=moveOneGuardian;
moveOneGuardian=function(g,t){
  const before=g?{x:g.x,y:g.y}:null;
  moveOneGuardianGuardians30Base(g,t);
  if(!g||!before)return;
  const moved=before.x!==g.x||before.y!==g.y;
  if(isElephant30(g)&&moved){
    g.elephantSteps30=(g.elephantSteps30||0)+1;
    if(g.elephantSteps30%4===0&&playing){
      /* En su paso doble, el elefante intenta continuar hacia Nito.
         Si la pared interior le corta ese avance, la rompe y atraviesa. */
      const dxToPlayer=player.x-g.x,dyToPlayer=player.y-g.y;
      const candidates=[];
      if(Math.abs(dxToPlayer)>=Math.abs(dyToPlayer)&&dxToPlayer!==0)candidates.push({dx:Math.sign(dxToPlayer),dy:0});
      if(dyToPlayer!==0)candidates.push({dx:0,dy:Math.sign(dyToPlayer)});
      if(dxToPlayer!==0&&!candidates.some(d=>d.dx===Math.sign(dxToPlayer)&&d.dy===0))candidates.push({dx:Math.sign(dxToPlayer),dy:0});

      let second=null;
      for(const d of candidates){
        const nx=g.x+d.dx,ny=g.y+d.dy;
        if(nx<0||ny<0||nx>=cols||ny>=rows||sameCell({x:nx,y:ny},levelStart))continue;
        const key=d.dx===1?'right':d.dx===-1?'left':d.dy===1?'down':'up';
        const opp=oppositeKey225(key);
        if(maze[g.y][g.x].walls[key]){
          maze[g.y][g.x].walls[key]=false;
          maze[ny][nx].walls[opp]=false;
          if(typeof elephantBursts225!=='undefined')elephantBursts225.push({x:g.x+d.dx*.5,y:g.y+d.dy*.5,start:t,duration:900,dx:d.dx,dy:d.dy});
          if(typeof elephantBoomSound225==='function')elephantBoomSound225();
        }
        second={x:nx,y:ny};
        break;
      }
      if(!second)second=chooseGuardianNext(g);
      if(second&&Math.abs(second.x-g.x)+Math.abs(second.y-g.y)===1&&!sameCell(second,levelStart)){
        g.x=second.x;g.y=second.y;
        if(typeof guardianCanCapture223==='function'&&guardianCanCapture223(g))resetToStart();
      }
    }
  }
  if(g.kind==='parrot'&&moved)parrotMoved30(g,t);
};

/* ---------- GUARDIÁN DEL VIENTO ---------- */
const WIND_WHIRL_LIFE_30=12000;
const WIND_CONFUSION_30=8000;
const WIND_DROP_EVERY_MOVES_30=7;
let windWhirlpools30=[];

/* Se desactiva el pájaro anónimo: ahora el viento pertenece al loro. */
if(typeof BIRD_LEVELS_222!=='undefined'&&BIRD_LEVELS_222.clear)BIRD_LEVELS_222.clear();

function farFromWind30(c){return windWhirlpools30.every(w=>Math.abs(w.x-c.x)+Math.abs(w.y-c.y)>=4)}
function parrotMoved30(g,t){
  if(!g||g.kind!=='parrot')return;
  g.windMoveCount30=(g.windMoveCount30||0)+1;
  if(g.windMoveCount30%WIND_DROP_EVERY_MOVES_30!==0)return;
  let drop={x:g.x,y:g.y};
  if(!farFromWind30(drop)){
    const opts=allCells().filter(c=>neighborsOf(c.x,c.y).length>0&&farFromWind30(c)&&!sameCell(c,levelStart)&&!sameCell(c,exit));
    opts.sort((a,b)=>Math.abs(b.x-g.x)+Math.abs(b.y-g.y)-Math.abs(a.x-g.x)-Math.abs(a.y-g.y));
    if(opts.length)drop=opts[0];
  }
  windWhirlpools30=windWhirlpools30.filter(w=>w.expiresAt>t);
  windWhirlpools30.push({...drop,bornAt:t,expiresAt:t+WIND_WHIRL_LIFE_30,used:false});
  while(windWhirlpools30.length>3)windWhirlpools30.shift();
  g.avoidWind30={x:drop.x,y:drop.y,until:t+5500};
  tone(700,.08,'triangle',.022);tone(510,.11,'triangle',.018,.06);
}

/* Tras dejar viento, el loro prefiere alejarse del remolino reciente. */
const chooseGuardianNextWind30Base=chooseGuardianNext;
chooseGuardianNext=function(g){
  if(g&&g.kind==='parrot'&&g.avoidWind30&&performance.now()<g.avoidWind30.until){
    const ns=DIRS.map(d=>({x:g.x+d.dx,y:g.y+d.dy})).filter(n=>n.x>=0&&n.y>=0&&n.x<cols&&n.y<rows);
    ns.sort((a,b)=>(Math.abs(b.x-g.avoidWind30.x)+Math.abs(b.y-g.avoidWind30.y))-(Math.abs(a.x-g.avoidWind30.x)+Math.abs(a.y-g.avoidWind30.y)));
    if(ns.length)return ns[0];
  }
  return chooseGuardianNextWind30Base(g);
};

/* Ocho segundos de confusión; otro remolino no reinicia el efecto. */
activateWhirlpoolEffect21=function(){
  const now=performance.now();
  if(whirlpoolEffectUntil21>now)return;
  controlsReversed=true;whirlpoolEffectUntil21=now+WIND_CONFUSION_30;
  if(whirlpoolTimer21)clearTimeout(whirlpoolTimer21);
  whirlpoolTimer21=setTimeout(()=>{clearWhirlpoolEffect21();glassesSound();draw()},WIND_CONFUSION_30);
  glassesSound();
};

const checkCellGuardians30Base=checkCell;
checkCell=function(){
  const now=performance.now();
  windWhirlpools30=windWhirlpools30.filter(w=>w.expiresAt>now);
  for(const w of windWhirlpools30){
    if(!w.used&&sameCell(player,w)){
      w.used=true;activateWhirlpoolEffect21();
      break;
    }
  }
  checkCellGuardians30Base();
};

function drawWindWhirlpools30(size,ox,oy){
  const now=performance.now();
  windWhirlpools30=windWhirlpools30.filter(w=>w.expiresAt>now);
  for(const w of windWhirlpools30){
    const left=w.expiresAt-now;
    /* Tres titileos en el último segundo. */
    const visible=left>1000||Math.floor((1000-left)/166)%2===0;
    if(!visible)continue;
    const cx=ox+(w.x+.5)*size,cy=oy+(w.y+.5)*size;
    ctx.save();ctx.translate(cx,cy);ctx.rotate(animTime*3.3);
    ctx.strokeStyle='#7654c7';ctx.lineWidth=Math.max(3,size*.055);
    for(let r=.09;r<.35;r+=.075){ctx.beginPath();ctx.arc(0,0,size*r,0,Math.PI*1.55);ctx.stroke();ctx.rotate(.78)}
    ctx.restore();
  }
}

const advanceGuardianGuardians30Base=advanceGuardian;
advanceGuardian=function(t){
  const herd=typeof allGuardians224==='function'?allGuardians224():[guardian,extraGuardian].filter(Boolean);
  for(const g of herd)decaySuspicion30(g,t);
  windWhirlpools30=windWhirlpools30.filter(w=>w.expiresAt>t);
  advanceGuardianGuardians30Base(t);
};

const drawGuardians30Base=draw;
draw=function(){
  drawGuardians30Base();if(!maze)return;
  const {size,ox,oy}=cellMetrics();drawWindWhirlpools30(size,ox,oy);
};

const makeGuardianGuardians30Base=makeGuardian;
makeGuardian=function(kind,offset=0){
  const g=makeGuardianGuardians30Base(kind,offset);if(!g)return g;
  if(isAttentive30(g)){initAttentive30(g);g.name='Guardián Atento'}
  if(g.kind==='elephant'){g.name='Guardián Demoledor';g.elephantSteps30=0;g.patrolMemory30=[]}
  if(g.kind==='sloth')g.name='Guardián Dormilón';
  if(g.kind==='turtle')g.name='Guardián Incansable';
  if(g.kind==='parrot'){g.name='Guardián del Viento';g.windMoveCount30=0}
  return g;
};

const buildLevelGuardians30Base=buildLevel;
buildLevel=function(n){
  windWhirlpools30=[];attentiveLastInput30={key:'',at:0};
  buildLevelGuardians30Base(n);
  const herd=typeof allGuardians224==='function'?allGuardians224():[guardian,extraGuardian].filter(Boolean);
  for(const g of herd){
    if(isAttentive30(g))initAttentive30(g);
    if(isElephant30(g)){g.elephantSteps30=0;g.patrolMemory30=[]}
    if(g.kind==='parrot')g.windMoveCount30=0;
  }
};


/* ===== Bloque JavaScript original 20 ===== */

'use strict';
/* =========================================================
   VERSIÓN 3.0 — LOS BOSQUES · PASADA 1
   Nombres de escenarios + Guardián Incansable definitivo.
   ========================================================= */

const SCENE_NAMES_30=[
  '',
  'Camino de la Semilla',
  'Camino de la Hoja',
  'Camino de la Hoja II',
  'Sendero del Brote',
  'Sendero de la Rama',
  'Sendero de la Rama II',
  'Camino del Claro',
  'Sendero de las Raíces',
  'Camino de las Mariposas',
  'Sendero del Arroyo',
  'Camino de la Sombra',
  'Sendero del Viento Suave',
  'Camino de la Piedra',
  'Sendero del Eco Lejano',
  'Camino del Bosque Antiguo',
  'Sendero de la Niebla',
  'Camino del Gran Claro',
  'Bosque del Viento',
  'Bosque del Eco',
  'Bosque del Gran Árbol'
];

const sceneLabel30=document.getElementById('sceneLabel');
function updateSceneName30(){
  if(sceneLabel30)sceneLabel30.textContent=SCENE_NAMES_30[level]||('Camino '+level);
  document.title=`Nito y el Laberinto — ${SCENE_NAMES_30[level]||''}`;
}
const updateHudScenes30Base=updateHud;
updateHud=function(){updateHudScenes30Base();updateSceneName30();};
updateSceneName30();

/* Selector: conserva números compactos, pero cada botón revela el nombre
   sin convertirlo en una explicación de mecánicas. */
const showLevelsScenes30Base=showLevels;
showLevels=function(returnTo='start'){
  showLevelsScenes30Base(returnTo);
  const buttons=[...document.querySelectorAll('#levelGrid .level-btn')];
  buttons.forEach((b,i)=>{b.title=SCENE_NAMES_30[i+1]||'';b.setAttribute('aria-label',SCENE_NAMES_30[i+1]||`Camino ${i+1}`)});
};

/* ---------- GUARDIÁN INCANSABLE ---------- */
const TURTLE_SLOW_MS_30=2200;
const TURTLE_PUSH_GRACE_MS_30=900;
let turtleSlowUntil30=0;
let turtleMoveGate30=0;
let turtlePushGraceUntil30=0;
let turtleImpact30=null;

function isTurtle30(g){return Boolean(g&&(g.kind==='turtle'||g.icon==='🐢'))}
function directionKey30(dx,dy){return dx===1?'right':dx===-1?'left':dy===1?'down':'up'}
function oppositeKey30(key){return {right:'left',left:'right',up:'down',down:'up'}[key]}

function canStep30(x,y,dx,dy){
  if(!maze||x<0||y<0||x>=cols||y>=rows)return false;
  const key=directionKey30(dx,dy),nx=x+dx,ny=y+dy;
  return nx>=0&&ny>=0&&nx<cols&&ny<rows&&!maze[y][x].walls[key];
}

/* Empuja hasta tres casillas, pero solo por pasajes realmente abiertos.
   Si el corredor termina, usa la última casilla válida. */
function findTurtlePushDestination30(start,dx,dy){
  let x=start.x,y=start.y,best=null;
  for(let i=0;i<3;i++){
    if(!canStep30(x,y,dx,dy))break;
    x+=dx;y+=dy;
    if(!sameCell({x,y},exit))best={x,y};
  }
  if(best)return best;
  const options=neighborsOf(start.x,start.y)
    .filter(n=>!sameCell(n,exit))
    .sort((a,b)=>{
      const da=Math.abs(a.x-start.x-dx)+Math.abs(a.y-start.y-dy);
      const db=Math.abs(b.x-start.x-dx)+Math.abs(b.y-start.y-dy);
      return da-db;
    });
  return options[0]||null;
}

function turtlePush30(g,dx,dy,t=performance.now()){
  if(!g||t<turtlePushGraceUntil30)return false;
  let dest=findTurtlePushDestination30(player,dx,dy);
  if(dest){player={x:dest.x,y:dest.y};}
  turtleSlowUntil30=t+TURTLE_SLOW_MS_30;
  turtlePushGraceUntil30=t+TURTLE_PUSH_GRACE_MS_30;
  turtleImpact30={x:player.x,y:player.y,start:t,duration:520};
  tone(115,.16,'square',.045);tone(76,.24,'triangle',.035,.07);
  moveLock=true;setTimeout(()=>{moveLock=false},180);
  updateHud();draw();
  return Boolean(dest);
}

/* La tortuga nunca captura ni reinicia: su castigo es posición + lentitud. */
const guardianCanCaptureTurtle30Base=guardianCanCapture223;
guardianCanCapture223=function(g=null){
  if(g&&isTurtle30(g))return false;
  if(!g){
    const herd=typeof allGuardians224==='function'?allGuardians224():[guardian,extraGuardian].filter(Boolean);
    return herd.some(x=>!isTurtle30(x)&&guardianCanCaptureTurtle30Base(x));
  }
  return guardianCanCaptureTurtle30Base(g);
};
guardianTouchesNito21=function(){return guardianCanCapture223()};
activeGuardianTouch222=function(g){return guardianCanCapture223(g)};

/* Siempre calcula el camino más corto hacia Nito. */
const chooseGuardianNextTurtle30Base=chooseGuardianNext;
chooseGuardianNext=function(g){
  if(isTurtle30(g)){
    const path=shortestPath({x:g.x,y:g.y},player);
    if(path.length>1)return path[1];
  }
  return chooseGuardianNextTurtle30Base(g);
};

/* Movimiento propio: si llega a Nito, ocupa su casilla anterior y lo empuja
   en la misma dirección de avance. Nunca se detiene a patrullar. */
const moveOneGuardianTurtle30Base=moveOneGuardian;
moveOneGuardian=function(g,t){
  if(!isTurtle30(g)){moveOneGuardianTurtle30Base(g,t);return}
  if(!g||!playing||t<g.nextAt||t<g.pauseUntil)return;
  const next=chooseGuardianNext(g);if(!next){g.nextAt=t+(g.step||1850);return}
  const old={x:g.x,y:g.y};
  const dx=next.x-g.x,dy=next.y-g.y;
  if(sameCell(next,player)){
    const originalPlayer={x:player.x,y:player.y};
    const pushed=turtlePush30(g,dx,dy,t);
    if(pushed){g.x=originalPlayer.x;g.y=originalPlayer.y;}
    else {g.x=old.x;g.y=old.y;}
  }else{
    g.x=next.x;g.y=next.y;
  }
  g.nextAt=t+(g.step||1850);g.pauseUntil=0;
};

/* Si Nito intenta entrar en la tortuga, ella lo devuelve por donde vino. */
const tryMoveTurtle30Base=tryMove;
tryMove=function(dx,dy){
  const now=performance.now();
  if(now<turtleSlowUntil30&&now<turtleMoveGate30)return;
  const before={x:player.x,y:player.y};
  tryMoveTurtle30Base(dx,dy);
  const moved=!sameCell(before,player);
  if(moved&&now<turtleSlowUntil30)turtleMoveGate30=now+230;
  const herd=typeof allGuardians224==='function'?allGuardians224():[guardian,extraGuardian].filter(Boolean);
  const turtle=herd.find(g=>isTurtle30(g)&&sameCell(g,player));
  if(turtle){
    const collision={x:player.x,y:player.y};
    const pushed=turtlePush30(turtle,-dx,-dy,performance.now());
    if(!pushed)player=before;
    turtle.x=collision.x;turtle.y=collision.y;
  }
};

function drawTurtleStatus30(size,ox,oy){
  const now=performance.now();
  if(now<turtleSlowUntil30){
    const cx=ox+(player.x+.5)*size,cy=oy+(player.y+.5)*size-size*.38;
    ctx.save();ctx.globalAlpha=.55+.35*Math.sin(animTime*10);
    ctx.font=`${Math.max(14,size*.22)}px Arial`;ctx.textAlign='center';ctx.fillText('💫',cx,cy);ctx.restore();
  }
  if(turtleImpact30){
    const p=(now-turtleImpact30.start)/turtleImpact30.duration;
    if(p>=1)turtleImpact30=null;
    else{
      const cx=ox+(turtleImpact30.x+.5)*size,cy=oy+(turtleImpact30.y+.5)*size;
      ctx.save();ctx.globalAlpha=1-p;ctx.strokeStyle='#fff1a8';ctx.lineWidth=Math.max(3,size*.05);
      ctx.beginPath();ctx.arc(cx,cy,size*(.15+.48*p),0,Math.PI*2);ctx.stroke();ctx.restore();
    }
  }
}
const drawTurtle30Base=draw;
draw=function(){drawTurtle30Base();if(!maze)return;const {size,ox,oy}=cellMetrics();drawTurtleStatus30(size,ox,oy)};

const makeGuardianTurtle30Base=makeGuardian;
makeGuardian=function(kind,offset=0){
  const g=makeGuardianTurtle30Base(kind,offset);
  if(g&&isTurtle30(g)){g.name='Guardián Incansable';g.pause=0;g.mode='chase'}
  return g;
};

const buildLevelTurtle30Base=buildLevel;
buildLevel=function(n){
  turtleSlowUntil30=0;turtleMoveGate30=0;turtlePushGraceUntil30=0;turtleImpact30=null;
  buildLevelTurtle30Base(n);updateSceneName30();
};


/* ===== Bloque JavaScript original 21 ===== */

'use strict';
/* =========================================================
   VERSIÓN 3.0 — LOS BOSQUES, PASADA 2
   - Campaña final de guardianes 18–20.
   - Guardián Atento sin saltos al abandonar una persecución.
   - Oído a través de paredes.
   - Saludos con línea de visión real.
   - Nivel 3 con cadena de dos botones.
   - Nivel 10 distribuido por todo el mapa.
   ========================================================= */

/* ---------- COMBINACIONES FINALES ---------- */
if(typeof CAMPAIGN_PLAN_224!=='undefined'){
  CAMPAIGN_PLAN_224[18]={...(CAMPAIGN_PLAN_224[18]||{}),guardians:['parrot','turtle']};
  CAMPAIGN_PLAN_224[19]={...(CAMPAIGN_PLAN_224[19]||{}),guardians:['sloth','sloth','elephant']};
  CAMPAIGN_PLAN_224[20]={...(CAMPAIGN_PLAN_224[20]||{}),guardians:['gorilla1','elephant','turtle']};
}
if(typeof GUARDIAN_PLAN!=='undefined'){
  GUARDIAN_PLAN[18]=['parrot','turtle'];
  GUARDIAN_PLAN[19]=['sloth','sloth','elephant'];
  GUARDIAN_PLAN[20]=['gorilla1','elephant','turtle'];
}

/* ---------- GUARDIÁN ATENTO ---------- */
/* Oye movimiento aunque haya paredes. La distancia, no la línea visual,
   regula cuánto aumenta su sospecha. */
straightVision30=function(g){
  if(!g)return null;
  const distance=Math.abs(player.x-g.x)+Math.abs(player.y-g.y);
  const max=Math.max(6,Math.ceil((cols+rows)*.40));
  if(distance>max)return null;
  return {distance,max};
};

function attentiveLocalPatrolV32(g){
  const ns=neighborsOf(g.x,g.y).map(n=>({x:n.x,y:n.y}));
  if(!ns.length)return null;
  if(!Array.isArray(g.attentiveMemoryV32))g.attentiveMemoryV32=[];
  const last=g.attentivePreviousV32||null;
  ns.sort((a,b)=>{
    const ar=g.attentiveMemoryV32.includes(cellKey(a))?1:0;
    const br=g.attentiveMemoryV32.includes(cellKey(b))?1:0;
    const ab=last&&sameCell(a,last)?1:0;
    const bb=last&&sameCell(b,last)?1:0;
    return ar-br||ab-bb;
  });
  const next=ns[0];
  g.attentivePreviousV32={x:g.x,y:g.y};
  g.attentiveMemoryV32.push(cellKey(next));
  if(g.attentiveMemoryV32.length>8)g.attentiveMemoryV32.shift();
  return next;
}

/* Al calmarse continúa desde la casilla real donde quedó. Nunca recupera
   un índice antiguo de patrulla, evitando el teletransporte. */
const chooseGuardianNextV32Base=chooseGuardianNext;
chooseGuardianNext=function(g){
  if(typeof isAttentive30==='function'&&isAttentive30(g)){
    initAttentive30(g);
    const target=g.suspicion30>=ATTENTIVE_CHASE_30?player:
      (g.suspicion30>=ATTENTIVE_INVESTIGATE_30?g.lastSeen30:null);
    if(target){
      const path=shortestPath({x:g.x,y:g.y},target);
      if(path.length>1)return path[1];
    }
    return attentiveLocalPatrolV32(g);
  }
  return chooseGuardianNextV32Base(g);
};

/* ---------- SALUDO DE LOS COMPAÑEROS ---------- */
function friendHasClearSightV32(){
  if(!friend||friend.found)return false;
  const dx=friend.x-player.x,dy=friend.y-player.y;
  const distance=Math.abs(dx)+Math.abs(dy);
  if(distance>2||distance===0)return false;
  if(dx!==0&&dy!==0)return false;
  const sx=Math.sign(dx),sy=Math.sign(dy);
  const key=sx===1?'right':sx===-1?'left':sy===1?'down':'up';
  let x=player.x,y=player.y;
  while(x!==friend.x||y!==friend.y){
    if(maze[y][x].walls[key])return false;
    x+=sx;y+=sy;
  }
  return true;
}
drawFriendWave240=function(size,ox,oy){
  if(!friendHasClearSightV32())return;
  const cx=ox+(friend.x+.5)*size,cy=oy+(friend.y+.5)*size;
  ctx.save();ctx.translate(cx+size*.27,cy-size*.22);ctx.rotate(Math.sin(animTime*8)*.35);
  ctx.font=`${Math.max(14,size*.25)}px Arial`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('👋',0,0);ctx.restore();
};

/* ---------- NIVEL 3: DOS BOTONES EN CADENA ---------- */
let level3ButtonAV32=null;
let level3ButtonBV32=null;
let level3SecondReleasedV32=false;

function setupLevel3ChainV32(){
  level3ButtonAV32=null;level3ButtonBV32=null;level3SecondReleasedV32=false;
  if(level!==3)return;
  /* Desactiva el botón antiguo para que no abra directamente la escuela. */
  level3Button=null;level3GateOpen=false;
  const main=new Set(shortestPath(levelStart,exit).map(cellKey));
  const dist=distancesFrom(levelStart);
  const forbidden=new Set([cellKey(levelStart),cellKey(exit)]);
  if(friend)forbidden.add(cellKey(friend));
  bananas.forEach(b=>forbidden.add(cellKey(b)));
  if(specialItem)forbidden.add(cellKey(specialItem));
  let candidates=allCells().filter(c=>!forbidden.has(cellKey(c))&&neighborsOf(c.x,c.y).length>0);
  /* Primer botón: arriba/derecha y fuera del camino principal si es posible. */
  candidates.sort((a,b)=>{
    const ao=main.has(cellKey(a))?1:0,bo=main.has(cellKey(b))?1:0;
    const as=(cols-1-a.x)+a.y,bs=(cols-1-b.x)+b.y;
    return ao-bo||as-bs||((dist.get(cellKey(b))||0)-(dist.get(cellKey(a))||0));
  });
  const a=candidates[0];
  if(!a)return;
  level3ButtonAV32={...a,pressed:false};forbidden.add(cellKey(a));
  /* Segundo botón: lejos del primero y en otro ramal. */
  candidates=allCells().filter(c=>!forbidden.has(cellKey(c))&&neighborsOf(c.x,c.y).length>0);
  candidates.sort((p,q)=>{
    const pd=Math.abs(p.x-a.x)+Math.abs(p.y-a.y),qd=Math.abs(q.x-a.x)+Math.abs(q.y-a.y);
    const po=main.has(cellKey(p))?1:0,qo=main.has(cellKey(q))?1:0;
    return qo-po||qd-pd||((dist.get(cellKey(q))||0)-(dist.get(cellKey(p))||0));
  });
  if(candidates[0])level3ButtonBV32={...candidates[0],pressed:false};
}

function pressLevel3ChainV32(){
  if(level!==3)return;
  if(level3ButtonAV32&&!level3ButtonAV32.pressed&&sameCell(player,level3ButtonAV32)){
    level3ButtonAV32.pressed=true;level3SecondReleasedV32=true;
    tone(360,.08,'square',.025);tone(560,.15,'triangle',.035,.06);
  }
  if(level3SecondReleasedV32&&level3ButtonBV32&&!level3ButtonBV32.pressed&&sameCell(player,level3ButtonBV32)){
    level3ButtonBV32.pressed=true;level3GateOpen=true;
    tone(420,.08,'square',.028);tone(660,.18,'triangle',.038,.07);
  }
}

function drawLevel3ButtonV32(b,size,ox,oy,active,locked=false){
  if(!b)return;
  const cx=ox+(b.x+.5)*size,cy=oy+(b.y+.5)*size;
  ctx.save();ctx.translate(cx,cy);
  ctx.globalAlpha=locked?.55:1;
  ctx.shadowColor=active?'rgba(100,235,125,.85)':'rgba(255,225,70,.85)';ctx.shadowBlur=size*.14;
  ctx.fillStyle=active?'#4eae61':locked?'#8e8a68':'#e8c438';ctx.strokeStyle='#654b1f';ctx.lineWidth=Math.max(2,size*.04);
  ctx.beginPath();ctx.ellipse(0,active?size*.045:0,size*.23,size*.15,0,0,Math.PI*2);ctx.fill();ctx.stroke();
  if(locked){
    ctx.shadowBlur=0;ctx.strokeStyle='#35643f';ctx.lineWidth=Math.max(3,size*.055);
    ctx.beginPath();ctx.moveTo(-size*.27,-size*.18);ctx.lineTo(size*.27,size*.18);ctx.moveTo(size*.27,-size*.18);ctx.lineTo(-size*.27,size*.18);ctx.stroke();
  }
  ctx.restore();
}

/* ---------- NIVEL 10: RECORRIDO EXTENDIDO ---------- */
function level10OccupiedV32(){
  const s=new Set([cellKey(levelStart),cellKey(exit)]);
  if(friend)s.add(cellKey(friend));
  bananas.forEach(b=>s.add(cellKey(b)));
  if(specialItem)s.add(cellKey(specialItem));
  const herd=typeof allGuardians224==='function'?allGuardians224():[];
  herd.forEach(g=>s.add(cellKey(g)));
  return s;
}
function level10ShortcutEdgesV32(){
  const base=pathLength(levelStart,exit),out=[];
  for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
    for(const d of [{dx:1,dy:0,key:'right',opp:'left'},{dx:0,dy:1,key:'down',opp:'up'}]){
      const nx=x+d.dx,ny=y+d.dy;
      if(nx>=cols||ny>=rows||!maze[y][x].walls[d.key])continue;
      maze[y][x].walls[d.key]=false;maze[ny][nx].walls[d.opp]=false;
      const len=pathLength(levelStart,exit);
      maze[y][x].walls[d.key]=true;maze[ny][nx].walls[d.opp]=true;
      const gain=Number.isFinite(len)&&Number.isFinite(base)?base-len:0;
      if(gain>=1)out.push({x,y,key:d.key,nx,ny,opp:d.opp,gain});
    }
  }
  return out.sort((a,b)=>b.gain-a.gain);
}
function rebuildLevel10SpreadV32(){
  if(level!==10||typeof colorButtons230==='undefined'||typeof colorGates230==='undefined')return;
  const colors=[['red','#e54848'],['yellow','#f0c928'],['blue','#3d75d6']];
  const used=level10OccupiedV32();
  const dist=distancesFrom(levelStart);
  const cells=allCells().filter(c=>!used.has(cellKey(c))&&neighborsOf(c.x,c.y).length>0)
    .sort((a,b)=>(dist.get(cellKey(a))||0)-(dist.get(cellKey(b))||0));
  const maxD=Math.max(1,...cells.map(c=>dist.get(cellKey(c))||0));
  const targets=[Math.max(2,maxD*.20),maxD*.55,maxD*.85];
  colorButtons230=[];pressedColors230=new Set();
  targets.forEach((target,i)=>{
    let best=null,bestScore=Infinity;
    for(const c of cells){
      if(used.has(cellKey(c)))continue;
      const spread=colorButtons230.reduce((m,b)=>Math.min(m,Math.abs(c.x-b.x)+Math.abs(c.y-b.y)),999);
      const score=Math.abs((dist.get(cellKey(c))||0)-target)+(spread<3?20:0);
      if(score<bestScore){best=c;bestScore=score;}
    }
    if(best){used.add(cellKey(best));colorButtons230.push({...best,id:colors[i][0],color:colors[i][1],pressed:false});}
  });
  const edges=level10ShortcutEdgesV32(),picked=[];
  for(const e of edges){
    if(picked.some(q=>Math.abs(q.x-e.x)+Math.abs(q.y-e.y)<3))continue;
    picked.push(e);if(picked.length===3)break;
  }
  colorGates230=[];
  colors.forEach((spec,i)=>{const e=picked[i];if(e)colorGates230.push({...e,id:spec[0],color:spec[1],requires:[spec[0]],open:false});});

  /* La tabla deja de estar junto al rompecabezas: queda en un rincón lejano,
     preferentemente un callejón, para que el resto del mapa tenga valor. */
  if(typeof logicChallenge!=='undefined'&&logicChallenge&&logicChallenge.kind==='bridge'){
    const main=new Set(shortestPath(levelStart,exit).map(cellKey));
    let options=allCells().filter(c=>!used.has(cellKey(c))&&!main.has(cellKey(c))&&neighborsOf(c.x,c.y).length===1);
    if(!options.length)options=allCells().filter(c=>!used.has(cellKey(c))&&!main.has(cellKey(c)));
    options.sort((a,b)=>(dist.get(cellKey(b))||0)-(dist.get(cellKey(a))||0));
    if(options[0])logicChallenge.item={...options[0]};
  }
}

/* ---------- INTEGRACIÓN ---------- */
const buildLevelV32Base=buildLevel;
buildLevel=function(n){
  buildLevelV32Base(n);
  setupLevel3ChainV32();
  rebuildLevel10SpreadV32();
  draw();
};

const checkCellV32Base=checkCell;
checkCell=function(){pressLevel3ChainV32();checkCellV32Base();};

const drawV32Base=draw;
draw=function(){
  drawV32Base();if(!maze)return;
  const {size,ox,oy}=cellMetrics();
  if(level===3){
    drawLevel3ButtonV32(level3ButtonAV32,size,ox,oy,Boolean(level3ButtonAV32&&level3ButtonAV32.pressed),false);
    drawLevel3ButtonV32(level3ButtonBV32,size,ox,oy,Boolean(level3ButtonBV32&&level3ButtonBV32.pressed),!level3SecondReleasedV32);
  }
};


/* ===== Bloque JavaScript original 22 ===== */

'use strict';
/* =========================================================
   NITO 3.1 — COMPAÑEROS, LLAVE Y EMBLEMAS DE LOS BOSQUES
   ========================================================= */

const STORY_CLASSMATES_31=[
  'Franchu','Martu','Lucy','Jose','Samy','Ori','Rousy','Vicky chiquita',
  'Vicky grande','Anto','Vitti','Ramirito','Santi','Francis','Leandrus',
  'Feli','Beltru','Lauti'
];

let extraFriends31=[];
let forestItems31=[];
let forestDoorUnlocked31=false;
let questPill31=null;

function storyIntro31(){
  const card=document.querySelector('#startOverlay .card');
  if(!card)return;
  const h=card.querySelector('h1');
  const ps=card.querySelectorAll('p');
  if(h)h.textContent='🌳 Nito y los compañeros perdidos';
  if(ps[0])ps[0].textContent='Nito es un nuevo compañerito del aula. Al llegar, descubre que sus compañeros todavía no llegaron a la escuela.';
  if(ps[1])ps[1].textContent='Nadie sabe dónde está el profe… ¿se habrá quedado dormido? Parece que Nito tendrá que encontrar a sus compañeros y acompañarlos hasta la escuela.';
}

function ensureQuestPill31(){
  if(questPill31&&questPill31.isConnected)return questPill31;
  questPill31=document.createElement('div');
  questPill31.className='pill';
  questPill31.id='forestQuestPill31';
  questPill31.style.display='none';
  document.querySelector('.hud')?.appendChild(questPill31);
  return questPill31;
}

function updateQuestHud31(){
  const pill=ensureQuestPill31();
  if(level<17){pill.style.display='none';return}
  pill.style.display='block';
  const got=forestItems31.filter(i=>i.got).length;
  const total=forestItems31.length;
  const icon=level===17?'🗝️':level===18?'🍃':level===19?'🔔':'🌳';
  pill.textContent=`${icon} ${got}/${total}`;
}

function occupiedForStory31(){
  const s=new Set([cellKey(levelStart),cellKey(exit)]);
  bananas.forEach(b=>{if(!b.got)s.add(cellKey(b));});
  if(friend&&!friend.found)s.add(cellKey(friend));
  extraFriends31.forEach(f=>{if(!f.found)s.add(cellKey(f));});
  if(specialItem&&!specialItem.got)s.add(cellKey(specialItem));
  if(typeof allGuardians224==='function')allGuardians224().forEach(g=>g&&s.add(cellKey(g)));
  for(const name of ['trampolines210','campaignWhirlpools250','colorButtons230','lightButtons230']){
    const a=globalThis[name];if(Array.isArray(a))a.forEach(o=>o&&s.add(cellKey(o)));
  }
  return s;
}

function pickSpreadCells31(count,seed=31){
  const used=occupiedForStory31();
  const dist=distancesFrom(levelStart);
  let cells=allCells().filter(c=>!used.has(cellKey(c))&&neighborsOf(c.x,c.y).length>0);
  cells.sort((a,b)=>(dist.get(cellKey(b))||0)-(dist.get(cellKey(a))||0));
  const chosen=[];
  while(cells.length&&chosen.length<count){
    let best=null,bestScore=-Infinity;
    for(const c of cells){
      const d=dist.get(cellKey(c))||0;
      const spread=chosen.length?Math.min(...chosen.map(q=>Math.abs(c.x-q.x)+Math.abs(c.y-q.y))):d;
      const score=d+spread*2+((c.x*17+c.y*31+seed)%7)*.01;
      if(score>bestScore){best=c;bestScore=score;}
    }
    if(!best)break;
    chosen.push({...best});used.add(cellKey(best));
    cells=cells.filter(c=>cellKey(c)!==cellKey(best));
  }
  return chosen;
}

function setupStoryObjectives31(){
  extraFriends31=[];forestItems31=[];forestDoorUnlocked31=false;

  if(level<=15){
    if(friend)friend.name=STORY_CLASSMATES_31[level-1];
  }else if(level===16){
    if(friend)friend.name=STORY_CLASSMATES_31[15];
    const cells=pickSpreadCells31(2,160);
    extraFriends31=cells.map((c,i)=>({...c,found:false,name:STORY_CLASSMATES_31[16+i]}));
  }else{
    friend=null;
    const definitions={
      17:[{icon:'🗝️',name:'Llave del Bosque'}],
      18:[{icon:'🪶',name:'Pluma del Vendaval'},{icon:'🐢',name:'Escama Incansable'}],
      19:[{icon:'🍂',name:'Hoja del Sueño'},{icon:'🦷',name:'Colmillo Demoledor'}],
      20:[{icon:'👁️',name:'Ojo del Atento'},{icon:'🦷',name:'Colmillo Demoledor'},{icon:'🐢',name:'Escama Incansable'}]
    };
    const defs=definitions[level]||[];
    const cells=pickSpreadCells31(defs.length,level*71);
    forestItems31=defs.map((d,i)=>({...cells[i],...d,got:false,pulse:i*.9})).filter(i=>Number.isFinite(i.x));
  }
  forestDoorUnlocked31=level<17?true:false;
  updateQuestHud31();
}

function storyAllFriendsFound31(){
  return (!friend||friend.found)&&extraFriends31.every(f=>f.found);
}
function storyAllItemsFound31(){return forestItems31.length>0&&forestItems31.every(i=>i.got);}
function storyExitUnlocked31(){
  if(level<=16)return storyAllFriendsFound31();
  return storyAllItemsFound31();
}

function collectStoryObjectives31(){
  for(const f of extraFriends31){
    if(!f.found&&sameCell(player,f)){
      f.found=true;friendSound();
      if(!foundClassmates.includes(f.name)){
        foundClassmates.push(f.name);
        localStorage.setItem('nitoFoundClassmates',JSON.stringify(foundClassmates));
      }
      if(typeof addPolishBurst240==='function')addPolishBurst240(f.x,f.y,'spark',12);
    }
  }
  for(const item of forestItems31){
    if(!item.got&&sameCell(player,item)){
      item.got=true;
      tone(523,.11,'triangle',.035);tone(659,.13,'triangle',.04,.08);tone(784,.20,'sine',.035,.17);
      if(typeof addPolishBurst240==='function')addPolishBurst240(item.x,item.y,'spark',14);
    }
  }
  forestDoorUnlocked31=storyExitUnlocked31();
  updateQuestHud31();
}

function drawStoryItem31(item,size,ox,oy){
  if(item.got)return;
  const cx=ox+(item.x+.5)*size,cy=oy+(item.y+.5)*size+Math.sin(animTime*3+item.pulse)*size*.045;
  ctx.save();ctx.translate(cx,cy);
  const glow=.6+.4*Math.sin(animTime*4+item.pulse);
  ctx.shadowColor=`rgba(255,226,100,${glow})`;ctx.shadowBlur=size*.20;
  ctx.font=`${Math.max(24,size*.48)}px Arial`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(item.icon,0,0);
  ctx.shadowBlur=0;ctx.font=`900 ${Math.max(9,size*.13)}px Arial`;ctx.fillStyle='#4c3a22';
  ctx.fillText(item.name,0,-size*.35);ctx.restore();
}

function drawForestDoor31(x,y,size,ox,oy){
  const px=ox+x*size,py=oy+y*size;
  const open=forestDoorUnlocked31;
  ctx.save();ctx.translate(px+size/2,py+size/2);
  ctx.fillStyle='#5d4934';ctx.fillRect(-size*.34,-size*.38,size*.68,size*.76);
  ctx.fillStyle=open?'#b8e6a1':'#263b34';ctx.fillRect(-size*.24,-size*.28,size*.48,size*.58);
  ctx.strokeStyle='#d4b46c';ctx.lineWidth=Math.max(3,size*.055);ctx.strokeRect(-size*.34,-size*.38,size*.68,size*.76);
  if(!open){
    const total=Math.max(1,forestItems31.length),got=forestItems31.filter(i=>i.got).length;
    for(let i=0;i<total;i++){
      const angle=-Math.PI/2+(i-(total-1)/2)*.55;
      ctx.fillStyle=i<got?'#f6d45d':'#6d6856';ctx.beginPath();ctx.arc(Math.cos(angle)*size*.18,Math.sin(angle)*size*.12,size*.055,0,Math.PI*2);ctx.fill();
    }
  }else{
    ctx.fillStyle='rgba(255,245,174,.75)';ctx.beginPath();ctx.ellipse(0,size*.12,size*.17,size*.10,0,0,Math.PI*2);ctx.fill();
  }
  ctx.restore();
}

/* La escuela permanece en los primeros 16 caminos. Desde el 17 hay una puerta. */
const drawExit31Base=drawExit;
drawExit=function(x,y,size,ox,oy){
  if(level>=17)drawForestDoor31(x,y,size,ox,oy);else drawExit31Base(x,y,size,ox,oy);
};

const buildLevel31Base__block22=buildLevel;
buildLevel=function(n){
  buildLevel31Base__block22(n);
  setupStoryObjectives31();
  draw();
};

const checkCell31Base=checkCell;
checkCell=function(){
  collectStoryObjectives31();
  checkCell31Base();
};

const finishLevel31Base=finishLevel;
finishLevel=function(){
  if(!storyExitUnlocked31()){
    bumpSound();
    return;
  }
  const finishedLevel=level;
  const rescuedNames=[];
  if(finishedLevel<=16){
    if(friend&&friend.found)rescuedNames.push(friend.name);
    extraFriends31.filter(f=>f.found).forEach(f=>rescuedNames.push(f.name));
  }
  finishLevel31Base();
  if(finishedLevel<=16){
    const remaining=finishedLevel<16?18-finishedLevel:0;
    const apply=()=>{
      const overlay=document.getElementById('messageOverlay');
      const text=document.getElementById('messageText');
      if(!overlay||overlay.style.display==='none'||!text)return false;
      const who=rescuedNames.length===1?rescuedNames[0]:rescuedNames.join(', ');
      text.innerHTML=remaining>0
        ?`Acompañaste a <strong>${who}</strong> hasta la escuela.<br><br>Faltan <strong>${remaining}</strong> compañeros por encontrar.`
        :`Acompañaste a <strong>${who}</strong> hasta la escuela.<br><br><strong>¡Los 18 compañeros ya están a salvo!</strong>`;
      return true;
    };
    let tries=0;const timer=setInterval(()=>{tries++;if(apply()||tries>20)clearInterval(timer);},100);
  }
};

const draw31Base=draw;
draw=function(){
  draw31Base();if(!maze)return;
  const {size,ox,oy}=cellMetrics();
  extraFriends31.forEach(f=>{if(!f.found)drawFriend(f.x,f.y,size,ox,oy,f.name);});
  forestItems31.forEach(i=>drawStoryItem31(i,size,ox,oy));
};

/* La meta final no muestra explicación adicional: conserva solo la imagen final. */
const originalFinalShow31=typeof showFinalAdventure==='function'?showFinalAdventure:null;
if(originalFinalShow31){
  showFinalAdventure=function(){
    document.getElementById('messageOverlay').style.display='none';
    originalFinalShow31();
  };
}

storyIntro31();
ensureQuestPill31();


/* ===== Bloque JavaScript original 23 ===== */

'use strict';
/* =========================================================
   REESTRUCTURACIÓN FINAL — NIVELES 16 A 20
   Mantiene intactos los niveles 1 a 15.
   ========================================================= */

/* Historia inicial solicitada. */
(function updateFinalStoryIntro(){
  const card=document.querySelector('#startOverlay .card');
  if(!card)return;
  const h=card.querySelector('h1');
  const ps=card.querySelectorAll('p');
  if(h)h.textContent='🌳 Nito y la Selva del Gran Árbol';
  if(ps[0])ps[0].textContent='Nito es nuevo en la Selva del Gran Árbol. Hoy el profe se quedó dormido y los niños lo están esperando.';
  if(ps[1])ps[1].textContent='Ayudá a Nito a encontrar a sus compañeritos y llevarlos a todos a la escuela.';
})();

/* Elimina por completo el sistema bugueado de botones ON/OFF y sus capas
   en la parte final de la aventura. */
if(typeof LIGHT_LEVELS_230!=='undefined'){
  LIGHT_LEVELS_230.delete(17);
  LIGHT_LEVELS_230.delete(18);
  LIGHT_LEVELS_230.delete(19);
  LIGHT_LEVELS_230.delete(20);
}
if(typeof DARK_LEVELS!=='undefined'){
  DARK_LEVELS.delete(17);
  DARK_LEVELS.delete(18);
  DARK_LEVELS.delete(19);
  DARK_LEVELS.delete(20);
}

/* Orden definitivo de guardianes. */
if(typeof CAMPAIGN_PLAN_224!=='undefined'){
  CAMPAIGN_PLAN_224[16]={guardians:[]};
  CAMPAIGN_PLAN_224[17]={guardians:[]};
  CAMPAIGN_PLAN_224[18]={guardians:['turtle','parrot']};
  CAMPAIGN_PLAN_224[19]={guardians:['elephant','sloth','sloth','sloth']};
  CAMPAIGN_PLAN_224[20]={guardians:['gorilla2','elephant','turtle']};
}
if(typeof GUARDIAN_PLAN!=='undefined'){
  GUARDIAN_PLAN[16]=[];
  GUARDIAN_PLAN[17]=[];
  GUARDIAN_PLAN[18]=['turtle','parrot'];
  GUARDIAN_PLAN[19]=['elephant','sloth','sloth','sloth'];
  GUARDIAN_PLAN[20]=['gorilla2','elephant','turtle'];
}

/* Un cuarto guardián para los tres perezosos del nivel 19. */
let finalExtraGuardians=[];
const allGuardiansFinalBase=typeof allGuardians224==='function'?allGuardians224:null;
allGuardians224=function(){
  const base=allGuardiansFinalBase?allGuardiansFinalBase():[guardian,extraGuardian,thirdGuardian224].filter(Boolean);
  return [...base,...finalExtraGuardians].filter(Boolean);
};

const placeGuardianFinalBase=placeGuardian;
placeGuardian=function(){
  finalExtraGuardians=[];
  placeGuardianFinalBase();
  if(level===19&&typeof makeGuardian==='function'){
    const fourth=makeGuardian('sloth',3);
    if(fourth){
      if(typeof shiftGuardianStart224==='function')shiftGuardianStart224(fourth,allGuardiansFinalBase?allGuardiansFinalBase():[]);
      fourth.nextAt=performance.now()+2450;
      if(typeof isSloth222==='function'&&isSloth222(fourth))fourth.slothCycleStart222=performance.now();
      finalExtraGuardians.push(fourth);
    }
  }
};

const advanceGuardianFinalBase=advanceGuardian;
advanceGuardian=function(t){
  advanceGuardianFinalBase(t);
  for(const g of finalExtraGuardians){
    if(typeof moveOneGuardian==='function')moveOneGuardian(g,t);
  }
};

/* Objetivos definitivos. En el 16 deben rescatarse tres compañeros.
   Desde el 17, todos los objetos son obligatorios para abrir la puerta. */
const setupStoryObjectivesFinalBase=setupStoryObjectives31;
setupStoryObjectives31=function(){
  setupStoryObjectivesFinalBase();
  if(level===18){
    const defs=[
      {icon:'🐢',name:'Caparazón de la Tortuga'},
      {icon:'🪶',name:'Pluma del Loro'}
    ];
    const cells=pickSpreadCells31(defs.length,1808);
    forestItems31=defs.map((d,i)=>({...cells[i],...d,got:false,pulse:i*.9})).filter(i=>Number.isFinite(i.x));
  }else if(level===19){
    const defs=[
      {icon:'🦷',name:'Colmillo del Elefante'},
      {icon:'🍂',name:'Hoja del Perezoso I'},
      {icon:'🍂',name:'Hoja del Perezoso II'},
      {icon:'🍂',name:'Hoja del Perezoso III'}
    ];
    const cells=pickSpreadCells31(defs.length,1909);
    forestItems31=defs.map((d,i)=>({...cells[i],...d,got:false,pulse:i*.8})).filter(i=>Number.isFinite(i.x));
  }else if(level===20){
    const defs=[
      {icon:'👁️',name:'Ojo del Gorila'},
      {icon:'🦷',name:'Colmillo del Elefante'},
      {icon:'🐢',name:'Caparazón de la Tortuga'}
    ];
    const cells=pickSpreadCells31(defs.length,2020);
    forestItems31=defs.map((d,i)=>({...cells[i],...d,got:false,pulse:i*.9})).filter(i=>Number.isFinite(i.x));
  }
  forestDoorUnlocked31=storyExitUnlocked31();
  updateQuestHud31();
};

/* Puerta grande de castillo/fantasía para los niveles 17 a 20. */
drawForestDoor31=function(x,y,size,ox,oy){
  const px=ox+x*size,py=oy+y*size,open=forestDoorUnlocked31;
  ctx.save();ctx.translate(px+size/2,py+size/2);
  ctx.shadowColor='rgba(40,24,12,.55)';ctx.shadowBlur=size*.10;
  ctx.fillStyle='#74604a';
  ctx.fillRect(-size*.44,-size*.43,size*.88,size*.86);
  ctx.fillStyle='#8c7658';
  ctx.fillRect(-size*.49,-size*.40,size*.16,size*.80);
  ctx.fillRect(size*.33,-size*.40,size*.16,size*.80);
  ctx.fillRect(-size*.49,-size*.50,size*.98,size*.16);
  ctx.shadowBlur=0;
  ctx.fillStyle=open?'#d7f2b9':'#37281f';
  ctx.beginPath();
  ctx.moveTo(-size*.30,size*.36);ctx.lineTo(-size*.30,-size*.12);
  ctx.arc(0,-size*.12,size*.30,Math.PI,0);
  ctx.lineTo(size*.30,size*.36);ctx.closePath();ctx.fill();
  ctx.strokeStyle='#d7b45f';ctx.lineWidth=Math.max(3,size*.05);ctx.stroke();
  if(!open){
    ctx.fillStyle='#d7b45f';ctx.fillRect(-size*.045,size*.02,size*.09,size*.22);
    ctx.beginPath();ctx.arc(0,-size*.01,size*.09,0,Math.PI*2);ctx.fill();
    const total=Math.max(1,forestItems31.length),got=forestItems31.filter(i=>i.got).length;
    for(let i=0;i<total;i++){
      const xx=(i-(total-1)/2)*size*.14;
      ctx.fillStyle=i<got?'#ffe16c':'#6e6758';ctx.beginPath();ctx.arc(xx,size*.29,size*.045,0,Math.PI*2);ctx.fill();
    }
  }else{
    const glow=ctx.createRadialGradient(0,0,0,0,0,size*.38);
    glow.addColorStop(0,'rgba(255,250,180,.95)');glow.addColorStop(1,'rgba(174,232,140,.15)');
    ctx.fillStyle=glow;ctx.fillRect(-size*.30,-size*.38,size*.60,size*.74);
  }
  ctx.restore();
};

/* Aviso único antes del bosque profundo. Los niveles 18 y 19 no anticipan nada. */
let forestWarningShownFinal=false;
const buildLevelFinalBase=buildLevel;
buildLevel=function(n){
  buildLevelFinalBase(n);
  if(typeof lightButtons230!=='undefined')lightButtons230=[];
  if(typeof lightOn230!=='undefined')lightOn230=true;
  if(typeof lightPulse230!=='undefined')lightPulse230=0;
  if(n===17&&!forestWarningShownFinal){
    forestWarningShownFinal=true;
    showToast('⚠️ Estás por entrar en los bosques más profundos y protegidos. Tené cuidado…');
  }
  draw();
};

/* Los nuevos guardianes adicionales también se dibujan. */
const drawFinalBossBase=draw;
draw=function(){
  drawFinalBossBase();
  if(!maze||!finalExtraGuardians.length)return;
  const {size,ox,oy}=cellMetrics();
  for(const g of finalExtraGuardians){
    if(typeof drawGuardian33==='function')drawGuardian33(g,size,ox,oy);
    else{
      const cx=ox+(g.x+.5)*size,cy=oy+(g.y+.5)*size;
      ctx.save();ctx.font=`${Math.max(24,size*.58)}px Arial`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(g.icon||'🦥',cx,cy);ctx.restore();
    }
  }
};

/* En 18 y 19 se conserva el misterio: el cartel final no enumera guardianes
   ni explica qué aparecerá después; solo confirma que la puerta se abrió. */
const finishLevelFinalMysteryBase=finishLevel;
finishLevel=function(){
  const finished=level;
  finishLevelFinalMysteryBase();
  if((finished===18||finished===19)&&document.getElementById('messageOverlay').style.display!=='none'){
    const title=document.getElementById('messageTitle');
    const text=document.getElementById('messageText');
    if(title)title.textContent='🚪 La puerta se abrió';
    if(text)text.innerHTML='';
  }
};

/* =========================================================
   AJUSTES FINALES SOLICITADOS — NIVELES 7, 10, 11, 12, 14, 15 Y 16
   Capa aislada para no modificar el comportamiento de otros niveles.
   ========================================================= */

/* Tortugas nuevas y elefante diferido. */
if(typeof CAMPAIGN_PLAN_224!=='undefined'){
  CAMPAIGN_PLAN_224[10]={...(CAMPAIGN_PLAN_224[10]||{}),guardians:['turtle']};
  CAMPAIGN_PLAN_224[11]={...(CAMPAIGN_PLAN_224[11]||{}),guardians:['turtle'],dark:true};
  CAMPAIGN_PLAN_224[14]={...(CAMPAIGN_PLAN_224[14]||{}),guardians:[],whirlpools:2};
}
if(typeof GUARDIAN_PLAN!=='undefined'){
  GUARDIAN_PLAN[10]=['turtle'];
  GUARDIAN_PLAN[11]=['turtle'];
  delete GUARDIAN_PLAN[14];
}

/* Se eliminan todos los trampolines de la campaña. */
setupCampaignTrampolines250=function(){campaignTrampolines250=[]};

function removeAllTrampolinesFinal(){
  if(typeof campaignTrampolines250!=='undefined')campaignTrampolines250=[];
  if(typeof level4Trampoline!=='undefined')level4Trampoline=null;
  if(typeof level4Landing!=='undefined')level4Landing=null;
  if(typeof level9Trampoline42!=='undefined')level9Trampoline42=null;
  if(typeof level9Landing42!=='undefined')level9Landing42=null;
  if(typeof trampolineFlight41!=='undefined')trampolineFlight41=null;
  if(typeof campaignFlightBusy250!=='undefined')campaignFlightBusy250=false;
  if(typeof trampolineBusy!=='undefined')trampolineBusy=false;
}

function occupiedForFinalAdjustments(){
  const used=new Set([cellKey(levelStart),cellKey(exit)]);
  bananas.forEach(b=>used.add(cellKey(b)));
  if(specialItem)used.add(cellKey(specialItem));
  if(typeof logicChallenge!=='undefined'&&logicChallenge){
    if(logicChallenge.item)used.add(cellKey(logicChallenge.item));
    if(logicChallenge.a)used.add(cellKey(logicChallenge.a));
    if(logicChallenge.b)used.add(cellKey(logicChallenge.b));
  }
  if(typeof falseExit!=='undefined'&&falseExit)used.add(cellKey(falseExit));
  if(typeof campaignWhirlpools250!=='undefined')campaignWhirlpools250.forEach(w=>used.add(cellKey(w)));
  if(typeof allGuardians224==='function')allGuardians224().forEach(g=>used.add(cellKey(g)));
  return used;
}

/* Nivel 12: compañero en la zona inferior izquierda. */
function placeLevel12FriendFinal(){
  if(level!==12||!friend)return;
  const used=occupiedForFinalAdjustments();
  used.delete(cellKey(friend));
  const choices=allCells().filter(c=>
    !used.has(cellKey(c))&&
    c.x<=Math.max(1,Math.floor((cols-1)*.35))&&
    c.y>=Math.floor((rows-1)*.62)&&
    neighborsOf(c.x,c.y).length>0
  );
  choices.sort((a,b)=>{
    const scoreA=a.y*4-a.x*3+(neighborsOf(a.x,a.y).length===1?6:0);
    const scoreB=b.y*4-b.x*3+(neighborsOf(b.x,b.y).length===1?6:0);
    return scoreB-scoreA;
  });
  if(choices[0]){friend.x=choices[0].x;friend.y=choices[0].y}
}

function oppositeFinal(key){return({up:'down',down:'up',left:'right',right:'left'})[key]}
function openEdgeFinal(a,d){
  const b={x:a.x+d.dx,y:a.y+d.dy};
  if(b.x<0||b.y<0||b.x>=cols||b.y>=rows)return false;
  maze[a.y][a.x].walls[d.key]=false;
  maze[b.y][b.x].walls[oppositeFinal(d.key)]=false;
  return true;
}

/* Abre una pared interior cercana al compañero y elige la que más acorta
   el regreso hacia la salida. En el 7 también crea una vía de escape del ramal. */
function openRescueWallFinal(){
  if(level!==7&&level!==12)return;
  const origin={x:friend.x,y:friend.y};
  const around=[origin,...neighborsOf(origin.x,origin.y)];
  const before=shortestPath(origin,exit).length||9999;
  let best=null;
  for(const a of around){
    for(const d of DIRS){
      const b={x:a.x+d.dx,y:a.y+d.dy};
      if(b.x<=0||b.y<=0||b.x>=cols-1||b.y>=rows-1)continue;
      if(!maze[a.y][a.x].walls[d.key])continue;
      maze[a.y][a.x].walls[d.key]=false;
      maze[b.y][b.x].walls[oppositeFinal(d.key)]=false;
      const after=shortestPath(origin,exit).length||9999;
      maze[a.y][a.x].walls[d.key]=true;
      maze[b.y][b.x].walls[oppositeFinal(d.key)]=true;
      const gain=before-after;
      const near=Math.abs(a.x-origin.x)+Math.abs(a.y-origin.y);
      const score=gain*20-near;
      if(!best||score>best.score)best={a:{...a},d,score,gain};
    }
  }
  if(best)openEdgeFinal(best.a,best.d);
}

/* Distribuye los tres perezosos en sectores claramente distintos. */
function spreadLevel15SlothsFinal(){
  if(level!==15||typeof allGuardians224!=='function')return;
  const herd=allGuardians224().filter(g=>g&&g.kind==='sloth').slice(0,3);
  const targets=[
    {x:Math.floor(cols*.18),y:Math.floor(rows*.22)},
    {x:Math.floor(cols*.78),y:Math.floor(rows*.30)},
    {x:Math.floor(cols*.48),y:Math.floor(rows*.78)}
  ];
  const taken=new Set([cellKey(levelStart),cellKey(exit),friend?cellKey(friend):'']);
  herd.forEach((g,i)=>{
    let choices=(g.route||[]).filter(c=>!taken.has(cellKey(c)));
    if(!choices.length)choices=allCells().filter(c=>!taken.has(cellKey(c))&&neighborsOf(c.x,c.y).length>0);
    choices.sort((a,b)=>
      (Math.abs(a.x-targets[i].x)+Math.abs(a.y-targets[i].y))-
      (Math.abs(b.x-targets[i].x)+Math.abs(b.y-targets[i].y))
    );
    const p=choices[0];if(!p)return;
    const idx=(g.route||[]).findIndex(c=>sameCell(c,p));
    if(idx>=0)g.index=idx;
    g.x=p.x;g.y=p.y;taken.add(cellKey(p));
  });
}

/* Nivel 16: remolinos en tres zonas separadas. */
function spreadLevel16WhirlpoolsFinal(){
  if(level!==16||typeof campaignWhirlpools250==='undefined'||campaignWhirlpools250.length<3)return;
  const used=occupiedForFinalAdjustments();
  campaignWhirlpools250.forEach(w=>used.delete(cellKey(w)));
  const targets=[
    {x:Math.floor(cols*.18),y:Math.floor(rows*.18)},
    {x:Math.floor(cols*.80),y:Math.floor(rows*.25)},
    {x:Math.floor(cols*.45),y:Math.floor(rows*.80)}
  ];
  campaignWhirlpools250.slice(0,3).forEach((w,i)=>{
    const options=allCells().filter(c=>!used.has(cellKey(c))&&neighborsOf(c.x,c.y).length>0);
    options.sort((a,b)=>
      (Math.abs(a.x-targets[i].x)+Math.abs(a.y-targets[i].y))-
      (Math.abs(b.x-targets[i].x)+Math.abs(b.y-targets[i].y))
    );
    if(options[0]){w.x=options[0].x;w.y=options[0].y;used.add(cellKey(w))}
  });
}

/* Nivel 14: el elefante aparece a los cinco segundos. Su primera rotura es
   solamente visual sobre el borde más cercano a Nito; el límite sigue cerrado. */
let delayedElephantTokenFinal=0;
function nearestBorderBurstFinal(t){
  const distances=[
    {key:'left',v:player.x,x:-.48,y:player.y,dx:-1,dy:0},
    {key:'right',v:cols-1-player.x,x:cols-.52,y:player.y,dx:1,dy:0},
    {key:'up',v:player.y,x:player.x,y:-.48,dx:0,dy:-1},
    {key:'down',v:rows-1-player.y,x:player.x,y:rows-.52,dx:0,dy:1}
  ].sort((a,b)=>a.v-b.v)[0];
  if(typeof elephantBursts225!=='undefined'){
    elephantBursts225.push({x:distances.x,y:distances.y,start:t,duration:1100,dx:distances.dx,dy:distances.dy});
  }
  if(typeof elephantBoomSound225==='function')elephantBoomSound225();
}
function scheduleLevel14ElephantFinal(){
  delayedElephantTokenFinal++;
  const token=delayedElephantTokenFinal;
  if(level!==14)return;
  guardian=null;extraGuardian=null;thirdGuardian224=null;
  setTimeout(()=>{
    if(token!==delayedElephantTokenFinal||level!==14||!playing)return;
    const g=typeof makeGuardian==='function'?makeGuardian('elephant',0):null;
    if(!g)return;
    guardian=g;
    g.nextWallBreak225=Number.POSITIVE_INFINITY;
    const t=performance.now();
    g.nextAt=t+1200;
    nearestBorderBurstFinal(t);
    draw();
  },5000);
}

const placeGuardianRequestedFinalBase=placeGuardian;
placeGuardian=function(){
  placeGuardianRequestedFinalBase();
  if(level===14){guardian=null;extraGuardian=null;thirdGuardian224=null}
  if(level===15)spreadLevel15SlothsFinal();
};

const buildLevelRequestedFinalBase=buildLevel;
buildLevel=function(n){
  buildLevelRequestedFinalBase(n);
  removeAllTrampolinesFinal();
  if(n===12)placeLevel12FriendFinal();
  if(n===15)spreadLevel15SlothsFinal();
  if(n===16)spreadLevel16WhirlpoolsFinal();
  scheduleLevel14ElephantFinal();
  updateHud();draw();
};

const checkCellRequestedFinalBase=checkCell;
checkCell=function(){
  const rescuePending=(level===7||level===12)&&friend&&!friend.found&&sameCell(player,friend);
  checkCellRequestedFinalBase();
  if(rescuePending&&friend&&friend.found){openRescueWallFinal();draw()}
};

/* =========================================================
   AJUSTE FINAL DE COLISIONES — ESCONDITES, ELEFANTE Y TORTUGA
   ========================================================= */

const TURTLE_NITO_GRACE_MS_FINAL=1500;
let turtleNitoInvulnerableUntilFinal=0;

/* Una casilla con tres o cuatro paredes funciona como escondite.
   Se cuentan las paredes reales de la celda, sin distinguir su apariencia. */
function nitoHiddenByThreeWallsFinal(){
  if(!maze||!player||!maze[player.y]||!maze[player.y][player.x])return false;
  const walls=maze[player.y][player.x].walls;
  return ['up','right','down','left'].reduce((total,key)=>total+(walls[key]?1:0),0)>=3;
}

/* La gracia de la tortuga protege a Nito de todos los guardianes durante
   un momento breve, para que pueda abandonar el lugar al que fue empujado. */
const turtlePushFinalBase=turtlePush30;
turtlePush30=function(g,dx,dy,t=performance.now()){
  const pushed=turtlePushFinalBase(g,dx,dy,t);
  if(pushed)turtleNitoInvulnerableUntilFinal=t+TURTLE_NITO_GRACE_MS_FINAL;
  return pushed;
};

/* Regla definitiva de contacto. No depende de que Nito haya pulsado una tecla:
   si un guardián ocupa su casilla, lo atrapa salvo escondite o invulnerabilidad. */
guardianCanCapture223=function(g=null){
  const now=performance.now();
  if(now<turtleNitoInvulnerableUntilFinal)return false;
  if(typeof nitoIsInvulnerable21==='function'&&nitoIsInvulnerable21())return false;
  if((typeof trampolineFlight41!=='undefined'&&trampolineFlight41)||
     (typeof schoolEntry240!=='undefined'&&schoolEntry240))return false;
  if(nitoHiddenByThreeWallsFinal())return false;

  const canCapture=target=>Boolean(
    target&&sameCell(player,target)&&
    !(typeof isTurtle30==='function'&&isTurtle30(target))&&
    !(typeof isSloth222==='function'&&isSloth222(target)&&slothSleeping222(target))&&
    !(now<(target.stunnedUntil230||0))
  );

  if(g)return canCapture(g);
  const herd=typeof allGuardians224==='function'
    ?allGuardians224()
    :[guardian,extraGuardian,typeof thirdGuardian224!=='undefined'?thirdGuardian224:null].filter(Boolean);
  return herd.some(canCapture);
};
guardianTouchesNito21=function(){return guardianCanCapture223()};
activeGuardianTouch222=function(g){return guardianCanCapture223(g)};

/* Comprobación continua: también funciona cuando Nito permanece quieto y el
   guardián avanza sobre su casilla. */
const advanceGuardianStationaryFinalBase=advanceGuardian;
advanceGuardian=function(t){
  advanceGuardianStationaryFinalBase(t);
  if(!playing||nitoHiddenByThreeWallsFinal())return;
  const herd=typeof allGuardians224==='function'?allGuardians224():[];
  const captor=herd.find(g=>guardianCanCapture223(g));
  if(captor){
    const message=captor.message||'El guardián encontró a Nito. ¡Volvamos a intentar!';
    resetToStart(message);
  }
};

const buildLevelCollisionFinalBase=buildLevel;
buildLevel=function(n){
  turtleNitoInvulnerableUntilFinal=0;
  buildLevelCollisionFinalBase(n);
};


/* =========================================================
   COLISIONES DEFINITIVAS 2026-07-19
   Escondites de tres paredes, demolición doble e invulnerabilidad.
   Esta capa se carga al final para prevalecer sobre versiones anteriores.
   ========================================================= */

const NITO_TURTLE_INVULNERABILITY_MS_20260719=1800;
let nitoTurtleInvulnerableUntil20260719=0;
let guardianResetLockUntil20260719=0;

function nitoIsHidden20260719(){
  if(!maze||!player||!maze[player.y]||!maze[player.y][player.x])return false;
  const cell=maze[player.y][player.x];
  return ['up','right','down','left'].filter(key=>Boolean(cell.walls[key])).length>=3;
}

function guardianHerd20260719(){
  if(typeof allGuardians224==='function')return allGuardians224().filter(Boolean);
  return [
    typeof guardian!=='undefined'?guardian:null,
    typeof extraGuardian!=='undefined'?extraGuardian:null,
    typeof thirdGuardian224!=='undefined'?thirdGuardian224:null
  ].filter(Boolean);
}

function guardianMayDefeatNito20260719(g,now=performance.now()){
  if(!g||!playing||!sameCell(g,player))return false;
  if(now<nitoTurtleInvulnerableUntil20260719)return false;
  if(nitoIsHidden20260719())return false;
  if(typeof nitoIsInvulnerable21==='function'&&nitoIsInvulnerable21())return false;
  if(typeof trampolineFlight41!=='undefined'&&trampolineFlight41)return false;
  if(typeof schoolEntry240!=='undefined'&&schoolEntry240)return false;
  if(typeof isTurtle30==='function'&&isTurtle30(g))return false;
  if(typeof isSloth222==='function'&&isSloth222(g)&&typeof slothSleeping222==='function'&&slothSleeping222(g))return false;
  if(now<(g.stunnedUntil230||0))return false;
  return true;
}

function checkStationaryGuardianCollision20260719(now=performance.now()){
  if(!playing||now<guardianResetLockUntil20260719)return false;
  const captor=guardianHerd20260719().find(g=>guardianMayDefeatNito20260719(g,now));
  if(!captor)return false;
  guardianResetLockUntil20260719=now+500;
  resetToStart(captor.message||'El guardián encontró a Nito. ¡Volvamos al comienzo!');
  return true;
}

/* La tortuga da 1,8 segundos de protección después de un empujón.
   Durante ese lapso tampoco puede volver a empujarlo. */
const turtlePushBefore20260719=turtlePush30;
turtlePush30=function(g,dx,dy,t=performance.now()){
  if(t<nitoTurtleInvulnerableUntil20260719)return false;
  const pushed=turtlePushBefore20260719(g,dx,dy,t);
  if(pushed){
    nitoTurtleInvulnerableUntil20260719=t+NITO_TURTLE_INVULNERABILITY_MS_20260719;
    if(typeof turtlePushGraceUntil30!=='undefined'){
      turtlePushGraceUntil30=Math.max(turtlePushGraceUntil30,nitoTurtleInvulnerableUntil20260719);
    }
  }
  return pushed;
};

/* Regla única y final de captura. Funciona aunque Nito no presione ninguna tecla. */
guardianCanCapture223=function(g=null){
  const now=performance.now();
  if(g)return guardianMayDefeatNito20260719(g,now);
  return guardianHerd20260719().some(x=>guardianMayDefeatNito20260719(x,now));
};
guardianTouchesNito21=function(){return guardianCanCapture223()};
activeGuardianTouch222=function(g){return guardianCanCapture223(g)};

function directionData20260719(dx,dy){
  if(dx===1&&dy===0)return{key:'right',opp:'left'};
  if(dx===-1&&dy===0)return{key:'left',opp:'right'};
  if(dx===0&&dy===1)return{key:'down',opp:'up'};
  if(dx===0&&dy===-1)return{key:'up',opp:'down'};
  return null;
}

function elephantSecondAction20260719(g,t){
  if(!g||g.kind!=='elephant'||!playing)return false;
  const dx=player.x-g.x,dy=player.y-g.y;
  const options=[];
  if(Math.abs(dx)>=Math.abs(dy)&&dx!==0)options.push({dx:Math.sign(dx),dy:0});
  if(dy!==0)options.push({dx:0,dy:Math.sign(dy)});
  if(dx!==0&&!options.some(d=>d.dx===Math.sign(dx)&&d.dy===0))options.push({dx:Math.sign(dx),dy:0});

  for(const d of options){
    const nx=g.x+d.dx,ny=g.y+d.dy;
    if(nx<0||ny<0||nx>=cols||ny>=rows)continue;
    if(sameCell({x:nx,y:ny},levelStart))continue;
    const dir=directionData20260719(d.dx,d.dy);if(!dir)continue;

    if(maze[g.y][g.x].walls[dir.key]){
      /* Solo rompe paredes interiores; los bordes del mapa siguen cerrados. */
      maze[g.y][g.x].walls[dir.key]=false;
      maze[ny][nx].walls[dir.opp]=false;
      if(typeof elephantBursts225!=='undefined'){
        elephantBursts225.push({x:g.x+d.dx*.5,y:g.y+d.dy*.5,start:t,duration:900,dx:d.dx,dy:d.dy});
      }
      if(typeof elephantBoomSound225==='function')elephantBoomSound225();
    }

    g.x=nx;g.y=ny;
    checkStationaryGuardianCollision20260719(t);
    return true;
  }
  return false;
}

/* Se observa cada movimiento real del elefante. En su turno doble, si la pared
   impide el segundo paso hacia Nito, la rompe y atraviesa ese pasaje. */
const moveOneGuardianBefore20260719=moveOneGuardian;
moveOneGuardian=function(g,t){
  const before=g?{x:g.x,y:g.y}:null;
  moveOneGuardianBefore20260719(g,t);
  if(!g||!before)return;

  const moved=before.x!==g.x||before.y!==g.y;
  if(g.kind==='elephant'&&moved){
    g.doubleWalkCounter20260719=(g.doubleWalkCounter20260719||0)+1;
    if(g.doubleWalkCounter20260719%4===0){
      elephantSecondAction20260719(g,t);
    }
  }

  checkStationaryGuardianCollision20260719(t);
};

/* Revisión en cada cuadro: si un guardián entra en la casilla de Nito mientras
   el jugador permanece quieto, la captura se procesa inmediatamente. */
const advanceGuardianBefore20260719=advanceGuardian;
advanceGuardian=function(t){
  advanceGuardianBefore20260719(t);
  checkStationaryGuardianCollision20260719(t);
};

const buildLevelBefore20260719=buildLevel;
buildLevel=function(n){
  nitoTurtleInvulnerableUntil20260719=0;
  guardianResetLockUntil20260719=0;
  buildLevelBefore20260719(n);
  guardianHerd20260719().forEach(g=>{if(g&&g.kind==='elephant')g.doubleWalkCounter20260719=0});
};


/* =========================================================
   PULIDO FINAL 2026-07-21
   Portada, escondites, elefante 3+1 y protección de tortuga.
   ========================================================= */

/* Dos segundos exactos de invulnerabilidad tras cada empujón de tortuga. */
const NITO_TURTLE_INVULNERABILITY_MS_20260721=2000;
const turtlePushBefore20260721=turtlePush30;
turtlePush30=function(g,dx,dy,t=performance.now()){
  if(t<nitoTurtleInvulnerableUntil20260719)return false;
  const pushed=turtlePushBefore20260721(g,dx,dy,t);
  if(pushed){
    nitoTurtleInvulnerableUntil20260719=t+NITO_TURTLE_INVULNERABILITY_MS_20260721;
    turtleNitoInvulnerableUntilFinal=Math.max(turtleNitoInvulnerableUntilFinal,nitoTurtleInvulnerableUntil20260719);
    if(typeof turtlePushGraceUntil30!=='undefined'){
      turtlePushGraceUntil30=Math.max(turtlePushGraceUntil30,nitoTurtleInvulnerableUntil20260719);
    }
  }
  return pushed;
};

/* En el cuarto turno (tres pasos normales y uno doble), el segundo paso del
   elefante rompe siempre una pared interior disponible. La prioridad es
   acercarse a Nito; si no hay una pared cerrada en esa dirección, usa otra. */
elephantSecondAction20260719=function(g,t){
  if(!g||g.kind!=='elephant'||!playing)return false;
  const dx=player.x-g.x,dy=player.y-g.y;
  const preferred=[];
  const add=(mx,my)=>{
    if(!preferred.some(d=>d.dx===mx&&d.dy===my))preferred.push({dx:mx,dy:my});
  };
  if(Math.abs(dx)>=Math.abs(dy)){
    if(dx)add(Math.sign(dx),0);
    if(dy)add(0,Math.sign(dy));
  }else{
    if(dy)add(0,Math.sign(dy));
    if(dx)add(Math.sign(dx),0);
  }
  for(const d of DIRS)add(d.dx,d.dy);

  const closed=preferred.find(d=>{
    const nx=g.x+d.dx,ny=g.y+d.dy;
    if(nx<0||ny<0||nx>=cols||ny>=rows)return false;
    if(sameCell({x:nx,y:ny},levelStart))return false;
    const dir=directionData20260719(d.dx,d.dy);
    return dir&&maze[g.y][g.x].walls[dir.key];
  });

  if(closed){
    const dir=directionData20260719(closed.dx,closed.dy);
    const nx=g.x+closed.dx,ny=g.y+closed.dy;
    maze[g.y][g.x].walls[dir.key]=false;
    maze[ny][nx].walls[dir.opp]=false;
    if(typeof elephantBursts225!=='undefined'){
      elephantBursts225.push({x:g.x+closed.dx*.5,y:g.y+closed.dy*.5,start:t,duration:900,dx:closed.dx,dy:closed.dy});
    }
    if(typeof elephantBoomSound225==='function')elephantBoomSound225();
    g.x=nx;g.y=ny;
    checkStationaryGuardianCollision20260719(t);
    return true;
  }

  /* Caso excepcional: la casilla está completamente abierta. Hace el segundo
     paso y rompe una pared desde la nueva casilla, sin sumar un tercer paso. */
  const open=preferred.find(d=>{
    const nx=g.x+d.dx,ny=g.y+d.dy;
    if(nx<0||ny<0||nx>=cols||ny>=rows)return false;
    const dir=directionData20260719(d.dx,d.dy);
    return dir&&!maze[g.y][g.x].walls[dir.key]&&!sameCell({x:nx,y:ny},levelStart);
  });
  if(!open)return false;
  g.x+=open.dx;g.y+=open.dy;
  const breakOnly=DIRS.find(d=>{
    const nx=g.x+d.dx,ny=g.y+d.dy;
    return nx>=0&&ny>=0&&nx<cols&&ny<rows&&maze[g.y][g.x].walls[d.key];
  });
  if(breakOnly){
    const nx=g.x+breakOnly.dx,ny=g.y+breakOnly.dy;
    maze[g.y][g.x].walls[breakOnly.key]=false;
    maze[ny][nx].walls[oppositeKey225(breakOnly.key)]=false;
    if(typeof elephantBursts225!=='undefined'){
      elephantBursts225.push({x:g.x+breakOnly.dx*.5,y:g.y+breakOnly.dy*.5,start:t,duration:900,dx:breakOnly.dx,dy:breakOnly.dy});
    }
    if(typeof elephantBoomSound225==='function')elephantBoomSound225();
  }
  checkStationaryGuardianCollision20260719(t);
  return true;
};


/* === PORTADA: botón invisible sobre “JUGAR AHORA” === */
(function setupCoverScreen(){
  const cover=document.getElementById('coverOverlay');
  const playButton=document.getElementById('coverPlayButton');
  if(!cover||!playButton)return;

  function openGameMenu(){
    cover.classList.add('is-hidden');
    window.setTimeout(()=>{ cover.style.display='none'; },340);
    const startOverlay=document.getElementById('startOverlay');
    if(startOverlay)startOverlay.style.display='flex';
  }

  playButton.addEventListener('click',openGameMenu);
  playButton.addEventListener('keydown',event=>{
    if(event.key==='Enter'||event.key===' '){
      event.preventDefault();
      openGameMenu();
    }
  });
})();
