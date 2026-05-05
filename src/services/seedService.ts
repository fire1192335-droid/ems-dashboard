import { collection, doc, setDoc, writeBatch } from "firebase/firestore";

import { getFirestoreInstance, Timestamp, type ActorIdentity, type SupplyDocument, type UsageRecordDocument } from "./firebase";

export type SampleSeedData = {
  supplies: Array<Omit<SupplyDocument, "updatedAt" | "updatedBy" | "updatedByUid">>;
  usageRecords: Array<
    Omit<UsageRecordDocument, "createdAt" | "createdBy" | "createdByUid"> & { id: string }
  >;
  users: Array<{
    docIdHint: string;
    email: string;
    displayName: string;
    station: string;
    role: string;
    note: string;
  }>;
};

export async function loadSampleSeedData() {
  const response = await fetch(`${import.meta.env.BASE_URL}data/firestore-seed.json`);

  if (!response.ok) {
    throw new Error("無法讀取範例 seed data。");
  }

  return (await response.json()) as SampleSeedData;
}

export async function seedSampleDatabase(actor: ActorIdentity) {
  const database = getFirestoreInstance();
  const batch = writeBatch(database);
  const data = await loadSampleSeedData();
  const now = Timestamp.now();

  for (const supply of data.supplies) {
    batch.set(doc(database, "supplies", supply.itemCode), {
      ...supply,
      updatedAt: now,
      updatedBy: actor.email,
      updatedByUid: actor.uid,
    } satisfies SupplyDocument);
  }

  for (const usageRecord of data.usageRecords) {
    batch.set(doc(collection(database, "usageRecords"), usageRecord.id), {
      ...usageRecord,
      createdAt: now,
      createdBy: actor.email,
      createdByUid: actor.uid,
    } satisfies UsageRecordDocument);
  }

  await batch.commit();
  return data;
}
