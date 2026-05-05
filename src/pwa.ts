import { registerSW } from "virtual:pwa-register";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

type PwaUiElements = {
  host: HTMLDivElement;
  installButton: HTMLButtonElement;
  updateBanner: HTMLDivElement;
  updateButton: HTMLButtonElement;
  dismissUpdateButton: HTMLButtonElement;
  offlineBanner: HTMLDivElement;
};

declare global {
  interface Window {
    __emsPwaInitialized?: boolean;
  }
}

let deferredInstallPrompt: BeforeInstallPromptEvent | null = null;
let pwaUi: PwaUiElements | null = null;

function ensurePwaUi() {
  if (pwaUi) {
    return pwaUi;
  }

  const host = document.createElement("div");
  host.className = "pwa-floating-ui";
  host.innerHTML = `
    <div id="pwaOfflineBanner" class="pwa-banner pwa-banner-offline" hidden>
      <span>目前為離線模式，資料為上次同步結果</span>
    </div>
    <div class="pwa-action-stack">
      <button id="pwaInstallButton" class="pwa-install-button" type="button" hidden>
        安裝到桌面
      </button>
      <div id="pwaUpdateBanner" class="pwa-banner pwa-banner-update" hidden>
        <span>已有新版可更新</span>
        <div class="pwa-banner-actions">
          <button id="pwaUpdateButton" class="secondary-button small-button" type="button">
            立即更新
          </button>
          <button id="pwaDismissUpdateButton" class="ghost-button small-button" type="button">
            稍後
          </button>
        </div>
      </div>
    </div>
  `;

  document.body.append(host);

  pwaUi = {
    host,
    installButton: host.querySelector<HTMLButtonElement>("#pwaInstallButton")!,
    updateBanner: host.querySelector<HTMLDivElement>("#pwaUpdateBanner")!,
    updateButton: host.querySelector<HTMLButtonElement>("#pwaUpdateButton")!,
    dismissUpdateButton: host.querySelector<HTMLButtonElement>("#pwaDismissUpdateButton")!,
    offlineBanner: host.querySelector<HTMLDivElement>("#pwaOfflineBanner")!,
  };

  return pwaUi;
}

function syncOfflineBanner() {
  const ui = ensurePwaUi();
  ui.offlineBanner.hidden = navigator.onLine;
}

function syncInstallButtonVisibility() {
  const ui = ensurePwaUi();
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

  ui.installButton.hidden = standalone || deferredInstallPrompt === null;
}

export function initPwaFeatures() {
  if (window.__emsPwaInitialized) {
    return;
  }

  window.__emsPwaInitialized = true;

  const ui = ensurePwaUi();

  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      ui.updateBanner.hidden = false;
    },
    onOfflineReady() {
      syncOfflineBanner();
    },
  });

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event as BeforeInstallPromptEvent;
    syncInstallButtonVisibility();
  });

  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    syncInstallButtonVisibility();
  });

  window.addEventListener("online", syncOfflineBanner);
  window.addEventListener("offline", syncOfflineBanner);

  ui.installButton.addEventListener("click", async () => {
    if (!deferredInstallPrompt) {
      return;
    }

    await deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    syncInstallButtonVisibility();
  });

  ui.updateButton.addEventListener("click", async () => {
    ui.updateButton.disabled = true;
    await updateSW(true);
  });

  ui.dismissUpdateButton.addEventListener("click", () => {
    ui.updateBanner.hidden = true;
  });

  syncOfflineBanner();
  syncInstallButtonVisibility();
}

