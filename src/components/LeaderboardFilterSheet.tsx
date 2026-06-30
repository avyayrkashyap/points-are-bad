import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import type { LeaderboardEntry } from '../lib/leaderboard';
import { useSwipeToDismiss } from '../lib/useSwipeToDismiss';
import { BottomSheetHandle } from './BottomSheetHandle';

interface Props {
  entries: LeaderboardEntry[];
  excludedUserIds: ReadonlySet<string>;
  returnFocusRef: RefObject<HTMLButtonElement | null>;
  onToggle: (userId: string) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
  onClose: () => void;
}

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';

export function LeaderboardFilterSheet({
  entries,
  excludedUserIds,
  returnFocusRef,
  onToggle,
  onSelectAll,
  onClearAll,
  onClose,
}: Props) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const swipeHandlers = useSwipeToDismiss(dialogRef, onClose);
  const selectedCount = entries.length - entries.filter((entry) => excludedUserIds.has(entry.userId)).length;

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const returnFocusElement = returnFocusRef.current;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;

      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      returnFocusElement?.focus();
    };
  }, [onClose, returnFocusRef]);

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm"
      onClick={(event) => event.target === overlayRef.current && onClose()}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="leaderboard-filter-title"
        className="bottom-sheet-enter w-full max-w-lg bg-white dark:bg-gray-900 rounded-t-3xl px-5 pt-5 pb-8 shadow-2xl"
      >
        <BottomSheetHandle {...swipeHandlers} />

        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2 id="leaderboard-filter-title" className="font-black text-xl text-gray-900 dark:text-gray-100">
              Filter leaderboard
            </h2>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">
              {selectedCount} of {entries.length} players selected
            </p>
          </div>
          <button
            ref={closeButtonRef}
            onClick={onClose}
            aria-label="Close leaderboard filter"
            className="text-gray-300 hover:text-gray-600 text-2xl leading-none px-2"
          >
            ×
          </button>
        </div>

        <div className="flex gap-2 mb-3">
          <button
            onClick={onSelectAll}
            className="flex-1 py-2 rounded-xl bg-yellow-300 text-sm font-bold text-gray-900 hover:bg-yellow-400"
          >
            Select all
          </button>
          <button
            onClick={onClearAll}
            className="flex-1 py-2 rounded-xl bg-gray-100 dark:bg-gray-800 text-sm font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
          >
            Clear all
          </button>
        </div>

        <div className="max-h-[55vh] overflow-y-auto rounded-2xl border border-gray-100 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
          {entries.map((entry) => {
            const checked = !excludedUserIds.has(entry.userId);
            return (
              <label
                key={entry.userId}
                className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggle(entry.userId)}
                  className="w-5 h-5 accent-yellow-400"
                />
                <div className="w-8 h-8 rounded-full bg-gray-900 flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {entry.photoURL ? (
                    <img
                      src={entry.photoURL}
                      alt=""
                      className="w-8 h-8 object-cover"
                    />
                  ) : (
                    <span className="text-yellow-300 font-black text-sm">
                      {entry.displayName[0]?.toUpperCase()}
                    </span>
                  )}
                </div>
                <span className="font-bold text-sm text-gray-900 dark:text-gray-100 truncate">
                  {entry.displayName}
                </span>
              </label>
            );
          })}
        </div>

        <button
          onClick={onClose}
          className="w-full mt-4 py-3 rounded-xl bg-gray-900 text-yellow-300 font-black hover:bg-gray-800"
        >
          Done
        </button>
      </div>
    </div>
  );
}
