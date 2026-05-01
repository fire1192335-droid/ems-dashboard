import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";

export const supplyCategoryOptions = [
  "A 自我防護類",
  "B 呼吸道處置類",
  "C 創傷處置類",
  "D 靜脈注射類",
  "E 輔助處置類",
  "H 高級救護處置",
  "I 心臟電擊去顫類",
] as const;

export const supplyPurposeOptions = [
  "出勤使用",
  "訓練使用",
  "補充車備",
  "盤點調整",
  "其他",
] as const;

export const supplyTeamOptions = ["第一分隊", "第二分隊", "第三分隊", "第四分隊"] as const;

export type SupplyCategory = (typeof supplyCategoryOptions)[number];
export type SupplyPurpose = (typeof supplyPurposeOptions)[number];
export type SupplyTeam = (typeof supplyTeamOptions)[number];

export type SupplyTraceRecord = {
  recordId: string;
  createdAt: string;
  timeSlot: string;
  category: SupplyCategory;
  itemCode: string;
  itemName: string;
  quantity: number;
  unit: string;
  takenBy: string;
  team: SupplyTeam | string;
  vehicleNo: string;
  caseNo: string;
  purpose: SupplyPurpose | string;
  stockAfter: number | null;
  note: string;
};

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? "",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? "",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? "",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? "",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? "",
  appId: import.meta.env.VITE_FIREBASE_APP_ID ?? "",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID ?? "",
};

export const hasFirebaseConfig = [
  firebaseConfig.apiKey,
  firebaseConfig.authDomain,
  firebaseConfig.projectId,
  firebaseConfig.storageBucket,
  firebaseConfig.messagingSenderId,
  firebaseConfig.appId,
].every(Boolean);

let firebaseApp: FirebaseApp | null = null;
let firestoreDb: Firestore | null = null;

export function getFirebaseAppInstance() {
  if (!hasFirebaseConfig) {
    return null;
  }

  if (firebaseApp) {
    return firebaseApp;
  }

  firebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  return firebaseApp;
}

export function getFirestoreInstance() {
  const app = getFirebaseAppInstance();

  if (!app) {
    return null;
  }

  if (!firestoreDb) {
    firestoreDb = getFirestore(app);
  }

  return firestoreDb;
}

export { firebaseConfig };
