import { Capacitor } from '@capacitor/core';
/**
 * スプラッシュ上のログイン。ログインとセーブの読込が終わるまで resolve しない。
 * ログイン状態は端末に保持されるので、ログアウトするまで再入力は不要。
 */
const LABEL = { google: 'Google でログイン', apple: 'Apple でログイン' };

function formHtml(providers) {
  const social = providers.map((p) => `<button type="button" data-act="oauth" data-provider="${p}" class="lg-social">${LABEL[p]}</button>`).join('');
  return `<form id="login-form" onsubmit="return false">
    ${social}${social ? '<p class="lg-or">または</p>' : ''}
    <input id="lg-email" type="email" placeholder="メールアドレス" autocomplete="email" aria-label="メールアドレス">
    <input id="lg-pass" type="password" placeholder="パスワード（6文字以上）" autocomplete="current-password" aria-label="パスワード">
    <div class="lg-row"><button type="button" data-act="signin" class="lg-main">ログイン</button><button type="button" data-act="signup">新規登録</button></div>
    <button type="button" data-act="reset" class="lg-link">パスワードを忘れた場合</button>
    <p id="lg-msg" role="alert"></p>
    <a class="lg-policy" href="${import.meta.env.BASE_URL}privacy.html" target="_blank" rel="noopener">プライバシーポリシー</a>
  </form>`;
}

/** 認証リダイレクトの失敗内容（URL に付いて戻る） */
function redirectError() {
  const params = new URLSearchParams(location.hash.slice(1) || location.search);
  return params.get('error_description');
}

export async function runLoginGate({ online, host, setLabel, onReady }) {
  const authError = redirectError();
  let user = null;
  try {
    user = await online.restore();
  } catch (err) {
    console.error(err);
  }

  for (;;) {
    if (!user) {
      setLabel('ログインしてください');
      await askLogin(online, host, authError);
      user = online.user;
    }
    setLabel('アカウントのデータを読み込み中…');
    try {
      await onReady();
      return;
    } catch (err) {
      // 読込に失敗したまま始めると、保存で既存データを上書きしてしまうので先へ進ませない
      console.error(err);
      setLabel('データを読み込めませんでした');
      await askRetry(online, host, err.message);
      user = online.user;
    }
  }
}

function askRetry(online, host, message) {
  return new Promise((resolve) => {
    host.innerHTML = `<form id="login-form" onsubmit="return false"><p id="lg-msg" role="alert"></p>
      <div class="lg-row"><button type="button" data-act="retry" class="lg-main">再試行</button><button type="button" data-act="out">ログアウト</button></div></form>`;
    host.querySelector('#lg-msg').textContent = message;
    host.onclick = async (e) => {
      const act = e.target.closest('button[data-act]')?.dataset.act;
      if (!act) return;
      host.onclick = null;
      if (act === 'out') await online.signOut().catch(console.error);
      host.innerHTML = '';
      resolve();
    };
  });
}

async function askLogin(online, host, initialError) {
  // iPhone アプリでは外部ログイン（Google など）の画面遷移がアプリへ戻らないので、メールとパスワードだけにする
  const providers = Capacitor.isNativePlatform() ? [] : await online.providers();
  return new Promise((resolve) => {
    host.innerHTML = formHtml(providers);
    const msg = host.querySelector('#lg-msg');
    const val = (k) => host.querySelector(`#lg-${k}`).value.trim();
    if (initialError) msg.textContent = initialError;
    let busy = false;

    const run = async (btn) => {
      const act = btn.dataset.act;
      if (act === 'oauth') return online.oauth(btn.dataset.provider); // 画面遷移する
      if (act === 'reset') {
        await online.resetPassword(val('email'));
        msg.textContent = '再設定用のメールを送りました';
        return;
      }
      if (act === 'signin') await online.signIn(val('email'), host.querySelector('#lg-pass').value);
      else if (!(await online.signUp(val('email'), host.querySelector('#lg-pass').value))) {
        msg.textContent = '確認メールを送りました。メールのリンクを開くとログインできます';
        return;
      }
      host.innerHTML = '';
      host.onclick = null;
      resolve();
    };

    host.onclick = async (e) => {
      const btn = e.target.closest('button[data-act]');
      if (!btn || busy) return;
      busy = true;
      msg.textContent = '';
      try {
        await run(btn);
      } catch (err) {
        msg.textContent = err.message;
      } finally {
        busy = false;
      }
    };
    host.onkeydown = (e) => {
      if (e.key === 'Enter' && e.target.matches('input')) host.querySelector('[data-act="signin"]')?.click();
    };
  });
}
