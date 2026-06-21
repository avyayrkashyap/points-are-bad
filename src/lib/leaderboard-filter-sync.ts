import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from './firebase';

const FILTER_FIELD = 'leaderboardFilter';

export function subscribeLeaderboardFilter(
  userId: string,
  cb: (excludedUserIds: Set<string>) => void,
): () => void {
  return onSnapshot(doc(db, 'users', userId), (snap) => {
    if (!snap.exists()) { cb(new Set()); return; }
    const raw = snap.data()?.[FILTER_FIELD];
    const ids = Array.isArray(raw?.excludedUserIds)
      ? raw.excludedUserIds.filter((x: unknown): x is string => typeof x === 'string')
      : [];
    cb(new Set(ids));
  });
}

export async function writeLeaderboardFilter(
  userId: string,
  excludedUserIds: ReadonlySet<string>,
): Promise<void> {
  await setDoc(
    doc(db, 'users', userId),
    { [FILTER_FIELD]: { excludedUserIds: Array.from(excludedUserIds).sort() } },
    { merge: true },
  );
}
