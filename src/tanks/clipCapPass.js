import * as THREE from 'three';

/**
 * 切り口のふたの描画（tankClip.js から使う）。
 * 岩が手前と奥のガラスをどちらも突き抜けていると、裏面まで水槽の外にあって切り口が穴になる。
 * そこで、水槽の壁をまたいでいるメッシュだけ、本体を描いた直後に2回の補助の描画を足す：
 *   1. しるし：視線が水槽へ入る点より奥に表面がある画素（＝入る点は岩の外）にステンシルで印を付ける
 *   2. ふた：印の無い画素の裏面を、水槽へ入る点の深さに切り口の色で描く
 * 壁をまたいでいない物・ステンシルの無い描画先では何もしない（本体の描画だけで切り口を塗る）。
 */

const HAS_STENCIL = new WeakMap(); // renderer → ステンシルがあるか
const PASSES = new WeakMap(); // 本体の材質 → { mark, fill }
const _c = new THREE.Vector3();

/** 本体の材質の複製を、しるし用・ふた用の設定にする（シェーダーの組み込みは tankClip.js 側で済ませて渡す） */
export function capPassMaterials(mark, fill) {
  mark.side = THREE.FrontSide;
  mark.colorWrite = false;
  mark.depthWrite = false;
  mark.depthTest = false;
  mark.stencilWrite = true;
  mark.stencilRef = 1;
  mark.stencilFunc = THREE.AlwaysStencilFunc;
  mark.stencilZPass = THREE.ReplaceStencilOp;
  fill.side = THREE.BackSide;
  fill.stencilWrite = true;
  fill.stencilRef = 0;
  fill.stencilFunc = THREE.EqualStencilFunc;
  fill.stencilFail = THREE.ZeroStencilOp; // 印は使ったら消す（次のメッシュへ持ち越さない）
  return { mark, fill };
}

/** メッシュの外接球が水槽の壁（円形は半径、箱型は XZ の範囲）にかかっているか */
function straddles(mesh, geometry, uniforms) {
  const s = geometry.boundingSphere ?? (geometry.computeBoundingSphere(), geometry.boundingSphere);
  const inv = uniforms.uClipInv.value;
  _c.copy(s.center).applyMatrix4(mesh.matrixWorld).applyMatrix4(inv);
  const r = s.radius * mesh.matrixWorld.getMaxScaleOnAxis() * inv.getMaxScaleOnAxis();
  const half = uniforms.uClipHalf.value;
  if (uniforms.uClipShape.value === 1) return Math.hypot(_c.x, _c.z) + r > half.z;
  return Math.abs(_c.x) + r > half.x || Math.abs(_c.z) + r > half.y;
}

/** mesh（材質 main）に、切り口のふたの描画を付ける。make()：{ mark, fill } を作る（要るときに1度だけ） */
export function attachCapPass(mesh, main, uniforms, make) {
  const old = PASSES.get(main); // 付け直し（別の水槽の uniform へ）：前の補助の材質は捨てて作り直す
  if (old) {
    old.mark.dispose();
    old.fill.dispose();
    PASSES.delete(main);
  }
  mesh.onAfterRender = (renderer, scene, camera, geometry, material) => {
    if (material !== main || renderer.getRenderTarget() || !straddles(mesh, geometry, uniforms)) return;
    let ok = HAS_STENCIL.get(renderer);
    if (ok === undefined) HAS_STENCIL.set(renderer, (ok = !!renderer.getContextAttributes().stencil));
    if (!ok) return;
    let p = PASSES.get(main);
    if (!p) {
      p = make();
      PASSES.set(main, p);
      const drop = () => {
        main.removeEventListener('dispose', drop);
        p.mark.dispose();
        p.fill.dispose();
        if (PASSES.get(main) === p) PASSES.delete(main);
      };
      main.addEventListener('dispose', drop);
    }
    renderer.renderBufferDirect(camera, scene, geometry, p.mark, mesh, null);
    renderer.renderBufferDirect(camera, scene, geometry, p.fill, mesh, null);
  };
}
