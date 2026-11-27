import * as THREE from 'three';

/**
 * アルビノ・変色個体の体の色。部品をまとめて陰影を焼き込む前（creatureBuilder の shapeOf）に、部品の頂点色を変える。
 * - アルビノ：黒・青・緑の色素（メラニンなど）が抜けて白っぽい桃色になる。赤・橙・黄（カロテノイド）は淡く残る。瞳は赤い
 * - 変色個体（黄変）：体が金色がかった黄色になる。瞳はそのまま
 */
const PUPILS = new Set([0x0c1014, 0x0a0c10]); // 瞳の色（creatureBuilder・creatureTraced）
const HL = 0xffffff; // 目の光
const c = new THREE.Color();
const hsl = { h: 0, s: 0, l: 0 };
const S = THREE.SRGBColorSpace;

function albino(col) {
  col.getHSL(hsl, S);
  const warm = (hsl.h < 0.13 || hsl.h > 0.93) && hsl.s > 0.35 && hsl.l > 0.2;
  if (warm) col.setHSL(hsl.h, hsl.s * 0.7, 0.62 + hsl.l * 0.3, S);
  else col.setHSL(0.02, 0.3, 0.8 + hsl.l * 0.15, S);
}

function golden(col) {
  col.getHSL(hsl, S);
  if (hsl.l > 0.93) return; // 白はそのまま
  col.setHSL(0.12 + (hsl.h < 0.1 ? 0.02 : 0), Math.max(0.65, hsl.s), Math.min(0.85, 0.38 + hsl.l * 0.55), S);
}

/** 部品の頂点色を変える（variant：'albino' | 'morph'） */
export function recolorPart(geo, variant) {
  const col = geo.attributes.color;
  if (!col) return;
  for (let i = 0; i < col.count; i++) {
    c.setRGB(col.getX(i), col.getY(i), col.getZ(i));
    const hex = c.getHex();
    if (hex === HL) continue;
    if (PUPILS.has(hex)) {
      if (variant === 'albino') c.setHex(0xc8283a);
      else continue;
    } else if (variant === 'albino') albino(c);
    else golden(c);
    col.setXYZ(i, c.r, c.g, c.b);
  }
  col.needsUpdate = true;
}

export const VARIANT_NAME = { albino: 'アルビノ', morph: '変色個体（黄変）' };
