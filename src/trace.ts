import "./style.css";

type TraceRecord = {
  recordId: string;
  createdAt: string;
  category: string;
  itemCode: string;
  itemName: string;
  quantity: number;
  unit: string;
  takenBy: string;
  team: string;
  vehicleNo: string;
  caseNo: string;
  purpose: string;
  stockAfter: number | null;
  note: string;
};

type TraceResponse = {
  meta: {
    sheetName: string;
    generatedAt: string;
    total: number;
  };
  records: TraceRecord[];
};

type TraceFilters = {
  search: string;
  category: string;
  team: string;
  period: "all" | "today" | "week";
};

const root = document.querySelector<HTMLDivElement>("#app");

if (!root) {
  throw new Error("Missing #app root element.");
}

const state: {
  records: TraceRecord[];
  filters: TraceFilters;
  error: string | null;
  generatedAt: string;
} = {
  records: [],
  filters: {
    search: "",
    category: "全部類別",
    team: "全部單位",
    period: "all",
  },
  error: null,
  generatedAt: "",
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatDate(value: string) {
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

function getCategoryOptions() {
  return [...new Set(state.records.map((record) => record.category))];
}

function getTeamOptions() {
  return [...new Set(state.records.map((record) => record.team))];
}

function isWithinPeriod(record: TraceRecord) {
  if (state.filters.period === "all") {
    return true;
  }

  const createdAt = new Date(record.createdAt).getTime();

  if (Number.isNaN(createdAt)) {
    return true;
  }

  const generatedAt = state.generatedAt ? new Date(state.generatedAt).getTime() : Date.now();
  const oneDay = 24 * 60 * 60 * 1000;

  if (state.filters.period === "today") {
    return generatedAt - createdAt <= oneDay;
  }

  return generatedAt - createdAt <= 7 * oneDay;
}

function getFilteredRecords() {
  const keyword = state.filters.search.trim().toLowerCase();

  return state.records.filter((record) => {
    const matchesKeyword = keyword
      ? [record.itemName, record.itemCode, record.takenBy, record.caseNo, record.vehicleNo]
          .filter(Boolean)
          .some((field) => field.toLowerCase().includes(keyword))
      : true;

    const matchesCategory =
      state.filters.category === "全部類別" || record.category === state.filters.category;
    const matchesTeam = state.filters.team === "全部單位" || record.team === state.filters.team;

    return matchesKeyword && matchesCategory && matchesTeam && isWithinPeriod(record);
  });
}

function getDistinctVehicles(records: TraceRecord[]) {
  return new Set(records.map((record) => record.vehicleNo).filter(Boolean)).size;
}

function getDistinctTakers(records: TraceRecord[]) {
  return new Set(records.map((record) => record.takenBy).filter(Boolean)).size;
}

function getCaseLinkedCount(records: TraceRecord[]) {
  return new Set(records.map((record) => record.caseNo).filter(Boolean)).size;
}

function getRiskCount(records: TraceRecord[]) {
  return records.filter((record) => record.stockAfter === 0 || record.stockAfter === 4).length;
}

function getPendingConfirmCount(records: TraceRecord[]) {
  return records.filter(
    (record) =>
      record.stockAfter === 0 ||
      record.note.includes("補登") ||
      record.note.includes("待") ||
      record.purpose === "補充車備",
  ).length;
}

function getTopItems(records: TraceRecord[]) {
  const totals = new Map<string, { itemName: string; total: number; category: string }>();

  for (const record of records) {
    const key = `${record.itemCode}-${record.itemName}`;
    const existing = totals.get(key);

    if (existing) {
      existing.total += record.quantity;
      continue;
    }

    totals.set(key, {
      itemName: record.itemName,
      total: record.quantity,
      category: record.category,
    });
  }

  return [...totals.values()].sort((a, b) => b.total - a.total).slice(0, 4);
}

function getRecentAlerts(records: TraceRecord[]) {
  return records
    .filter((record) => record.stockAfter === 0 || record.stockAfter === 4)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 4);
}

function renderSummary(records: TraceRecord[]) {
  const todayRecords = state.records.filter((record) => {
    const generatedAt = state.generatedAt ? new Date(state.generatedAt).getTime() : Date.now();
    const createdAt = new Date(record.createdAt).getTime();

    return !Number.isNaN(createdAt) && generatedAt - createdAt <= 24 * 60 * 60 * 1000;
  });

  const cards = [
    {
      title: "今日領取筆數",
      value: `${todayRecords.length}`,
      tone: "tone-normal",
      badge: "Today",
    },
    {
      title: "目前篩選結果",
      value: `${records.length}`,
      tone: "tone-warning",
      badge: "Filtered",
    },
    {
      title: "涉及車輛數",
      value: `${getDistinctVehicles(records)}`,
      tone: "tone-normal",
      badge: "Vehicles",
    },
    {
      title: "交班待確認",
      value: `${getPendingConfirmCount(records)}`,
      tone: "tone-danger",
      badge: "Pending",
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

function renderControlRibbon(records: TraceRecord[]) {
  const cards = [
    {
      label: "當班領取人員",
      value: `${getDistinctTakers(records)} 人`,
      note: "可快速確認是否涉及多車多員共同領取",
    },
    {
      label: "關聯案件數",
      value: `${getCaseLinkedCount(records)} 件`,
      note: "方便回頭追查案件與耗材使用軌跡",
    },
    {
      label: "高風險異動",
      value: `${getRiskCount(records)} 筆`,
      note: "含領後缺貨與低庫存邊界值",
    },
    {
      label: "值班重點",
      value: getPendingConfirmCount(records) > 0 ? "需交班" : "已清點",
      note: "示範內部頁可加上交班註記與追蹤機制",
    },
  ];

  return `
    <section class="section-block trace-ribbon-block">
      <div class="section-heading">
        <div>
          <p class="section-kicker">CONTROL RIBBON</p>
          <h2>值班控管帶</h2>
        </div>
        <p class="section-helper">這一排更接近正式內部系統首頁的作業訊號，不只是查詢，而是提示你下一步要看哪裡。</p>
      </div>
      <div class="trace-ribbon-grid">
        ${cards
          .map(
            (card) => `
              <article class="trace-ribbon-card">
                <p>${card.label}</p>
                <strong>${card.value}</strong>
                <span>${card.note}</span>
              </article>
            `,
          )
          .join("")}
      </div>
    </section>
  `;
}

function renderRows(records: TraceRecord[]) {
  return records
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .map((record) => {
      const riskClass =
        record.stockAfter === 0
          ? "status status-danger"
          : record.stockAfter === 4
            ? "status status-warning"
            : "status status-normal";

      const riskLabel =
        record.stockAfter === 0 ? "缺貨風險" : record.stockAfter === 4 ? "低庫存注意" : "正常";

      return `
        <tr>
          <td data-label="時間">${escapeHtml(formatDate(record.createdAt))}</td>
          <td data-label="耗材">
            <div class="name-cell">
              <strong>${escapeHtml(record.itemName)}</strong>
              <span>${escapeHtml(record.itemCode)} ・ ${escapeHtml(record.category)}</span>
            </div>
          </td>
          <td data-label="領取資訊">
            <div class="trace-inline-meta">
              <strong>${escapeHtml(String(record.quantity))}${escapeHtml(record.unit)}</strong>
              <span>${escapeHtml(record.purpose)}</span>
            </div>
          </td>
          <td data-label="領取人">${escapeHtml(record.takenBy)}</td>
          <td data-label="單位 / 車號">
            <div class="trace-inline-meta">
              <strong>${escapeHtml(record.team)}</strong>
              <span>${escapeHtml(record.vehicleNo || "-")}</span>
            </div>
          </td>
          <td data-label="案件 / 庫存">
            <div class="trace-inline-meta">
              <strong>${escapeHtml(record.caseNo || "-")}</strong>
              <span>領後庫存：${record.stockAfter ?? "-"}</span>
            </div>
          </td>
          <td data-label="風險">
            <span class="${riskClass}">${riskLabel}</span>
          </td>
        </tr>
      `;
    })
    .join("");
}

function renderMobileCards(records: TraceRecord[]) {
  return records
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .map((record) => {
      const riskClass =
        record.stockAfter === 0
          ? "status status-danger"
          : record.stockAfter === 4
            ? "status status-warning"
            : "status status-normal";

      const riskLabel =
        record.stockAfter === 0 ? "缺貨風險" : record.stockAfter === 4 ? "低庫存注意" : "正常";

      return `
        <article class="mobile-card">
          <div class="mobile-card-top">
            <div>
              <p class="mobile-category">${escapeHtml(record.category)}</p>
              <h3>${escapeHtml(record.itemName)}</h3>
              <p class="mobile-code">${escapeHtml(record.itemCode)} ・ ${escapeHtml(record.takenBy)}</p>
            </div>
            <span class="${riskClass}">${riskLabel}</span>
          </div>
          <dl class="mobile-meta">
            <div>
              <dt>時間</dt>
              <dd>${escapeHtml(formatDate(record.createdAt))}</dd>
            </div>
            <div>
              <dt>數量 / 用途</dt>
              <dd>${escapeHtml(String(record.quantity))}${escapeHtml(record.unit)} ・ ${escapeHtml(record.purpose)}</dd>
            </div>
            <div>
              <dt>單位 / 車號</dt>
              <dd>${escapeHtml(record.team)} ${escapeHtml(record.vehicleNo || "")}</dd>
            </div>
            <div>
              <dt>案件 / 領後庫存</dt>
              <dd>${escapeHtml(record.caseNo || "-")} ・ ${record.stockAfter ?? "-"}</dd>
            </div>
          </dl>
        </article>
      `;
    })
    .join("");
}

function renderSpotlight(records: TraceRecord[]) {
  const topItems = getTopItems(records);
  const alerts = getRecentAlerts(records);
  const handoverItems = records
    .filter(
      (record) =>
        record.stockAfter === 0 ||
        record.note.includes("補登") ||
        record.note.includes("待") ||
        record.purpose === "補充車備",
    )
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 4);
  const caseTimeline = records
    .filter((record) => record.caseNo)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 4);

  return `
    <section class="section-block">
      <div class="section-heading">
        <div>
          <p class="section-kicker">SPOTLIGHT</p>
          <h2>Prototype 觀察面板</h2>
        </div>
        <p class="section-helper">這一區示範未來可延伸成主管追蹤區、車備稽核區或補貨提醒區。</p>
      </div>

      <div class="trace-spotlight-grid">
        <article class="trace-panel">
          <h3>近期最常領取耗材</h3>
          <div class="trace-list">
            ${topItems
              .map(
                (item) => `
                  <div class="trace-list-item">
                    <div>
                      <strong>${escapeHtml(item.itemName)}</strong>
                      <span>${escapeHtml(item.category)}</span>
                    </div>
                    <b>${escapeHtml(String(item.total))}</b>
                  </div>
                `,
              )
              .join("")}
          </div>
        </article>

        <article class="trace-panel">
          <h3>需追蹤的異動</h3>
          <div class="trace-list">
            ${alerts
              .map(
                (record) => `
                  <div class="trace-list-item">
                    <div>
                      <strong>${escapeHtml(record.itemName)}</strong>
                      <span>${escapeHtml(formatDate(record.createdAt))} ・ ${escapeHtml(record.team)}</span>
                    </div>
                    <b>${record.stockAfter === 0 ? "缺貨" : "低庫存"}</b>
                  </div>
                `,
              )
              .join("")}
          </div>
        </article>

        <article class="trace-panel">
          <h3>交班待確認事項</h3>
          <div class="trace-list">
            ${handoverItems
              .map(
                (record) => `
                  <div class="trace-list-item">
                    <div>
                      <strong>${escapeHtml(record.itemName)}</strong>
                      <span>${escapeHtml(formatDate(record.createdAt))} ・ ${escapeHtml(record.takenBy)} ・ ${escapeHtml(record.team)}</span>
                    </div>
                    <b>${record.stockAfter === 0 ? "補貨" : "確認"}</b>
                  </div>
                `,
              )
              .join("")}
          </div>
        </article>

        <article class="trace-panel">
          <h3>近期案件足跡</h3>
          <div class="trace-list">
            ${caseTimeline
              .map(
                (record) => `
                  <div class="trace-list-item">
                    <div>
                      <strong>${escapeHtml(record.caseNo)}</strong>
                      <span>${escapeHtml(record.itemName)} ・ ${escapeHtml(record.vehicleNo || record.team)}</span>
                    </div>
                    <b>${escapeHtml(record.takenBy)}</b>
                  </div>
                `,
              )
              .join("")}
          </div>
        </article>
      </div>
    </section>
  `;
}

function bindEvents() {
  const searchInput = document.querySelector<HTMLInputElement>("#traceSearchInput");
  const categorySelect = document.querySelector<HTMLSelectElement>("#traceCategoryFilter");
  const teamSelect = document.querySelector<HTMLSelectElement>("#traceTeamFilter");
  const periodSelect = document.querySelector<HTMLSelectElement>("#tracePeriodFilter");
  const resetButton = document.querySelector<HTMLButtonElement>("#traceResetFiltersButton");

  searchInput?.addEventListener("input", (event) => {
    state.filters.search = event.currentTarget.value;
    render();
  });

  categorySelect?.addEventListener("change", (event) => {
    state.filters.category = event.currentTarget.value;
    render();
  });

  teamSelect?.addEventListener("change", (event) => {
    state.filters.team = event.currentTarget.value;
    render();
  });

  periodSelect?.addEventListener("change", (event) => {
    state.filters.period = event.currentTarget.value as TraceFilters["period"];
    render();
  });

  resetButton?.addEventListener("click", () => {
    state.filters = {
      search: "",
      category: "全部類別",
      team: "全部單位",
      period: "all",
    };
    render();
  });
}

function render() {
  const records = getFilteredRecords();
  const hasData = state.records.length > 0;
  const categoryOptions = getCategoryOptions();
  const teamOptions = getTeamOptions();

  root.innerHTML = `
    <div class="page-shell">
      <nav class="top-nav" aria-label="網站導覽">
        <a class="nav-link" href="${import.meta.env.BASE_URL}">耗材儀表板</a>
        <a class="nav-link is-active" href="${import.meta.env.BASE_URL}trace.html">領取足跡 Prototype</a>
      </nav>

      <header class="hero hero-trace">
        <div class="hero-copy">
          <p class="eyebrow">Internal Trace Prototype</p>
          <h1>領取足跡 Prototype</h1>
          <p class="hero-text">
            這一頁示範未來若把 Google 表單 / Google Sheets 的領取紀錄接進網站，主管與值班人員可以如何快速追蹤領用流向、缺貨風險與車備異動。
          </p>
          <div class="hero-system-tags">
            <span class="hero-system-tag">值班模式</span>
            <span class="hero-system-tag">交班追蹤</span>
            <span class="hero-system-tag">案件回查</span>
          </div>
          <div class="hero-actions">
            <a class="hero-link" href="${import.meta.env.BASE_URL}">回到耗材儀表板</a>
          </div>
        </div>
        <div class="hero-meta">
          <div class="meta-panel">
            <span>資料來源</span>
            <strong>${escapeHtml("Google 表單 / Google Sheets Prototype")}</strong>
          </div>
          <div class="meta-panel">
            <span>最後同步</span>
            <strong>${escapeHtml(state.generatedAt ? formatDate(state.generatedAt) : "資料未提供")}</strong>
          </div>
          <div class="meta-panel meta-panel-accent">
            <span>內部首頁定位</span>
            <strong>值班人員先看待辦，再查明細</strong>
          </div>
        </div>
      </header>

      ${
        state.error
          ? `<section class="notice notice-error">${escapeHtml(state.error)}</section>`
          : ""
      }

      <section class="section-block">
        <div class="section-heading">
          <div>
            <p class="section-kicker">SUMMARY</p>
            <h2>領取摘要</h2>
          </div>
          <p class="section-helper">這裡可延伸成主管每日晨會用的異動概況卡。</p>
        </div>
        <div class="summary-grid trace-summary-grid">
          ${renderSummary(records)}
        </div>
      </section>

      ${renderControlRibbon(records)}

      ${renderSpotlight(records)}

      <section class="section-block">
        <div class="section-heading section-heading-stack">
          <div>
            <p class="section-kicker">TRACE LOG</p>
            <h2>領取紀錄查詢</h2>
          </div>
          <div class="filters-grid trace-filters-grid">
            <label class="field">
              <span>搜尋</span>
              <input
                id="traceSearchInput"
                type="search"
                placeholder="搜尋耗材、領取人、案件編號"
                value="${escapeHtml(state.filters.search)}"
              />
            </label>
            <label class="field">
              <span>類別</span>
              <select id="traceCategoryFilter">
                <option value="全部類別">全部類別</option>
                ${categoryOptions
                  .map(
                    (category) => `
                      <option value="${escapeHtml(category)}" ${
                        category === state.filters.category ? "selected" : ""
                      }>${escapeHtml(category)}</option>
                    `,
                  )
                  .join("")}
              </select>
            </label>
            <label class="field">
              <span>單位</span>
              <select id="traceTeamFilter">
                <option value="全部單位">全部單位</option>
                ${teamOptions
                  .map(
                    (team) => `
                      <option value="${escapeHtml(team)}" ${
                        team === state.filters.team ? "selected" : ""
                      }>${escapeHtml(team)}</option>
                    `,
                  )
                  .join("")}
              </select>
            </label>
            <label class="field">
              <span>期間</span>
              <select id="tracePeriodFilter">
                <option value="all" ${state.filters.period === "all" ? "selected" : ""}>全部期間</option>
                <option value="today" ${state.filters.period === "today" ? "selected" : ""}>近 24 小時</option>
                <option value="week" ${state.filters.period === "week" ? "selected" : ""}>近 7 日</option>
              </select>
            </label>
            <button id="traceResetFiltersButton" class="reset-button" type="button">重設條件</button>
          </div>
        </div>

        ${
          hasData
            ? `
              <div class="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>時間</th>
                      <th>耗材</th>
                      <th>領取資訊</th>
                      <th>領取人</th>
                      <th>單位 / 車號</th>
                      <th>案件 / 庫存</th>
                      <th>風險</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${renderRows(records)}
                  </tbody>
                </table>
              </div>
              <div class="mobile-list">
                ${renderMobileCards(records)}
              </div>
            `
            : `<div class="empty-state">目前沒有可顯示的領取紀錄。</div>`
        }

        ${
          hasData && records.length === 0
            ? `<div class="empty-state">目前篩選條件沒有符合的領取紀錄。</div>`
            : ""
        }
      </section>
    </div>
  `;

  bindEvents();
}

async function loadTraceRecords() {
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}data/trace-records.json`);

    if (!response.ok) {
      throw new Error("無法讀取領取足跡資料，請確認 trace-records.json 是否存在。");
    }

    const data = (await response.json()) as TraceResponse;
    state.records = data.records;
    state.generatedAt = data.meta.generatedAt;
    state.error = null;
  } catch (error) {
    state.error = error instanceof Error ? error.message : "領取足跡資料讀取失敗。";
  } finally {
    render();
  }
}

render();
void loadTraceRecords();
