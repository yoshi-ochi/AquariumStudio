// 部屋の見た目の選択肢と初期値（データのみ）

export const FLOOR_TYPES = [
  { id: 'flooring', label: 'フローリング' },
  { id: 'carpet', label: '絨毯' },
  { id: 'mat', label: 'マット' },
  { id: 'tile', label: 'タイル' },
  { id: 'solid', label: '塗りつぶし' },
];

export const WALL_TYPES = [
  { id: 'plaster', label: '塗り壁' },
  { id: 'wood', label: '木目' },
  { id: 'wallTile', label: 'タイル' },
  { id: 'brick', label: 'レンガ' },
];


/** 天井の高さ(m)と、照明の標準の高さ（天井に埋め込んだダウンライト） */
export const CEILING_H = 3.6;
export const RECESSED_H = CEILING_H - 0.05;

/** 室内ライト。zone（置いた部屋）の中だけを照らす。(x, height, z) から床の照射点 (tx, tz) へ向ける。数の上限はない */
export function defaultLight(x = 0, z = 0, zone = 'entrance') {
  return { zone, x, z, height: RECESSED_H, tx: x, tz: z, intensity: 1.2, color: '#fff1d6', angle: 70 };
}

/** 旧形式（yaw/tilt）の照明を照射点形式に変換 */
export function normalizeLight(l) {
  if (l.tx !== undefined) return l;
  const yaw = ((l.yaw ?? 0) * Math.PI) / 180;
  const tilt = ((l.tilt ?? 90) * Math.PI) / 180;
  const reach = tilt >= Math.PI / 2 - 1e-3 ? 0 : (l.height ?? 2.4) / Math.tan(tilt);
  return { ...defaultLight(l.x, l.z), ...l, tx: l.x + Math.sin(yaw) * reach, tz: l.z + Math.cos(yaw) * reach };
}

export function defaultRoomSettings() {
  return {
    floor: { type: 'flooring', color: '#c99d74' },
    wall: { type: 'plaster', color: '#eef0ec' },
    ceiling: { color: '#f2f1ec' },
    lights: [defaultLight(0.45, 14.85, 'entrance')],
  };
}
