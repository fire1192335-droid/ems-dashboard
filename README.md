# 救護耗材管理儀表板

這是一個可直接部署到 GitHub Pages 的靜態網站專案，使用純 `HTML + CSS + JavaScript` 製作，提供救護耗材的分類總覽、補貨警示與明細查詢。

## 專案特色

- A-G 類耗材分類總覽
- 低庫存與缺貨警示
- 分類彙整圖表
- 關鍵字、分類、狀態篩選
- 可直接部署到 GitHub Pages

## 專案結構

```text
救護耗材系統/
├─ index.html
├─ .nojekyll
├─ css/
│  └─ style.css
├─ js/
│  └─ main.js
├─ data/
│  └─ inventory-data.js
└─ README.md
```

## GitHub Pages 部署方式

1. 在 GitHub 建立新的 repository。
2. 將本專案檔案上傳到 repository 根目錄。
3. 確認 `index.html` 位於 repo 根目錄。
4. 到 GitHub repository 的 `Settings > Pages`。
5. `Source` 選擇 `Deploy from a branch`。
6. Branch 選 `main`，資料夾選 `/ (root)`。
7. 儲存後等待 GitHub 發布網站。

網站網址通常會是：

```text
https://你的帳號.github.io/你的-repo-名稱/
```

## 路徑與部署注意事項

- 本專案使用相對路徑：
  - `css/style.css`
  - `data/inventory-data.js`
  - `js/main.js`
- 沒有使用本機絕對路徑，因此可直接部署到 GitHub Pages。
- 已加入 `.nojekyll`，避免 GitHub Pages 對靜態檔案做不必要處理。
- 圖表使用 CDN 載入 `Chart.js`，部署後需可連上外部網路。

## 如何更新耗材資料

如果要修改品名、數量、單位或備註，請直接編輯：

`data/inventory-data.js`

## 本機預覽

直接用瀏覽器開啟：

`index.html`

即可查看儀表板畫面。
