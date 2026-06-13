import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from './firebase';

export interface LeaderboardEntry {
  userId: string;
  displayName: string;
  photoURL: string;
  totalPoints: number;
  matchesScored: number;
}

export function subscribeLeaderboard(cb: (entries: LeaderboardEntry[]) => void) {
  const q = query(collection(db, 'leaderboard'));
  return onSnapshot(q, (snap) => {
    const entries = snap.docs.map((d) => ({ userId: d.id, ...d.data() } as LeaderboardEntry));
    // Sort by pts/game ascending; more games played wins ties
    entries.sort((a, b) => {
      const aPpg = a.matchesScored > 0 ? a.totalPoints / a.matchesScored : Infinity;
      const bPpg = b.matchesScored > 0 ? b.totalPoints / b.matchesScored : Infinity;
      if (aPpg !== bPpg) return aPpg - bPpg;
      return b.matchesScored - a.matchesScored; // more games played ranks higher
    });
    cb(entries);
  });
}
