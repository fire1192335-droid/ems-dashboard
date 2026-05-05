import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  runTransaction,
} from "firebase/firestore";

import {
  getFirestoreInstance,
  isCategoryOption,
  isPurposeOption,
  isStationOption,
  normalizeNumber,
  toDisplayDate,
  type ActorIdentity,
  type SupplyDocument,
  type UsageRecord,
  type UsageRecordDocument,
} from "./firebase";

const suppliesCollectionName = "supplies";
const usageRecordsCollectionName = "usageRecords";

export type UsageRecordFormInput = {
  receiveDate: string;
  receiveTime: string;
  receivePeriod: string;
  category: string;
  itemCode: string;
  itemName: string;
  quantity: number | string;
  unit: string;
  receiver: string;
  station: string;
  vehicleNo: string;
  caseNo: string;
  purpose: string;
  note: string;
};

function mapUsageRecord(documentId: string, payload: UsageRecordDocument): UsageRecord {
  return {
    ...payload,
    id: documentId,
    createdAtLabel: toDisplayDate(payload.createdAt),
  };
}

function validateUsageInput(input: UsageRecordFormInput) {
  const receiveDate = input.receiveDate.trim();
  const receiveTime = input.receiveTime.trim();
  const receivePeriod = input.receivePeriod.trim();
  const category = input.category.trim();
  const itemCode = input.itemCode.trim();
  const itemName = input.itemName.trim();
  const unit = input.unit.trim();
  const receiver = input.receiver.trim();
  const station = input.station.trim();
  const vehicleNo = input.vehicleNo.trim();
  const caseNo = input.caseNo.trim();
  const purpose = input.purpose.trim();
  const note = input.note.trim();
  const quantity = normalizeNumber(input.quantity);

  if (!receiveDate) {
    throw new Error("請填寫領取日期。");
  }

  if (!receiveTime) {
    throw new Error("請填寫領取時間。");
  }

  if (!receivePeriod) {
    throw new Error("請填寫領取時段。");
  }

  if (!isCategoryOption(category)) {
    throw new Error("請選擇有效的類別。");
  }

  if (!itemCode || !itemName) {
    throw new Error("請選擇有效的耗材。");
  }

  if (!unit) {
    throw new Error("單位不可為空。");
  }

  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error("領取數量必須大於 0。");
  }

  if (!receiver) {
    throw new Error("請填寫領取人。");
  }

  if (!isStationOption(station)) {
    throw new Error("請選擇有效的所屬單位。");
  }

  if (!isPurposeOption(purpose)) {
    throw new Error("請選擇有效的用途。");
  }

  return {
    receiveDate,
    receiveTime,
    receivePeriod,
    category,
    itemCode,
    itemName,
    quantity,
    unit,
    receiver,
    station,
    vehicleNo,
    caseNo,
    purpose,
    note,
  };
}

export async function listUsageRecords() {
  const snapshot = await getDocs(query(collection(getFirestoreInstance(), usageRecordsCollectionName)));

  return snapshot.docs
    .map((document) => mapUsageRecord(document.id, document.data() as UsageRecordDocument))
    .sort((left, right) => {
      const leftTime =
        left.createdAt instanceof Timestamp
          ? left.createdAt.toMillis()
          : new Date(left.createdAt).getTime();
      const rightTime =
        right.createdAt instanceof Timestamp
          ? right.createdAt.toMillis()
          : new Date(right.createdAt).getTime();

      return rightTime - leftTime;
    });
}

export async function createUsageRecord(input: UsageRecordFormInput, actor: ActorIdentity) {
  const payload = validateUsageInput(input);
  const database = getFirestoreInstance();

  return runTransaction(database, async (transaction) => {
    const supplyRef = doc(database, suppliesCollectionName, payload.itemCode);
    const usageRef = doc(collection(database, usageRecordsCollectionName));
    const supplySnapshot = await transaction.get(supplyRef);

    if (!supplySnapshot.exists()) {
      throw new Error("找不到對應的耗材主檔。");
    }

    const supply = supplySnapshot.data() as SupplyDocument;

    if (payload.quantity > supply.currentStock) {
      throw new Error(`領取數量不可大於目前庫存，現有庫存為 ${supply.currentStock}。`);
    }

    const stockAfterUse = supply.currentStock - payload.quantity;
    const now = Timestamp.now();

    transaction.update(supplyRef, {
      currentStock: stockAfterUse,
      updatedAt: now,
      updatedBy: actor.email,
      updatedByUid: actor.uid,
    });

    transaction.set(usageRef, {
      ...payload,
      stockAfterUse,
      createdBy: actor.email,
      createdByUid: actor.uid,
      createdAt: now,
    } satisfies UsageRecordDocument);

    return {
      id: usageRef.id,
      stockAfterUse,
    };
  });
}

export async function updateUsageRecord(
  recordId: string,
  input: UsageRecordFormInput,
  actor: ActorIdentity,
) {
  const payload = validateUsageInput(input);
  const database = getFirestoreInstance();

  return runTransaction(database, async (transaction) => {
    const recordRef = doc(database, usageRecordsCollectionName, recordId);
    const recordSnapshot = await transaction.get(recordRef);

    if (!recordSnapshot.exists()) {
      throw new Error("找不到要修改的領用紀錄。");
    }

    const previousRecord = recordSnapshot.data() as UsageRecordDocument;
    const previousSupplyRef = doc(database, suppliesCollectionName, previousRecord.itemCode);
    const previousSupplySnapshot = await transaction.get(previousSupplyRef);

    if (!previousSupplySnapshot.exists()) {
      throw new Error("原始耗材主檔不存在，無法調整庫存。");
    }

    const previousSupply = previousSupplySnapshot.data() as SupplyDocument;
    const now = Timestamp.now();

    if (previousRecord.itemCode === payload.itemCode) {
      const availableStock = previousSupply.currentStock + previousRecord.quantity;

      if (payload.quantity > availableStock) {
        throw new Error(`修改後數量不可大於可用庫存 ${availableStock}。`);
      }

      const stockAfterUse = availableStock - payload.quantity;

      transaction.update(previousSupplyRef, {
        currentStock: stockAfterUse,
        updatedAt: now,
        updatedBy: actor.email,
        updatedByUid: actor.uid,
      });

      transaction.update(recordRef, {
        ...payload,
        stockAfterUse,
      });

      return { stockAfterUse };
    }

    const nextSupplyRef = doc(database, suppliesCollectionName, payload.itemCode);
    const nextSupplySnapshot = await transaction.get(nextSupplyRef);

    if (!nextSupplySnapshot.exists()) {
      throw new Error("新指定的耗材主檔不存在。");
    }

    const nextSupply = nextSupplySnapshot.data() as SupplyDocument;

    if (payload.quantity > nextSupply.currentStock) {
      throw new Error(`修改後數量不可大於新耗材目前庫存 ${nextSupply.currentStock}。`);
    }

    const restoredPreviousStock = previousSupply.currentStock + previousRecord.quantity;
    const stockAfterUse = nextSupply.currentStock - payload.quantity;

    transaction.update(previousSupplyRef, {
      currentStock: restoredPreviousStock,
      updatedAt: now,
      updatedBy: actor.email,
      updatedByUid: actor.uid,
    });

    transaction.update(nextSupplyRef, {
      currentStock: stockAfterUse,
      updatedAt: now,
      updatedBy: actor.email,
      updatedByUid: actor.uid,
    });

    transaction.update(recordRef, {
      ...payload,
      stockAfterUse,
    });

    return { stockAfterUse };
  });
}

export async function deleteUsageRecord(recordId: string, actor: ActorIdentity) {
  const database = getFirestoreInstance();

  return runTransaction(database, async (transaction) => {
    const recordRef = doc(database, usageRecordsCollectionName, recordId);
    const recordSnapshot = await transaction.get(recordRef);

    if (!recordSnapshot.exists()) {
      throw new Error("找不到要刪除的領用紀錄。");
    }

    const record = recordSnapshot.data() as UsageRecordDocument;
    const supplyRef = doc(database, suppliesCollectionName, record.itemCode);
    const supplySnapshot = await transaction.get(supplyRef);

    if (!supplySnapshot.exists()) {
      throw new Error("對應耗材主檔不存在，無法回補庫存。");
    }

    const supply = supplySnapshot.data() as SupplyDocument;

    transaction.update(supplyRef, {
      currentStock: supply.currentStock + record.quantity,
      updatedAt: Timestamp.now(),
      updatedBy: actor.email,
      updatedByUid: actor.uid,
    });

    transaction.delete(recordRef);
  });
}
