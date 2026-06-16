import { useEffect, useRef } from 'react';
import type { Match } from '../lib/matches';
import type { Prediction } from '../lib/predictions';

interface DayGroup {
  dateKey: string;       // YYYY-MM-DD
  label: string;         // "Mon 16"
  dayLetter: string;     // "M"
  dayNum: string;        // "16"
  isToday: boolean;
  matches: Match[];
}

type DotStatus = 'green' | 'red' | 'gray';

function getDotStatus(matches: Match[], predMap: Map<string, Prediction>): DotStatus {
  const now = new Date();
  const threeDays = 3 * 24 * 60 * 60 * 1000;

  let hasOpen = false;
  let allActionable = true;

  for (const m of matches) {
    if (m.actualScore1 != null) continue;   // finished
    if (predMap.has(m.id)) continue;         // predicted
    if (now >= m.date) continue;             // missed — past kickoff, nothing to do

    // This match needs a prediction
    allActionable = false;
    const msUntil = m.date.getTime() - now.getTime();
    if (msUntil <= threeDays) hasOpen = true;
  }

  if (allActionable) return 'green';
  if (hasOpen) return 'red';
  return 'gray';
}

interface Props {
  groups: DayGroup[];
  predMap: Map<string, Prediction>;
  onSelectDay: (dateKey: string) => void;
}

export type { DayGroup };

export function CalendarBar({ groups, predMap, onSelectDay }: Props) {
  const todayRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    todayRef.current?.scrollIntoView({ behavior: 'instant', inline: 'center', block: 'nearest' });
  }, [groups.length]);

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-100">
      <div className="max-w-lg mx-auto overflow-x-auto scrollbar-hide">
        <div className="flex gap-1 px-3 py-3" style={{ width: 'max-content' }}>
          {groups.map((g) => {
            const dot = getDotStatus(g.matches, predMap);
            const dotColor =
              dot === 'green' ? '#22C55E' :
              dot === 'red'   ? '#EF4444' :
                                '#D1D5DB';

            return (
              <button
                key={g.dateKey}
                ref={g.isToday ? todayRef : undefined}
                onClick={() => onSelectDay(g.dateKey)}
                className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-colors flex-shrink-0 ${
                  g.isToday ? 'bg-yellow-300' : 'hover:bg-gray-50'
                }`}
              >
                <span
                  className="text-[10px] font-semibold uppercase tracking-wide leading-none"
                  style={{ color: g.isToday ? '#7A6200' : '#AAAAAA' }}
                >
                  {g.dayLetter}
                </span>
                <span
                  className="text-sm font-black leading-tight"
                  style={{ color: g.isToday ? '#0A0A0A' : '#333333' }}
                >
                  {g.dayNum}
                </span>
                <div
                  className="w-1.5 h-1.5 rounded-full mt-0.5"
                  style={{ backgroundColor: dotColor }}
                />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export function buildDayGroups(matches: Match[]): DayGroup[] {
  const map = new Map<string, Match[]>();
  for (const m of matches) {
    const d = m.date;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(m);
  }

  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  return Array.from(map.entries()).map(([dateKey, dayMatches]) => {
    const d = dayMatches[0].date;
    return {
      dateKey,
      label: d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' }),
      dayLetter: DAY_LETTERS[d.getDay()],
      dayNum: String(d.getDate()),
      isToday: dateKey === todayKey,
      matches: dayMatches,
    };
  });
}
