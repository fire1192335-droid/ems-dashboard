# 救護耗材控管儀表板 V2

本專案第二版在 **不更換框架** 的前提下，將原本的 Vite 多頁展示站升級為：

- Firebase Hosting
- Firebase Authentication（Email / Password）
- Cloud Firestore
- Firestore Security Rules
- 角色權限：`admin` / `user` / `viewer`

## 1. 目前專案架構判斷

本專案目前是：

- `Vite + TypeScript`
- 多頁靜態網站
- 入口頁面：
  - `index.html`
  - `trace.html`
  - `login.html`

不是：

- 純 HTML 單檔站
- React
- Vite React
- Next.js

因此第二版維持 **Vite 多頁架構**，以最小修改方式升級，不改成其他框架。

## 2. 第二版完成內容

### 已加入

- Firebase Hosting 設定
- Firebase Authentication Email / Password 登入頁
- 未登入者不可進入內部頁面
- 使用者登入後顯示：
  - Email
  - 所屬單位
  - 角色
- Firestore 資料服務層
- supplies / usageRecords / users 三個 collection 的前端 CRUD 流程
- 領用紀錄寫入時自動扣除 `supplies.currentStock`
- 領用數量檢查
- 低庫存警示
- Firestore Security Rules
- 範例 seed / sample data

### 保留

- 原本 `vercel.json` 保留，沒有刪除
- 原本 Vite 建置流程保留
- 原本首頁與領取足跡頁的視覺語言保留並擴充
- 手機版 RWD 保留

## 3. 專案結構

```text
public/
  data/
    public-supplies.json
    trace-records.json
    firestore-seed.json
src/
  login.ts
  main.ts
  trace.ts
  style.css
  services/
    firebase.ts
    authService.ts
    supplyService.ts
    usageRecordService.ts
    seedService.ts
index.html
login.html
trace.html
firebase.json
firestore.rules
firestore.indexes.json
.firebaserc.example
.env.example
vercel.json
```

## 4. Firestore collections 與資料結構

### supplies

用途：耗材主檔

欄位：

- `itemCode`
- `itemName`
- `category`
- `unit`
- `currentStock`
- `safetyStock`
- `location`
- `updatedAt`
- `updatedBy`
- `updatedByUid`

說明：

- 本專案使用 `itemCode` 作為 supplies 文件 ID
- 這樣可以在領用交易時直接找到對應耗材並扣庫存

### usageRecords

用途：領用紀錄

欄位：

- `receiveDate`
- `receiveTime`
- `receivePeriod`
- `category`
- `itemCode`
- `itemName`
- `quantity`
- `unit`
- `receiver`
- `station`
- `vehicleNo`
- `caseNo`
- `purpose`
- `stockAfterUse`
- `note`
- `createdBy`
- `createdByUid`
- `createdAt`

### users

用途：使用者權限

欄位：

- `email`
- `displayName`
- `station`
- `role`
- `createdAt`

重要：

- `users` collection 的文件 ID 必須是 **Firebase Authentication 的 uid**
- Security Rules 會依 `users/{uid}` 判斷角色

## 5. 角色權限

### admin

- 可新增、修改、刪除耗材主檔
- 可新增、修改、刪除領用紀錄
- 可查看所有分隊資料
- 可管理使用者角色

### user

- 可查看耗材庫存
- 可新增領用紀錄
- 不可刪除耗材主檔
- 第二版採較保守實作：`user` 不提供刪除領用紀錄

### viewer

- 只能查看儀表板與庫存
- 不可新增、修改、刪除資料

## 6. 固定欄位與選單

### 領用欄位

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

## 7. 庫存邏輯

第二版已實作：

1. 新增領用紀錄時，自動扣除 `supplies.currentStock`
2. 領用數量不可小於或等於 `0`
3. 領用數量不可大於目前庫存
4. 新增紀錄後，自動計算 `stockAfterUse`
5. `currentStock <= safetyStock` 時顯示低庫存警示
6. 首頁顯示醒目的低庫存清單
7. Firestore 寫入失敗時顯示錯誤訊息
8. 編輯或刪除領用紀錄時，也會同步調整庫存

技術實作：

- 使用 Firestore `transaction`
- 避免只更新前端畫面而沒有真正寫入資料庫

## 8. 安裝 Node.js

請先安裝：

- Node.js 20+ 建議

安裝完成後請確認：

```powershell
node -v
npm -v
```

## 9. 安裝 Firebase CLI

```powershell
npm install -g firebase-tools
```

確認：

```powershell
firebase --version
```

## 10. 安裝套件

```powershell
npm install
```

## 11. 建立 Firebase 專案

1. 到 Firebase Console 建立專案
2. 建立 Web App
3. 記下 Web App 設定
4. 開啟 Hosting
5. 開啟 Authentication
6. 建立 Firestore Database

## 12. 啟用 Authentication Email / Password

Firebase Console：

1. 進入 `Authentication`
2. 選 `Sign-in method`
3. 開啟 `Email/Password`

第二版只用 Email / Password，不實作 Google 登入。

## 13. 建立 Firestore Database

Firebase Console：

1. 進入 `Firestore Database`
2. 建立資料庫
3. 選擇正式模式或測試模式都可以開始，但正式上線前請以本 repo 的 `firestore.rules` 為準

## 14. 建立 `.env`

複製：

```powershell
Copy-Item .env.example .env
```

填入：

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

不要把真實值直接寫死進程式碼。

## 15. 建立第一個 admin 帳號

這一步 **需要到 Firebase Console 手動設定**。

### 建立 Authentication 帳號

在 Firebase Console 的 `Authentication > Users`：

1. 新增 Email / Password 使用者

### 建立對應 users 文件

登入後，`users` collection 文件 ID 必須等於該使用者的 `uid`。

建議第一位 admin 建立如下文件：

路徑：

```text
users/{auth_uid}
```

內容：

```json
{
  "email": "admin@example.com",
  "displayName": "系統管理員",
  "station": "第一分隊",
  "role": "admin",
  "createdAt": "Firestore Timestamp"
}
```

### 為什麼第一位 admin 需要手動設

第二版的安全規則不允許未授權的人任意建立 admin。  
第一次登入若沒有 profile，前端只會建立 `viewer` profile。  
所以第一位 admin 請手動在 Console 建立，之後 admin 可以管理既有 users profile 的角色。

## 16. 本機啟動

```powershell
npm run dev
```

通常網址：

```text
http://localhost:5173/
```

若埠號被占用，Vite 會自動改用其他埠號。

## 17. 建置

```powershell
npm run build
```

輸出目錄：

```text
dist
```

本次已驗證 `npm run build` 可成功產出：

- `dist/index.html`
- `dist/login.html`
- `dist/trace.html`

## 18. 部署 Firebase Hosting

### 登入 Firebase

```powershell
firebase login
```

### 初始化專案

```powershell
firebase init hosting
```

建議回答：

- `Use an existing project`
- `public directory`: `dist`
- `Configure as a single-page app`: `No`
- `Set up automatic builds and deploys with GitHub`: 視需求決定

### 部署

```powershell
firebase deploy --only hosting
```

如果要一次部署 Hosting + Firestore rules + indexes：

```powershell
firebase deploy
```

## 19. 部署 Firestore Rules

```powershell
firebase deploy --only firestore:rules
```

若要一起部署索引設定：

```powershell
firebase deploy --only firestore
```

## 20. firestore.rules 說明

這份規則已實作：

1. 未登入者不能讀寫
2. 已登入者可讀取 `supplies`
3. `admin` 可完整讀寫 `supplies`、`usageRecords`、`users`
4. `user` 可新增 `usageRecords`
5. `user` 不可刪除 `supplies`
6. `viewer` 只能讀取 `supplies` 與 `usageRecords`
7. 使用者角色從 `users/{uid}` 判斷

補充：

- `users/{uid}` 文件 ID 必須與 Firebase Auth uid 一致
- 規則中允許使用者第一次登入時建立自己的 `viewer` profile
- 但不允許自行把自己設成 `admin`

## 21. Firestore indexes

本版 `firestore.indexes.json` 目前為空：

```json
{
  "indexes": [],
  "fieldOverrides": []
}
```

原因：

- 第二版主要採用 client-side 篩選
- 目前沒有必要的複合索引查詢

若未來改為大型資料量與 server-side query，再補 index 即可。

## 22. 範例資料

已提供：

- [public/data/firestore-seed.json](./public/data/firestore-seed.json)

內容包含：

- 10 筆耗材主檔
- 10 筆領用紀錄
- 3 種角色範例：
  - admin
  - user
  - viewer

注意：

- `users` 範例是參考資料
- 真正登入用的 `users/{uid}` 必須配合 Firebase Auth uid
- 前端 admin 工具可一鍵寫入 supplies 與 usageRecords 範例資料
- 不會自動建立 Authentication 帳號

## 23. 常見錯誤排除

### `firebase` 找不到

請先：

```powershell
npm install -g firebase-tools
```

重新開 PowerShell 後再試。

### `Directory 'dist' for Hosting does not exist`

請先 build：

```powershell
npm run build
```

### 登入成功但進不去儀表板

可能原因：

- `users/{uid}` 文件不存在
- `users` 文件 ID 不是 Firebase Auth uid
- `role` 欄位不是 `admin` / `user` / `viewer`

### 可以登入但看不到資料

請檢查：

- Firestore Database 是否已建立
- `firestore.rules` 是否已部署
- 目前帳號 role 是否符合規則

### 新增領用紀錄失敗

請檢查：

- 領用數量是否大於 0
- 領用數量是否超過目前庫存
- supplies 是否有對應 `itemCode`
- 目前帳號是否為 `admin` 或 `user`

### 第一位 admin 無法建立

這是預期行為。  
第一位 admin 請在 Firebase Console 手動建立 Auth 帳號與 `users/{uid}` 文件。

## 24. 哪些仍需到 Firebase Console 手動設定

第二版完成後，仍需你在 Firebase Console 手動做：

1. 建立 Firebase 專案
2. 建立 Web App
3. 啟用 Hosting
4. 啟用 Authentication 的 Email / Password
5. 建立 Firestore Database
6. 建立第一位 admin 的 Auth 帳號
7. 建立第一位 admin 對應的 `users/{uid}` 文件

## 25. 是否有任何可能產生費用的功能

本版優先維持在 Firebase Spark 免費方案可使用範圍：

- Firebase Hosting
- Authentication Email / Password
- Firestore

目前 **沒有直接實作** 下列可能增加複雜度或費用的功能：

- Cloud Functions
- 自動寄信
- 簡訊通知
- 排程通知
- Admin SDK 後端

只要使用量在 Firebase Spark 免費額度內，第二版不必升級 Blaze。  
若未來資料量、Auth 使用量或 Hosting 流量明顯上升，才需要再看額度。

## 26. 第二版修改原因

- `login.html` / `src/login.ts`
  - 新增登入頁
  - 未登入者不得進入內部頁面
- `src/services/firebase.ts`
  - 集中 Firebase 初始化、常數、型別
- `src/services/authService.ts`
  - 集中登入、登出、讀取 users profile、角色管理
- `src/services/supplyService.ts`
  - 管理 supplies collection
- `src/services/usageRecordService.ts`
  - 管理 usageRecords collection
  - 交易式扣庫存
- `src/services/seedService.ts`
  - 管理 sample data 寫入
- `src/main.ts`
  - 升級為受保護的內部儀表板
- `src/trace.ts`
  - 升級為真正的領用紀錄管理頁
- `firebase.json`
  - 同時支援 Hosting / Firestore rules / indexes
- `firestore.rules`
  - 實作角色分流與未登入拒絕
- `firestore.indexes.json`
  - 保留索引部署入口
- `public/data/firestore-seed.json`
  - 提供消防救護情境 sample data
- `README.md`
  - 補齊 Windows 啟動、建置、Firebase Console 與部署流程

## 27. 下一版建議

第三版優先建議：

1. 加入 `使用者建立流程`
   - 目前第一位 admin 仍需手動在 Console 建立
2. 加入 `耗材主檔匯入 / 匯出`
   - 方便從現有 Google Sheets 過渡
3. 加入 `領用紀錄編輯歷程`
   - 保留誰改過哪一筆
4. 加入 `公開頁 / 內部頁分流`
   - 保留對外公開版，同時維持內部控管版
5. 加入 `Firestore Emulator` 本機開發流程
   - 降低測試風險

## 官方文件

- Firebase Hosting: [https://firebase.google.com/docs/hosting](https://firebase.google.com/docs/hosting)
- Firebase Authentication Email/Password: [https://firebase.google.com/docs/auth/web/password-auth](https://firebase.google.com/docs/auth/web/password-auth)
- Firestore Transactions: [https://firebase.google.com/docs/firestore/manage-data/transactions](https://firebase.google.com/docs/firestore/manage-data/transactions)
- Firestore Security Rules Conditions: [https://firebase.google.com/docs/firestore/security/rules-conditions](https://firebase.google.com/docs/firestore/security/rules-conditions)
- Firestore Index Overview: [https://firebase.google.com/docs/firestore/query-data/index-overview](https://firebase.google.com/docs/firestore/query-data/index-overview)

## 28. PWA 安裝與更新

目前專案已加入 PWA 支援，包含：

- `manifest.webmanifest`
- Service Worker
- App shell 快取
- Firestore 離線快取
- 安裝到桌面按鈕
- 新版更新提示
- 離線提示

### PWA 設定檔

- [public/manifest.webmanifest](./public/manifest.webmanifest)
- [src/sw.ts](./src/sw.ts)
- [src/pwa.ts](./src/pwa.ts)
- [public/icons/icon-192.png](./public/icons/icon-192.png)
- [public/icons/icon-512.png](./public/icons/icon-512.png)
- [public/icons/icon-maskable-512.png](./public/icons/icon-maskable-512.png)

### 本機驗證 PWA

```powershell
npm run build
npm run preview
```

開啟預覽網址後，請用 Chrome 或 Edge 檢查：

- 網址列是否出現安裝圖示
- 頁面右下角是否出現 `安裝到桌面`
- 更新版本後是否出現新版更新提示
- 斷網後是否出現 `目前為離線模式，資料為上次同步結果`

### 安裝成桌面 App

#### Chrome / Edge（Windows）

1. 打開網站
2. 點網址列右側的安裝圖示，或頁面右下角 `安裝到桌面`
3. 確認安裝

#### Android Chrome

1. 打開網站
2. 點選瀏覽器選單
3. 選 `加入主畫面` 或 `安裝應用程式`

### 離線資料說明

- 頁面資產由 Service Worker 快取
- Firestore 資料使用瀏覽器本機快取
- 離線時可讀取最近一次成功同步的資料
- 第一次從未成功載入過的資料，不保證離線可用
