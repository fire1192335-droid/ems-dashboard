import "./style.css";

import { initPwaFeatures } from "./pwa";
import { observeAuthSession, roleLabel, signOutCurrentUser, type AuthSession } from "./services/authService";
import {
  categoryChoicesHtml,
  purposeChoicesHtml,
  stationChoicesHtml,
  type SupplyRecord,
  type UsageRecord,
} from "./services/firebase";
import { listSupplies } from "./services/supplyService";
import {
  createUsageRecord,
  deleteUsageRecord,
  listUsageRecords,
  updateUsageRecord,
  type UsageRecordFormInput,
} from "./services/usageRecordService";

const root = document.querySelector<HTMLDivElement>("#app");

if (!root) {
  throw new Error("Missing #app root element.");
}

initPwaFeatures();

type UsageFilters = {
  dateFrom: string;
  dateTo: string;
  category: string;
  station: string;
  vehicleNo: string;
  purpose: string;
  keyword: string;
};

type UsageFormState = {
  receiveDate: string;
  receiveTime: string;
  receivePeriod: string;
  category: string;
  itemCode: string;
  itemName: string;
  quantity: string;
  unit: string;
  receiver: string;
  station: string;
  vehicleNo: string;
  caseNo: string;
  purpose: string;
  note: string;
};

type UsageState = {
  session: AuthSession | null;
  supplies: SupplyRecord[];
  usageRecords: UsageRecord[];
  filters: UsageFilters;
  form: UsageFormState;
  editingRecordId: string | null;
  isLoading: boolean;
  error: string | null;
  info: string | null;
};

const defaultFilters: UsageFilters = {
  dateFrom: "",
  dateTo: "",
  category: "全部類別",
  station: "全部單位",
  vehicleNo: "",
  purpose: "全部用途",
  keyword: "",
};

function nowDate() {
  return new Date().toISOString().slice(0, 10);
}

function nowTime() {
  return new Date().toLocaleTimeString("zh-TW", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

const defaultForm: UsageFormState = {
  receiveDate: nowDate(),
  receiveTime: nowTime(),
  receivePeriod: "白班",
  category: "A 自我防護類",
  itemCode: "",
  itemName: "",
  quantity: "1",
  unit: "",
  receiver: "",
  station: "第一分隊",
  vehicleNo: "",
  caseNo: "",
  purpose: "出勤使用",
  note: "",
};

const state: UsageState = {
  session: null,
  supplies: [],
  usageRecords: [],
  filters: { ...defaultFilters },
  form: { ...defaultForm },
  editingRecordId: null,
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

function formatDateTime(value: string) {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function showLoading(message: string) {
  root.innerHTML = `
    <div class="bootstrap-shell">
      <div class="bootstrap-card">
        <p class="bootstrap-eyebrow">EMS INTERNAL USAGE RECORDS</p>
        <h1>領用紀錄管理</h1>
        <p class="bootstrap-text">${escapeHtml(message)}</p>
      </div>
    </div>
  `;
}

function redirectToLogin() {
  window.location.href = `${import.meta.env.BASE_URL}login.html?next=trace.html`;
}

function isAdmin() {
  return state.session?.profile?.role === "admin";
}

function canWrite() {
  return state.session?.profile?.role === "admin" || state.session?.profile?.role === "user";
}

function actorIdentity() {
  if (!state.session?.user.email) {
    throw new Error("目前登入帳號缺少 email。");
  }

  return {
    uid: state.session.user.uid,
    email: state.session.user.email,
  };
}

function setSupplyFieldsByItemCode(itemCode: string) {
  const supply = state.supplies.find((item) => item.itemCode === itemCode);

  if (!supply) {
    state.form.itemCode = "";
    state.form.itemName = "";
    state.form.unit = "";
    return;
  }

  state.form.category = supply.category;
  state.form.itemCode = supply.itemCode;
  state.form.itemName = supply.itemName;
  state.form.unit = supply.unit;
}

function resetForm() {
  state.form = {
    ...defaultForm,
    receiveDate: nowDate(),
    receiveTime: nowTime(),
    station: state.session?.profile?.station ?? "第一分隊",
    receiver: state.session?.profile?.displayName ?? "",
  };
  state.editingRecordId = null;
  const firstSupply = state.supplies[0];

  if (firstSupply) {
    setSupplyFieldsByItemCode(firstSupply.itemCode);
  }
}

function getSelectedSupply() {
  return state.supplies.find((item) => item.itemCode === state.form.itemCode) ?? null;
}

function getStockPreview() {
  const supply = getSelectedSupply();
  const quantity = Number(state.form.quantity);
  const editingRecord = state.editingRecordId
    ? state.usageRecords.find((record) => record.id === state.editingRecordId)
    : null;

  if (!supply || !Number.isFinite(quantity)) {
    return "-";
  }

  const baseStock =
    editingRecord && editingRecord.itemCode === supply.itemCode
      ? supply.currentStock + editingRecord.quantity
      : supply.currentStock;

  return String(baseStock - quantity);
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

function getFilteredRecords() {
  const keyword = state.filters.keyword.trim().toLowerCase();
  const vehicleKeyword = state.filters.vehicleNo.trim().toLowerCase();

  return state.usageRecords.filter((record) => {
    const matchesKeyword = keyword
      ? [
          record.itemCode,
          record.itemName,
          record.receiver,
          record.caseNo,
          record.vehicleNo,
          record.station,
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

function getTodayRecords() {
  const today = nowDate();
  return state.usageRecords.filter((record) => record.receiveDate === today);
}

function getLowStockSupplies() {
  return state.supplies.filter((supply) => supply.currentStock <= supply.safetyStock);
}

async function refreshData() {
  state.isLoading = true;
  render();

  try {
    const [supplies, usageRecords] = await Promise.all([listSupplies(), listUsageRecords()]);

    state.supplies = supplies;
    state.usageRecords = usageRecords;
    state.error = null;

    if (!state.editingRecordId && !state.form.itemCode && state.supplies[0]) {
      setSupplyFieldsByItemCode(state.supplies[0].itemCode);
    }
  } catch (error) {
    state.error = error instanceof Error ? error.message : "無法讀取 Firestore 領用紀錄。";
  } finally {
    state.isLoading = false;
    render();
  }
}

function renderHeader() {
  if (!state.session?.profile || !state.session.user.email) {
    return "";
  }

  return `
    <nav class="top-nav" aria-label="系統導覽">
      <a class="nav-link" href="${import.meta.env.BASE_URL}">儀表板</a>
      <a class="nav-link is-active" href="${import.meta.env.BASE_URL}trace.html">領用紀錄</a>
      <div class="session-bar">
        <span class="session-pill">${escapeHtml(state.session.user.email)}</span>
        <span class="session-pill">${escapeHtml(state.session.profile.station)}</span>
        <span class="${state.session.profile.role === "admin" ? "status status-danger" : state.session.profile.role === "user" ? "status status-warning" : "status status-normal"}">${escapeHtml(roleLabel(state.session.profile.role))}</span>
        <button id="logoutButton" class="secondary-button" type="button">登出</button>
      </div>
    </nav>
  `;
}

function renderSummaryCards() {
  const todayRecords = getTodayRecords();
  const todayQuantity = todayRecords.reduce((sum, record) => sum + record.quantity, 0);
  const lowStockCount = getLowStockSupplies().length;

  const cards = [
    { title: "今日領用次數", value: `${todayRecords.length}`, tone: "tone-normal", badge: "Today" },
    { title: "今日領用總數", value: `${todayQuantity}`, tone: "tone-normal", badge: "Quantity" },
    { title: "低庫存品項數", value: `${lowStockCount}`, tone: lowStockCount > 0 ? "tone-danger" : "tone-warning", badge: "Alert" },
    { title: "篩選後紀錄數", value: `${getFilteredRecords().length}`, tone: "tone-warning", badge: "Filtered" },
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

function renderLowStockAlerts() {
  const supplies = getLowStockSupplies().slice(0, 6);

  return `
    <section class="section-block section-alert">
      <div class="section-heading">
        <div>
          <p class="section-kicker">STOCK RISK</p>
          <h2>低庫存提醒</h2>
        </div>
      </div>
      ${
        supplies.length === 0
          ? `<div class="empty-state">目前沒有低庫存或缺貨項目。</div>`
          : `<div class="alert-list">
              ${supplies
                .map(
                  (supply) => `
                    <article class="alert-card">
                      <div>
                        <strong>${escapeHtml(supply.itemName)}</strong>
                        <p>${escapeHtml(supply.itemCode)} ・ ${escapeHtml(supply.category)}</p>
                      </div>
                      <div class="alert-values">
                        <span class="${supply.status === "缺貨" ? "status status-danger" : "status status-warning"}">${escapeHtml(supply.status)}</span>
                        <b>${supply.currentStock} / 安全 ${supply.safetyStock}</b>
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

function renderFilters() {
  return `
    <section class="section-block">
      <div class="section-heading section-heading-stack">
        <div>
          <p class="section-kicker">FILTERS</p>
          <h2>查詢條件</h2>
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
            <input id="filterVehicleNo" value="${escapeHtml(state.filters.vehicleNo)}" placeholder="例如 91車" />
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

function renderFormSection() {
  if (!canWrite()) {
    return "";
  }

  const supplyOptions = state.supplies
    .filter((supply) => supply.category === state.form.category)
    .map(
      (supply) =>
        `<option value="${escapeHtml(supply.itemCode)}" ${state.form.itemCode === supply.itemCode ? "selected" : ""}>${escapeHtml(supply.itemCode)}｜${escapeHtml(supply.itemName)}</option>`,
    )
    .join("");

  const selectedSupply = getSelectedSupply();

  return `
    <section class="section-block">
      <div class="section-heading">
        <div>
          <p class="section-kicker">WRITEBACK</p>
          <h2>${state.editingRecordId ? "修改領用紀錄" : "新增領用紀錄"}</h2>
        </div>
      </div>
      <form id="usageForm" class="data-form-grid">
        <label class="field">
          <span>領取日期</span>
          <input name="receiveDate" type="date" value="${escapeHtml(state.form.receiveDate)}" required />
        </label>
        <label class="field">
          <span>領取時間</span>
          <input name="receiveTime" type="time" value="${escapeHtml(state.form.receiveTime)}" required />
        </label>
        <label class="field">
          <span>領取時段</span>
          <input name="receivePeriod" value="${escapeHtml(state.form.receivePeriod)}" placeholder="例如 白班 / 夜班" required />
        </label>
        <label class="field">
          <span>類別</span>
          <select name="category" id="usageCategorySelect">${categoryChoicesHtml(state.form.category)}</select>
        </label>
        <label class="field">
          <span>耗材編號</span>
          <select name="itemCode" id="usageItemCodeSelect">${supplyOptions}</select>
        </label>
        <label class="field">
          <span>耗材名稱</span>
          <input name="itemName" value="${escapeHtml(state.form.itemName)}" readonly />
        </label>
        <label class="field">
          <span>領取數量</span>
          <input name="quantity" type="number" min="1" step="1" value="${escapeHtml(state.form.quantity)}" required />
        </label>
        <label class="field">
          <span>單位</span>
          <input name="unit" value="${escapeHtml(state.form.unit)}" readonly />
        </label>
        <label class="field">
          <span>領取人</span>
          <input name="receiver" value="${escapeHtml(state.form.receiver)}" required />
        </label>
        <label class="field">
          <span>所屬單位</span>
          <select name="station">${stationChoicesHtml(state.form.station)}</select>
        </label>
        <label class="field">
          <span>車號</span>
          <input name="vehicleNo" value="${escapeHtml(state.form.vehicleNo)}" placeholder="例如 91車" />
        </label>
        <label class="field">
          <span>案件編號</span>
          <input name="caseNo" value="${escapeHtml(state.form.caseNo)}" placeholder="例如 EMS-20260502-001" />
        </label>
        <label class="field">
          <span>用途</span>
          <select name="purpose">${purposeChoicesHtml(state.form.purpose)}</select>
        </label>
        <label class="field">
          <span>目前庫存</span>
          <input value="${selectedSupply ? `${selectedSupply.currentStock} ${selectedSupply.unit}` : "-"}" readonly />
        </label>
        <label class="field">
          <span>領取後庫存預覽</span>
          <input value="${escapeHtml(getStockPreview())}" readonly />
        </label>
        <label class="field field-span-2">
          <span>備註</span>
          <textarea name="note" rows="3" placeholder="可填寫補登、追蹤或案件補充說明">${escapeHtml(state.form.note)}</textarea>
        </label>
        <div class="form-actions">
          <button class="primary-button" type="submit">${state.editingRecordId ? "更新領用紀錄" : "新增領用紀錄"}</button>
          <button id="cancelUsageEditButton" class="secondary-button" type="button" ${state.editingRecordId ? "" : "disabled"}>取消編輯</button>
        </div>
      </form>
    </section>
  `;
}

function renderRecordsTable() {
  const records = getFilteredRecords();

  return `
    <section class="section-block">
      <div class="section-heading">
        <div>
          <p class="section-kicker">USAGE LOG</p>
          <h2>領用紀錄清單</h2>
        </div>
      </div>
      ${
        records.length === 0
          ? `<div class="empty-state">目前沒有符合條件的領用紀錄。</div>`
          : `<div class="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>日期時間</th>
                    <th>時段</th>
                    <th>類別 / 耗材</th>
                    <th>數量</th>
                    <th>領取人 / 單位</th>
                    <th>車號 / 案件</th>
                    <th>用途</th>
                    <th>領後庫存</th>
                    <th>備註</th>
                    ${isAdmin() ? "<th>操作</th>" : ""}
                  </tr>
                </thead>
                <tbody>
                  ${records
                    .map(
                      (record) => `
                        <tr>
                          <td>${escapeHtml(record.receiveDate)} ${escapeHtml(record.receiveTime)}</td>
                          <td>${escapeHtml(record.receivePeriod)}</td>
                          <td>
                            <div class="name-cell">
                              <strong>${escapeHtml(record.itemName)}</strong>
                              <span>${escapeHtml(record.itemCode)} ・ ${escapeHtml(record.category)}</span>
                            </div>
                          </td>
                          <td>${record.quantity}${escapeHtml(record.unit)}</td>
                          <td>
                            <div class="trace-inline-meta">
                              <strong>${escapeHtml(record.receiver)}</strong>
                              <span>${escapeHtml(record.station)}</span>
                            </div>
                          </td>
                          <td>
                            <div class="trace-inline-meta">
                              <strong>${escapeHtml(record.vehicleNo || "-")}</strong>
                              <span>${escapeHtml(record.caseNo || "-")}</span>
                            </div>
                          </td>
                          <td>${escapeHtml(record.purpose)}</td>
                          <td>${record.stockAfterUse}</td>
                          <td>${escapeHtml(record.note || "-")}</td>
                          ${
                            isAdmin()
                              ? `<td>
                                  <div class="table-actions">
                                    <button class="secondary-button small-button" type="button" data-edit-record="${escapeHtml(record.id)}">編輯</button>
                                    <button class="danger-button small-button" type="button" data-delete-record="${escapeHtml(record.id)}">刪除</button>
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

function renderPage() {
  if (!state.session?.profile || !state.session.user.email) {
    return;
  }

  root.innerHTML = `
    <div class="page-shell">
      ${renderHeader()}
      <header class="hero hero-trace">
        <div class="hero-copy">
          <p class="eyebrow">EMS INTERNAL USAGE RECORDS</p>
          <h1>領用紀錄管理</h1>
          <p class="hero-text">
            這一頁使用 Firestore 交易寫入領用紀錄，新增時會同步扣除 supplies.currentStock；若寫入失敗，畫面會直接回報錯誤，不會假裝成功。
          </p>
          <div class="hero-system-tags">
            <span class="hero-system-tag">${escapeHtml(state.session.user.email)}</span>
            <span class="hero-system-tag">${escapeHtml(state.session.profile.station)}</span>
            <span class="hero-system-tag">${escapeHtml(roleLabel(state.session.profile.role))}</span>
          </div>
        </div>
        <div class="hero-meta">
          <div class="meta-panel">
            <span>頁面用途</span>
            <strong>新增 / 查詢 / 管理領用紀錄</strong>
          </div>
          <div class="meta-panel">
            <span>權限範圍</span>
            <strong>${isAdmin() ? "admin 可新增、修改、刪除" : canWrite() ? "user 可新增領用紀錄" : "viewer 僅可檢視"}</strong>
          </div>
          <div class="meta-panel meta-panel-accent">
            <span>同步邏輯</span>
            <strong>Firestore transaction 實際扣庫存</strong>
          </div>
        </div>
      </header>
      ${state.error ? `<section class="notice notice-error">${escapeHtml(state.error)}</section>` : ""}
      ${state.info ? `<section class="notice notice-success">${escapeHtml(state.info)}</section>` : ""}
      <section class="section-block">
        <div class="section-heading">
          <div>
            <p class="section-kicker">SUMMARY</p>
            <h2>今日與篩選摘要</h2>
          </div>
        </div>
        <div class="summary-grid trace-summary-grid">
          ${renderSummaryCards()}
        </div>
      </section>
      ${renderLowStockAlerts()}
      ${renderFilters()}
      ${renderFormSection()}
      ${renderRecordsTable()}
    </div>
  `;

  bindEvents();
}

function render() {
  if (!state.session) {
    redirectToLogin();
    return;
  }

  if (!state.session.profile) {
    window.location.href = `${import.meta.env.BASE_URL}index.html`;
    return;
  }

  renderPage();
}

function bindFilter(id: string, key: keyof UsageFilters) {
  const element = document.querySelector<HTMLInputElement | HTMLSelectElement>(id);

  element?.addEventListener("input", (event) => {
    state.filters[key] = event.currentTarget.value;
    renderPage();
  });

  element?.addEventListener("change", (event) => {
    state.filters[key] = event.currentTarget.value;
    renderPage();
  });
}

function fillFormFromRecord(record: UsageRecord) {
  state.editingRecordId = record.id;
  state.form = {
    receiveDate: record.receiveDate,
    receiveTime: record.receiveTime,
    receivePeriod: record.receivePeriod,
    category: record.category,
    itemCode: record.itemCode,
    itemName: record.itemName,
    quantity: String(record.quantity),
    unit: record.unit,
    receiver: record.receiver,
    station: record.station,
    vehicleNo: record.vehicleNo,
    caseNo: record.caseNo,
    purpose: record.purpose,
    note: record.note,
  };
}

function bindEvents() {
  document.querySelector<HTMLButtonElement>("#logoutButton")?.addEventListener("click", async () => {
    await signOutCurrentUser();
    redirectToLogin();
  });

  bindFilter("#filterDateFrom", "dateFrom");
  bindFilter("#filterDateTo", "dateTo");
  bindFilter("#filterCategory", "category");
  bindFilter("#filterStation", "station");
  bindFilter("#filterVehicleNo", "vehicleNo");
  bindFilter("#filterPurpose", "purpose");
  bindFilter("#filterKeyword", "keyword");

  document.querySelector<HTMLButtonElement>("#resetFiltersButton")?.addEventListener("click", () => {
    state.filters = { ...defaultFilters };
    renderPage();
  });

  document.querySelector<HTMLSelectElement>("#usageCategorySelect")?.addEventListener("change", (event) => {
    state.form.category = event.currentTarget.value;
    const firstSupply = state.supplies.find((item) => item.category === state.form.category);
    if (firstSupply) {
      setSupplyFieldsByItemCode(firstSupply.itemCode);
    }
    renderPage();
  });

  document.querySelector<HTMLSelectElement>("#usageItemCodeSelect")?.addEventListener("change", (event) => {
    setSupplyFieldsByItemCode(event.currentTarget.value);
    renderPage();
  });

  document.querySelector<HTMLButtonElement>("#cancelUsageEditButton")?.addEventListener("click", () => {
    resetForm();
    renderPage();
  });

  document.querySelector<HTMLFormElement>("#usageForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const payload: UsageRecordFormInput = {
      receiveDate: String(formData.get("receiveDate") ?? ""),
      receiveTime: String(formData.get("receiveTime") ?? ""),
      receivePeriod: String(formData.get("receivePeriod") ?? ""),
      category: String(formData.get("category") ?? ""),
      itemCode: String(formData.get("itemCode") ?? ""),
      itemName: String(formData.get("itemName") ?? ""),
      quantity: String(formData.get("quantity") ?? ""),
      unit: String(formData.get("unit") ?? ""),
      receiver: String(formData.get("receiver") ?? ""),
      station: String(formData.get("station") ?? ""),
      vehicleNo: String(formData.get("vehicleNo") ?? ""),
      caseNo: String(formData.get("caseNo") ?? ""),
      purpose: String(formData.get("purpose") ?? ""),
      note: String(formData.get("note") ?? ""),
    };

    try {
      if (state.editingRecordId) {
        await updateUsageRecord(state.editingRecordId, payload, actorIdentity());
        state.info = "領用紀錄已更新，相關庫存也已同步調整。";
      } else {
        await createUsageRecord(payload, actorIdentity());
        state.info = "領用紀錄已建立，庫存已同步扣除。";
      }

      state.error = null;
      resetForm();
      await refreshData();
    } catch (error) {
      state.error = error instanceof Error ? error.message : "寫入領用紀錄失敗。";
      renderPage();
    }
  });

  document.querySelectorAll<HTMLButtonElement>("[data-edit-record]").forEach((button) => {
    button.addEventListener("click", () => {
      const record = state.usageRecords.find((item) => item.id === button.dataset.editRecord);

      if (!record) {
        return;
      }

      fillFormFromRecord(record);
      renderPage();
    });
  });

  document.querySelectorAll<HTMLButtonElement>("[data-delete-record]").forEach((button) => {
    button.addEventListener("click", async () => {
      const recordId = button.dataset.deleteRecord ?? "";

      if (!recordId || !window.confirm("確定刪除這筆領用紀錄並回補庫存？")) {
        return;
      }

      try {
        await deleteUsageRecord(recordId, actorIdentity());
        state.error = null;
        state.info = "領用紀錄已刪除，庫存已回補。";
        await refreshData();
      } catch (error) {
        state.error = error instanceof Error ? error.message : "刪除領用紀錄失敗。";
        renderPage();
      }
    });
  });
}

showLoading("正在驗證登入狀態...");

observeAuthSession(
  async (session) => {
    state.session = session;
    state.error = null;

    if (!session) {
      state.isLoading = false;
      render();
      return;
    }

    if (!session.profile) {
      state.isLoading = false;
      render();
      return;
    }

    if (!state.form.receiver) {
      state.form.receiver = session.profile.displayName;
      state.form.station = session.profile.station;
    }

    await refreshData();
  },
  (error) => {
    state.isLoading = false;
    state.error = error.message;
    render();
  },
);
