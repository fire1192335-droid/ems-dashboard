import "./style.css";

import { initPwaFeatures } from "./pwa";
import {
  createViewerProfile,
  listUserProfiles,
  observeAuthSession,
  roleLabel,
  signOutCurrentUser,
  updateUserProfile,
  userRoleBadge,
  type AuthSession,
} from "./services/authService";
import {
  categoryChoicesHtml,
  computeSupplyStatus,
  hasFirebaseConfig,
  roleLabel as resolveRoleLabel,
  stationChoicesHtml,
  type SupplyRecord,
  type UsageRecord,
  type UserProfile,
} from "./services/firebase";
import { loadSampleSeedData, seedSampleDatabase, type SampleSeedData } from "./services/seedService";
import { deleteSupply, listSupplies, saveSupply, type SupplyFormInput } from "./services/supplyService";
import { listUsageRecords } from "./services/usageRecordService";

const root = document.querySelector<HTMLDivElement>("#app");

if (!root) {
  throw new Error("Missing #app root element.");
}

initPwaFeatures();

type DashboardFilters = {
  dateFrom: string;
  dateTo: string;
  category: string;
  station: string;
  vehicleNo: string;
  purpose: string;
  keyword: string;
};

type SupplyFormState = {
  itemCode: string;
  itemName: string;
  category: string;
  unit: string;
  currentStock: string;
  safetyStock: string;
  location: string;
};

type BootstrapFormState = {
  displayName: string;
  station: string;
};

type DashboardState = {
  session: AuthSession | null;
  supplies: SupplyRecord[];
  usageRecords: UsageRecord[];
  users: UserProfile[];
  filters: DashboardFilters;
  supplyForm: SupplyFormState;
  bootstrapForm: BootstrapFormState;
  editingSupplyId: string | null;
  sampleData: SampleSeedData | null;
  isLoading: boolean;
  error: string | null;
  info: string | null;
};

const defaultFilters: DashboardFilters = {
  dateFrom: "",
  dateTo: "",
  category: "全部類別",
  station: "全部單位",
  vehicleNo: "",
  purpose: "全部用途",
  keyword: "",
};

const defaultSupplyForm: SupplyFormState = {
  itemCode: "",
  itemName: "",
  category: "A 自我防護類",
  unit: "",
  currentStock: "0",
  safetyStock: "0",
  location: "",
};

const defaultBootstrapForm: BootstrapFormState = {
  displayName: "",
  station: "第一分隊",
};

const state: DashboardState = {
  session: null,
  supplies: [],
  usageRecords: [],
  users: [],
  filters: { ...defaultFilters },
  supplyForm: { ...defaultSupplyForm },
  bootstrapForm: { ...defaultBootstrapForm },
  editingSupplyId: null,
  sampleData: null,
  isLoading: true,
  error: null,
  info: null,
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("zh-TW").format(value);
}

function todayDateKey() {
  return new Date().toISOString().slice(0, 10);
}

function isAdmin() {
  return state.session?.profile?.role === "admin";
}

function canCreateUsageRecord() {
  return state.session?.profile?.role === "admin" || state.session?.profile?.role === "user";
}

function actorIdentity() {
  if (!state.session?.user.email) {
    throw new Error("目前登入使用者缺少 email，無法執行資料寫入。");
  }

  return {
    uid: state.session.user.uid,
    email: state.session.user.email,
  };
}

function showLoading(message: string) {
  root.innerHTML = `
    <div class="bootstrap-shell">
      <div class="bootstrap-card">
        <p class="bootstrap-eyebrow">EMS INTERNAL DASHBOARD</p>
        <h1>救護耗材控管儀表板</h1>
        <p class="bootstrap-text">${escapeHtml(message)}</p>
      </div>
    </div>
  `;
}

function redirectToLogin() {
  window.location.href = `${import.meta.env.BASE_URL}login.html?next=index.html`;
}

function setInfo(message: string | null) {
  state.info = message;
}

function setError(message: string | null) {
  state.error = message;
}

async function refreshDashboardData() {
  if (!state.session?.profile) {
    return;
  }

  state.isLoading = true;
  render();

  try {
    const [supplies, usageRecords, sampleData] = await Promise.all([
      listSupplies(),
      listUsageRecords(),
      isAdmin() ? loadSampleSeedData().catch(() => null) : Promise.resolve(null),
    ]);

    state.supplies = supplies;
    state.usageRecords = usageRecords;
    state.sampleData = sampleData;
    state.users = isAdmin() ? await listUserProfiles() : [];
    state.error = null;
  } catch (error) {
    state.error = error instanceof Error ? error.message : "無法讀取 Firestore 資料。";
  } finally {
    state.isLoading = false;
    render();
  }
}

function resetSupplyForm() {
  state.supplyForm = { ...defaultSupplyForm };
  state.editingSupplyId = null;
}

function matchesDateRange(record: UsageRecord) {
  if (state.filters.dateFrom && record.receiveDate < state.filters.dateFrom) {
    return false;
  }

  if (state.filters.dateTo && record.receiveDate > state.filters.dateTo) {
    return false;
  }

  return true;
}

function getFilteredUsageRecords() {
  const keyword = state.filters.keyword.trim().toLowerCase();
  const vehicleKeyword = state.filters.vehicleNo.trim().toLowerCase();

  return state.usageRecords.filter((record) => {
    const matchesKeyword = keyword
      ? [
          record.itemName,
          record.itemCode,
          record.receiver,
          record.caseNo,
          record.station,
          record.purpose,
        ]
          .filter(Boolean)
          .some((field) => field.toLowerCase().includes(keyword))
      : true;

    const matchesCategory =
      state.filters.category === "全部類別" || record.category === state.filters.category;
    const matchesStation =
      state.filters.station === "全部單位" || record.station === state.filters.station;
    const matchesVehicle = vehicleKeyword
      ? record.vehicleNo.toLowerCase().includes(vehicleKeyword)
      : true;
    const matchesPurpose =
      state.filters.purpose === "全部用途" || record.purpose === state.filters.purpose;

    return (
      matchesKeyword &&
      matchesCategory &&
      matchesStation &&
      matchesVehicle &&
      matchesPurpose &&
      matchesDateRange(record)
    );
  });
}

function getFilteredSupplies() {
  const keyword = state.filters.keyword.trim().toLowerCase();

  return state.supplies.filter((supply) => {
    const matchesKeyword = keyword
      ? [supply.itemName, supply.itemCode, supply.location]
          .filter(Boolean)
          .some((field) => field.toLowerCase().includes(keyword))
      : true;

    const matchesCategory =
      state.filters.category === "全部類別" || supply.category === state.filters.category;

    return matchesKeyword && matchesCategory;
  });
}

function getTodayUsageRecords() {
  const today = todayDateKey();
  return state.usageRecords.filter((record) => record.receiveDate === today);
}

function getTodayUsageTotal() {
  return getTodayUsageRecords().reduce((sum, record) => sum + record.quantity, 0);
}

function getLowStockSupplies() {
  return state.supplies
    .filter((supply) => supply.currentStock <= supply.safetyStock)
    .sort((left, right) => {
      const severity = (item: SupplyRecord) => {
        const status = computeSupplyStatus(item.currentStock, item.safetyStock);
        return status === "缺貨" ? 0 : status === "低庫存" ? 1 : 2;
      };

      return severity(left) - severity(right) || left.currentStock - right.currentStock;
    });
}

function getCategorySummary() {
  const buckets = new Map<
    string,
    { category: string; items: number; totalStock: number; lowStock: number; outOfStock: number }
  >();

  for (const supply of state.supplies) {
    const current =
      buckets.get(supply.category) ??
      {
        category: supply.category,
        items: 0,
        totalStock: 0,
        lowStock: 0,
        outOfStock: 0,
      };

    current.items += 1;
    current.totalStock += supply.currentStock;

    if (supply.status === "低庫存") {
      current.lowStock += 1;
    }

    if (supply.status === "缺貨") {
      current.outOfStock += 1;
    }

    buckets.set(supply.category, current);
  }

  return [...buckets.values()].sort((left, right) => left.category.localeCompare(right.category));
}

function getStationUsageSummary() {
  const buckets = new Map<string, { station: string; count: number; quantity: number }>();

  for (const record of getFilteredUsageRecords()) {
    const current = buckets.get(record.station) ?? {
      station: record.station,
      count: 0,
      quantity: 0,
    };

    current.count += 1;
    current.quantity += record.quantity;
    buckets.set(record.station, current);
  }

  return [...buckets.values()].sort((left, right) => right.quantity - left.quantity);
}

function renderProfileBootstrap() {
  const email = state.session?.user.email ?? "";

  root.innerHTML = `
    <div class="auth-shell">
      <section class="auth-card">
        <div class="auth-side">
          <p class="bootstrap-eyebrow">EMS PROFILE SETUP</p>
          <h1>完成使用者資料</h1>
          <p class="auth-copy">
            Firebase Authentication 已登入，但 Firestore 的 users profile 尚未建立。請先補上顯示名稱與所屬單位。
          </p>
        </div>
        <div class="auth-form-panel">
          <h2>建立 viewer profile</h2>
          <p class="auth-helper">第一次登入會先建立 viewer 權限，之後再由 admin 調整角色。</p>
          ${state.error ? `<div class="notice notice-error">${escapeHtml(state.error)}</div>` : ""}
          <form id="bootstrapProfileForm" class="auth-form">
            <label class="field">
              <span>Email</span>
              <input value="${escapeHtml(email)}" disabled />
            </label>
            <label class="field">
              <span>顯示名稱</span>
              <input name="displayName" value="${escapeHtml(state.bootstrapForm.displayName)}" required />
            </label>
            <label class="field">
              <span>所屬單位</span>
              <select name="station">${stationChoicesHtml(state.bootstrapForm.station)}</select>
            </label>
            <button class="primary-button" type="submit">建立 profile</button>
          </form>
        </div>
      </section>
    </div>
  `;

  document
    .querySelector<HTMLFormElement>("#bootstrapProfileForm")
    ?.addEventListener("submit", async (event) => {
      event.preventDefault();

      if (!state.session?.user.email) {
        setError("目前登入帳號缺少 email，無法建立 profile。");
        renderProfileBootstrap();
        return;
      }

      const formData = new FormData(event.currentTarget);
      const displayName = String(formData.get("displayName") ?? "").trim();
      const station = String(formData.get("station") ?? "").trim();

      state.bootstrapForm = { displayName, station };

      try {
        state.session.profile = await createViewerProfile({
          uid: state.session.user.uid,
          email: state.session.user.email,
          displayName,
          station,
        });
        setError(null);
        await refreshDashboardData();
      } catch (error) {
        setError(error instanceof Error ? error.message : "建立使用者資料失敗。");
        renderProfileBootstrap();
      }
    });
}

function renderHeader() {
  if (!state.session?.profile || !state.session.user.email) {
    return "";
  }

  return `
    <nav class="top-nav" aria-label="系統導覽">
      <a class="nav-link is-active" href="${import.meta.env.BASE_URL}">儀表板</a>
      <a class="nav-link" href="${import.meta.env.BASE_URL}trace.html">領用紀錄</a>
      <div class="session-bar">
        <span class="session-pill">${escapeHtml(state.session.user.email)}</span>
        <span class="session-pill">${escapeHtml(state.session.profile.station)}</span>
        <span class="${userRoleBadge(state.session.profile.role)}">${escapeHtml(resolveRoleLabel(state.session.profile.role))}</span>
        <button id="logoutButton" class="secondary-button" type="button">登出</button>
      </div>
    </nav>
  `;
}

function renderSummaryCards() {
  const todayRecords = getTodayUsageRecords();
  const lowStockCount = getLowStockSupplies().length;

  const cards = [
    {
      title: "今日領用次數",
      value: `${todayRecords.length}`,
      tone: "tone-normal",
      badge: "Today",
    },
    {
      title: "今日領用總數",
      value: `${formatNumber(getTodayUsageTotal())}`,
      tone: "tone-normal",
      badge: "Quantity",
    },
    {
      title: "低庫存品項數",
      value: `${lowStockCount}`,
      tone: lowStockCount > 0 ? "tone-danger" : "tone-normal",
      badge: "Alert",
    },
    {
      title: "耗材主檔總數",
      value: `${state.supplies.length}`,
      tone: "tone-warning",
      badge: "Items",
    },
  ];

  return cards
    .map(
      (card) => `
        <article class="summary-card ${card.tone}">
          <div>
            <p class="summary-label">${card.title}</p>
            <strong class="summary-value">${card.value}</strong>
          </div>
          <span class="trace-badge">${card.badge}</span>
        </article>
      `,
    )
    .join("");
}

function renderLowStockPanel() {
  const lowStockSupplies = getLowStockSupplies().slice(0, 8);

  return `
    <section class="section-block section-alert">
      <div class="section-heading">
        <div>
          <p class="section-kicker">LOW STOCK ALERT</p>
          <h2>低庫存警示清單</h2>
        </div>
        <p class="section-helper">currentStock 小於或等於 safetyStock 時會出現在這裡。</p>
      </div>
      ${
        lowStockSupplies.length === 0
          ? `<div class="empty-state">目前沒有低庫存或缺貨項目。</div>`
          : `<div class="alert-list">
              ${lowStockSupplies
                .map(
                  (supply) => `
                    <article class="alert-card">
                      <div>
                        <strong>${escapeHtml(supply.itemName)}</strong>
                        <p>${escapeHtml(supply.itemCode)} ・ ${escapeHtml(supply.category)}</p>
                      </div>
                      <div class="alert-values">
                        <span class="${supply.status === "缺貨" ? "status status-danger" : "status status-warning"}">${escapeHtml(supply.status)}</span>
                        <b>${formatNumber(supply.currentStock)} / 安全庫存 ${formatNumber(supply.safetyStock)}</b>
                      </div>
                    </article>
                  `,
                )
                .join("")}
            </div>`
      }
    </section>
  `;
}

function renderFilterBar() {
  return `
    <section class="section-block">
      <div class="section-heading section-heading-stack">
        <div>
          <p class="section-kicker">FILTERS</p>
          <h2>搜尋與篩選</h2>
        </div>
        <div class="filters-grid filters-grid-wide">
          <label class="field">
            <span>開始日期</span>
            <input id="filterDateFrom" type="date" value="${escapeHtml(state.filters.dateFrom)}" />
          </label>
          <label class="field">
            <span>結束日期</span>
            <input id="filterDateTo" type="date" value="${escapeHtml(state.filters.dateTo)}" />
          </label>
          <label class="field">
            <span>類別</span>
            <select id="filterCategory">
              <option value="全部類別">全部類別</option>
              ${categoryChoicesHtml(state.filters.category)}
            </select>
          </label>
          <label class="field">
            <span>所屬單位</span>
            <select id="filterStation">
              <option value="全部單位">全部單位</option>
              ${stationChoicesHtml(state.filters.station)}
            </select>
          </label>
          <label class="field">
            <span>車號</span>
            <input id="filterVehicleNo" type="text" value="${escapeHtml(state.filters.vehicleNo)}" placeholder="例如 91車" />
          </label>
          <label class="field">
            <span>用途</span>
            <select id="filterPurpose">
              <option value="全部用途">全部用途</option>
              <option value="出勤使用" ${state.filters.purpose === "出勤使用" ? "selected" : ""}>出勤使用</option>
              <option value="訓練使用" ${state.filters.purpose === "訓練使用" ? "selected" : ""}>訓練使用</option>
              <option value="補充車備" ${state.filters.purpose === "補充車備" ? "selected" : ""}>補充車備</option>
              <option value="盤點調整" ${state.filters.purpose === "盤點調整" ? "selected" : ""}>盤點調整</option>
              <option value="其他" ${state.filters.purpose === "其他" ? "selected" : ""}>其他</option>
            </select>
          </label>
          <label class="field field-wide">
            <span>耗材名稱或編號</span>
            <input id="filterKeyword" type="search" value="${escapeHtml(state.filters.keyword)}" placeholder="搜尋耗材、領取人、案件編號" />
          </label>
          <button id="resetFiltersButton" class="reset-button" type="button">重設條件</button>
        </div>
      </div>
    </section>
  `;
}

function renderCategorySummary() {
  const summary = getCategorySummary();

  return `
    <section class="section-block">
      <div class="section-heading">
        <div>
          <p class="section-kicker">CATEGORY STOCK</p>
          <h2>各類別耗材庫存統計</h2>
        </div>
      </div>
      <div class="metrics-grid">
        ${summary
          .map(
            (entry) => `
              <article class="metric-card">
                <p>${escapeHtml(entry.category)}</p>
                <strong>${formatNumber(entry.totalStock)}</strong>
                <span>共 ${entry.items} 項 ・ 低庫存 ${entry.lowStock} ・ 缺貨 ${entry.outOfStock}</span>
              </article>
            `,
          )
          .join("")}
      </div>
    </section>
  `;
}

function renderStationSummary() {
  const summary = getStationUsageSummary();

  return `
    <section class="section-block">
      <div class="section-heading">
        <div>
          <p class="section-kicker">STATION SUMMARY</p>
          <h2>各分隊領用統計</h2>
        </div>
      </div>
      ${
        summary.length === 0
          ? `<div class="empty-state">目前篩選條件沒有可統計的領用紀錄。</div>`
          : `<div class="metrics-grid">
              ${summary
                .map(
                  (entry) => `
                    <article class="metric-card">
                      <p>${escapeHtml(entry.station)}</p>
                      <strong>${formatNumber(entry.quantity)}</strong>
                      <span>${entry.count} 筆領用紀錄</span>
                    </article>
                  `,
                )
                .join("")}
            </div>`
      }
    </section>
  `;
}

function renderRecentUsageSection() {
  const records = getFilteredUsageRecords().slice(0, 8);

  return `
    <section class="section-block">
      <div class="section-heading">
        <div>
          <p class="section-kicker">RECENT USAGE</p>
          <h2>最近領用紀錄</h2>
        </div>
      </div>
      ${
        records.length === 0
          ? `<div class="empty-state">目前沒有符合篩選條件的領用紀錄。</div>`
          : `<div class="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>日期時間</th>
                    <th>耗材</th>
                    <th>領用資訊</th>
                    <th>領取人 / 單位</th>
                    <th>車號 / 案號</th>
                    <th>領後庫存</th>
                  </tr>
                </thead>
                <tbody>
                  ${records
                    .map(
                      (record) => `
                        <tr>
                          <td data-label="日期時間">${escapeHtml(record.receiveDate)} ${escapeHtml(record.receiveTime)}</td>
                          <td data-label="耗材">
                            <div class="name-cell">
                              <strong>${escapeHtml(record.itemName)}</strong>
                              <span>${escapeHtml(record.itemCode)} ・ ${escapeHtml(record.category)}</span>
                            </div>
                          </td>
                          <td data-label="領用資訊">
                            <div class="trace-inline-meta">
                              <strong>${record.quantity}${escapeHtml(record.unit)}</strong>
                              <span>${escapeHtml(record.purpose)}</span>
                            </div>
                          </td>
                          <td data-label="領取人 / 單位">
                            <div class="trace-inline-meta">
                              <strong>${escapeHtml(record.receiver)}</strong>
                              <span>${escapeHtml(record.station)}</span>
                            </div>
                          </td>
                          <td data-label="車號 / 案號">
                            <div class="trace-inline-meta">
                              <strong>${escapeHtml(record.vehicleNo || "-")}</strong>
                              <span>${escapeHtml(record.caseNo || "-")}</span>
                            </div>
                          </td>
                          <td data-label="領後庫存">${formatNumber(record.stockAfterUse)}</td>
                        </tr>
                      `,
                    )
                    .join("")}
                </tbody>
              </table>
            </div>`
      }
    </section>
  `;
}

function renderSupplyTable() {
  const supplies = getFilteredSupplies();

  return `
    <section class="section-block">
      <div class="section-heading">
        <div>
          <p class="section-kicker">SUPPLIES</p>
          <h2>耗材主檔與庫存</h2>
        </div>
        <div class="toolbar-actions">
          ${canCreateUsageRecord() ? `<a class="hero-link hero-link-inline" href="${import.meta.env.BASE_URL}trace.html">新增領用紀錄</a>` : ""}
        </div>
      </div>
      ${
        supplies.length === 0
          ? `<div class="empty-state">目前沒有符合條件的耗材資料。</div>`
          : `<div class="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>類別</th>
                    <th>編號 / 名稱</th>
                    <th>庫存</th>
                    <th>安全庫存</th>
                    <th>狀態</th>
                    <th>位置</th>
                    <th>更新者</th>
                    ${isAdmin() ? "<th>操作</th>" : ""}
                  </tr>
                </thead>
                <tbody>
                  ${supplies
                    .map(
                      (supply) => `
                        <tr>
                          <td data-label="類別">${escapeHtml(supply.category)}</td>
                          <td data-label="編號 / 名稱">
                            <div class="name-cell">
                              <strong>${escapeHtml(supply.itemName)}</strong>
                              <span>${escapeHtml(supply.itemCode)}</span>
                            </div>
                          </td>
                          <td data-label="庫存">${formatNumber(supply.currentStock)} ${escapeHtml(supply.unit)}</td>
                          <td data-label="安全庫存">${formatNumber(supply.safetyStock)}</td>
                          <td data-label="狀態">
                            <span class="${supply.status === "缺貨" ? "status status-danger" : supply.status === "低庫存" ? "status status-warning" : "status status-normal"}">${escapeHtml(supply.status)}</span>
                          </td>
                          <td data-label="位置">${escapeHtml(supply.location || "-")}</td>
                          <td data-label="更新者">
                            <div class="trace-inline-meta">
                              <strong>${escapeHtml(supply.updatedBy)}</strong>
                              <span>${escapeHtml(supply.updatedAtLabel)}</span>
                            </div>
                          </td>
                          ${
                            isAdmin()
                              ? `<td data-label="操作">
                                  <div class="table-actions">
                                    <button class="secondary-button small-button" type="button" data-edit-supply="${escapeHtml(supply.id)}">編輯</button>
                                    <button class="danger-button small-button" type="button" data-delete-supply="${escapeHtml(supply.id)}">刪除</button>
                                  </div>
                                </td>`
                              : ""
                          }
                        </tr>
                      `,
                    )
                    .join("")}
                </tbody>
              </table>
            </div>`
      }
    </section>
  `;
}

function renderAdminSection() {
  if (!isAdmin()) {
    return "";
  }

  return `
    <section class="section-block">
      <div class="section-heading">
        <div>
          <p class="section-kicker">ADMIN TOOLS</p>
          <h2>耗材主檔管理</h2>
        </div>
      </div>
      <form id="supplyForm" class="data-form-grid">
        <label class="field">
          <span>耗材編號</span>
          <input name="itemCode" value="${escapeHtml(state.supplyForm.itemCode)}" ${state.editingSupplyId ? "readonly" : ""} required />
        </label>
        <label class="field">
          <span>耗材名稱</span>
          <input name="itemName" value="${escapeHtml(state.supplyForm.itemName)}" required />
        </label>
        <label class="field">
          <span>類別</span>
          <select name="category">${categoryChoicesHtml(state.supplyForm.category)}</select>
        </label>
        <label class="field">
          <span>單位</span>
          <input name="unit" value="${escapeHtml(state.supplyForm.unit)}" required />
        </label>
        <label class="field">
          <span>目前庫存</span>
          <input name="currentStock" type="number" min="0" step="1" value="${escapeHtml(state.supplyForm.currentStock)}" required />
        </label>
        <label class="field">
          <span>安全庫存</span>
          <input name="safetyStock" type="number" min="0" step="1" value="${escapeHtml(state.supplyForm.safetyStock)}" required />
        </label>
        <label class="field field-span-2">
          <span>存放位置</span>
          <input name="location" value="${escapeHtml(state.supplyForm.location)}" placeholder="例如 總庫房 A1" />
        </label>
        <div class="form-actions">
          <button class="primary-button" type="submit">${state.editingSupplyId ? "更新耗材主檔" : "新增耗材主檔"}</button>
          <button id="cancelSupplyEditButton" class="secondary-button" type="button" ${state.editingSupplyId ? "" : "disabled"}>取消編輯</button>
        </div>
      </form>
    </section>
    <section class="section-block">
      <div class="section-heading">
        <div>
          <p class="section-kicker">USER ROLES</p>
          <h2>使用者角色管理</h2>
        </div>
      </div>
      ${
        state.users.length === 0
          ? `<div class="empty-state">目前尚未建立任何 users profile。</div>`
          : `<div class="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>顯示名稱</th>
                    <th>所屬單位</th>
                    <th>角色</th>
                    <th>建立時間</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  ${state.users
                    .map(
                      (user) => `
                        <tr>
                          <td>${escapeHtml(user.email)}</td>
                          <td><input class="inline-input" id="user-display-${escapeHtml(user.id)}" value="${escapeHtml(user.displayName)}" /></td>
                          <td>
                            <select class="inline-select" id="user-station-${escapeHtml(user.id)}">
                              ${stationChoicesHtml(user.station)}
                            </select>
                          </td>
                          <td>
                            <select class="inline-select" id="user-role-${escapeHtml(user.id)}">
                              <option value="admin" ${user.role === "admin" ? "selected" : ""}>admin</option>
                              <option value="user" ${user.role === "user" ? "selected" : ""}>user</option>
                              <option value="viewer" ${user.role === "viewer" ? "selected" : ""}>viewer</option>
                            </select>
                          </td>
                          <td>${escapeHtml(user.createdAtLabel)}</td>
                          <td>
                            <button class="secondary-button small-button" type="button" data-save-user="${escapeHtml(user.id)}">儲存</button>
                          </td>
                        </tr>
                      `,
                    )
                    .join("")}
                </tbody>
              </table>
            </div>`
      }
    </section>
    <section class="section-block">
      <div class="section-heading">
        <div>
          <p class="section-kicker">SEED DATA</p>
          <h2>範例資料工具</h2>
        </div>
      </div>
      <p class="section-helper">可一次寫入 10 筆耗材主檔與 10 筆領用紀錄；users 範例僅提供對照，不會自動建立 Auth 帳號。</p>
      <div class="form-actions">
        <button id="seedSampleButton" class="primary-button" type="button">寫入範例資料</button>
      </div>
      ${
        state.sampleData
          ? `<div class="sample-users-grid">
              ${state.sampleData.users
                .map(
                  (user) => `
                    <article class="sample-user-card">
                      <strong>${escapeHtml(user.email)}</strong>
                      <span>${escapeHtml(user.role)} ・ ${escapeHtml(user.station)}</span>
                      <p>${escapeHtml(user.note)}</p>
                    </article>
                  `,
                )
                .join("")}
            </div>`
          : ""
      }
    </section>
  `;
}

function renderDashboard() {
  if (!state.session?.profile || !state.session.user.email) {
    return;
  }

  root.innerHTML = `
    <div class="page-shell">
      ${renderHeader()}
      <header class="hero">
        <div class="hero-copy">
          <p class="eyebrow">EMS INTERNAL SYSTEM</p>
          <h1>救護耗材控管儀表板 V2</h1>
          <p class="hero-text">
            這一版已改為 Firebase Hosting + Authentication + Firestore 內部系統。未登入者無法進入，所有領用紀錄與庫存異動都以 Firestore 為準。
          </p>
          <div class="hero-system-tags">
            <span class="hero-system-tag">${escapeHtml(state.session.user.email)}</span>
            <span class="hero-system-tag">${escapeHtml(state.session.profile.station)}</span>
            <span class="hero-system-tag">${escapeHtml(roleLabel(state.session.profile.role))}</span>
          </div>
          <div class="hero-actions">
            <a class="hero-link" href="${import.meta.env.BASE_URL}trace.html">前往領用紀錄管理</a>
          </div>
        </div>
        <div class="hero-meta">
          <div class="meta-panel">
            <span>目前角色</span>
            <strong>${escapeHtml(roleLabel(state.session.profile.role))}</strong>
          </div>
          <div class="meta-panel">
            <span>目前可見資料</span>
            <strong>${isAdmin() ? "所有分隊資料與角色管理" : state.session.profile.role === "user" ? "可新增領用紀錄與查看庫存" : "僅查看儀表板與領用紀錄"}</strong>
          </div>
          <div class="meta-panel meta-panel-accent">
            <span>Firebase 專案模式</span>
            <strong>Hosting / Authentication / Firestore</strong>
          </div>
        </div>
      </header>
      ${state.error ? `<section class="notice notice-error">${escapeHtml(state.error)}</section>` : ""}
      ${state.info ? `<section class="notice notice-success">${escapeHtml(state.info)}</section>` : ""}
      <section class="section-block">
        <div class="section-heading">
          <div>
            <p class="section-kicker">SUMMARY</p>
            <h2>今日概況</h2>
          </div>
        </div>
        <div class="summary-grid trace-summary-grid">
          ${renderSummaryCards()}
        </div>
      </section>
      ${renderLowStockPanel()}
      ${renderFilterBar()}
      ${renderCategorySummary()}
      ${renderStationSummary()}
      ${renderRecentUsageSection()}
      ${renderSupplyTable()}
      ${renderAdminSection()}
    </div>
  `;

  bindDashboardEvents();
}

function render() {
  if (!hasFirebaseConfig) {
    root.innerHTML = `
      <div class="bootstrap-shell">
        <div class="bootstrap-card">
          <p class="bootstrap-eyebrow">EMS INTERNAL DASHBOARD</p>
          <h1>尚未完成 Firebase 設定</h1>
          <p class="bootstrap-text">請先建立 .env 並填入 Firebase Web App 參數。</p>
        </div>
      </div>
    `;
    return;
  }

  if (state.isLoading && !state.session) {
    showLoading("正在驗證登入狀態...");
    return;
  }

  if (!state.session) {
    redirectToLogin();
    return;
  }

  if (!state.session.profile) {
    renderProfileBootstrap();
    return;
  }

  renderDashboard();
}

function bindFilterInput(id: string, key: keyof DashboardFilters) {
  const element = document.querySelector<HTMLInputElement | HTMLSelectElement>(id);

  element?.addEventListener("input", (event) => {
    state.filters[key] = event.currentTarget.value;
    renderDashboard();
  });

  element?.addEventListener("change", (event) => {
    state.filters[key] = event.currentTarget.value;
    renderDashboard();
  });
}

function bindDashboardEvents() {
  document.querySelector<HTMLButtonElement>("#logoutButton")?.addEventListener("click", async () => {
    await signOutCurrentUser();
    redirectToLogin();
  });

  bindFilterInput("#filterDateFrom", "dateFrom");
  bindFilterInput("#filterDateTo", "dateTo");
  bindFilterInput("#filterCategory", "category");
  bindFilterInput("#filterStation", "station");
  bindFilterInput("#filterVehicleNo", "vehicleNo");
  bindFilterInput("#filterPurpose", "purpose");
  bindFilterInput("#filterKeyword", "keyword");

  document.querySelector<HTMLButtonElement>("#resetFiltersButton")?.addEventListener("click", () => {
    state.filters = { ...defaultFilters };
    renderDashboard();
  });

  document.querySelector<HTMLButtonElement>("#cancelSupplyEditButton")?.addEventListener("click", () => {
    resetSupplyForm();
    renderDashboard();
  });

  document.querySelector<HTMLFormElement>("#supplyForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();

    try {
      const formData = new FormData(event.currentTarget);
      const payload: SupplyFormInput = {
        itemCode: String(formData.get("itemCode") ?? ""),
        itemName: String(formData.get("itemName") ?? ""),
        category: String(formData.get("category") ?? ""),
        unit: String(formData.get("unit") ?? ""),
        currentStock: String(formData.get("currentStock") ?? ""),
        safetyStock: String(formData.get("safetyStock") ?? ""),
        location: String(formData.get("location") ?? ""),
      };

      await saveSupply(payload, actorIdentity());
      setError(null);
      setInfo(state.editingSupplyId ? "耗材主檔已更新。" : "耗材主檔已新增。");
      resetSupplyForm();
      await refreshDashboardData();
    } catch (error) {
      setError(error instanceof Error ? error.message : "耗材主檔儲存失敗。");
      renderDashboard();
    }
  });

  document.querySelectorAll<HTMLButtonElement>("[data-edit-supply]").forEach((button) => {
    button.addEventListener("click", () => {
      const supply = state.supplies.find((item) => item.id === button.dataset.editSupply);

      if (!supply) {
        return;
      }

      state.editingSupplyId = supply.id;
      state.supplyForm = {
        itemCode: supply.itemCode,
        itemName: supply.itemName,
        category: supply.category,
        unit: supply.unit,
        currentStock: String(supply.currentStock),
        safetyStock: String(supply.safetyStock),
        location: supply.location,
      };
      renderDashboard();
    });
  });

  document.querySelectorAll<HTMLButtonElement>("[data-delete-supply]").forEach((button) => {
    button.addEventListener("click", async () => {
      const supplyId = button.dataset.deleteSupply ?? "";

      if (!supplyId || !window.confirm(`確定刪除耗材主檔 ${supplyId}？`)) {
        return;
      }

      try {
        await deleteSupply(supplyId);
        setError(null);
        setInfo(`耗材主檔 ${supplyId} 已刪除。`);
        await refreshDashboardData();
      } catch (error) {
        setError(error instanceof Error ? error.message : "刪除耗材主檔失敗。");
        renderDashboard();
      }
    });
  });

  document.querySelectorAll<HTMLButtonElement>("[data-save-user]").forEach((button) => {
    button.addEventListener("click", async () => {
      const uid = button.dataset.saveUser ?? "";
      const displayName = (
        document.querySelector<HTMLInputElement>(`#user-display-${uid}`)?.value ?? ""
      ).trim();
      const station = document.querySelector<HTMLSelectElement>(`#user-station-${uid}`)?.value ?? "";
      const role = document.querySelector<HTMLSelectElement>(`#user-role-${uid}`)?.value ?? "";

      try {
        await updateUserProfile({ uid, displayName, station, role });
        setError(null);
        setInfo(`使用者 ${displayName || uid} 已更新角色設定。`);
        await refreshDashboardData();
      } catch (error) {
        setError(error instanceof Error ? error.message : "更新使用者角色失敗。");
        renderDashboard();
      }
    });
  });

  document.querySelector<HTMLButtonElement>("#seedSampleButton")?.addEventListener("click", async () => {
    if (!window.confirm("這會寫入範例耗材主檔與領用紀錄到 Firestore，是否繼續？")) {
      return;
    }

    try {
      await seedSampleDatabase(actorIdentity());
      setError(null);
      setInfo("範例耗材主檔與領用紀錄已寫入 Firestore。");
      await refreshDashboardData();
    } catch (error) {
      setError(error instanceof Error ? error.message : "寫入範例資料失敗。");
      renderDashboard();
    }
  });
}

showLoading("正在初始化 Firebase 與登入狀態...");

observeAuthSession(
  async (session) => {
    state.session = session;
    state.error = null;
    state.info = null;

    if (!session) {
      state.isLoading = false;
      render();
      return;
    }

    if (!session.profile) {
      state.isLoading = false;
      if (!state.bootstrapForm.displayName && session.user.email) {
        state.bootstrapForm.displayName = session.user.email.split("@")[0];
      }
      render();
      return;
    }

    await refreshDashboardData();
  },
  (error) => {
    state.isLoading = false;
    setError(error.message);
    render();
  },
);
