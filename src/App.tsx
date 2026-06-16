import { useEffect, useState } from 'react';
import { AuthContext, useAuthProvider } from './lib/useAuth';
import { subscribeMatches } from './lib/matches';
import type { Match } from './lib/matches';
import { subscribeUserPredictions } from './lib/predictions';
import type { Prediction } from './lib/predictions';
import { MatchCard } from './components/MatchCard';
import { PredictionModal } from './components/PredictionModal';
import { Leaderboard } from './components/Leaderboard';
import { CalendarBar, buildDayGroups } from './components/CalendarBar';

function getOpenMatches(matches: Match[], predMap: Map<string, Prediction>): Match[] {
  const now = new Date();
  const threeDays = 3 * 24 * 60 * 60 * 1000;
  return matches.filter((m) => {
    if (m.actualScore1 != null) return false;       // finished
    if (predMap.has(m.id)) return false;             // already predicted
    if (now >= m.date) return false;                 // kicked off already
    return m.date.getTime() - now.getTime() <= threeDays;
  });
}

type View = 'matches' | 'leaderboard';

function App() {
  const auth = useAuthProvider();
  const [matches, setMatches] = useState<Match[]>([]);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [selected, setSelected] = useState<Match | null>(null);
  const [loadingMatches, setLoadingMatches] = useState(true);
  const [view, setView] = useState<View>('matches');

  useEffect(() => {
    return subscribeMatches((m) => {
      setMatches(m);
      setLoadingMatches(false);
    });
  }, []);

  useEffect(() => {
    if (!auth.user) { setPredictions([]); return; }
    return subscribeUserPredictions(auth.user.uid, setPredictions);
  }, [auth.user]);

  const predMap = new Map(predictions.map((p) => [p.matchId, p]));
  const openMatches = getOpenMatches(matches, predMap);
  const dayGroups = buildDayGroups(matches);

  function scrollToDay(dateKey: string) {
    const el = document.getElementById(`day-${dateKey}`);
    if (!el) return;
    const headerHeight = 80;
    const top = el.getBoundingClientRect().top + window.scrollY - headerHeight - 8;
    window.scrollTo({ top, behavior: 'smooth' });
  }

  // Scroll to today (or nearest upcoming day) on initial load
  useEffect(() => {
    if (dayGroups.length === 0) return;
    const now = new Date();
    const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const target = dayGroups.find((g) => g.dateKey >= todayKey);
    if (!target) return;
    requestAnimationFrame(() => scrollToDay(target.dateKey));
  }, [dayGroups.length > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  function jumpToNextPrediction() {
    if (openMatches.length === 0) return;
    const next = openMatches[0];
    const el = document.getElementById(`match-${next.id}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Small delay so scroll completes before modal opens
      setTimeout(() => setSelected(next), 300);
    } else {
      setSelected(next);
    }
  }

  if (auth.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <AuthContext.Provider value={auth}>
      <div className="min-h-screen max-w-lg mx-auto px-4 pb-32">
        {/* Header */}
        <header className="sticky top-4 z-30 flex items-center justify-between bg-yellow-300 rounded-2xl px-5 py-3 mb-6 mt-4">
          <h1 className="text-xl font-black text-gray-900 leading-tight">
            Points <span className="font-normal">'R'</span> Bad
          </h1>
          <div className="flex items-center gap-2">
            {auth.user ? (
              <>
                <button
                  onClick={() => setView('matches')}
                  className={`px-4 py-1.5 rounded-full text-sm font-bold transition-colors ${
                    view === 'matches'
                      ? 'bg-gray-900 text-yellow-300'
                      : 'bg-yellow-200 text-gray-700 hover:bg-yellow-100'
                  }`}
                >
                  Matches
                </button>
                <button
                  onClick={() => setView('leaderboard')}
                  className={`px-4 py-1.5 rounded-full text-sm font-bold transition-colors ${
                    view === 'leaderboard'
                      ? 'bg-gray-900 text-yellow-300'
                      : 'bg-yellow-200 text-gray-700 hover:bg-yellow-100'
                  }`}
                >
                  Points
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
            <p className="text-gray-800 font-bold text-lg mb-1">Predict the scores</p>
            <p className="text-sm text-gray-500">
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
            {dayGroups.map((g) => (
              <section key={g.dateKey} id={`day-${g.dateKey}`}>
                <h2 className="text-xs font-semibold tracking-widest text-gray-400 uppercase mb-3 px-1">
                  {g.matches[0].date.toLocaleDateString(undefined, {
                    weekday: 'long', month: 'long', day: 'numeric',
                  })}
                </h2>
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
              </section>
            ))}
          </div>
        )}
      </div>

      {/* Calendar bar */}
      {auth.user && view === 'matches' && (
        <CalendarBar
          groups={dayGroups}
          predMap={predMap}
          onSelectDay={scrollToDay}
        />
      )}

      {/* Floating "predictions left" button */}
      {auth.user && view === 'matches' && openMatches.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40">
          <button
            onClick={jumpToNextPrediction}
            className="flex items-center gap-2 px-4 py-2 rounded-full shadow-md hover:shadow-lg transition-shadow active:scale-95"
            style={{ backgroundColor: '#F6F6F6' }}
          >
            <span
              style={{
                fontFamily: 'Lexend, sans-serif',
                fontWeight: 400,
                fontSize: '16px',
                letterSpacing: '-0.04em',
                lineHeight: '24px',
                color: '#0A0A0A',
                whiteSpace: 'nowrap',
              }}
            >
              {openMatches.length} prediction{openMatches.length !== 1 ? 's' : ''} left
            </span>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 3v10M3 8l5 5 5-5" stroke="#0A0A0A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      )}

      {selected && (
        <PredictionModal
          match={selected}
          myPrediction={predMap.get(selected.id)}
          onClose={() => setSelected(null)}
        />
      )}
    </AuthContext.Provider>
  );
}

export default App;
