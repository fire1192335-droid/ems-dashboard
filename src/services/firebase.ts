import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { browserLocalPersistence, getAuth, setPersistence, type Auth } from "firebase/auth";
import {
  Timestamp,
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from "firebase/firestore";

export const categoryOptions = [
  "A 自我防護類",
  "B 呼吸道處置類",
  "C 創傷處置類",
  "D 靜脈注射類",
  "E 輔助處置類",
  "H 高級救護處置",
  "I 心臟電擊去顫類",
] as const;

export const purposeOptions = ["出勤使用", "訓練使用", "補充車備", "盤點調整", "其他"] as const;
export const stationOptions = ["第一分隊", "第二分隊", "第三分隊", "第四分隊"] as const;
export const roleOptions = ["admin", "user", "viewer"] as const;

export type CategoryOption = (typeof categoryOptions)[number];
export type PurposeOption = (typeof purposeOptions)[number];
export type StationOption = (typeof stationOptions)[number];
export type UserRole = (typeof roleOptions)[number];
export type SupplyStatus = "正常" | "低庫存" | "缺貨";

export type SupplyDocument = {
  itemCode: string;
  itemName: string;
  category: string;
  unit: string;
  currentStock: number;
  safetyStock: number;
  location: string;
  updatedAt: Timestamp | Date | string;
  updatedBy: string;
  updatedByUid: string;
};

export type SupplyRecord = SupplyDocument & {
  id: string;
  updatedAtLabel: string;
  status: SupplyStatus;
};

export type UsageRecordDocument = {
  receiveDate: string;
  receiveTime: string;
  receivePeriod: string;
  category: string;
  itemCode: string;
  itemName: string;
  quantity: number;
  unit: string;
  receiver: string;
  station: string;
  vehicleNo: string;
  caseNo: string;
  purpose: string;
  stockAfterUse: number;
  note: string;
  createdBy: string;
  createdByUid: string;
  createdAt: Timestamp | Date | string;
};

export type UsageRecord = UsageRecordDocument & {
  id: string;
  createdAtLabel: string;
};

export type UserProfileDocument = {
  email: string;
  displayName: string;
  station: string;
  role: UserRole;
  createdAt: Timestamp | Date | string;
};

export type UserProfile = UserProfileDocument & {
  id: string;
  createdAtLabel: string;
};

export type ActorIdentity = {
  uid: string;
  email: string;
};

export type FirebaseConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
};

const firebaseConfig: FirebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? "",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? "",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? "",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? "",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? "",
  appId: import.meta.env.VITE_FIREBASE_APP_ID ?? "",
};

export const hasFirebaseConfig = Object.values(firebaseConfig).every(Boolean);

let firebaseApp: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let firestoreInstance: Firestore | null = null;
let authPersistencePromise: Promise<void> | null = null;

export function getFirebaseAppInstance() {
  if (!hasFirebaseConfig) {
    throw new Error("缺少 Firebase Web App 設定，請先建立 .env 並填入 VITE_FIREBASE_* 參數。");
  }

  if (firebaseApp) {
    return firebaseApp;
  }

  firebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  return firebaseApp;
}

export function getAuthInstance() {
  if (authInstance) {
    return authInstance;
  }

  authInstance = getAuth(getFirebaseAppInstance());
  return authInstance;
}

export async function ensureAuthPersistence() {
  if (!authPersistencePromise) {
    authPersistencePromise = setPersistence(getAuthInstance(), browserLocalPersistence);
  }

  await authPersistencePromise;
}

export function getFirestoreInstance() {
  if (firestoreInstance) {
    return firestoreInstance;
  }

  const app = getFirebaseAppInstance();

  try {
    firestoreInstance = initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    });
  } catch {
    firestoreInstance = getFirestore(app);
  }

  return firestoreInstance;
}

export function toDisplayDate(value: Timestamp | Date | string | undefined | null) {
  if (!value) {
    return "未提供";
  }

  const source =
    value instanceof Timestamp ? value.toDate() : value instanceof Date ? value : new Date(value);

  if (Number.isNaN(source.getTime())) {
    return String(value);
  }

  return source.toLocaleString("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function toInputDate(value: Timestamp | Date | string | undefined | null) {
  if (!value) {
    return "";
  }

  const source =
    value instanceof Timestamp ? value.toDate() : value instanceof Date ? value : new Date(value);

  if (Number.isNaN(source.getTime())) {
    return "";
  }

  return source.toISOString().slice(0, 10);
}

export function computeSupplyStatus(currentStock: number, safetyStock: number): SupplyStatus {
  if (currentStock <= 0) {
    return "缺貨";
  }

  if (currentStock <= safetyStock) {
    return "低庫存";
  }

  return "正常";
}

export function normalizeNumber(value: number | string) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : NaN;
}

export function isCategoryOption(value: string): value is CategoryOption {
  return categoryOptions.includes(value as CategoryOption);
}

export function isPurposeOption(value: string): value is PurposeOption {
  return purposeOptions.includes(value as PurposeOption);
}

export function isStationOption(value: string): value is StationOption {
  return stationOptions.includes(value as StationOption);
}

export function isRoleOption(value: string): value is UserRole {
  return roleOptions.includes(value as UserRole);
}

export function roleLabel(role: UserRole) {
  if (role === "admin") {
    return "管理員";
  }

  if (role === "user") {
    return "一般使用者";
  }

  return "檢視者";
}

export function stationChoicesHtml(selected?: string) {
  return stationOptions
    .map(
      (option) =>
        `<option value="${option}" ${selected === option ? "selected" : ""}>${option}</option>`,
    )
    .join("");
}

export function categoryChoicesHtml(selected?: string) {
  return categoryOptions
    .map(
      (option) =>
        `<option value="${option}" ${selected === option ? "selected" : ""}>${option}</option>`,
    )
    .join("");
}

export function purposeChoicesHtml(selected?: string) {
  return purposeOptions
    .map(
      (option) =>
        `<option value="${option}" ${selected === option ? "selected" : ""}>${option}</option>`,
    )
    .join("");
}

export { firebaseConfig, Timestamp };
