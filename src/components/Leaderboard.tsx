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
      <div className="text-center py-20">
        <p className="text-4xl mb-4">⏳</p>
        <p className="font-bold text-lg mb-1 text-gray-900">No results yet</p>
        <p className="text-sm text-gray-500">
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
      <div className="text-center py-20">
        <p className="text-4xl mb-4">📋</p>
        <p className="font-bold text-lg mb-1 text-gray-900">No predictions yet</p>
        <p className="text-sm text-gray-500">
          Be the first to predict a finished match.
        </p>
      </div>
    );
  }

  return (
    <div className="px-1 pt-4 pb-2 flex flex-col gap-0.5">
      {rows.map((row, i) => {
        const isMe = row.userId === user?.uid;
        const ptsPerGame = row.matchesScored > 0
          ? (row.totalPoints / row.matchesScored).toFixed(1)
          : '–';

        return (
          <div
            key={row.userId}
            className={`flex items-center rounded-full px-3 ${isMe ? 'bg-yellow-300' : ''}`}
            style={{ minHeight: '44px' }}
          >
            {/* Rank */}
            <div className="w-8 flex-shrink-0 flex items-center justify-center">
              <span
                className="font-['Lexend'] font-black text-sm tracking-tight"
                style={{ color: isMe ? '#0A0A0A' : '#CCCCCC' }}
              >
                {i + 1}
              </span>
            </div>

            {/* Name */}
            <span
              className="flex-1 font-['Lexend'] font-bold text-[15px] leading-5 truncate"
              style={{ color: '#0A0A0A' }}
            >
              {row.userName}
            </span>

            {/* Pts/game badge */}
            <div
              className="w-[72px] flex-shrink-0 flex items-center justify-center rounded px-1 py-0.5"
              style={{ backgroundColor: isMe ? '#D7AF3A' : '#F6F6F6' }}
            >
              <span
                className="font-['Lexend'] font-medium text-xs tracking-tight"
                style={{ color: isMe ? '#0A0A0A' : '#888888' }}
              >
                {ptsPerGame}/game
              </span>
            </div>

            {/* Total pts */}
            <div
              className="w-[60px] flex-shrink-0 flex items-center justify-end gap-1 pl-2"
            >
              <span
                className="font-['Lexend'] font-normal text-base tracking-tight leading-8"
                style={{ color: '#0A0A0A' }}
              >
                {row.totalPoints}
              </span>
              <span
                className="font-['Lexend'] font-normal text-xs tracking-tight leading-8"
                style={{ color: isMe ? '#7A6201' : '#CCCCCC' }}
              >
                pts
              </span>
            </div>
          </div>
        );
      })}

      <p className="text-center text-xs text-gray-400 mt-4 font-medium">
        {finishedMatchIds.length} match{finishedMatchIds.length !== 1 ? 'es' : ''} scored · lower is better
      </p>
    </div>
  );
}
