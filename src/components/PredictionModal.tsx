import { useEffect, useRef, useState } from 'react';
import type { Match } from '../lib/matches';
import type { Prediction } from '../lib/predictions';
import { submitPrediction, subscribeMatchPredictions } from '../lib/predictions';
import { calcPoints, pointsLabel } from '../lib/scoring';
import { useAuth } from '../lib/useAuth';
import { flagUrl } from '../lib/flags';
import { useSwipeToDismiss } from '../lib/useSwipeToDismiss';
import { BottomSheetHandle } from './BottomSheetHandle';

interface Props {
  match: Match;
  myPrediction: Prediction | undefined;
  onClose: () => void;
}

function Avatar({ photo, name }: { photo: string; name: string }) {
  return (
    <img
      src={photo || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=f5c842&color=111`}
      alt={name}
      className="w-7 h-7 rounded-full object-cover flex-shrink-0"
      onError={(e) => {
        (e.target as HTMLImageElement).src =
          `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=f5c842&color=111`;
      }}
    />
  );
}

function FlagImg({ name }: { name: string }) {
  const url = flagUrl(name);
  return url ? (
    <img src={url} alt={name} className="w-10 h-7 object-cover rounded-sm shadow-sm" />
  ) : (
    <div className="w-10 h-7 bg-gray-100 rounded-sm flex items-center justify-center text-base">🏳️</div>
  );
}

export function PredictionModal({ match, myPrediction, onClose }: Props) {
  const { user } = useAuth();
  const [score1, setScore1] = useState('');
  const [score2, setScore2] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [allPredictions, setAllPredictions] = useState<Prediction[]>([]);
  const overlayRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const swipeHandlers = useSwipeToDismiss(sheetRef, onClose);

  // Once user has submitted, subscribe to all predictions for this match
  useEffect(() => {
    if (!myPrediction) return;
    return subscribeMatchPredictions(match.id, setAllPredictions);
  }, [match.id, myPrediction]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const s1 = parseInt(score1, 10);
    const s2 = parseInt(score2, 10);
    if (isNaN(s1) || isNaN(s2) || s1 < 0 || s2 < 0 || s1 > 20 || s2 > 20) {
      setError('Enter valid scores (0–20)');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await submitPrediction(
        user.uid,
        match.id,
        s1,
        s2,
        user.displayName ?? 'Anonymous',
        user.photoURL ?? ''
      );
    } catch {
      setError('Failed to submit. Try again.');
      setSubmitting(false);
    }
  };

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm"
      onClick={(e) => e.target === overlayRef.current && onClose()}
    >
      <div ref={sheetRef} className="bottom-sheet-enter w-full max-w-lg bg-white dark:bg-gray-900 rounded-t-3xl px-6 pt-5 pb-10 shadow-2xl">
        <BottomSheetHandle {...swipeHandlers} />
        {/* Header */}
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-semibold tracking-widest text-gray-400 uppercase">
            Group {match.group}
          </span>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 transition-colors text-2xl leading-none">
            ×
          </button>
        </div>

        {/* Teams */}
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <FlagImg name={match.team1} />
            <span className="text-base font-bold text-gray-900 dark:text-gray-100">{match.team1}</span>
          </div>
          <span className="text-sm font-semibold text-gray-300 dark:text-gray-600">vs</span>
          <div className="flex items-center gap-2">
            <span className="text-base font-bold text-gray-900 dark:text-gray-100">{match.team2}</span>
            <FlagImg name={match.team2} />
          </div>
        </div>

        <p className="text-xs text-gray-400 mb-5">
          {match.date.toLocaleString(undefined, {
            weekday: 'short', month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit',
          })} · {match.venue}
        </p>

        {!myPrediction ? (
          /* Prediction form */
          <form onSubmit={handleSubmit}>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 text-center font-medium">What's your prediction?</p>
            <div className="flex items-center justify-center gap-4 mb-6">
              <div className="flex flex-col items-center gap-1">
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">{match.team1}</span>
                <input
                  type="number"
                  min={0}
                  max={20}
                  value={score1}
                  onChange={(e) => setScore1(e.target.value)}
                  className="w-20 h-16 text-3xl font-black text-center text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-xl focus:border-yellow-400 focus:outline-none"
                  placeholder="0"
                  required
                />
              </div>
              <span className="text-2xl font-black text-gray-300 dark:text-gray-600 mt-5">–</span>
              <div className="flex flex-col items-center gap-1">
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">{match.team2}</span>
                <input
                  type="number"
                  min={0}
                  max={20}
                  value={score2}
                  onChange={(e) => setScore2(e.target.value)}
                  className="w-20 h-16 text-3xl font-black text-center text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-xl focus:border-yellow-400 focus:outline-none"
                  placeholder="0"
                  required
                />
              </div>
            </div>
            {error && <p className="text-red-500 text-sm text-center mb-3">{error}</p>}
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 rounded-xl bg-yellow-300 hover:bg-yellow-400 disabled:opacity-50 font-black text-gray-900 transition-colors"
            >
              {submitting ? 'Submitting…' : 'Lock it in'}
            </button>
            <p className="text-xs text-gray-400 text-center mt-3">
              You can't change this once submitted.
            </p>
          </form>
        ) : (
          /* Reveal */
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-3 text-center font-medium">Everyone's predictions</p>
            {allPredictions.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-4">Loading…</p>
            ) : (
              <ul className="space-y-2 max-h-72 overflow-y-auto">
                {allPredictions
                  .sort((a, b) => (a.userId === user?.uid ? -1 : b.userId === user?.uid ? 1 : 0))
                  .map((p) => (
                    <li
                      key={p.id}
                      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${
                        p.userId === user?.uid
                          ? 'bg-yellow-50 border-2 border-yellow-300'
                          : 'bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700'
                      }`}
                    >
                      <Avatar photo={p.userPhoto} name={p.userName} />
                      <span className="text-sm text-gray-800 dark:text-gray-200 flex-1 truncate font-medium">
                        {p.userName}
                        {p.userId === user?.uid && (
                          <span className="ml-2 text-xs text-yellow-600 font-bold">(you)</span>
                        )}
                      </span>
                      <div className="flex flex-col items-end gap-0.5">
                        <span className="text-lg font-black text-gray-900 dark:text-gray-100 tabular-nums">
                          {p.score1} – {p.score2}
                        </span>
                        {(() => {
                          const pts = calcPoints(p, match);
                          return pts !== null ? (
                            <span className={`text-xs font-bold ${pts === 0 ? 'text-emerald-600' : 'text-amber-500'}`}>
                              {pointsLabel(pts)}
                            </span>
                          ) : null;
                        })()}
                      </div>
                    </li>
                  ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
