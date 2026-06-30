import { useEffect, useRef } from 'react';
import type { Prediction } from '../lib/predictions';
import { getDotStatus } from '../lib/calendar';
import type { DayGroup } from '../lib/calendar';

interface Props {
  groups: DayGroup[];
  predMap: Map<string, Prediction>;
  onSelectDay: (dateKey: string) => void;
}

export function CalendarBar({ groups, predMap, onSelectDay }: Props) {
  const todayRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    todayRef.current?.scrollIntoView({ behavior: 'instant', inline: 'center', block: 'nearest' });
  }, [groups.length]);

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800">
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
                  g.isToday ? 'bg-yellow-300' : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                <span
                  className="text-[10px] font-semibold uppercase tracking-wide leading-none"
                  style={{ color: g.isToday ? '#7A6200' : '#AAAAAA' }}
                >
                  {g.dayLetter}
                </span>
                <span
                  className="text-sm font-black leading-tight dark:text-gray-100"
                  style={{ color: g.isToday ? '#0A0A0A' : undefined }}
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
