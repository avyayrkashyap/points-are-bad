/**
 * Syncs actual scores for finished WC 2026 group-stage matches into Firestore,
 * then recomputes the leaderboard aggregates (totalPoints, matchesScored per user).
 *
 * Run manually:  npx tsx --env-file=.env scripts/sync-scores.ts
 * In CI:         uses FIREBASE_SERVICE_ACCOUNT secret (base64-encoded JSON)
 */
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { readFileSync, existsSync, writeFileSync } from 'fs';
import { resolve } from 'path';

// Support both local (service-account.json) and CI (FIREBASE_SERVICE_ACCOUNT env var)
let serviceAccount: object;
const localKey = resolve(process.cwd(), 'service-account.json');
const envKey = process.env.FIREBASE_SERVICE_ACCOUNT;

if (envKey) {
  const decoded = Buffer.from(envKey, 'base64').toString('utf-8');
  const tmpPath = resolve(process.cwd(), '.tmp-service-account.json');
  writeFileSync(tmpPath, decoded);
  serviceAccount = JSON.parse(decoded);
} else if (existsSync(localKey)) {
  serviceAccount = JSON.parse(readFileSync(localKey, 'utf-8'));
} else {
  console.error('No service account found. Set FIREBASE_SERVICE_ACCOUNT env var or place service-account.json in project root.');
  process.exit(1);
}

const apiKey = process.env.FOOTBALL_DATA_API_KEY;
if (!apiKey) {
  console.error('Missing FOOTBALL_DATA_API_KEY');
  process.exit(1);
}

initializeApp({ credential: cert(serviceAccount as Parameters<typeof cert>[0]) });
const db = getFirestore();

interface ApiMatch {
  id: number;
  status: string;
  score: {
    fullTime: { home: number | null; away: number | null };
  };
}

async function fetchFinishedMatches(): Promise<ApiMatch[]> {
  const res = await fetch(
    'https://api.football-data.org/v4/competitions/WC/matches?stage=GROUP_STAGE&status=FINISHED',
    { headers: { 'X-Auth-Token': apiKey! } }
  );
  if (!res.ok) throw new Error(`API error: ${res.status} ${await res.text()}`);
  const data = await res.json() as { matches: ApiMatch[] };
  return data.matches;
}

async function recomputeLeaderboard(finishedMatchIds: Set<string>, scoreMap: Map<string, { home: number; away: number }>) {
  console.log('Recomputing leaderboard...');

  // Fetch match dates
  const matchesSnap = await db.collection('matches').get();
  const matchDates = new Map<string, Date>();
  for (const doc of matchesSnap.docs) {
    const d = doc.data();
    if (d.date) matchDates.set(doc.id, d.date.toDate());
  }

  // Fetch all predictions
  const predsSnap = await db.collection('predictions').get();

  // Group predictions by user and by match
  const userPreds = new Map<string, Map<string, { score1: number; score2: number }>>();
  const userInfo = new Map<string, { displayName: string; photoURL: string }>();
  const matchPreds = new Map<string, Array<{ score1: number; score2: number }>>();

  for (const doc of predsSnap.docs) {
    const p = doc.data();
    if (!userPreds.has(p.userId)) userPreds.set(p.userId, new Map());
    userPreds.get(p.userId)!.set(p.matchId, { score1: p.score1, score2: p.score2 });
    userInfo.set(p.userId, { displayName: p.userName ?? 'Anonymous', photoURL: p.userPhoto ?? '' });
    if (!matchPreds.has(p.matchId)) matchPreds.set(p.matchId, []);
    matchPreds.get(p.matchId)!.push({ score1: p.score1, score2: p.score2 });
  }

  // For each finished match, compute the penalty (worst score among predictors + 2)
  const matchPenalty = new Map<string, number>();
  for (const matchId of finishedMatchIds) {
    const score = scoreMap.get(matchId);
    if (!score) continue;
    const preds = matchPreds.get(matchId) ?? [];
    if (preds.length === 0) {
      matchPenalty.set(matchId, 7); // fallback if nobody predicted
    } else {
      const maxPts = Math.max(...preds.map(p =>
        Math.abs(p.score1 - score.home) + Math.abs(p.score2 - score.away)
      ));
      matchPenalty.set(matchId, maxPts + 2);
    }
  }

  // Compute totals per user
  const batch = db.batch();
  let usersUpdated = 0;

  for (const [userId, preds] of userPreds) {
    // Find the kickoff date of the user's earliest prediction
    let firstMatchDate: Date | null = null;
    for (const matchId of preds.keys()) {
      const d = matchDates.get(matchId);
      if (d && (!firstMatchDate || d < firstMatchDate)) firstMatchDate = d;
    }
    if (!firstMatchDate) continue;

    let totalPoints = 0;
    let matchesScored = 0;

    for (const matchId of finishedMatchIds) {
      const score = scoreMap.get(matchId);
      if (!score) continue;
      const matchDate = matchDates.get(matchId);
      if (!matchDate) continue;
      if (matchDate < firstMatchDate) continue; // before they joined

      const pred = preds.get(matchId);
      if (pred) {
        totalPoints += Math.abs(pred.score1 - score.home) + Math.abs(pred.score2 - score.away);
      } else {
        totalPoints += matchPenalty.get(matchId) ?? 7; // worst score + 2
      }
      matchesScored += 1;
    }

    const info = userInfo.get(userId)!;
    batch.set(db.collection('leaderboard').doc(userId), {
      displayName: info.displayName,
      photoURL: info.photoURL,
      totalPoints,
      matchesScored,
      updatedAt: FieldValue.serverTimestamp(),
    });
    usersUpdated++;
  }

  await batch.commit();
  console.log(`Leaderboard updated for ${usersUpdated} users (miss penalty: worst score + 2).`);
}

async function syncScores() {
  console.log('Fetching finished group-stage matches...');
  const finished = await fetchFinishedMatches();
  console.log(`Found ${finished.length} finished matches.`);

  if (finished.length === 0) {
    console.log('Nothing to update.');
    process.exit(0);
  }

  // Build score map keyed by Firestore match ID (string)
  const scoreMap = new Map<string, { home: number; away: number }>();
  const batch = db.batch();
  let updated = 0;

  for (const m of finished) {
    const { home, away } = m.score.fullTime;
    if (home === null || away === null) continue;

    const matchId = String(m.id);
    scoreMap.set(matchId, { home, away });

    const ref = db.collection('matches').doc(matchId);
    batch.update(ref, { actualScore1: home, actualScore2: away });
    updated++;
  }

  if (updated > 0) {
    await batch.commit();
    console.log(`Updated scores for ${updated} matches.`);
  } else {
    console.log('No score changes to write.');
  }

  // Recompute leaderboard using the finished match IDs + scores
  await recomputeLeaderboard(new Set(scoreMap.keys()), scoreMap);

  process.exit(0);
}

syncScores().catch((err) => { console.error(err); process.exit(1); });
