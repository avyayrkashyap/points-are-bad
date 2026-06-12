import { useEffect, useRef, useState } from 'react';
import type { Match } from '../lib/matches';
import type { Prediction } from '../lib/predictions';
import { submitPrediction, subscribeMatchPredictions } from '../lib/predictions';
import { calcPoints, pointsLabel } from '../lib/scoring';
import { useAuth } from '../lib/useAuth';

interface Props {
  match: Match;
  myPrediction: Prediction | undefined;
  onClose: () => void;
}

function Avatar({ photo, name }: { photo: string; name: string }) {
  return (
    <img
      src={photo || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=334155&color=fff`}
      alt={name}
      className="w-7 h-7 rounded-full object-cover flex-shrink-0"
      onError={(e) => {
        (e.target as HTMLImageElement).src =
          `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=334155&color=fff`;
      }}
    />
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
    } catch (err) {
      setError('Failed to submit. Try again.');
      setSubmitting(false);
    }
  };

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={(e) => e.target === overlayRef.current && onClose()}
    >
      <div className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-3xl p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-semibold tracking-widest text-slate-400 uppercase">
            Group {match.group}
          </span>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors text-lg leading-none">
            ×
          </button>
        </div>
        <h2 className="text-xl font-black text-white mb-1">
          {match.team1} vs {match.team2}
        </h2>
        <p className="text-xs text-slate-500 mb-6">
          {match.date.toLocaleString(undefined, {
            weekday: 'short', month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit',
          })} · {match.venue}
        </p>

        {!myPrediction ? (
          /* Prediction form */
          <form onSubmit={handleSubmit}>
            <p className="text-sm text-slate-400 mb-4 text-center">What's your prediction?</p>
            <div className="flex items-center justify-center gap-4 mb-6">
              <div className="flex flex-col items-center gap-1">
                <span className="text-sm font-semibold text-white">{match.team1}</span>
                <input
                  type="number"
                  min={0}
                  max={20}
                  value={score1}
                  onChange={(e) => setScore1(e.target.value)}
                  className="w-20 h-16 text-3xl font-black text-center text-white bg-slate-800 border-2 border-slate-600 rounded-xl focus:border-emerald-500 focus:outline-none"
                  placeholder="0"
                  required
                />
              </div>
              <span className="text-2xl font-black text-slate-500 mt-5">–</span>
              <div className="flex flex-col items-center gap-1">
                <span className="text-sm font-semibold text-white">{match.team2}</span>
                <input
                  type="number"
                  min={0}
                  max={20}
                  value={score2}
                  onChange={(e) => setScore2(e.target.value)}
                  className="w-20 h-16 text-3xl font-black text-center text-white bg-slate-800 border-2 border-slate-600 rounded-xl focus:border-emerald-500 focus:outline-none"
                  placeholder="0"
                  required
                />
              </div>
            </div>
            {error && <p className="text-red-400 text-sm text-center mb-3">{error}</p>}
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 font-bold text-white transition-colors"
            >
              {submitting ? 'Submitting…' : 'Submit prediction'}
            </button>
            <p className="text-xs text-slate-500 text-center mt-3">
              You can't change this once submitted.
            </p>
          </form>
        ) : (
          /* Reveal */
          <div>
            <p className="text-sm text-slate-400 mb-4 text-center">Everyone's predictions</p>
            {allPredictions.length === 0 ? (
              <p className="text-slate-500 text-sm text-center py-4">Loading…</p>
            ) : (
              <ul className="space-y-2 max-h-72 overflow-y-auto">
                {allPredictions
                  .sort((a, b) => (a.userId === user?.uid ? -1 : b.userId === user?.uid ? 1 : 0))
                  .map((p) => (
                    <li
                      key={p.id}
                      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${
                        p.userId === user?.uid
                          ? 'bg-emerald-900/40 border border-emerald-700/40'
                          : 'bg-slate-800'
                      }`}
                    >
                      <Avatar photo={p.userPhoto} name={p.userName} />
                      <span className="text-sm text-white flex-1 truncate">
                        {p.userName}
                        {p.userId === user?.uid && (
                          <span className="ml-2 text-xs text-emerald-400">(you)</span>
                        )}
                      </span>
                      <div className="flex flex-col items-end gap-0.5">
                        <span className="text-lg font-black text-white tabular-nums">
                          {p.score1} – {p.score2}
                        </span>
                        {(() => {
                          const pts = calcPoints(p, match);
                          return pts !== null ? (
                            <span className={`text-xs font-bold ${pts === 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
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
