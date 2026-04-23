# 救護耗材公開資訊頁

這是一個可直接部署到 **GitHub Pages** 的純靜態網站，使用 **Vite + TypeScript + HTML/CSS/JavaScript** 製作，所有資料皆來自本地 JSON 檔案，不依賴後端 API，也不需要任何私密金鑰。

資料來源檔案：

- `public/data/public-supplies.json`

## 專案特色

- 純靜態網站，適合 GitHub Pages
- 使用本地 JSON 作為公開資料來源
- 提供更新時間、摘要卡片、分類區塊、搜尋與篩選
- 缺貨顯示紅色、低庫存顯示黃色、正常顯示綠色
- 手機與桌機都可閱讀

## 1. 如何在本機執行

```bash
npm install
npm run dev
```

開啟瀏覽器前往：

- [http://localhost:5173](http://localhost:5173)

若要測試正式輸出：

```bash
npm run build
npm run preview
```

## 2. 如何建立 GitHub repo

1. 前往 [GitHub](https://github.com/)
2. 點選右上角 `New repository`
3. 輸入 repo 名稱，例如 `ems-public-supplies`
4. 建立 repository

## 3. 如何推送到 GitHub

如果本機尚未初始化 git：

```bash
git init
git branch -M main
git add .
git commit -m "feat: add public supplies site"
git remote add origin https://github.com/你的帳號/你的-repo.git
git push -u origin main
```

如果你已經有既有 repo，只要：

```bash
git add .
git commit -m "feat: update public supplies site"
git push
```

## 4. 如何開啟 GitHub Pages

本專案已內建 GitHub Actions workflow：`.github/workflows/deploy.yml`

開啟方式：

1. 將程式碼推到 GitHub 的 `main` 分支
2. 到 GitHub repo 的 `Settings`
3. 點選左側 `Pages`
4. 在 `Build and deployment` 中將 `Source` 設為 `GitHub Actions`
5. 回到 repo 的 `Actions` 頁面，等待 `Deploy to GitHub Pages` workflow 完成

完成後網址通常會是：

```text
https://你的帳號.github.io/你的-repo/
```

## 5. 如何更新 public-supplies.json

請直接編輯：

- `public/data/public-supplies.json`

每筆資料格式如下：

```json
{
  "category": "A 自我防護類",
  "itemCode": "0001",
  "name": "手套(L)",
  "status": "正常",
  "updatedAt": "2026-04-18T09:00:00+08:00",
  "note": "對應試算表 A 類。"
}
```

欄位說明：

- `category`：耗材分類
- `itemCode`：品項代碼
- `name`：品名
- `status`：只能是 `正常`、`低庫存`、`缺貨`
- `updatedAt`：更新時間
- `note`：備註

更新資料後重新推送：

```bash
git add public/data/public-supplies.json
git commit -m "chore: update public supplies data"
git push
```

GitHub Pages 就會重新部署最新版本。

## 專案結構

```text
public/
  data/
    public-supplies.json
src/
  main.ts
  style.css
index.html
vite.config.ts
.github/workflows/deploy.yml
```

## GitHub Pages 部署重點

- 本站為純靜態輸出，沒有後端 API
- 不使用 Service Account、API Key 或任何私密憑證
- `vite.config.ts` 已設定相對路徑，可直接部署到 GitHub Pages
