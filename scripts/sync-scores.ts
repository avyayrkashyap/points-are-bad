/**
 * Syncs actual scores for all finished WC 2026 matches (group stage + knockout)
 * into Firestore, and updates team names for knockout matches as the bracket
 * fills in. Then recomputes leaderboard aggregates.
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

interface ScoreEntry { home: number | null; away: number | null; }

interface ApiMatch {
  id: number;
  stage: string;
  status: string;
  homeTeam: { name: string };
  awayTeam: { name: string };
  score: {
    duration: 'REGULAR' | 'EXTRA_TIME' | 'PENALTY_SHOOTOUT';
    fullTime: ScoreEntry;
    regularTime?: ScoreEntry;
    extraTime?: ScoreEntry;
  };
}

// Returns the final score excluding penalty shootout goals.
// - REGULAR:            fullTime (90-min score)
// - EXTRA_TIME:         fullTime (= regularTime + extraTime, already correct)
// - PENALTY_SHOOTOUT:   regularTime + extraTime (fullTime includes PSO goals, so we sum manually)
function finalScoreNoPSO(m: ApiMatch): { home: number; away: number } | null {
  if (m.score.duration === 'PENALTY_SHOOTOUT') {
    const rt = m.score.regularTime;
    const et = m.score.extraTime;
    if (rt?.home == null || rt?.away == null) return null;
    const etHome = et?.home ?? 0;
    const etAway = et?.away ?? 0;
    return { home: rt.home + etHome, away: rt.away + etAway };
  }
  const { home, away } = m.score.fullTime;
  if (home === null || away === null) return null;
  return { home, away };
}

const GROUP_STAGE = 'GROUP_STAGE';

async function fetchFinishedMatches(): Promise<ApiMatch[]> {
  const res = await fetch(
    'https://api.football-data.org/v4/competitions/WC/matches?status=FINISHED',
    { headers: { 'X-Auth-Token': apiKey! } }
  );
  if (!res.ok) throw new Error(`API error: ${res.status} ${await res.text()}`);
  const data = await res.json() as { matches: ApiMatch[] };
  return data.matches;
}

// Fetches all knockout matches so we can keep team names up to date as the
// bracket fills in (team names go from TBD to real names after group stage).
async function fetchKnockoutMatches(): Promise<ApiMatch[]> {
  const res = await fetch(
    'https://api.football-data.org/v4/competitions/WC/matches',
    { headers: { 'X-Auth-Token': apiKey! } }
  );
  if (!res.ok) throw new Error(`API error: ${res.status} ${await res.text()}`);
  const data = await res.json() as { matches: ApiMatch[] };
  return data.matches.filter((m) => m.stage !== GROUP_STAGE);
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
    let totalPredicted = 0;
    let missed = 0;
    let perfect = 0, plusOne = 0, plusTwo = 0, plusThree = 0, fourPlus = 0;
    let correctWinner = 0;
    const matchHistory: { date: number; pts: number; miss: boolean }[] = [];

    // Sort finished matches by date for the history chart
    const sortedMatchIds = Array.from(finishedMatchIds).sort((a, b) => {
      const da = matchDates.get(a)?.getTime() ?? 0;
      const db_ = matchDates.get(b)?.getTime() ?? 0;
      return da - db_;
    });

    for (const matchId of sortedMatchIds) {
      const score = scoreMap.get(matchId);
      if (!score) continue;
      const matchDate = matchDates.get(matchId);
      if (!matchDate) continue;
      if (matchDate < firstMatchDate) continue; // before they joined

      matchesScored += 1;
      const pred = preds.get(matchId);

      if (pred) {
        totalPredicted += 1;
        const pts = Math.abs(pred.score1 - score.home) + Math.abs(pred.score2 - score.away);
        totalPoints += pts;
        if (pts === 0) perfect++;
        else if (pts === 1) plusOne++;
        else if (pts === 2) plusTwo++;
        else if (pts === 3) plusThree++;
        else fourPlus++;

        const predOutcome = pred.score1 > pred.score2 ? 'H' : pred.score1 < pred.score2 ? 'A' : 'D';
        const actualOutcome = score.home > score.away ? 'H' : score.home < score.away ? 'A' : 'D';
        if (predOutcome === actualOutcome) correctWinner++;
        matchHistory.push({ date: matchDate.getTime(), pts, miss: false });
      } else {
        missed += 1;
        const penalty = matchPenalty.get(matchId) ?? 7;
        totalPoints += penalty;
        matchHistory.push({ date: matchDate.getTime(), pts: penalty, miss: true });
      }
    }

    const info = userInfo.get(userId)!;
    batch.set(db.collection('leaderboard').doc(userId), {
      displayName: info.displayName,
      photoURL: info.photoURL,
      totalPoints,
      matchesScored,
      totalPredicted,
      missed,
      perfect,
      plusOne,
      plusTwo,
      plusThree,
      fourPlus,
      correctWinner,
      matchHistory,
      updatedAt: FieldValue.serverTimestamp(),
    });
    usersUpdated++;
  }

  await batch.commit();
  console.log(`Leaderboard updated for ${usersUpdated} users (miss penalty: worst score + 2).`);
}

async function syncScores() {
  console.log('Fetching all finished matches...');
  const [finished, knockout] = await Promise.all([fetchFinishedMatches(), fetchKnockoutMatches()]);
  console.log(`Found ${finished.length} finished matches.`);

  const scoreMap = new Map<string, { home: number; away: number }>();
  const batch = db.batch();
  let scoresUpdated = 0;
  let teamsUpdated = 0;

  // Update scores for all finished matches — exclude penalty shootout goals
  for (const m of finished) {
    const score = finalScoreNoPSO(m);
    if (!score) continue;

    const matchId = String(m.id);
    scoreMap.set(matchId, score);

    const ref = db.collection('matches').doc(matchId);
    batch.update(ref, { actualScore1: score.home, actualScore2: score.away });
    scoresUpdated++;
  }

  // Update team names for knockout matches as the bracket fills in
  for (const m of knockout) {
    const team1 = m.homeTeam.name;
    const team2 = m.awayTeam.name;
    if (!team1 || !team2) continue;
    const ref = db.collection('matches').doc(String(m.id));
    batch.update(ref, { team1, team2 });
    teamsUpdated++;
  }

  if (scoresUpdated > 0 || teamsUpdated > 0) {
    await batch.commit();
    if (scoresUpdated > 0) console.log(`Updated scores for ${scoresUpdated} matches.`);
    if (teamsUpdated > 0) console.log(`Updated team names for ${teamsUpdated} knockout matches.`);
  } else {
    console.log('No changes to write.');
  }

  if (scoreMap.size === 0) {
    console.log('No finished matches — skipping leaderboard recompute.');
    process.exit(0);
  }

  await recomputeLeaderboard(new Set(scoreMap.keys()), scoreMap);

  process.exit(0);
}

syncScores().catch((err) => { console.error(err); process.exit(1); });
