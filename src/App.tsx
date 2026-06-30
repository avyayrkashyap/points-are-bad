import { useEffect, useState } from 'react';
import { AuthContext, useAuthProvider } from './lib/useAuth';
import { DarkModeContext } from './lib/theme';
import { subscribeMatches } from './lib/matches';
import type { Match } from './lib/matches';
import { subscribeUserPredictions } from './lib/predictions';
import type { Prediction } from './lib/predictions';
import { MatchCard } from './components/MatchCard';
import { PredictionModal } from './components/PredictionModal';
import { Leaderboard } from './components/Leaderboard';
import { CalendarBar } from './components/CalendarBar';
import { buildDayGroups, shouldCollapseDay } from './lib/calendar';

type View = 'matches' | 'leaderboard';

function IconMatches(_: { active: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
      <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01" strokeWidth="2.5" />
    </svg>
  );
}

function IconTrophy(_: { active: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2z" />
    </svg>
  );
}

function IconSun() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  );
}

function IconMoon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

function App() {
  const auth = useAuthProvider();
  const [matches, setMatches] = useState<Match[]>([]);
  const [predictionState, setPredictionState] = useState<{
    userId: string;
    predictions: Prediction[];
  } | null>(null);
  const [selected, setSelected] = useState<Match | null>(null);
  const [loadingMatches, setLoadingMatches] = useState(true);
  const [view, setView] = useState<View>('matches');
  const [expandedDayKeys, setExpandedDayKeys] = useState<Set<string>>(() => new Set());
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches);
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  useEffect(() => {
    return subscribeMatches((m) => {
      setMatches(m);
      setLoadingMatches(false);
    });
  }, []);

  useEffect(() => {
    if (!auth.user) return;
    const userId = auth.user.uid;
    return subscribeUserPredictions(userId, (predictions) => {
      setPredictionState({ userId, predictions });
    });
  }, [auth.user]);

  const predictions = predictionState && predictionState.userId === auth.user?.uid
    ? predictionState.predictions
    : [];
  const predMap = new Map(predictions.map((p) => [p.matchId, p]));
  const dayGroups = buildDayGroups(matches);

  function scrollToDay(dateKey: string, behavior: ScrollBehavior = 'smooth') {
    const el = document.getElementById(`day-${dateKey}`);
    if (!el) return;
    const headerHeight = 80;
    const top = el.getBoundingClientRect().top + window.scrollY - headerHeight - 8;
    window.scrollTo({ top, behavior });
  }

  function expandAndScrollToDay(dateKey: string) {
    setExpandedDayKeys((current) => {
      if (current.has(dateKey)) return current;
      const next = new Set(current);
      next.add(dateKey);
      return next;
    });
    requestAnimationFrame(() => {
      requestAnimationFrame(() => scrollToDay(dateKey));
    });
  }

  function toggleDay(dateKey: string) {
    setExpandedDayKeys((current) => {
      const next = new Set(current);
      if (next.has(dateKey)) next.delete(dateKey);
      else next.add(dateKey);
      return next;
    });
  }

  useEffect(() => {
    if (view !== 'matches') return;
    if (auth.loading || !auth.user) return;
    if (dayGroups.length === 0) return;
    const now = new Date();
    const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const target = dayGroups.find((g) => g.dateKey >= todayKey);
    if (!target) return;
    requestAnimationFrame(() => scrollToDay(target.dateKey, 'auto'));
  }, [view, auth.loading, auth.user?.uid, dayGroups.length > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  if (auth.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center dark:bg-gray-900">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const tabBtn = (active: boolean) =>
    `w-9 h-9 flex items-center justify-center rounded-full transition-colors ${
      active ? 'bg-gray-900 text-yellow-300' : 'bg-yellow-200 text-gray-700 hover:bg-yellow-100'
    }`;

  return (
    <AuthContext.Provider value={auth}>
      <DarkModeContext.Provider value={isDark}>
        <div className="min-h-screen max-w-lg mx-auto px-4 pb-32">
          {/* Header */}
          <header className="sticky top-4 z-30 flex items-center justify-between bg-yellow-300 rounded-2xl px-5 py-3 mb-6 mt-4">
            <h1 className="text-xl font-black text-gray-900 leading-tight">
              Points <span className="font-normal">'R'</span> Bad
            </h1>
            <div className="flex items-center gap-2">
              {/* Dark mode toggle */}
              <button
                onClick={() => setIsDark((d) => !d)}
                className="w-9 h-9 flex items-center justify-center rounded-full bg-yellow-200 text-gray-700 hover:bg-yellow-100 transition-colors"
                aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {isDark ? <IconSun /> : <IconMoon />}
              </button>

              {auth.user ? (
                <>
                  <button
                    onClick={() => setView('matches')}
                    className={tabBtn(view === 'matches')}
                    aria-label="Matches"
                    title="Matches"
                  >
                    <IconMatches active={view === 'matches'} />
                  </button>
                  <button
                    onClick={() => setView('leaderboard')}
                    className={tabBtn(view === 'leaderboard')}
                    aria-label="Points leaderboard"
                    title="Points"
                  >
                    <IconTrophy active={view === 'leaderboard'} />
                  </button>
                  <button onClick={auth.signOut} title="Sign out">
                    <img
                      src={auth.user.photoURL ?? ''}
                      alt={auth.user.displayName ?? ''}
                      className="w-8 h-8 rounded-full ml-1"
                    />
                  </button>
                </>
              ) : (
                <button
                  onClick={auth.signIn}
                  className="flex items-center gap-2 px-4 py-2 rounded-full bg-gray-900 text-yellow-300 text-sm font-bold hover:bg-gray-800 transition-colors"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Sign in
                </button>
              )}
            </div>
          </header>

          {/* Match list */}
          {!auth.user ? (
            <div className="text-center py-20">
              <p className="text-4xl mb-4">⚽</p>
              <p className="dark:text-gray-100 text-gray-800 font-bold text-lg mb-1">Predict the scores</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Sign in with Google to start predicting.
              </p>
            </div>
          ) : loadingMatches ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : view === 'leaderboard' ? (
            <Leaderboard />
          ) : (
            <div className="space-y-8">
              {dayGroups.map((g) => {
                const collapsible = shouldCollapseDay(g);
                const collapsed = collapsible && !expandedDayKeys.has(g.dateKey);
                const dateLabel = g.matches[0].date.toLocaleDateString(undefined, {
                  weekday: 'long', month: 'long', day: 'numeric',
                });

                return (
                  <section key={g.dateKey} id={`day-${g.dateKey}`}>
                    {collapsible ? (
                      <button
                        type="button"
                        onClick={() => toggleDay(g.dateKey)}
                        aria-expanded={!collapsed}
                        className={`w-full flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-800 ${collapsed ? 'bg-gray-50 dark:bg-gray-800' : 'mb-3'}`}
                      >
                        <span className="text-xs font-semibold tracking-widest text-gray-400 uppercase">
                          {dateLabel}
                        </span>
                        <span className="flex items-center gap-2 text-xs font-semibold text-gray-400">
                          {collapsed && `${g.matches.length} matches`}
                          <svg
                            aria-hidden="true"
                            className={`w-4 h-4 transition-transform ${collapsed ? '' : 'rotate-180'}`}
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </span>
                      </button>
                    ) : (
                      <h2 className="text-xs font-semibold tracking-widest text-gray-400 uppercase mb-3 px-1">
                        {dateLabel}
                      </h2>
                    )}

                    {!collapsed && (
                      <div className="space-y-3">
                        {g.matches.map((m) => (
                          <div key={m.id} id={`match-${m.id}`}>
                            <MatchCard
                              match={m}
                              myPrediction={predMap.get(m.id)}
                              onClick={() => setSelected(m)}
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                );
              })}
            </div>
          )}
        </div>

        {/* Calendar bar */}
        {auth.user && view === 'matches' && (
          <CalendarBar
            groups={dayGroups}
            predMap={predMap}
            onSelectDay={expandAndScrollToDay}
          />
        )}

        {selected && (
          <PredictionModal
            match={selected}
            myPrediction={predMap.get(selected.id)}
            onClose={() => setSelected(null)}
          />
        )}
      </DarkModeContext.Provider>
    </AuthContext.Provider>
  );
}

export default App;
