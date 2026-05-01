# 救護耗材控管儀表板

本專案目前是 **Vite + TypeScript + HTML/CSS/JavaScript** 的多頁靜態網站，不是 Next.js，也不是 React SPA。  
現有頁面包含：

- `index.html`：救護耗材儀表板首頁
- `trace.html`：領取足跡 Prototype

這次調整以 **最小修改** 為原則，保留既有畫面與 JSON 資料來源，只補上 Firebase Hosting 所需設定，並預留未來串接 Firestore 的資料層。

## 目前技術棧

- Vite
- TypeScript
- HTML / CSS / JavaScript
- 本地 JSON 資料
- Firebase Hosting 部署設定
- Firebase Web App 初始化服務層

## 專案結構

```text
public/
  data/
    public-supplies.json
    trace-records.json
src/
  main.ts
  trace.ts
  style.css
  services/
    firebase.ts
index.html
trace.html
vite.config.ts
firebase.json
.firebaserc.example
.env.example
firestore.rules
```

## 核心資料欄位

領取足跡資料保留或預留以下欄位：

- 領取時間
- 領取時段
- 類別
- 耗材編號
- 耗材名稱
- 領取數量
- 單位
- 領取人
- 所屬單位
- 車號
- 案件編號
- 用途
- 領取後庫存
- 備註

目前前端仍以既有 `public/data/trace-records.json` 為主，不破壞原畫面。  
未來若切換到 Firestore，可直接沿用 `src/services/firebase.ts` 內的欄位型別與選單常數。

## 固定下拉選單

### 類別

- A 自我防護類
- B 呼吸道處置類
- C 創傷處置類
- D 靜脈注射類
- E 輔助處置類
- H 高級救護處置
- I 心臟電擊去顫類

### 用途

- 出勤使用
- 訓練使用
- 補充車備
- 盤點調整
- 其他

### 所屬單位

- 第一分隊
- 第二分隊
- 第三分隊
- 第四分隊

## 本機啟動

### Windows PowerShell

```powershell
npm install
npm run dev
```

Vite 預設網址通常是：

```text
http://localhost:5173/
```

若 `5173` 被占用，Vite 會自動改用其他埠號，請以終端機實際輸出為準。

## 建置

```powershell
npm run build
```

建置完成後，部署用資料夾為：

```text
dist
```

本次已實際驗證 `npm run build` 可成功產出 `dist/`。

## Firebase 設定檔

本次新增或調整的 Firebase 相關檔案：

- `firebase.json`
- `.firebaserc.example`
- `.env.example`
- `src/services/firebase.ts`
- `firestore.rules`

## Firebase Web App 環境變數

先複製範本：

```powershell
Copy-Item .env.example .env.local
```

再把 Firebase Console 的 Web App 設定值填入 `.env.local`。

範例欄位如下：

```env
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project-id.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
VITE_FIREBASE_APP_ID=your_firebase_app_id
VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id_optional
```

注意：

- 不要把真實設定直接寫死在程式碼中
- `.env.local` 不要提交到 Git
- `.env.example` 只保留欄位名稱與假值

## 部署到 Firebase Hosting

### 1. 安裝套件

```powershell
npm install
```

### 2. 建置

```powershell
npm run build
```

### 3. 安裝 Firebase CLI

```powershell
npm install -g firebase-tools
```

### 4. 登入 Firebase

```powershell
firebase login
```

### 5. 初始化 Hosting

```powershell
firebase init hosting
```

建議回答如下：

- `Use an existing project`：選你的 Firebase 專案
- `public directory`：填 `dist`
- `Configure as a single-page app`：選 `No`
- `Set up automatic builds and deploys with GitHub`：第一版可選 `No`

### 6. 部署

```powershell
firebase deploy
```

## 為什麼 Firebase Hosting 要指向 `dist`

因為本專案是 Vite，執行 `npm run build` 之後，正式可部署檔案會輸出到：

- `dist/index.html`
- `dist/trace.html`
- `dist/assets/*`

所以 `firebase.json` 的 `hosting.public` 必須設定成 `dist`。

## Firestore 預留說明

這一版 **只做 Firebase Hosting**，符合 Firebase Spark 免費方案可支援的範圍。  
目前沒有實作：

- Cloud Functions
- 需要 Blaze 的付費服務
- 直接從前端寫入 Firestore 的正式功能

但已預留：

- `src/services/firebase.ts`
  - Firebase App / Firestore 初始化
  - 類別、用途、所屬單位選單常數
  - 領取足跡資料型別
- `firestore.rules`
  - 目前採最保守的 `allow read, write: if false;`
  - 只是測試用安全預留檔，避免任何人任意讀寫

如果未來要正式接 Firestore，請至少補上：

- Firebase Authentication
- 依角色限制的 Firestore Security Rules
- 管理端與公開頁分流

## 常見部署錯誤與排除

### 1. `firebase` 指令找不到

請先安裝 Firebase CLI：

```powershell
npm install -g firebase-tools
```

若已安裝仍找不到，請重新開 PowerShell。

### 2. `Directory 'dist' for Hosting does not exist`

代表還沒先 build，請先執行：

```powershell
npm run build
```

### 3. 部署後畫面空白

請檢查：

- `firebase.json` 的 `public` 是否為 `dist`
- `dist/index.html` 是否存在
- `dist/trace.html` 是否存在
- `dist/assets/*` 是否有正常輸出

### 4. `.env.local` 沒生效

請檢查：

- 檔名是否為 `.env.local`
- 變數名稱是否都以 `VITE_` 開頭
- 修改後是否重新執行 `npm run dev` 或 `npm run build`

### 5. `firebase deploy` 成功但資料沒更新

請重新執行：

```powershell
npm run build
firebase deploy
```

並清除瀏覽器快取後再檢查。

## 本次修改原因

- `firebase.json`
  - 指定 Firebase Hosting 以 `dist` 作為部署目錄
  - 補上靜態資源快取策略
- `.firebaserc.example`
  - 提供 Firebase 專案 ID 範本，避免把真實專案寫死
- `.env.example`
  - 提供 Firebase Web App 所需環境變數欄位
- `src/services/firebase.ts`
  - 建立未來串接 Firestore 的服務層
  - 集中管理資料欄位與選單常數
- `firestore.rules`
  - 先提供保守的安全規則範本，避免誤開放讀寫
- `package.json`
  - 加入 `firebase` 套件
  - 保留 `dev`、`build`、`preview` scripts
- `.gitignore`
  - 忽略 `.env.local`、`.firebase` 等本機或敏感設定
  - 保留 `.env.example` 供版本控制
- `README.md`
  - 補齊 Windows 本機啟動、建置、Firebase Hosting 部署與排錯說明

## 官方文件

- Firebase Hosting: [https://firebase.google.com/docs/hosting](https://firebase.google.com/docs/hosting)
- Firebase Hosting Quickstart: [https://firebase.google.com/docs/hosting/quickstart](https://firebase.google.com/docs/hosting/quickstart)
- Firebase Web Setup: [https://firebase.google.com/docs/web/setup](https://firebase.google.com/docs/web/setup)
