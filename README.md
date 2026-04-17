# 救護耗材控管儀表板

使用 Next.js、TypeScript、Tailwind CSS 與 Recharts 建立的內部救護耗材儀表板，透過 Google Sheets API 由後端讀取試算表資料，再提供 `/api/supplies` 給前端頁面顯示。

## 功能特色

- Google Sheets API 後端讀取，憑證不暴露到前端瀏覽器
- `/api/supplies` 會將試算表資料轉成前端可直接使用的 JSON
- 儀表板首頁提供 KPI 總覽、分類區塊、耗材清單表格與圖表
- 支援品名搜尋、類別篩選、狀態篩選、剩餘數量排序
- 讀取失敗時會在首頁顯示明確錯誤訊息

## 1. 如何安裝套件

```bash
npm install
```

## 2. 如何設定 Google Cloud

1. 前往 [Google Cloud Console](https://console.cloud.google.com/)
2. 建立新的專案，或選擇既有專案
3. 確認專案已完成基本設定

## 3. 如何啟用 Google Sheets API

1. 進入 Google Cloud Console 左側選單 `APIs & Services`
2. 點選 `Library`
3. 搜尋 `Google Sheets API`
4. 點選 `Enable`

## 4. 如何建立 Service Account

1. 進入 `APIs & Services` → `Credentials`
2. 點選 `Create Credentials` → `Service Account`
3. 輸入 Service Account 名稱並完成建立
4. 進入該 Service Account，切到 `Keys`
5. 點選 `Add Key` → `Create new key`
6. 選擇 `JSON` 並下載憑證檔
7. 從 JSON 中取出：
   - `client_email`
   - `private_key`

## 5. 如何把 Service Account email 加入 Google 試算表共用權限

1. 打開目標 Google 試算表
2. 點右上角 `共用`
3. 將 Service Account 的 `client_email` 加入共用名單
4. 權限至少給 `檢視者`

## 6. 如何設定 .env.local

1. 複製 `.env.example` 成 `.env.local`
2. 依照你的 Google Cloud 與試算表資訊填入

```env
GOOGLE_SHEET_ID=13S44pTDPTKGehNFG6hThArDOXEphZ1MVrnDFUC6P-Ug
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY\n-----END PRIVATE KEY-----\n"
GOOGLE_SHEET_RANGE=工作表1!A1:AZ200
```

說明：

- `GOOGLE_SHEET_ID`：Google 試算表 ID
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`：Service Account Email
- `GOOGLE_PRIVATE_KEY`：Service Account Private Key，請保留 `\n`
- `GOOGLE_SHEET_RANGE`：讀取範圍，例如 `工作表1!A1:AZ200`

## 7. 如何執行 npm run dev

```bash
npm run dev
```

預設開啟：

- [http://localhost:3000](http://localhost:3000)

## 8. 如何部署到 Vercel

1. 將專案推到 GitHub、GitLab 或 Bitbucket
2. 登入 [Vercel](https://vercel.com/)
3. 匯入此專案
4. 在 Vercel 專案設定的 `Environment Variables` 加入：
   - `GOOGLE_SHEET_ID`
   - `GOOGLE_SERVICE_ACCOUNT_EMAIL`
   - `GOOGLE_PRIVATE_KEY`
   - `GOOGLE_SHEET_RANGE`
5. 重新部署

## 專案結構

```text
app/
  api/supplies/route.ts
  page.tsx
components/
  CategoryTabs.tsx
  StockCharts.tsx
  SummaryCards.tsx
  SuppliesTable.tsx
lib/
  googleSheets.ts
  parseSupplies.ts
types/
  supply.ts
```

## API 說明

### `GET /api/supplies`

從 Google Sheets 讀取資料後，回傳：

- `supplies`：耗材清單
- `summary`：總覽統計
- `categoryStats`：分類統計
- `topRestock`：最需要補貨前 10 項
- `meta`：資料時間與警示資訊

## 注意事項

- Google Sheets API 憑證只會在後端 Route Handler 使用，不會注入前端
- 如果試算表沒有完整安全庫存欄位，系統會先以推估門檻判斷低庫存狀態
- 若你的工作表名稱不是 `工作表1`，請記得調整 `GOOGLE_SHEET_RANGE`
