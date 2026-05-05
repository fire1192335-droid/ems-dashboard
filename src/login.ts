import "./style.css";

import { initPwaFeatures } from "./pwa";
import { observeAuthSession, signInWithPassword } from "./services/authService";
import { hasFirebaseConfig } from "./services/firebase";

const root = document.querySelector<HTMLDivElement>("#app");

if (!root) {
  throw new Error("Missing #app root element.");
}

initPwaFeatures();

const nextPath = new URLSearchParams(window.location.search).get("next") || "index.html";

type LoginState = {
  isSubmitting: boolean;
  error: string | null;
};

const state: LoginState = {
  isSubmitting: false,
  error: null,
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function redirectAfterLogin() {
  window.location.href = `${import.meta.env.BASE_URL}${nextPath}`;
}

function render() {
  if (!hasFirebaseConfig) {
    root.innerHTML = `
      <div class="bootstrap-shell">
        <div class="bootstrap-card">
          <p class="bootstrap-eyebrow">EMS AUTHENTICATION</p>
          <h1>尚未完成 Firebase 設定</h1>
          <p class="bootstrap-text">請先建立 .env 並填入 Firebase Web App 參數。</p>
        </div>
      </div>
    `;
    return;
  }

  root.innerHTML = `
    <div class="auth-shell">
      <section class="auth-card">
        <div class="auth-side">
          <p class="bootstrap-eyebrow">EMS AUTHENTICATION</p>
          <h1>救護耗材控管儀表板</h1>
          <p class="auth-copy">
            第二版已改為 Firebase Authentication + Firestore 內部系統。未登入者不可進入儀表板與領用紀錄頁。
          </p>
          <ul class="auth-points">
            <li>Email / Password 登入</li>
            <li>依 users collection 套用 admin、user、viewer 權限</li>
            <li>所有耗材異動寫入 Firestore</li>
          </ul>
        </div>
        <div class="auth-form-panel">
          <div class="bootstrap-nav">
            <a class="bootstrap-link" href="./index.html">儀表板</a>
            <a class="bootstrap-link" href="./trace.html">領用紀錄</a>
            <a class="bootstrap-link is-active" href="./login.html">登入</a>
          </div>
          <h2>帳號登入</h2>
          <p class="auth-helper">登入後會依據使用者角色自動進入內部頁面。</p>
          ${state.error ? `<div class="notice notice-error">${escapeHtml(state.error)}</div>` : ""}
          <form id="loginForm" class="auth-form">
            <label class="field">
              <span>Email</span>
              <input name="email" type="email" autocomplete="username" placeholder="name@example.com" required />
            </label>
            <label class="field">
              <span>密碼</span>
              <input name="password" type="password" autocomplete="current-password" placeholder="請輸入密碼" required />
            </label>
            <button class="primary-button" type="submit" ${state.isSubmitting ? "disabled" : ""}>
              ${state.isSubmitting ? "登入中..." : "登入"}
            </button>
          </form>
          <p class="auth-footnote">
            若是第一次登入且尚未建立 users profile，登入後系統會要求補上顯示名稱與所屬單位。
          </p>
        </div>
      </section>
    </div>
  `;

  document.querySelector<HTMLFormElement>("#loginForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");

    state.isSubmitting = true;
    state.error = null;
    render();

    try {
      await signInWithPassword(email, password);
      redirectAfterLogin();
    } catch (error) {
      state.error = error instanceof Error ? error.message : "登入失敗，請稍後再試。";
      state.isSubmitting = false;
      render();
    }
  });
}

render();

const unsubscribe = observeAuthSession(
  (session) => {
    if (session?.user) {
      unsubscribe();
      redirectAfterLogin();
    }
  },
  (error) => {
    state.error = error.message;
    render();
  },
);
