/** オンラインシート内のアカウント設定（表示名・メールアドレス・パスワード） */
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export function accountHtml(online) {
  const hasPw = online.hasPassword;
  return `<button data-act="account-back">← 戻る</button>
    ${online.isAdmin ? `<h4>管理者</h4><a class="primary admin-link" href="${import.meta.env.BASE_URL}admin.html">管理者ツールを開く（生物の設定）</a>` : ''}
    <h4>プレイヤー名</h4>
    <div class="fp-me"><input id="fp-rename" value="${esc(online.profile.name)}" maxlength="24" aria-label="プレイヤー名"><button data-act="rename" class="primary">変更</button></div>
    <p class="muted">はじめはプレイヤーID（${esc(online.profile.friend_code)}）です。好きな名前に変えられます。</p>
    <h4>メールアドレス</h4>
    <div class="fp-me"><input id="fp-email-new" type="email" value="${esc(online.user.email ?? '')}" autocomplete="email" aria-label="メールアドレス"><button data-act="email" class="primary">変更</button></div>
    <p class="muted">変更後、確認メールのリンクを開くと反映されます。</p>
    <h4>パスワード</h4>
    ${hasPw ? '<input id="fp-pass-cur" type="password" placeholder="現在のパスワード" autocomplete="current-password" aria-label="現在のパスワード">' : '<p class="muted">パスワードを設定すると、メールアドレスでもログインできます。</p>'}
    <input id="fp-pass-new" type="password" placeholder="新しいパスワード（6文字以上）" autocomplete="new-password" aria-label="新しいパスワード">
    <div class="fp-row end"><button data-act="password" class="primary">${hasPw ? '変更' : '設定'}</button></div>
    <h4>アカウント削除</h4>
    <p class="muted">水族館のセーブデータ、フレンド、同盟の所属など、サーバー上のすべてのデータを削除します。元に戻せません。</p>
    <div class="fp-me"><input id="fp-delete-confirm" placeholder="確認のため「削除」と入力" autocomplete="off" aria-label="確認のため削除と入力"><button data-act="delete-account" class="danger">アカウントを削除</button></div>`;
}

/** 処理したら完了メッセージを返す。対象外の操作は null */
export async function accountAction(act, online, el) {
  const raw = (k) => el.querySelector(`#fp-${k}`)?.value ?? '';
  if (act === 'email') {
    await online.changeEmail(raw('email-new').trim());
    return '確認メールを送りました';
  }
  if (act === 'password') {
    await online.changePassword(raw('pass-cur'), raw('pass-new'));
    return 'パスワードを変更しました';
  }
  return null;
}
