/

class InventoryDashboard {
    constructor() {
        this.api = null;
        this.inventoryData = [];
        this.usageData = [];
        this.charts = {
            inventory: null,
            usage: null
        };
        this.settings = this.loadSettings();
        this.autoRefreshTimer = null;
        this.init();
    }

    /**
     * 初始化應用程序
     */
    init() {
        this.attachEventListeners();
        this.initializeSettings();
        
        // 自動嘗試使用已保存的設置加載數據
        if (this.settings.apiKey && this.settings.sheetId) {
            this.loadData();
            this.startAutoRefresh();
        } else {
            this.showSettingsModal();
        }
    }

    /**
     * 綁定事件監聽器
     */
    attachEventListeners() {
        // 刷新按鈕
        document.getElementById('refreshBtn').addEventListener('click', () => {
            this.loadData();
        });

        // 設置按鈕
        document.getElementById('settingsBtn').addEventListener('click', () => {
            this.showSettingsModal();
        });

        // 設置模態框按鈕
        document.getElementById('saveSettingsBtn').addEventListener('click', () => {
            this.saveSettings();
            this.hideSettingsModal();
            this.loadData();
        });

        document.getElementById('cancelSettingsBtn').addEventListener('click', () => {
            this.hideSettingsModal();
        });

        document.querySelector('.close-btn').addEventListener('click', () => {
            this.hideSettingsModal();
        });

        // 搜尋和過濾
        document.getElementById('searchInput').addEventListener('input', () => {
            this.filterInventoryTable();
        });

        document.getElementById('filterStatus').addEventListener('change', () => {
            this.filterInventoryTable();
        });

        // 模態框外點擊關閉
        document.getElementById('settingsModal').addEventListener('click', (e) => {
            if (e.target.id === 'settingsModal') {
                this.hideSettingsModal();
            }
        });
    }

    /**
     * 加載設置
     */
    loadSettings() {
        const stored = localStorage.getItem('dashboardSettings');
        return stored ? JSON.parse(stored) : {
            apiKey: '',
            sheetId: '',
            refreshInterval: 5,
            warningThreshold: 30
        };
    }

    /**
     * 保存設置
     */
    saveSettings() {
        this.settings = {
            apiKey: document.getElementById('apiKey').value,
            sheetId: document.getElementById('sheetId').value,
            refreshInterval: parseInt(document.getElementById('refreshInterval').value) || 5,
            warningThreshold: parseInt(document.getElementById('warningThreshold').value) || 30
        };

        localStorage.setItem('dashboardSettings', JSON.stringify(this.settings));
        
        // 停止舊的自動刷新，啟動新的
        this.stopAutoRefresh();
        this.startAutoRefresh();
    }

    /**
     * 初始化設置模態框中的值
     */
    initializeSettings() {
        document.getElementById('apiKey').value = this.settings.apiKey;
        document.getElementById('sheetId').value = this.settings.sheetId;
        document.getElementById('refreshInterval').value = this.settings.refreshInterval;
        document.getElementById('warningThreshold').value = this.settings.warningThreshold;
    }

    /**
     * 顯示設置模態框
     */
    showSettingsModal() {
        this.initializeSettings();
        document.getElementById('settingsModal').classList.remove('hidden');
    }

    /**
     * 隱藏設置模態框
     */
    hideSettingsModal() {
        document.getElementById('settingsModal').classList.add('hidden');
    }

    /**
     * 加載數據
     */
    async loadData() {
        try {
            this.updateSyncStatus('pending', '⏳ 正在同步...');
            
            if (!this.api) {
                this.api = new GoogleSheetsAPI(this.settings.apiKey, this.settings.sheetId);
            }

            const data = await this.api.getAllData();
            this.inventoryData = data.inventory;
            this.usageData = data.usage;

            // 更新各個部分
            this.updateStats();
            this.updateInventoryTable();
            this.updateUsageTable();
            this.updateCharts();

            this.updateSyncStatus('success', '✅ 同步成功');
            this.updateLastUpdateTime();
        } catch (error) {
            console.error('加載數據失败:', error);
            this.updateSyncStatus('error', '❌ 同步失败: ' + error.message);
            this.showErrorMessage(error.message);
        }
    }

    /**
     * 更新統計數據
     */
    updateStats() {
        const stats = this.api.calculateStats(this.inventoryData);
        
        document.getElementById('totalItems').textContent = stats.totalItems;
        document.getElementById('warningItems').textContent = stats.warningItems;
        document.getElementById('stockoutItems').textContent = stats.stockoutItems;
        document.getElementById('totalValue').textContent = '$' + stats.totalValue.toFixed(2);
    }

    /**
     * 更新庫存表格
     */
    updateInventoryTable() {
        const tbody = document.getElementById('inventoryTableBody');
        
        if (this.inventoryData.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="loading">暫無数據</td></tr>';
            return;
        }

        tbody.innerHTML = this.inventoryData.map(item => {
            const total = item.currentStock * item.unitPrice;
            const status = this.api.getItemStatus(item);
            
            return `
                <tr>
                    <td>${this.escapeHtml(item.name)}</td>
                    <td>${item.currentStock}</td>
                    <td>${item.minStock}</td>
                    <td>${this.escapeHtml(item.unit)}</td>
                    <td>$${item.unitPrice.toFixed(2)}</td>
                    <td>$${total.toFixed(2)}</td>
                    <td><span class="status-badge ${status.class}">${status.status}</span></td>
                    <td>${this.escapeHtml(item.lastUpdate)}</td>
                </tr>
            `;
        }).join('');
    }

    /**
     * 更新使用記錄表格
     */
    updateUsageTable() {
        const tbody = document.getElementById('usageTableBody');
        
        if (this.usageData.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="loading">暫無記錄</td></tr>';
            return;
        }

        // 只顯示最近 20 條記錄
        const recentUsage = this.usageData.slice(-20).reverse();
        
        tbody.innerHTML = recentUsage.map(record => `
            <tr>
                <td>${this.escapeHtml(record.name)}</td>
                <td>${record.quantity}</td>
                <td>${this.escapeHtml(record.user)}</td>
                <td>${this.escapeHtml(record.time)}</td>
                <td>${this.escapeHtml(record.notes)}</td>
            </tr>
        `).join('');
    }

    /**
     * 過濾庫存表格
     */
    filterInventoryTable() {
        const searchValue = document.getElementById('searchInput').value.toLowerCase();
        const statusValue = document.getElementById('filterStatus').value;
        const tbody = document.getElementById('inventoryTableBody');
        const rows = tbody.querySelectorAll('tr:not(.loading)');

        rows.forEach(row => {
            const name = row.cells[0].textContent.toLowerCase();
            const status = row.cells[6].textContent.trim();
            
            const nameMatch = name.includes(searchValue);
            const statusMatch = !statusValue || status === statusValue;
            
            row.style.display = (nameMatch && statusMatch) ? '' : 'none';
        });
    }

    /**
     * 更新圖表
     */
    updateCharts() {
        this.updateInventoryChart();
        this.updateUsageChart();
    }

    /**
     * 更新庫存分佈圖
     */
    updateInventoryChart() {
        const ctx = document.getElementById('inventoryChart');
        const chartData = this.api.prepareInventoryChartData(this.inventoryData);

        if (this.charts.inventory) {
            this.charts.inventory.destroy();
        }

        this.charts.inventory = new Chart(ctx, {
            type: 'doughnut',
            data: chartData,
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });
    }

    /**
     * 更新使用趨勢圖
     */
    updateUsageChart() {
        const ctx = document.getElementById('usageChart');
        
        if (this.usageData.length === 0) {
            ctx.parentElement.innerHTML = '<p style="text-align: center; color: #999;">暫無使用記錄</p>';
            return;
        }

        const chartData = this.api.prepareUsageChartData(this.usageData);

        if (this.charts.usage) {
            this.charts.usage.destroy();
        }

        this.charts.usage = new Chart(ctx, {
            type: 'line',
            data: chartData,
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        display: true
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    }

    /**
     * 更新同步狀態
     */
    updateSyncStatus(status, message) {
        const indicator = document.getElementById('syncStatus');
        indicator.textContent = message;
        indicator.className = `status-indicator ${status}`;
    }

    /**
     * 更新最後更新時間
     */
    updateLastUpdateTime() {
        const now = new Date();
        const timeStr = now.toLocaleString('zh-TW');
        document.getElementById('lastUpdate').textContent = `最後更新: ${timeStr}`;
    }

    /**
     * 啟動自動刷新
     */
    startAutoRefresh() {
        if (this.autoRefreshTimer) {
            clearInterval(this.autoRefreshTimer);
        }

        const interval = this.settings.refreshInterval * 60 * 1000; // 轉換為毫秒
        this.autoRefreshTimer = setInterval(() => {
            this.loadData();
        }, interval);
    }

    /**
     * 停止自動刷新
     */
    stopAutoRefresh() {
        if (this.autoRefreshTimer) {
            clearInterval(this.autoRefreshTimer);
            this.autoRefreshTimer = null;
        }
    }

    /**
     * 顯示錯誤消息
     */
    showErrorMessage(message) {
        console.error('儀表板錯誤:', message);
        // 可以添加 toast 通知或模態框
    }

    /**
     * HTML 轉義函數
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// 頁面加載完成後初始化應用
document.addEventListener('DOMContentLoaded', () => {
    window.dashboard = new InventoryDashboard();
});
