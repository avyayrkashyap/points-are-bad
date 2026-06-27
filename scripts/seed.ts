/**
 * Fetches all WC 2026 fixtures (group stage + knockout) from football-data.org
 * and seeds Firestore. Safe to re-run — uses the API match ID as the document
 * ID so it's idempotent.
 *
 * Setup:
 *   1. service-account.json in project root (Firebase Admin key)
 *   2. FOOTBALL_DATA_API_KEY in .env
 *   3. npx tsx --env-file=.env scripts/seed.ts
 */
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const keyPath = resolve(process.cwd(), 'service-account.json');
if (!existsSync(keyPath)) {
  console.error('Missing service-account.json — download from Firebase console → Project settings → Service accounts');
  process.exit(1);
}

const apiKey = process.env.FOOTBALL_DATA_API_KEY;
if (!apiKey) {
  console.error('Missing FOOTBALL_DATA_API_KEY — add it to .env and run with --env-file=.env');
  process.exit(1);
}

initializeApp({ credential: cert(JSON.parse(readFileSync(keyPath, 'utf-8'))) });
const db = getFirestore();

interface ApiMatch {
  id: number;
  utcDate: string;
  stage: string;
  group: string | null;
  homeTeam: { name: string };
  awayTeam: { name: string };
  venue: string | null;
}

const STAGE_LABELS: Record<string, string> = {
  LAST_32: 'Round of 32',
  LAST_16: 'Round of 16',
  QUARTER_FINALS: 'Quarter-final',
  SEMI_FINALS: 'Semi-final',
  THIRD_PLACE: '3rd Place',
  FINAL: 'Final',
};

function stageToGroup(stage: string, group: string | null): string {
  if (stage === 'GROUP_STAGE' && group) return group.replace('GROUP_', '');
  return STAGE_LABELS[stage] ?? stage;
}

async function fetchAllMatches(): Promise<ApiMatch[]> {
  const res = await fetch(
    'https://api.football-data.org/v4/competitions/WC/matches',
    { headers: { 'X-Auth-Token': apiKey! } }
  );
  if (!res.ok) throw new Error(`API error: ${res.status} ${await res.text()}`);
  const data = await res.json() as { matches: ApiMatch[] };
  return data.matches;
}

async function seed() {
  console.log('Fetching all WC 2026 fixtures from football-data.org...');
  const matches = await fetchAllMatches();
  console.log(`Got ${matches.length} matches — writing to Firestore...`);

  const batch = db.batch();
  for (const m of matches) {
    const ref = db.collection('matches').doc(String(m.id));
    batch.set(ref, {
      team1: m.homeTeam.name,
      team2: m.awayTeam.name,
      group: stageToGroup(m.stage, m.group),
      date: Timestamp.fromDate(new Date(m.utcDate)),
      venue: m.venue ?? '',
    });
  }
  await batch.commit();
  console.log(`Done — ${matches.length} matches written.`);
  process.exit(0);
}

seed().catch((err) => { console.error(err); process.exit(1); });
