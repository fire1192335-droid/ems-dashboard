(function () {
    const dataset = window.inventoryDashboardData;

    if (!dataset || !Array.isArray(dataset.categories)) {
        throw new Error("找不到 inventoryDashboardData，請確認 data/inventory-data.js 已載入。");
    }

    const numberFormatter = new Intl.NumberFormat("zh-TW");
    const timeFormatter = new Intl.DateTimeFormat("zh-TW", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit"
    });

    const statusMeta = {
        stockout: { label: "缺貨", priority: 0 },
        low: { label: "緊繃", priority: 1 },
        watch: { label: "觀察", priority: 2 },
        healthy: { label: "充足", priority: 3 },
        unknown: { label: "待補數據", priority: 4 }
    };

    const charts = {
        category: null,
        status: null
    };

    const elements = {
        sheetLink: document.getElementById("sheetLink"),
        sheetName: document.getElementById("sheetName"),
        sourceUpdatedAt: document.getElementById("sourceUpdatedAt"),
        sourceNote: document.getElementById("sourceNote"),
        dataVersion: document.getElementById("dataVersion"),
        syncStatus: document.getElementById("syncStatus"),
        lastRefreshedAt: document.getElementById("lastRefreshedAt"),
        coverageText: document.getElementById("coverageText"),
        categoryCount: document.getElementById("categoryCount"),
        itemCount: document.getElementById("itemCount"),
        lowStockCount: document.getElementById("lowStockCount"),
        stockoutCount: document.getElementById("stockoutCount"),
        numericTotal: document.getElementById("numericTotal"),
        categoryCards: document.getElementById("categoryCards"),
        alertList: document.getElementById("alertList"),
        inventoryTableBody: document.getElementById("inventoryTableBody"),
        categoryFilter: document.getElementById("categoryFilter"),
        statusFilter: document.getElementById("statusFilter"),
        searchInput: document.getElementById("searchInput"),
        resetFilterBtn: document.getElementById("resetFilterBtn"),
        jumpToTableBtn: document.getElementById("jumpToTableBtn"),
        inventoryTableSection: document.getElementById("inventoryTableSection"),
        categoryChart: document.getElementById("categoryChart"),
        statusChart: document.getElementById("statusChart")
    };

    const state = {
        items: flattenItems(dataset.categories),
        filters: {
            search: "",
            category: "",
            status: ""
        }
    };

    init();

    function init() {
        hydrateSourceMeta();
        populateCategoryFilter();
        bindEvents();
        render();
    }

    function hydrateSourceMeta() {
        const source = dataset.source;
        const sheetUrl = `https://docs.google.com/spreadsheets/d/${source.sheetId}/edit#gid=0`;

        elements.sheetLink.href = sheetUrl;
        elements.sheetName.textContent = source.sheetName;
        elements.sourceUpdatedAt.textContent = source.updatedAt;
        elements.sourceNote.textContent = source.note;
        elements.dataVersion.textContent = source.version;
    }

    function populateCategoryFilter() {
        const options = dataset.categories.map((category) => {
            return `<option value="${escapeHtml(category.id)}">${escapeHtml(category.id)} - ${escapeHtml(category.name)}</option>`;
        }).join("");

        elements.categoryFilter.insertAdjacentHTML("beforeend", options);
    }

    function bindEvents() {
        elements.searchInput.addEventListener("input", (event) => {
            state.filters.search = event.target.value.trim().toLowerCase();
            renderTable();
        });

        elements.categoryFilter.addEventListener("change", (event) => {
            state.filters.category = event.target.value;
            renderTable();
        });

        elements.statusFilter.addEventListener("change", (event) => {
            state.filters.status = event.target.value;
            renderTable();
        });

        elements.resetFilterBtn.addEventListener("click", () => {
            state.filters.search = "";
            state.filters.category = "";
            state.filters.status = "";
            elements.searchInput.value = "";
            elements.categoryFilter.value = "";
            elements.statusFilter.value = "";
            renderTable();
        });

        elements.jumpToTableBtn.addEventListener("click", () => {
            elements.inventoryTableSection.scrollIntoView({ behavior: "smooth", block: "start" });
        });
    }

    function render() {
        const summary = buildSummary(state.items);

        elements.syncStatus.textContent = "已載入本地快照";
        elements.lastRefreshedAt.textContent = timeFormatter.format(new Date());
        elements.coverageText.textContent = `${numberFormatter.format(summary.itemCount)} 筆品項`;
        elements.categoryCount.textContent = numberFormatter.format(summary.categoryCount);
        elements.itemCount.textContent = numberFormatter.format(summary.itemCount);
        elements.lowStockCount.textContent = numberFormatter.format(summary.lowCount);
        elements.stockoutCount.textContent = numberFormatter.format(summary.stockoutCount);
        elements.numericTotal.textContent = numberFormatter.format(summary.numericTotal);

        renderAlerts(summary.alertItems);
        renderCategoryCards(summary.categoryStats);
        renderCharts(summary);
        renderTable();
    }

    function renderAlerts(alertItems) {
        if (!alertItems.length) {
            elements.alertList.innerHTML = `<div class="empty-state">目前沒有需要優先處理的缺貨或低庫存項目。</div>`;
            return;
        }

        elements.alertList.innerHTML = alertItems.slice(0, 12).map((item, index) => {
            return `
                <article class="alert-item">
                    <div class="alert-rank">${index + 1}</div>
                    <div class="alert-main">
                        <strong>${escapeHtml(item.name)}</strong>
                        <p>${escapeHtml(item.categoryId)} - ${escapeHtml(item.categoryName)}${item.code ? ` / ${escapeHtml(item.code)}` : ""}</p>
                    </div>
                    <div class="alert-qty">
                        <strong>${escapeHtml(item.stockLabel)}</strong>
                        <span>${escapeHtml(statusMeta[item.status].label)}${item.unit ? ` / ${escapeHtml(item.unit)}` : ""}</span>
                    </div>
                </article>
            `;
        }).join("");
    }

    function renderCategoryCards(categoryStats) {
        const maxTotal = Math.max(...categoryStats.map((category) => category.numericTotal), 1);

        elements.categoryCards.innerHTML = categoryStats.map((category) => {
            const width = `${Math.max((category.numericTotal / maxTotal) * 100, 4)}%`;

            return `
                <article class="category-summary-card" style="--category-color:${escapeAttribute(category.color)}">
                    <div class="category-summary-head">
                        <div>
                            <strong>${escapeHtml(category.id)} - ${escapeHtml(category.name)}</strong>
                            <span>${numberFormatter.format(category.itemCount)} 項</span>
                        </div>
                        <strong>${numberFormatter.format(category.numericTotal)}</strong>
                    </div>
                    <div class="summary-progress"><span style="width:${escapeAttribute(width)}"></span></div>
                    <div class="summary-meta">
                        <span>缺貨 ${numberFormatter.format(category.stockoutCount)}</span>
                        <span>緊繃 ${numberFormatter.format(category.lowCount)}</span>
                        <span>待補 ${numberFormatter.format(category.unknownCount)}</span>
                    </div>
                </article>
            `;
        }).join("");
    }

    function renderTable() {
        const filteredItems = getFilteredItems();

        if (!filteredItems.length) {
            elements.inventoryTableBody.innerHTML = `
                <tr>
                    <td colspan="7" class="empty-state">目前沒有符合條件的品項。</td>
                </tr>
            `;
            return;
        }

        elements.inventoryTableBody.innerHTML = filteredItems.map((item) => {
            const note = item.notes || "-";

            return `
                <tr>
                    <td>
                        <span class="category-badge" style="background:${hexToSoftColor(item.color)}">${escapeHtml(item.categoryId)} - ${escapeHtml(item.categoryName)}</span>
                    </td>
                    <td>${escapeHtml(item.code || "-")}</td>
                    <td>${escapeHtml(item.name)}</td>
                    <td>${escapeHtml(item.stockLabel)}</td>
                    <td>${escapeHtml(item.unit || "-")}</td>
                    <td><span class="status-pill ${escapeAttribute(item.status)}">${escapeHtml(statusMeta[item.status].label)}</span></td>
                    <td class="muted">${escapeHtml(note)}</td>
                </tr>
            `;
        }).join("");
    }

    function renderCharts(summary) {
        if (typeof Chart === "undefined") {
            elements.categoryChart.parentElement.innerHTML = `<div class="empty-state">目前無法載入圖表元件，請確認網路連線後重新開啟頁面。</div>`;
            elements.statusChart.parentElement.innerHTML = `<div class="empty-state">目前無法載入圖表元件，請確認網路連線後重新開啟頁面。</div>`;
            return;
        }

        if (charts.category) {
            charts.category.destroy();
        }

        if (charts.status) {
            charts.status.destroy();
        }

        charts.category = new Chart(elements.categoryChart, {
            type: "bar",
            data: {
                labels: summary.categoryStats.map((category) => `${category.id}`),
                datasets: [{
                    label: "可統計總量",
                    data: summary.categoryStats.map((category) => category.numericTotal),
                    backgroundColor: summary.categoryStats.map((category) => category.color),
                    borderRadius: 10,
                    borderSkipped: false
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label(context) {
                                return `${context.label} 類 ${numberFormatter.format(context.raw)}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { display: false }
                    },
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback(value) {
                                return numberFormatter.format(value);
                            }
                        }
                    }
                }
            }
        });

        charts.status = new Chart(elements.statusChart, {
            type: "doughnut",
            data: {
                labels: ["缺貨", "緊繃", "觀察", "充足", "待補數據"],
                datasets: [{
                    data: [
                        summary.stockoutCount,
                        summary.lowCount,
                        summary.watchCount,
                        summary.healthyCount,
                        summary.unknownCount
                    ],
                    backgroundColor: ["#b13b3b", "#b3572a", "#c78b2a", "#2f7d61", "#6f7891"],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: "62%",
                plugins: {
                    legend: {
                        position: "bottom"
                    }
                }
            }
        });
    }

    function getFilteredItems() {
        return state.items.filter((item) => {
            const searchMatch = !state.filters.search || [
                item.name,
                item.code,
                item.categoryId,
                item.categoryName,
                item.notes,
                item.stockLabel
            ].filter(Boolean).some((value) => value.toLowerCase().includes(state.filters.search));

            const categoryMatch = !state.filters.category || item.categoryId === state.filters.category;
            const statusMatch = !state.filters.status || item.status === state.filters.status;

            return searchMatch && categoryMatch && statusMatch;
        });
    }

    function flattenItems(categories) {
        return categories.flatMap((category) => {
            return category.items.map((item) => {
                return {
                    ...item,
                    categoryId: category.id,
                    categoryName: category.name,
                    color: category.color,
                    status: getStatusKey(item.stock)
                };
            });
        });
    }

    function buildSummary(items) {
        const itemCount = items.length;
        const categoryCount = dataset.categories.length;
        const numericItems = items.filter((item) => typeof item.stock === "number");
        const numericTotal = numericItems.reduce((sum, item) => sum + item.stock, 0);
        const stockoutCount = items.filter((item) => item.status === "stockout").length;
        const lowCount = items.filter((item) => item.status === "low").length;
        const watchCount = items.filter((item) => item.status === "watch").length;
        const healthyCount = items.filter((item) => item.status === "healthy").length;
        const unknownCount = items.filter((item) => item.status === "unknown").length;

        const categoryStats = dataset.categories.map((category) => {
            const categoryItems = items.filter((item) => item.categoryId === category.id);
            return {
                id: category.id,
                name: category.name,
                color: category.color,
                itemCount: categoryItems.length,
                numericTotal: categoryItems.reduce((sum, item) => sum + (typeof item.stock === "number" ? item.stock : 0), 0),
                stockoutCount: categoryItems.filter((item) => item.status === "stockout").length,
                lowCount: categoryItems.filter((item) => item.status === "low").length,
                unknownCount: categoryItems.filter((item) => item.status === "unknown").length
            };
        });

        const alertItems = items
            .filter((item) => item.status === "stockout" || item.status === "low" || item.status === "watch")
            .sort((left, right) => {
                const statusDiff = statusMeta[left.status].priority - statusMeta[right.status].priority;
                if (statusDiff !== 0) {
                    return statusDiff;
                }

                return (left.stock ?? Number.POSITIVE_INFINITY) - (right.stock ?? Number.POSITIVE_INFINITY);
            });

        return {
            itemCount,
            categoryCount,
            numericTotal,
            stockoutCount,
            lowCount,
            watchCount,
            healthyCount,
            unknownCount,
            categoryStats,
            alertItems
        };
    }

    function getStatusKey(stock) {
        if (typeof stock !== "number") {
            return "unknown";
        }
        if (stock <= 0) {
            return "stockout";
        }
        if (stock <= 10) {
            return "low";
        }
        if (stock <= 30) {
            return "watch";
        }
        return "healthy";
    }

    function hexToSoftColor(hex) {
        if (!hex || typeof hex !== "string") {
            return "rgba(38, 93, 102, 0.12)";
        }

        const normalized = hex.replace("#", "");
        const red = parseInt(normalized.slice(0, 2), 16);
        const green = parseInt(normalized.slice(2, 4), 16);
        const blue = parseInt(normalized.slice(4, 6), 16);

        return `rgba(${red}, ${green}, ${blue}, 0.18)`;
    }

    function escapeHtml(value) {
        return String(value)
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#39;");
    }

    function escapeAttribute(value) {
        return escapeHtml(value).replaceAll("`", "");
    }
})();
