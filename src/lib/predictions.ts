import {
  doc,
  setDoc,
  collection,
  query,
  where,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';

export interface Prediction {
  id: string;
  userId: string;
  matchId: string;
  score1: number;
  score2: number;
  submittedAt: Date | null;
  userName: string;
  userPhoto: string;
}

function toDate(val: unknown): Date | null {
  if (!val) return null;
  if (val && typeof (val as { toDate: () => Date }).toDate === 'function') {
    return (val as { toDate: () => Date }).toDate();
  }
  return null;
}

export async function submitPrediction(
  userId: string,
  matchId: string,
  score1: number,
  score2: number,
  userName: string,
  userPhoto: string
) {
  await setDoc(doc(db, 'predictions', `${userId}_${matchId}`), {
    userId,
    matchId,
    score1,
    score2,
    userName,
    userPhoto,
    submittedAt: serverTimestamp(),
  });
}

export function subscribeUserPredictions(
  userId: string,
  cb: (preds: Prediction[]) => void
) {
  const q = query(collection(db, 'predictions'), where('userId', '==', userId));
  return onSnapshot(q, (snap) =>
    cb(
      snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<Prediction, 'id' | 'submittedAt'>),
        submittedAt: toDate(d.data().submittedAt),
      }))
    )
  );
}

export function subscribeMatchPredictions(
  matchId: string,
  cb: (preds: Prediction[]) => void
) {
  const q = query(collection(db, 'predictions'), where('matchId', '==', matchId));
  return onSnapshot(q, (snap) =>
    cb(
      snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<Prediction, 'id' | 'submittedAt'>),
        submittedAt: toDate(d.data().submittedAt),
      }))
    )
  );
}

function fromDoc(d: import('firebase/firestore').QueryDocumentSnapshot): Prediction {
  return {
    id: d.id,
    ...(d.data() as Omit<Prediction, 'id' | 'submittedAt'>),
    submittedAt: toDate(d.data().submittedAt),
  };
}

/**
 * Fetches all predictions for a set of finished match IDs.
 * Used by the leaderboard — only works for matches where actualScore is set
 * (security rules allow reading those).
 */
export function subscribeLeaderboardPredictions(
  finishedMatchIds: string[],
  cb: (preds: Prediction[]) => void
): () => void {
  if (finishedMatchIds.length === 0) {
    cb([]);
    return () => {};
  }

  // Chunk into groups of 30 (Firestore 'in' query limit)
  const chunks: string[][] = [];
  for (let i = 0; i < finishedMatchIds.length; i += 30) {
    chunks.push(finishedMatchIds.slice(i, i + 30));
  }

  if (chunks.length === 1) {
    const q = query(collection(db, 'predictions'), where('matchId', 'in', chunks[0]));
    return onSnapshot(q, (snap) => cb(snap.docs.map(fromDoc)));
  }

  // Multiple chunks: merge results from all subscriptions
  const buckets = new Map<number, Prediction[]>();
  const unsubs: (() => void)[] = [];
  for (let i = 0; i < chunks.length; i++) {
    const idx = i;
    const q = query(collection(db, 'predictions'), where('matchId', 'in', chunks[idx]));
    unsubs.push(
      onSnapshot(q, (snap) => {
        buckets.set(idx, snap.docs.map(fromDoc));
        cb(Array.from(buckets.values()).flat());
      })
    );
  }
  return () => unsubs.forEach((u) => u());
}
