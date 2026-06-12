import type { Match } from '../lib/matches';
import type { Prediction } from '../lib/predictions';
import { calcPoints, pointsLabel } from '../lib/scoring';

interface Props {
  match: Match;
  myPrediction: Prediction | undefined;
  onClick: () => void;
}

type CardState = 'open' | 'submitted' | 'closed' | 'soon' | 'finished';

function getState(match: Match, pred: Prediction | undefined): CardState {
  const now = new Date();
  const kickoff = match.date;
  const msUntil = kickoff.getTime() - now.getTime();
  const threeDays = 3 * 24 * 60 * 60 * 1000;

  if (match.actualScore1 != null) return 'finished';
  if (pred) return 'submitted';
  if (now >= kickoff) return 'closed';
  if (msUntil <= threeDays) return 'open';
  return 'soon';
}

const stateLabel: Record<CardState, string> = {
  open: 'Predict',
  submitted: 'Submitted',
  closed: 'Missed',
  soon: 'Coming soon',
  finished: 'Final',
};

const stateDot: Record<CardState, string> = {
  open: 'bg-emerald-400',
  submitted: 'bg-blue-400',
  closed: 'bg-red-400',
  soon: 'bg-slate-400',
  finished: 'bg-slate-400',
};

const stateColor: Record<CardState, string> = {
  open: 'text-emerald-400',
  submitted: 'text-blue-400',
  closed: 'text-slate-400',
  soon: 'text-slate-400',
  finished: 'text-slate-400',
};

function formatKickoff(date: Date) {
  return date.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function MatchCard({ match, myPrediction, onClick }: Props) {
  const state = getState(match, myPrediction);
  const clickable = state === 'open' || state === 'submitted' || state === 'finished';
  const pts = myPrediction ? calcPoints(myPrediction, match) : null;

  return (
    <button
      onClick={clickable ? onClick : undefined}
      className={`w-full text-left rounded-2xl border p-4 transition-all
        ${clickable
          ? 'border-slate-700 bg-slate-800 hover:border-slate-500 cursor-pointer'
          : 'border-slate-800 bg-slate-900 cursor-default opacity-60'
        }`}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold tracking-widest text-slate-400 uppercase">
          Group {match.group}
        </span>
        <div className="flex items-center gap-2">
          {pts !== null && (
            <span className={`text-xs font-bold ${pts === 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
              {pointsLabel(pts)}
            </span>
          )}
          <span className="flex items-center gap-1.5 text-xs font-medium">
            <span className={`w-2 h-2 rounded-full ${stateDot[state]}`} />
            <span className={stateColor[state]}>{stateLabel[state]}</span>
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <span className="text-lg font-bold text-white flex-1 text-left leading-tight">
          {match.team1}
        </span>

        {state === 'finished' ? (
          <div className="flex flex-col items-center px-2 gap-0.5">
            <span className="text-2xl font-black text-white tabular-nums">
              {match.actualScore1} – {match.actualScore2}
            </span>
            {myPrediction && (
              <span className="text-xs text-slate-500 tabular-nums">
                You: {myPrediction.score1} – {myPrediction.score2}
              </span>
            )}
          </div>
        ) : state === 'submitted' && myPrediction ? (
          <span className="text-2xl font-black text-white tabular-nums px-2">
            {myPrediction.score1} – {myPrediction.score2}
          </span>
        ) : (
          <span className="text-sm font-semibold text-slate-500 px-2">vs</span>
        )}

        <span className="text-lg font-bold text-white flex-1 text-right leading-tight">
          {match.team2}
        </span>
      </div>

      <div className="mt-3 text-xs text-slate-500">
        {formatKickoff(match.date)} · {match.venue}
      </div>
    </button>
  );
}
