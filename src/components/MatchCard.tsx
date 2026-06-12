import type { Match } from '../lib/matches';
import type { Prediction } from '../lib/predictions';
import { calcPoints, pointsLabel } from '../lib/scoring';
import { flagUrl } from '../lib/flags';

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

const statusConfig: Record<CardState, { dot: string; label: string; textColor: string }> = {
  open:      { dot: 'bg-emerald-500', label: 'Predict',     textColor: 'text-emerald-600' },
  submitted: { dot: 'bg-emerald-500', label: 'Submitted',   textColor: 'text-gray-500' },
  closed:    { dot: 'bg-red-400',     label: 'Missed',      textColor: 'text-red-500' },
  soon:      { dot: 'bg-gray-300',    label: 'Coming soon', textColor: 'text-gray-400' },
  finished:  { dot: 'bg-gray-400',    label: 'Final',       textColor: 'text-gray-400' },
};

function TeamFlag({ name }: { name: string }) {
  const url = flagUrl(name);
  return (
    <div className="flex flex-col items-center gap-2 w-24">
      {url ? (
        <img
          src={url}
          alt={name}
          className="w-16 h-10 object-cover rounded-sm shadow-sm"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
      ) : (
        <div className="w-16 h-10 bg-gray-100 rounded-sm flex items-center justify-center text-xl">
          🏳️
        </div>
      )}
      <span className="text-xs font-semibold text-gray-800 text-center leading-tight">
        {name}
      </span>
    </div>
  );
}

export function MatchCard({ match, myPrediction, onClick }: Props) {
  const state = getState(match, myPrediction);
  const { dot, label, textColor } = statusConfig[state];
  const clickable = state === 'open' || state === 'submitted' || state === 'finished';
  const pts = myPrediction ? calcPoints(myPrediction, match) : null;

  return (
    <button
      onClick={clickable ? onClick : undefined}
      className={`w-full text-left rounded-2xl border-2 bg-white p-4 transition-all
        ${clickable ? 'border-yellow-300 hover:border-yellow-400 cursor-pointer hover:shadow-md' : 'border-gray-100 cursor-default opacity-60'}
      `}
    >
      {/* Status row */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-gray-400 font-medium">Group {match.group}</span>
        <div className="flex items-center gap-3">
          {pts !== null && (
            <span className={`text-xs font-bold ${pts === 0 ? 'text-emerald-500' : 'text-amber-500'}`}>
              {pointsLabel(pts)}
            </span>
          )}
          <span className={`flex items-center gap-1.5 text-xs font-semibold ${textColor}`}>
            <span className={`w-2 h-2 rounded-full ${dot}`} />
            {label}
          </span>
        </div>
      </div>

      {/* Teams + scores */}
      <div className="flex items-center justify-between">
        <TeamFlag name={match.team1} />

        <div className="flex items-center gap-3 flex-1 justify-center">
          {state === 'finished' ? (
            <>
              <span className="text-5xl font-black text-gray-900 tabular-nums">{match.actualScore1}</span>
              <span className="text-4xl font-black text-gray-300 mx-1">-</span>
              <span className="text-5xl font-black text-gray-900 tabular-nums">{match.actualScore2}</span>
            </>
          ) : state === 'submitted' && myPrediction ? (
            <>
              <span className="text-5xl font-black text-gray-900 tabular-nums">{myPrediction.score1}</span>
              <span className="text-4xl font-black text-gray-300 mx-1">-</span>
              <span className="text-5xl font-black text-gray-900 tabular-nums">{myPrediction.score2}</span>
            </>
          ) : state === 'open' ? (
            <span className="text-sm font-bold text-yellow-500 px-3 py-1.5 bg-yellow-50 rounded-lg">
              Tap to predict
            </span>
          ) : (
            <span className="text-sm font-semibold text-gray-300">vs</span>
          )}
        </div>

        <TeamFlag name={match.team2} />
      </div>

      {/* Kickoff time */}
      <div className="mt-3 text-xs text-gray-400 text-center">
        {match.date.toLocaleString(undefined, {
          weekday: 'short', month: 'short', day: 'numeric',
          hour: '2-digit', minute: '2-digit',
        })}
        {state === 'finished' && myPrediction && (
          <span className="ml-2 text-gray-400">
            · You: {myPrediction.score1}–{myPrediction.score2}
          </span>
        )}
      </div>
    </button>
  );
}
