import {
  type User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import {
  Timestamp,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
} from "firebase/firestore";

import {
  ensureAuthPersistence,
  getAuthInstance,
  getFirestoreInstance,
  isRoleOption,
  isStationOption,
  roleLabel,
  toDisplayDate,
  type UserProfile,
  type UserProfileDocument,
  type UserRole,
} from "./firebase";

export type AuthSession = {
  user: User;
  profile: UserProfile | null;
};

const usersCollectionName = "users";

function mapUserProfile(id: string, payload: UserProfileDocument): UserProfile {
  return {
    ...payload,
    id,
    createdAtLabel: toDisplayDate(payload.createdAt),
  };
}

export async function signInWithPassword(email: string, password: string) {
  await ensureAuthPersistence();
  return signInWithEmailAndPassword(getAuthInstance(), email, password);
}

export async function signOutCurrentUser() {
  await signOut(getAuthInstance());
}

export async function getUserProfile(uid: string) {
  const snapshot = await getDoc(doc(getFirestoreInstance(), usersCollectionName, uid));

  if (!snapshot.exists()) {
    return null;
  }

  return mapUserProfile(snapshot.id, snapshot.data() as UserProfileDocument);
}

export async function createViewerProfile(input: {
  uid: string;
  email: string;
  displayName: string;
  station: string;
}) {
  const displayName = input.displayName.trim();
  const station = input.station.trim();

  if (!displayName) {
    throw new Error("請填寫顯示名稱。");
  }

  if (!isStationOption(station)) {
    throw new Error("請選擇有效的所屬單位。");
  }

  const ref = doc(getFirestoreInstance(), usersCollectionName, input.uid);
  await setDoc(ref, {
    email: input.email.trim().toLowerCase(),
    displayName,
    station,
    role: "viewer",
    createdAt: Timestamp.now(),
  } satisfies UserProfileDocument);

  const created = await getDoc(ref);
  return mapUserProfile(created.id, created.data() as UserProfileDocument);
}

export function observeAuthSession(
  onChange: (session: AuthSession | null) => void,
  onError?: (error: Error) => void,
) {
  let unsubscribe = () => undefined;

  void ensureAuthPersistence()
    .then(() => {
      unsubscribe = onAuthStateChanged(
        getAuthInstance(),
        async (user) => {
          if (!user) {
            onChange(null);
            return;
          }

          try {
            const profile = await getUserProfile(user.uid);
            onChange({ user, profile });
          } catch (error) {
            if (error instanceof Error) {
              onError?.(error);
            } else {
              onError?.(new Error("無法讀取目前使用者資料。"));
            }
          }
        },
        (error) => onError?.(error),
      );
    })
    .catch((error) => {
      if (error instanceof Error) {
        onError?.(error);
      } else {
        onError?.(new Error("無法初始化登入狀態。"));
      }
    });

  return () => unsubscribe();
}

export async function listUserProfiles() {
  const snapshot = await getDocs(query(collection(getFirestoreInstance(), usersCollectionName)));

  return snapshot.docs
    .map((document) => mapUserProfile(document.id, document.data() as UserProfileDocument))
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

export async function updateUserProfile(input: {
  uid: string;
  displayName: string;
  station: string;
  role: string;
}) {
  const displayName = input.displayName.trim();
  const station = input.station.trim();
  const role = input.role.trim();

  if (!displayName) {
    throw new Error("顯示名稱不可為空。");
  }

  if (!isStationOption(station)) {
    throw new Error("請選擇有效的所屬單位。");
  }

  if (!isRoleOption(role)) {
    throw new Error("請選擇有效的角色。");
  }

  await updateDoc(doc(getFirestoreInstance(), usersCollectionName, input.uid), {
    displayName,
    station,
    role: role as UserRole,
  });
}

export function userRoleBadge(role: UserRole) {
  if (role === "admin") {
    return "status status-danger";
  }

  if (role === "user") {
    return "status status-warning";
  }

  return "status status-normal";
}

export { roleLabel };
