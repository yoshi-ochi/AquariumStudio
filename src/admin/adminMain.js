import { createClient } from '@supabase/supabase-js';
import './admin.css';
import { applyConfig, CONFIG_KEY } from '../expedition/creatureConfig.js';
import { pruneConfig, auditConfig } from './adminState.js';
import { SpeciesTab } from './adminSpecies.js';
import { PlacesTab } from './adminPlaces.js';
import { GrowthTab } from './adminGrowth.js';
import { esc } from './adminUi.js';

/**
 * 管理者ツール（ゲームとは別サイト：admin/。npm run admin で起動）。生物のレア度・季節・生息環境・採取地・経験値を編集し、
 * Supabase の game_config に保存する。プレイヤーは次に起動したときに反映される。
 * 書き込みは管理者だけ（supabase/admin_config.sql の行レベルセキュリティ）。
 */
const $ = (id) => document.getElementById(id);
const URL_ = import.meta.env.VITE_SUPABASE_URL;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const sb = URL_ && KEY ? createClient(URL_, KEY) : null;

const state = {
  cfg: {}, // 編集中の設定（下書き）
  saved: '{}', // サーバーにある設定（変更の有無の判定用）
  tab: 'species',
  dirty: false,
};

/** 下書きを組み込みのデータへ反映し、画面を描き直す */
function changed() {
  applyConfig(state.cfg);
  state.dirty = JSON.stringify(pruneConfig(state.cfg)) !== state.saved;
  render();
}

const tabs = {
  species: ['魚種', new SpeciesTab(state, changed)],
  places: ['採取地', new PlacesTab(state, changed)],
  growth: ['レア度・経験値', new GrowthTab(state, changed)],
  audit: ['点検', { html: () => auditHtml(), bind() {} }],
};

function auditHtml() {
  const list = auditConfig();
  return `<section class="ad-card"><h3>データの点検</h3><p class="ad-note">保存前に、捕れない魚種・漁法の無い魚種・空の採取地などを確認します。</p>
    ${list.length ? `<ul class="ad-issues">${list.map((x) => `<li class="${x.level}">${esc(x.text)}</li>`).join('')}</ul>` : '<p>問題は見つかりませんでした。</p>'}</section>`;
}

function render() {
  $('ad-tabs').innerHTML = Object.entries(tabs).map(([id, [label]]) => `<button data-tab="${id}" class="${state.tab === id ? 'active' : ''}">${label}</button>`).join('');
  const issues = auditConfig().filter((x) => x.level === 'error').length;
  $('ad-status').textContent = state.dirty ? `未保存の変更あり${issues ? `・エラー${issues}件` : ''}` : '保存済み';
  $('ad-save').disabled = !state.dirty;
  const main = $('ad-main');
  const scroll = window.scrollY;
  main.onclick = null;
  main.innerHTML = tabs[state.tab][1].html();
  tabs[state.tab][1].bind(main);
  window.scrollTo(0, scroll);
}

$('ad-tabs').addEventListener('click', (e) => {
  const b = e.target.closest('[data-tab]');
  if (!b) return;
  state.tab = b.dataset.tab;
  render();
});

$('ad-save').addEventListener('click', async () => {
  const errors = auditConfig().filter((x) => x.level === 'error');
  if (errors.length && !confirm(`エラーが${errors.length}件あります（点検タブ）。このまま保存しますか？`)) return;
  const data = pruneConfig(state.cfg);
  $('ad-save').disabled = true;
  const { data: { user } } = await sb.auth.getUser();
  const res = await sb.from('game_config').upsert({ key: CONFIG_KEY, data, updated_at: new Date().toISOString(), updated_by: user.id });
  if (res.error) {
    alert(`保存できませんでした：${res.error.message}`);
    $('ad-save').disabled = false;
    return;
  }
  state.saved = JSON.stringify(data);
  state.dirty = false;
  render();
  alert('保存しました。プレイヤーは次にゲームを起動したときに反映されます。');
});

window.addEventListener('beforeunload', (e) => {
  if (state.dirty) e.preventDefault();
});

function loginForm(message) {
  $('ad-main').innerHTML = `<section class="ad-card ad-login"><h3>管理者ログイン</h3><p class="ad-note">${esc(message)}</p>
    <input id="ad-email" type="email" placeholder="メールアドレス" autocomplete="email">
    <input id="ad-pass" type="password" placeholder="パスワード" autocomplete="current-password">
    <button id="ad-login" class="primary">ログイン</button>
    <p class="ad-note">管理者のアカウントにパスワードが無い場合は、ゲームのアカウント設定でパスワードを設定してください。</p></section>`;
  $('ad-login').onclick = async () => {
    const res = await sb.auth.signInWithPassword({ email: $('ad-email').value.trim(), password: $('ad-pass').value });
    if (res.error) return alert(res.error.message);
    start();
  };
}

async function start() {
  if (!sb) return ($('ad-main').innerHTML = '<p class="ad-note">オンライン設定（VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY）がありません。</p>');
  const { data } = await sb.auth.getSession();
  if (!data.session) return loginForm('管理者として登録したアカウントでログインしてください。');
  const admin = await sb.rpc('is_admin');
  if (admin.error) return loginForm(`管理者の設定が見つかりません（supabase/admin_config.sql を実行してください）：${admin.error.message}`);
  if (!admin.data) return loginForm('このアカウントは管理者として登録されていません。');
  const res = await sb.from('game_config').select('data').eq('key', CONFIG_KEY).maybeSingle();
  if (res.error) return loginForm(`設定を読み込めませんでした：${res.error.message}`);
  state.cfg = structuredClone(res.data?.data ?? {});
  state.saved = JSON.stringify(pruneConfig(state.cfg));
  changed();
}

start();
