import { useEffect, useState } from 'react';
import { subscribeLeaderboardPredictions } from '../lib/predictions';
import type { Prediction } from '../lib/predictions';
import type { Match } from '../lib/matches';
import { calcPoints } from '../lib/scoring';
import { useAuth } from '../lib/useAuth';

interface Props {
  matchMap: Map<string, Match>;
}

interface UserRow {
  userId: string;
  userName: string;
  userPhoto: string;
  totalPoints: number;
  matchesScored: number;
}

export function Leaderboard({ matchMap }: Props) {
  const { user } = useAuth();
  const [predictions, setPredictions] = useState<Prediction[]>([]);

  const finishedMatchIds = Array.from(matchMap.values())
    .filter((m) => m.actualScore1 != null)
    .map((m) => m.id);

  useEffect(() => {
    return subscribeLeaderboardPredictions(finishedMatchIds, setPredictions);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finishedMatchIds.join(',')]);

  if (finishedMatchIds.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-4xl mb-4">⏳</p>
        <p className="text-slate-300 font-semibold mb-2">No results yet</p>
        <p className="text-sm text-slate-500">
          Leaderboard updates once matches have final scores.
        </p>
      </div>
    );
  }

  // Aggregate points per user
  const userMap = new Map<string, UserRow>();
  for (const pred of predictions) {
    const match = matchMap.get(pred.matchId);
    if (!match) continue;
    const pts = calcPoints(pred, match);
    if (pts === null) continue;

    const existing = userMap.get(pred.userId);
    if (existing) {
      existing.totalPoints += pts;
      existing.matchesScored += 1;
    } else {
      userMap.set(pred.userId, {
        userId: pred.userId,
        userName: pred.userName,
        userPhoto: pred.userPhoto,
        totalPoints: pts,
        matchesScored: 1,
      });
    }
  }

  const rows = Array.from(userMap.values()).sort(
    (a, b) => a.totalPoints - b.totalPoints
  );

  if (rows.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-4xl mb-4">📋</p>
        <p className="text-slate-300 font-semibold mb-2">No predictions yet</p>
        <p className="text-sm text-slate-500">
          Be the first to predict a finished match.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-500 text-center mb-4">
        Lower is better · {finishedMatchIds.length} match{finishedMatchIds.length !== 1 ? 'es' : ''} scored
      </p>
      {rows.map((row, i) => {
        const isMe = row.userId === user?.uid;
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : null;

        return (
          <div
            key={row.userId}
            className={`flex items-center gap-3 rounded-2xl px-4 py-3 ${
              isMe
                ? 'bg-emerald-900/40 border border-emerald-700/40'
                : 'bg-slate-800 border border-slate-700'
            }`}
          >
            <span className="w-6 text-center text-sm font-bold text-slate-400">
              {medal ?? i + 1}
            </span>
            <img
              src={
                row.userPhoto ||
                `https://ui-avatars.com/api/?name=${encodeURIComponent(row.userName)}&background=334155&color=fff`
              }
              alt={row.userName}
              className="w-8 h-8 rounded-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(row.userName)}&background=334155&color=fff`;
              }}
            />
            <span className="flex-1 text-sm font-semibold text-white truncate">
              {row.userName}
              {isMe && <span className="ml-2 text-xs text-emerald-400">(you)</span>}
            </span>
            <div className="text-right">
              <span className="text-lg font-black text-white tabular-nums">
                {row.totalPoints}
              </span>
              <span className="text-xs text-slate-400 ml-1">pts</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
