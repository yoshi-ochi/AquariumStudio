/**
 * 壁への水槽埋め込み。
 * embed = { key, along, ratio, bottom }
 *   key    : 壁ランのキー（同じ直線・同じ向き）
 *   along  : ラン方向の座標（axis='x' なら x、'z' なら z）
 *   ratio  : 奥行きのうち壁の向こうに入る割合 0.5（半分）〜 1（前面が壁と面一）
 *   bottom : 水槽底面の高さ(m)
 */
export const EMBED_RATIO_MIN = 0.5;
export const EMBED_RATIO_MAX = 1;

export const runPoint = (run, along) => (run.axis === 'x' ? [along, run.line] : [run.line, along]);
export const alongOf = (run, x, z) => (run.axis === 'x' ? x : z);
/** 壁の内向き法線が水槽の前面(+Z)になる回転 */
export const runTheta = (run) => Math.atan2(run.normal[0], run.normal[1]);

/**
 * (x,z) に最も近い壁（距離 maxDist 以内）。
 * 仕切り壁なら奥はバックヤードに、外壁なら奥を囲う張り出し（アルコーブ）を作るので、
 * どちらでも水槽が建物の外にむき出しにならない。
 */
export function findNearestRun(runs, x, z, maxDist = 1.2, bothSides = false, partitionOnly = false) {
  let best = null;
  for (const run of runs) {
    if (run.kind === 'rail' || run.kind === 'shutter' || run.noEmbed) continue; // 手すりや工事パネル、裏に観客席がある通路の壁には埋め込めない
    if (partitionOnly && run.kind !== 'partition') continue;
    const a = alongOf(run, x, z);
    if (a < run.from || a > run.to) continue;
    const perp = run.axis === 'x' ? z - run.line : x - run.line;
    // 部屋の内側（法線方向）にある場合だけ
    const inside = perp * (run.axis === 'x' ? run.normal[1] : run.normal[0]);
    if (!bothSides && inside < -0.05) continue;
    const dist = Math.abs(perp);
    if (dist <= maxDist && (!best || dist < best.dist)) best = { run, along: a, dist };
  }
  return best;
}

export function findRunByKey(runs, key, along) {
  const inRun = (r) => along >= r.from - 1e-6 && along <= r.to + 1e-6;
  const hit = runs.find((r) => r.key === key && inRun(r));
  if (hit) return hit;
  // 同じ線・同じ向きで、壁の種類だけ変わったもの（外壁の裏にバックヤードができて仕切り壁になった等）
  const line = key.split(':').slice(0, 3).join(':') + ':';
  return runs.find((r) => r.key.startsWith(line) && inRun(r) && !r.noEmbed && r.kind !== 'rail' && r.kind !== 'shutter') ?? null;
}

/** 埋め込み状態に合わせて水槽の位置・向きを決める。ランに収まらなければ false */
export function placeEmbedded(tank, def, run, embed) {
  const { w, d } = def.size;
  if (run.to - run.from < w + 0.02) return false;
  embed.along = Math.min(Math.max(embed.along, run.from + w / 2 + 0.01), run.to - w / 2 - 0.01);
  const [px, pz] = runPoint(run, embed.along);
  const [nx, nz] = run.normal;
  // 前面 = 壁から内側へ d*(1-ratio)。中心は前面から d/2 奥。
  const off = d * (1 - embed.ratio) - d / 2;
  tank.position.set(px + nx * off, embed.bottom, pz + nz * off);
  tank.rotation.y = runTheta(run);
  return true;
}

/** 壁に開ける穴（ラン座標系） */
export function holeFor(def, embed) {
  return {
    key: embed.key,
    along: embed.along,
    width: def.size.w + 0.004,
    bottom: embed.bottom - 0.002,
    top: embed.bottom + def.size.h + 0.004,
    depth: def.size.d * embed.ratio, // 壁の向こう側へ出る奥行き（外壁の張り出しの深さ）
    lightTop: def.size.h + 0.12, // 水槽ライトの分の余裕
  };
}
