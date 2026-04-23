import "./style.css";

type SupplyStatus = "正常" | "低庫存" | "缺貨";

type PublicSupply = {
  category: string;
  itemCode: string;
  name: string;
  status: SupplyStatus;
  updatedAt: string;
  note: string;
};

type FilterState = {
  search: string;
  category: string;
  status: string;
};

const categoryOrder = [
  "A 自我防護類",
  "B 呼吸道處置類",
  "C 創傷處置類",
  "D 靜脈注射類",
  "E 輔助處置類",
  "H 高級救護處置",
  "I 心臟電擊去顫類",
] as const;

const statusOrder: SupplyStatus[] = ["正常", "低庫存", "缺貨"];

const statusClassMap: Record<SupplyStatus, string> = {
  正常: "status status-normal",
  低庫存: "status status-warning",
  缺貨: "status status-danger",
};

const statusToneMap: Record<SupplyStatus, string> = {
  正常: "tone-normal",
  低庫存: "tone-warning",
  缺貨: "tone-danger",
};

const root = document.querySelector<HTMLDivElement>("#app");

if (!root) {
  throw new Error("Missing #app root element.");
}

const state: {
  supplies: PublicSupply[];
  filters: FilterState;
  error: string | null;
} = {
  supplies: [],
  filters: {
    search: "",
    category: "全部類別",
    status: "全部狀態",
  },
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

function getFilteredSupplies() {
  const keyword = state.filters.search.trim().toLowerCase();

  return state.supplies.filter((supply) => {
    const matchesSearch = keyword
      ? [supply.name, supply.note, supply.itemCode].some((field) =>
          field.toLowerCase().includes(keyword),
        )
      : true;

    const matchesCategory =
      state.filters.category === "全部類別" || supply.category === state.filters.category;
    const matchesStatus =
      state.filters.status === "全部狀態" || supply.status === state.filters.status;

    return matchesSearch && matchesCategory && matchesStatus;
  });
}

function getLatestUpdate() {
  const timestamps = state.supplies
    .map((supply) => new Date(supply.updatedAt).getTime())
    .filter((timestamp) => !Number.isNaN(timestamp));

  if (timestamps.length === 0) {
    return "資料未提供";
  }

  return formatDate(new Date(Math.max(...timestamps)).toISOString());
}

function getStatusCount(status: SupplyStatus) {
  return state.supplies.filter((supply) => supply.status === status).length;
}

function getCategoryCount(category: string) {
  return state.supplies.filter((supply) => supply.category === category).length;
}

function renderSummaryCards() {
  return statusOrder
    .map((status) => {
      const label =
        status === "正常" ? "正常項目數" : status === "低庫存" ? "低庫存項目數" : "缺貨項目數";

      return `
        <article class="summary-card ${statusToneMap[status]}">
          <div>
            <p class="summary-label">${label}</p>
            <strong class="summary-value">${getStatusCount(status)}</strong>
          </div>
          <span class="${statusClassMap[status]}">${status}</span>
        </article>
      `;
    })
    .join("");
}

function renderCategoryBlocks() {
  return categoryOrder
    .map((category) => {
      const isActive = state.filters.category === category;
      const normal = state.supplies.filter(
        (supply) => supply.category === category && supply.status === "正常",
      ).length;
      const lowStock = state.supplies.filter(
        (supply) => supply.category === category && supply.status === "低庫存",
      ).length;
      const outOfStock = state.supplies.filter(
        (supply) => supply.category === category && supply.status === "缺貨",
      ).length;

      return `
        <button
          class="category-card ${isActive ? "is-active" : ""}"
          type="button"
          data-category="${escapeHtml(category)}"
        >
          <div class="category-header">
            <span class="category-code">${escapeHtml(category.slice(0, 1))}</span>
            <strong>${escapeHtml(category)}</strong>
          </div>
          <p class="category-meta">公開項目 ${getCategoryCount(category)} 項</p>
          <div class="category-status-row">
            <span class="mini-status normal">正常 ${normal}</span>
            <span class="mini-status warning">低庫存 ${lowStock}</span>
            <span class="mini-status danger">缺貨 ${outOfStock}</span>
          </div>
        </button>
      `;
    })
    .join("");
}

function renderTableRows(filteredSupplies: PublicSupply[]) {
  return filteredSupplies
    .map(
      (supply) => `
        <tr>
          <td data-label="類別">${escapeHtml(supply.category)}</td>
          <td data-label="品名">
            <div class="name-cell">
              <strong>${escapeHtml(supply.name)}</strong>
              <span>${escapeHtml(supply.itemCode)}</span>
            </div>
          </td>
          <td data-label="狀態">
            <span class="${statusClassMap[supply.status]}">${escapeHtml(supply.status)}</span>
          </td>
          <td data-label="更新時間">${escapeHtml(formatDate(supply.updatedAt))}</td>
          <td data-label="備註">${escapeHtml(supply.note || "-")}</td>
        </tr>
      `,
    )
    .join("");
}

function renderMobileCards(filteredSupplies: PublicSupply[]) {
  return filteredSupplies
    .map(
      (supply) => `
        <article class="mobile-card">
          <div class="mobile-card-top">
            <div>
              <p class="mobile-category">${escapeHtml(supply.category)}</p>
              <h3>${escapeHtml(supply.name)}</h3>
              <p class="mobile-code">${escapeHtml(supply.itemCode)}</p>
            </div>
            <span class="${statusClassMap[supply.status]}">${escapeHtml(supply.status)}</span>
          </div>
          <dl class="mobile-meta">
            <div>
              <dt>更新時間</dt>
              <dd>${escapeHtml(formatDate(supply.updatedAt))}</dd>
            </div>
            <div>
              <dt>備註</dt>
              <dd>${escapeHtml(supply.note || "-")}</dd>
            </div>
          </dl>
        </article>
      `,
    )
    .join("");
}

function bindEvents() {
  const searchInput = document.querySelector<HTMLInputElement>("#searchInput");
  const categorySelect = document.querySelector<HTMLSelectElement>("#categoryFilter");
  const statusSelect = document.querySelector<HTMLSelectElement>("#statusFilter");
  const resetButton = document.querySelector<HTMLButtonElement>("#resetFiltersButton");

  searchInput?.addEventListener("input", (event) => {
    state.filters.search = event.currentTarget.value;
    render();
  });

  categorySelect?.addEventListener("change", (event) => {
    state.filters.category = event.currentTarget.value;
    render();
  });

  statusSelect?.addEventListener("change", (event) => {
    state.filters.status = event.currentTarget.value;
    render();
  });

  resetButton?.addEventListener("click", () => {
    state.filters = {
      search: "",
      category: "全部類別",
      status: "全部狀態",
    };
    render();
  });

  document.querySelectorAll<HTMLButtonElement>("[data-category]").forEach((button) => {
    button.addEventListener("click", () => {
      const selected = button.dataset.category ?? "全部類別";
      state.filters.category =
        state.filters.category === selected ? "全部類別" : selected;
      render();
    });
  });
}

function render() {
  const filteredSupplies = getFilteredSupplies();
  const hasData = state.supplies.length > 0;

  root.innerHTML = `
    <div class="page-shell">
      <nav class="top-nav" aria-label="網站導覽">
        <a class="nav-link is-active" href="${import.meta.env.BASE_URL}">耗材儀表板</a>
        <a class="nav-link" href="${import.meta.env.BASE_URL}trace.html">領取足跡 Prototype</a>
      </nav>

      <header class="hero">
        <div class="hero-copy">
          <p class="eyebrow">Fire Department Public Information</p>
          <h1>救護耗材控管儀表板</h1>
          <p class="hero-text">
            提供民眾與合作單位快速查詢救護耗材公開狀態、各分類更新時間與目前供應狀況。
          </p>
          <div class="hero-actions">
            <a class="hero-link" href="${import.meta.env.BASE_URL}trace.html">查看領取足跡 Prototype</a>
          </div>
        </div>
        <div class="hero-meta">
          <div class="meta-panel">
            <span>最新更新時間</span>
            <strong>${escapeHtml(getLatestUpdate())}</strong>
          </div>
          <div class="meta-panel">
            <span>公開狀態分類</span>
            <strong>正常 / 低庫存 / 缺貨</strong>
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
            <h2>公開摘要</h2>
          </div>
        </div>
        <div class="summary-grid">
          ${renderSummaryCards()}
        </div>
      </section>

      <section class="section-block">
        <div class="section-heading">
          <div>
            <p class="section-kicker">CATEGORIES</p>
            <h2>分類區塊</h2>
          </div>
          <p class="section-helper">點選分類卡片即可快速套用篩選。</p>
        </div>
        <div class="category-grid">
          ${renderCategoryBlocks()}
        </div>
      </section>

      <section class="section-block">
        <div class="section-heading section-heading-stack">
          <div>
            <p class="section-kicker">LIST</p>
            <h2>耗材清單表格</h2>
          </div>
          <div class="filters-grid">
            <label class="field">
              <span>搜尋</span>
              <input id="searchInput" type="search" placeholder="搜尋品名或編號" value="${escapeHtml(
                state.filters.search,
              )}" />
            </label>
            <label class="field">
              <span>類別篩選</span>
              <select id="categoryFilter">
                <option value="全部類別">全部類別</option>
                ${categoryOrder
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
              <span>狀態篩選</span>
              <select id="statusFilter">
                <option value="全部狀態">全部狀態</option>
                ${statusOrder
                  .map(
                    (status) => `
                      <option value="${escapeHtml(status)}" ${
                        status === state.filters.status ? "selected" : ""
                      }>${escapeHtml(status)}</option>
                    `,
                  )
                  .join("")}
              </select>
            </label>
            <button id="resetFiltersButton" class="reset-button" type="button">重設條件</button>
          </div>
        </div>

        ${
          hasData
            ? `
              <div class="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>類別</th>
                      <th>品名</th>
                      <th>狀態</th>
                      <th>更新時間</th>
                      <th>備註</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${renderTableRows(filteredSupplies)}
                  </tbody>
                </table>
              </div>
              <div class="mobile-list">
                ${renderMobileCards(filteredSupplies)}
              </div>
            `
            : `<div class="empty-state">目前沒有可顯示的公開耗材資料。</div>`
        }

        ${
          hasData && filteredSupplies.length === 0
            ? `<div class="empty-state">目前篩選條件沒有符合的資料。</div>`
            : ""
        }
      </section>
    </div>
  `;

  bindEvents();
}

async function loadSupplies() {
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}data/public-supplies.json`);

    if (!response.ok) {
      throw new Error("無法讀取公開耗材資料，請確認 public-supplies.json 是否存在。");
    }

    const data = (await response.json()) as PublicSupply[];
    state.supplies = data;
    state.error = null;
  } catch (error) {
    state.error = error instanceof Error ? error.message : "公開耗材資料讀取失敗。";
  } finally {
    render();
  }
}

render();
void loadSupplies();
