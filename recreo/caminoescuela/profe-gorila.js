const PROFE_SHEET_SRC = "assets/sprites/profe-gorila/profe-sheet.png";
const PROFE_FRAME = 64;
const PROFE_COLS = 6;
const PROFE_FRAME_MAP = {'idle1': 0, 'idle2': 1, 'idle3': 2, 'idle4': 3, 'walk1': 4, 'walk2': 5, 'walk3': 6, 'walk4': 7, 'walk5': 8, 'walk6': 9, 'jump': 10, 'fall': 11, 'climb1': 12, 'climb2': 13, 'hug': 14, 'dance1': 15, 'dance2': 16};
const profeSheet = new Image();
let profeSheetReady = false;
profeSheet.onload = () => profeSheetReady = true;
profeSheet.src = PROFE_SHEET_SRC;
function spriteFrameName(){
  if(player.state==="uke") return null;
  if(player.onVine) return Math.floor(elapsed*8)%2===0 ? "climb1" : "climb2";
  if(!player.onGround) return player.vy<0 ? "jump" : "fall";
  if(player.state==="hug") return "hug";
  if(player.state==="dance") return Math.floor(elapsed*8)%2===0 ? "dance1" : "dance2";
  if(Math.abs(player.vx)>25){
    const arr=["walk1","walk2","walk3","walk4","walk5","walk6"];
    return arr[Math.floor(player.walkFrame)%arr.length];
  }
  const idle=["idle1","idle2","idle3","idle4"];
  return idle[Math.floor(elapsed*2)%idle.length];
}
function drawProfeSprite(frameName, x, y, flip){
  const idx=PROFE_FRAME_MAP[frameName];
  if(idx===undefined || !profeSheetReady) return false;
  const sx=(idx%PROFE_COLS)*PROFE_FRAME;
  const sy=Math.floor(idx/PROFE_COLS)*PROFE_FRAME;
  ctx.save();
  ctx.imageSmoothingEnabled=false;
  if(flip){
    ctx.translate(x+76,y-14);
    ctx.scale(-1,1);
    ctx.drawImage(profeSheet,sx,sy,PROFE_FRAME,PROFE_FRAME,0,0,76,96);
  }else{
    ctx.drawImage(profeSheet,sx,sy,PROFE_FRAME,PROFE_FRAME,x-9,y-14,76,96);
  }
  ctx.restore();
  return true;
}

