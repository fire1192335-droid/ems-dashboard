import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  setDoc,
} from "firebase/firestore";

import {
  computeSupplyStatus,
  getFirestoreInstance,
  isCategoryOption,
  normalizeNumber,
  toDisplayDate,
  type ActorIdentity,
  type SupplyDocument,
  type SupplyRecord,
} from "./firebase";

const suppliesCollectionName = "supplies";

export type SupplyFormInput = {
  itemCode: string;
  itemName: string;
  category: string;
  unit: string;
  currentStock: number | string;
  safetyStock: number | string;
  location: string;
};

function mapSupply(documentId: string, payload: SupplyDocument): SupplyRecord {
  return {
    ...payload,
    id: documentId,
    updatedAtLabel: toDisplayDate(payload.updatedAt),
    status: computeSupplyStatus(payload.currentStock, payload.safetyStock),
  };
}

function validateSupplyInput(input: SupplyFormInput) {
  const itemCode = input.itemCode.trim();
  const itemName = input.itemName.trim();
  const category = input.category.trim();
  const unit = input.unit.trim();
  const location = input.location.trim();
  const currentStock = normalizeNumber(input.currentStock);
  const safetyStock = normalizeNumber(input.safetyStock);

  if (!itemCode) {
    throw new Error("耗材編號不可為空。");
  }

  if (!itemName) {
    throw new Error("耗材名稱不可為空。");
  }

  if (!isCategoryOption(category)) {
    throw new Error("請選擇有效的耗材類別。");
  }

  if (!unit) {
    throw new Error("單位不可為空。");
  }

  if (!Number.isInteger(currentStock) || currentStock < 0) {
    throw new Error("目前庫存必須為 0 或以上的整數。");
  }

  if (!Number.isInteger(safetyStock) || safetyStock < 0) {
    throw new Error("安全庫存必須為 0 或以上的整數。");
  }

  return {
    itemCode,
    itemName,
    category,
    unit,
    currentStock,
    safetyStock,
    location,
  };
}

export async function listSupplies() {
  const snapshot = await getDocs(query(collection(getFirestoreInstance(), suppliesCollectionName)));

  return snapshot.docs
    .map((document) => mapSupply(document.id, document.data() as SupplyDocument))
    .sort((left, right) => left.category.localeCompare(right.category) || left.itemCode.localeCompare(right.itemCode));
}

export async function saveSupply(input: SupplyFormInput, actor: ActorIdentity) {
  const payload = validateSupplyInput(input);
  const documentId = payload.itemCode;

  await setDoc(doc(getFirestoreInstance(), suppliesCollectionName, documentId), {
    ...payload,
    updatedAt: Timestamp.now(),
    updatedBy: actor.email,
    updatedByUid: actor.uid,
  } satisfies SupplyDocument);
}

export async function deleteSupply(itemCode: string) {
  await deleteDoc(doc(getFirestoreInstance(), suppliesCollectionName, itemCode));
}
