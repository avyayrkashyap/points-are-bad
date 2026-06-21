import { useCallback, useEffect, useRef, useState } from 'react';
import { subscribeLeaderboard } from '../lib/leaderboard';
import type { LeaderboardEntry } from '../lib/leaderboard';
import { useAuth } from '../lib/useAuth';
import { PlayerProfile } from './PlayerProfile';
import { LeaderboardFilterSheet } from './LeaderboardFilterSheet';
import {
  excludeAllAvailableUsers,
  filterLeaderboardEntries,
  includeAllAvailableUsers,
  readExcludedUserIds,
  toggleExcludedUser,
  writeExcludedUserIds,
} from '../lib/leaderboard-filter';
import { subscribeLeaderboardFilter, writeLeaderboardFilter } from '../lib/leaderboard-filter-sync';

export function Leaderboard() {
  const { user } = useAuth();
  const [rows, setRows] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<{ entry: LeaderboardEntry; rank: number } | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const filterButtonRef = useRef<HTMLButtonElement>(null);
  const viewerId = user?.uid ?? '';
  const [excludedUserIds, setExcludedUserIds] = useState<Set<string>>(() =>
    viewerId ? readExcludedUserIds(window.localStorage, viewerId) : new Set(),
  );

  useEffect(() => {
    return subscribeLeaderboard((entries) => {
      setRows(entries);
      setLoading(false);
    });
  }, []);

  // Sync filter from Firestore; localStorage seeds the initial render to avoid flicker
  useEffect(() => {
    if (!viewerId) return;
    return subscribeLeaderboardFilter(viewerId, (ids) => {
      setExcludedUserIds(ids);
    });
  }, [viewerId]);

  const visibleRows = filterLeaderboardEntries(rows, excludedUserIds);
  const closeFilter = useCallback(() => setFilterOpen(false), []);

  function updateExcludedUserIds(next: Set<string>) {
    setExcludedUserIds(next);
    if (viewerId) {
      writeExcludedUserIds(window.localStorage, viewerId, next);
      writeLeaderboardFilter(viewerId, next);
    }
  }

  function selectAll() {
    updateExcludedUserIds(includeAllAvailableUsers(excludedUserIds, rows));
  }

  function clearAll() {
    updateExcludedUserIds(excludeAllAvailableUsers(excludedUserIds, rows));
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-8 h-8 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (rows.length === 0) {
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

  return (
    <>
    <div className="px-1 pt-4 flex items-center justify-between gap-4">
      <h2 className="font-['Lexend'] text-xl font-black text-gray-900">
        Leaderboard
      </h2>
      <button
        ref={filterButtonRef}
        onClick={() => setFilterOpen(true)}
        aria-label={`Filter leaderboard, ${visibleRows.length} of ${rows.length} players selected`}
        className="flex items-center gap-2 px-3 py-2 rounded-full bg-gray-100 hover:bg-gray-200 text-sm font-bold text-gray-700"
      >
        <svg aria-hidden="true" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 6h16M7 12h10M10 18h4" strokeLinecap="round" />
        </svg>
        {visibleRows.length} of {rows.length}
      </button>
    </div>

    {visibleRows.length === 0 ? (
      <div className="text-center py-20 px-6">
        <p className="text-4xl mb-4">👥</p>
        <p className="font-bold text-lg mb-1 text-gray-900">No players selected</p>
        <p className="text-sm text-gray-500 mb-5">
          Select players to build your custom leaderboard.
        </p>
        <button
          onClick={selectAll}
          className="px-5 py-2.5 rounded-xl bg-yellow-300 hover:bg-yellow-400 font-black text-gray-900"
        >
          Select all players
        </button>
      </div>
    ) : (
    <div className="px-1 pt-4 pb-2 flex flex-col gap-0.5">
      {visibleRows.map((row, i) => {
        const isMe = row.userId === user?.uid;
        const ptsPerGame = row.matchesScored > 0
          ? (row.totalPoints / row.matchesScored).toFixed(1)
          : '–';

        return (
          <div
            key={row.userId}
            className={`flex items-center rounded-full px-3 cursor-pointer active:opacity-70 transition-opacity ${isMe ? 'bg-yellow-300' : 'hover:bg-gray-50'}`}
            style={{ minHeight: '44px' }}
            onClick={() => setSelected({ entry: row, rank: i + 1 })}
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
              {row.displayName}
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
            <div className="w-[60px] flex-shrink-0 flex items-center justify-end gap-1 pl-2">
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

    </div>
    )}

    {selected && (
      <PlayerProfile
        player={selected.entry}
        rank={selected.rank}
        onClose={() => setSelected(null)}
      />
    )}

    {filterOpen && (
      <LeaderboardFilterSheet
        entries={rows}
        excludedUserIds={excludedUserIds}
        returnFocusRef={filterButtonRef}
        onToggle={(userId) => updateExcludedUserIds(toggleExcludedUser(excludedUserIds, userId))}
        onSelectAll={selectAll}
        onClearAll={clearAll}
        onClose={closeFilter}
      />
    )}
    </>
  );
}
