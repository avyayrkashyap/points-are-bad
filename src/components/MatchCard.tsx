import { useEffect, useRef, useState } from 'react';
import type { Match } from '../lib/matches';
import type { Prediction } from '../lib/predictions';
import { calcPoints } from '../lib/scoring';
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

function abbr(name: string) {
  return name.slice(0, 3).toUpperCase();
}

// Flag width scales with viewport; height is auto so each flag's natural
// aspect ratio is preserved. At ≥470 px the width caps at 80 px.
const FLAG_W = 'min(80px, 17vw)';
const SCORE_FONT = 'min(52px, 11.5vw)';
const SCORE_W = 'min(60px, 13vw)';
const OUTER_GAP = 'min(8px, 2vw)';
const INNER_GAP = 'min(8px, 2vw)';

function TeamFlag({ name, align = 'left' }: { name: string; align?: 'left' | 'right' }) {
  const url = flagUrl(name);
  return (
    <div className="flex flex-col" style={{ gap: 6, alignItems: align === 'right' ? 'flex-end' : 'flex-start', flexShrink: 0, width: FLAG_W }}>
      {url ? (
        <img
          src={url}
          alt={name}
          style={{ width: '100%', height: 'auto', objectFit: 'cover', borderRadius: 4, display: 'block' }}
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
      ) : (
        <div style={{ width: '100%', aspectRatio: '3/2', background: '#F5F5F5', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>
          🏳️
        </div>
      )}
      <span style={{
        fontFamily: 'Manrope, sans-serif',
        fontWeight: 700,
        fontSize: 11,
        color: '#000000',
        lineHeight: '15px',
        textAlign: align === 'right' ? 'right' : 'left',
        display: 'block',
        wordBreak: 'break-word',
      }}>
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

  const cardRef = useRef<HTMLButtonElement>(null);
  const [dartActive, setDartActive] = useState(false);

  useEffect(() => {
    if (pts !== 0 || !cardRef.current) return;
    const el = cardRef.current;
    const io = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setDartActive(true); io.disconnect(); } },
      { threshold: 0.5 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [pts]);

  return (
    <button
      ref={cardRef}
      onClick={clickable ? onClick : undefined}
      className={`w-full text-left rounded-2xl border-2 bg-white p-4 transition-all overflow-hidden
        ${clickable ? 'border-yellow-300 hover:border-yellow-400 cursor-pointer hover:shadow-md' : 'border-gray-100 cursor-default opacity-60'}
      `}
    >
      {/* Status row */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-gray-400 font-medium">Group {match.group}</span>
        <span className={`flex items-center gap-1.5 text-xs font-semibold ${textColor}`}>
          <span className={`w-2 h-2 rounded-full ${dot}`} />
          {label}
        </span>
      </div>

      {/* Teams + scores — layout: [flag+name | score] [–] [score | flag+name] */}
      <div style={{ display: 'flex', alignItems: 'center', gap: OUTER_GAP, justifyContent: 'center', alignSelf: 'stretch' }}>
        {/* Left group: flag+name column then score */}
        <div style={{ display: 'flex', alignItems: 'center', gap: INNER_GAP, flex: 1 }}>
          <TeamFlag name={match.team1} align="left" />
          <span style={{
            fontFamily: 'Lexend, sans-serif',
            fontWeight: 900,
            fontSize: SCORE_FONT,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: SCORE_W,
            color: state === 'finished' ? '#000000' : '#E5E7EB',
            flexShrink: 0,
          }}>
            {state === 'finished' ? match.actualScore1 : '—'}
          </span>
        </div>

        {/* Hyphen separator */}
        <span style={{
          fontFamily: 'Lexend, sans-serif',
          fontWeight: 900,
          fontSize: SCORE_FONT,
          color: '#F6F6F6',
          flexShrink: 0,
          position: 'relative',
        }}>
          -
          {/* Dart tip lands at the hyphen centre. rotate(108deg) on the original
              image (no flip) puts the tip at the lower-left, matching the
              ~35° below-horizontal landing angle of the parabolic arc. */}
          {pts === 0 && dartActive && (
            <div
              className="dart-fly-in"
              style={{ position: 'absolute', left: 6, top: -4, pointerEvents: 'none' }}
            >
              <img src="/dart.png" aria-hidden style={{ transform: 'rotate(108deg)', width: 48, height: 37, display: 'block' }} />
            </div>
          )}
        </span>

        {/* Right group: score then flag+name column */}
        <div style={{ display: 'flex', alignItems: 'center', gap: INNER_GAP, flex: 1, justifyContent: 'flex-end' }}>
          <span style={{
            fontFamily: 'Lexend, sans-serif',
            fontWeight: 900,
            fontSize: SCORE_FONT,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: SCORE_W,
            color: state === 'finished' ? '#000000' : '#E5E7EB',
            flexShrink: 0,
          }}>
            {state === 'finished' ? match.actualScore2 : '—'}
          </span>
          <TeamFlag name={match.team2} align="right" />
        </div>
      </div>

      {/* "Tap to predict" prompt for open state */}
      {state === 'open' && (
        <div className="mt-1 flex justify-center">
          <span className="text-sm font-bold text-yellow-500 px-3 py-1 bg-yellow-50 rounded-lg">
            Tap to predict
          </span>
        </div>
      )}

      {/* My prediction (shown below scores for submitted + finished) */}
      {myPrediction && (
        <div className="mt-3 flex items-center justify-center" style={{ gap: '4px' }}>
          {/* Pill: label + score inline */}
          <div
            className="flex items-center"
            style={{ backgroundColor: '#F6F6F6', borderRadius: '999px', paddingInline: '16px', paddingBlock: '4px', gap: '8px' }}
          >
            <span style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 400, fontSize: '10px', color: '#C0C0C0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              My Prediction
            </span>
            <span style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: '12px', color: '#BE9F32' }}>
              {abbr(match.team1)} {myPrediction.score1} - {myPrediction.score2} {abbr(match.team2)}
            </span>
          </div>
          {/* Points badge pill */}
          {pts !== null && (
            <div
              className="flex items-center justify-center"
              style={{ backgroundColor: '#F6F6F6', borderRadius: '999px', padding: '4px 8px' }}
            >
              <span style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: '12px', color: '#999999' }}>
                {pts === 0 ? '🎯' : `+${pts}`}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Kickoff time (only when no prediction shown) */}
      {!myPrediction && (
        <div className="mt-3 text-xs text-gray-400 text-center">
          {match.date.toLocaleString(undefined, {
            weekday: 'short', month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit',
          })}
        </div>
      )}
    </button>
  );
}
