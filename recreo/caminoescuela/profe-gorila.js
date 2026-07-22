/*
  PROFE GORILA — FASE 1 FINAL · CAMINATA CON FLEXIÓN

  Hoja oficial: imyso/profe/profe-base-v7.png
  8 cuadros horizontales de 240 x 260 px:

  00 Idle
  01 Walk A — contacto izquierdo
  02 Walk Flex A — rodillas flexionadas
  03 Walk B — cruce intermedio
  04 Walk C — contacto derecho
  05 Walk Flex B — rodillas flexionadas
  06 Walk D — cruce intermedio
  07 Jump
  08 Jump High
  09 Fall

  El código ya queda preparado para una hoja coherente y sin correcciones
  individuales por cuadro. Mientras la hoja V2 no exista, carga la V1.2
  como respaldo para que el juego siga siendo ejecutable.
*/

const PROFE_FRAME_W = 240;
const PROFE_FRAME_H = 260;

const PROFE_FRAME_MAP = Object.freeze({
  idle1: 0,
  walkA: 1,
  walkFlexA: 2,
  walkB: 3,
  walkC: 4,
  walkFlexB: 5,
  walkD: 6,
  jump: 7,
  jumpHigh: 8,
  fall: 9,

  // Provisorios hasta sus fases específicas.
  climb1: 9,
  climb2: 9,
  hug: 0,
  dance1: 1,
  dance2: 3
});

const PROFE_SHEET_V2_SRC = "imyso/profe/profe-base-v7.png";
const PROFE_SHEET_FALLBACK_SRC = "imyso/profe/profe-base-v1-2.png";

const profeSheet = new Image();
let profeSheetReady = false;
let profeUsingFallback = false;

function loadProfeSheet(src, fallback = false){
  profeSheetReady = false;
  profeSheet.onload = () => {
    profeSheetReady = true;
    profeUsingFallback = fallback;
  };
  profeSheet.onerror = () => {
    if(!fallback) loadProfeSheet(PROFE_SHEET_FALLBACK_SRC, true);
  };
  profeSheet.src = src;
}

loadProfeSheet(PROFE_SHEET_V2_SRC);

function spriteFrameName(){
  if(player.state === "uke") return null;
  if(player.onVine) return "fall";

  if(!player.onGround){
    if(player.vy >= 0) return "fall";

    // Conserva la programación de salto aprobada en Fase 1.2.
    const highJumpVisible =
      player.jumpVisualTime >= 0.16 &&
      player.jumpHeldTime >= 0.105 &&
      player.vy < -180 &&
      !player.jumpCut;

    return highJumpVisible ? "jumpHigh" : "jump";
  }

  if(player.state === "hug") return "hug";

  if(player.state === "dance"){
    return Math.floor(elapsed * 5) % 2 ? "dance1" : "dance2";
  }

  if(Math.abs(player.vx) > 25){
    /*
      Ciclo final de seis poses:
      contacto izquierdo → flexión → cruce → contacto derecho → flexión → cruce.
      Las poses de flexión bajan la cadera y muestran el peso del cuerpo pasando
      de una pierna a la otra. El salto permanece sin cambios.
    */
    const cycle = Math.floor(player.walkFrame) % 6;
    return [
      "walkA",
      "walkFlexA",
      "walkB",
      "walkC",
      "walkFlexB",
      "walkD"
    ][cycle];
  }

  return "idle1";
}

function drawProfeSprite(frameName, x, y, flip){
  const idx = PROFE_FRAME_MAP[frameName];
  if(idx === undefined || !profeSheetReady) return false;

  const sx = idx * PROFE_FRAME_W;
  const sy = 0;

  // Escala corporal base. Los saltos necesitan compensación porque los
  // brazos ocupan más altura dentro del mismo cuadro y, sin este ajuste,
  // el cuerpo parecía achicarse en el aire.
  const scaleByFrame = {
    jump: 1.04,
    jumpHigh: 1.15,
    fall: 1.03
  };
  const visualScale = scaleByFrame[frameName] || 1;
  const drawW = 175 * visualScale;
  const drawH = 190 * visualScale;

  // Anclaje único: centro inferior del personaje. La compensación mantiene
  // el centro corporal estable aunque cambie la escala visual del salto.
  const anchorX = x + 29;
  const anchorY = y + 87;
  const drawX = anchorX - drawW / 2;
  let drawY = anchorY - drawH;

  // Microajustes de transición durante la caminata. Mantienen el apoyo
  // estable, pero suavizan el traslado del peso entre los cuatro dibujos.
  if(frameName.startsWith("walk")){
    const phase = Math.floor(player.walkFrame) % 6;
    const easeY = [0, 1, 0, 0, 1, 0][phase];
    const easeX = [0, 1, 0, 0, -1, 0][phase];
    drawY += easeY;
    // Se aplica después del cálculo de anclaje para no modificar la colisión.
    // drawX es const en la versión original, por eso usamos translate abajo.
    var walkEaseX = easeX;
  } else {
    var walkEaseX = 0;
  }

  if(player.landTimer > 0){
    drawY += Math.sin((player.landTimer / 0.16) * Math.PI) * 3;
  }

  ctx.save();
  ctx.imageSmoothingEnabled = true;

  if(flip){
    ctx.translate(drawX + drawW + walkEaseX, drawY);
    ctx.scale(-1, 1);
    ctx.drawImage(
      profeSheet,
      sx, sy, PROFE_FRAME_W, PROFE_FRAME_H,
      0, 0, drawW, drawH
    );
  } else {
    ctx.drawImage(
      profeSheet,
      sx, sy, PROFE_FRAME_W, PROFE_FRAME_H,
      drawX + walkEaseX, drawY, drawW, drawH
    );
  }

  ctx.restore();
  return true;
}
