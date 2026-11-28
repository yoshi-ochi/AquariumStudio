import * as THREE from 'three';
import { TankStage } from './tankStage.js';
import { snapshotTank, packSnapshot, newShareId, shareUrl, MAX_BYTES } from './shareData.js';
import { showText } from '../ui/dialog.js';

/**
 * 水槽を共有する（館内の水槽パネルの「共有」）。
 *   1. 水槽の写しを作り、gzip して大きさを確かめる
 *   2. 写しから作り直した水槽を正面から撮る（リンクの絵：1200×630 の JPEG）
 *   3. Supabase に画像と写しを保存（同じ水槽は上書き。1人3件まで）
 *   4. スマホの共有シート（LINE・インスタ・X など）か、URL のコピー
 * Supabase の表・制限は supabase/share.sql。
 */
const W = 1200;
const H = 630;

/** 写しから作り直した水槽を撮る（館内の描画とは別のレンダラー。水紋は使わない） */
export async function shootTank(snap) {
  const stage = new TankStage(snap);
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, stencil: true }); // stencil：岩の切り口（tanks/clipCapPass.js）
  renderer.setPixelRatio(1);
  renderer.setSize(W, H);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const camera = new THREE.PerspectiveCamera(40, W / H, 0.05, 100);
  stage.frame(camera, { yaw: 0.3, pitch: 0.12, fill: 0.95 });
  // 生き物が水槽に散らばるまで少し時間を進めてから撮る
  for (let t = 0; t <= 6; t += 0.25) stage.update(t, renderer, camera, { caustics: false });
  renderer.render(stage.scene, camera);
  const blob = await new Promise((ok) => renderer.domElement.toBlob(ok, 'image/jpeg', 0.82));
  stage.dispose();
  renderer.dispose();
  renderer.forceContextLoss();
  return blob;
}

const ERR = {
  share_limit: '共有できる水槽は3つまでです。どれかの共有をやめてください',
  share_too_fast: '続けて共有するときは1分ほど待ってください',
};
const message = (e) => ERR[Object.keys(ERR).find((k) => String(e?.message ?? e).includes(k))] ?? `共有できませんでした：${e?.message ?? e}`;

export class ShareApi {
  constructor(online) {
    this.online = online;
  }

  get sb() {
    return this.online.sb;
  }

  /** この水槽の共有（無ければ null） */
  async find(tankUid) {
    const res = await this.sb.from('shared_tanks').select('id, views, updated_at').eq('owner', this.online.user.id).eq('tank_uid', tankUid).maybeSingle();
    if (res.error) throw new Error(message(res.error));
    return res.data;
  }

  /** 共有する（すでに共有していれば写しと画像を更新）。共有ページの URL を返す */
  async share(manager, tank) {
    const snap = snapshotTank(manager, tank);
    const data = packSnapshot(snap);
    if (data.length > MAX_BYTES) throw new Error('水槽のレイアウトが大きすぎて共有できません（生き物オブジェを減らしてください）');
    const old = await this.find(tank.userData.uid);
    const id = old?.id ?? newShareId();
    const user = this.online.user;
    let hasImage = false;
    try {
      const blob = await shootTank(snap);
      const up = await this.sb.storage.from('share-img').upload(`${user.id}/${id}.jpg`, blob, { contentType: 'image/jpeg', upsert: true, cacheControl: '300' });
      hasImage = !up.error;
    } catch (e) {
      console.warn('share image', e); // 画像が撮れなくても共有はする（リンクの絵はアプリ共通のものになる）
    }
    const row = { id, owner: user.id, tank_uid: tank.userData.uid, title: (tank.userData.name ?? '').slice(0, 40), owner_name: (this.online.profile?.name ?? '').slice(0, 40), data, has_image: hasImage };
    const res = await this.sb.from('shared_tanks').upsert(row, { onConflict: 'owner,tank_uid' });
    if (res.error) throw new Error(message(res.error));
    return shareUrl(id);
  }

  /** 共有をやめる（画像も消す） */
  async unshare(tankUid) {
    const old = await this.find(tankUid);
    if (!old) return;
    await this.sb.storage.from('share-img').remove([`${this.online.user.id}/${old.id}.jpg`]);
    const res = await this.sb.from('shared_tanks').delete().eq('id', old.id);
    if (res.error) throw new Error(message(res.error));
  }
}

/** スマホの共有シートで送る（無い端末・断られたときは URL をコピー）。'shared' | 'copied' | 'cancel' */
export async function sendUrl(url, title) {
  if (navigator.share) {
    try {
      await navigator.share({ title: `${title} | Aquarium Studio`, text: 'ﾟ｡･ﾟ･｡･｡ﾟ｡ アクスタで作った水槽を見てね ｡ﾟ｡･｡･ﾟ･｡ﾟ', url });
      return 'shared';
    } catch (e) {
      if (e?.name === 'AbortError') return 'cancel';
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    return 'copied';
  } catch {
    return (await showText({ title: '共有ページの URL', text: 'コピーして LINE やインスタに貼り付けてください', value: url })) ? 'copied' : 'cancel';
  }
}
