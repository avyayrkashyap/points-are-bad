import { useEffect, useState } from 'react';
import { AuthContext, useAuthProvider } from './lib/useAuth';
import { subscribeMatches } from './lib/matches';
import type { Match } from './lib/matches';
import { subscribeUserPredictions } from './lib/predictions';
import type { Prediction } from './lib/predictions';
import { MatchCard } from './components/MatchCard';
import { PredictionModal } from './components/PredictionModal';
import { Leaderboard } from './components/Leaderboard';

function groupByDate(matches: Match[]): [string, Match[]][] {
  const map = new Map<string, Match[]>();
  for (const m of matches) {
    const key = m.date.toLocaleDateString(undefined, {
      weekday: 'long', month: 'long', day: 'numeric',
    });
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(m);
  }
  return Array.from(map.entries());
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
  const matchMap = new Map(matches.map((m) => [m.id, m]));

  if (auth.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <AuthContext.Provider value={auth}>
      <div className="min-h-screen max-w-lg mx-auto px-4 py-6">
        {/* Header */}
        <header className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-black text-white leading-tight">
              ⚽ WC 2026
            </h1>
            <p className="text-xs text-slate-400">Group Stage Predictions</p>
          </div>
          {auth.user ? (
            <div className="flex items-center gap-3">
              <img
                src={auth.user.photoURL ?? ''}
                alt={auth.user.displayName ?? ''}
                className="w-8 h-8 rounded-full"
              />
              <button
                onClick={auth.signOut}
                className="text-xs text-slate-400 hover:text-white transition-colors"
              >
                Sign out
              </button>
            </div>
          ) : (
            <button
              onClick={auth.signIn}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white text-slate-900 text-sm font-semibold hover:bg-slate-100 transition-colors"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Sign in with Google
            </button>
          )}
        </header>

        {/* Tabs */}
        {auth.user && (
          <div className="flex gap-1 bg-slate-800 rounded-xl p-1 mb-6">
            <button
              onClick={() => setView('matches')}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
                view === 'matches'
                  ? 'bg-slate-700 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Matches
            </button>
            <button
              onClick={() => setView('leaderboard')}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
                view === 'leaderboard'
                  ? 'bg-slate-700 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Leaderboard
            </button>
          </div>
        )}

        {/* Match list */}
        {!auth.user ? (
          <div className="text-center py-16">
            <p className="text-4xl mb-4">🔐</p>
            <p className="text-slate-300 font-semibold mb-2">Sign in to predict</p>
            <p className="text-sm text-slate-500">
              Sign in with Google above to start predicting match scores.
            </p>
          </div>
        ) : loadingMatches ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : view === 'leaderboard' ? (
          <Leaderboard matchMap={matchMap} />
        ) : (
          <div className="space-y-8">
            {groupByDate(matches).map(([date, dayMatches]) => (
              <section key={date}>
                <h2 className="text-xs font-semibold tracking-widest text-slate-400 uppercase mb-3 px-1">
                  {date}
                </h2>
                <div className="space-y-3">
                  {dayMatches.map((m) => (
                    <MatchCard
                      key={m.id}
                      match={m}
                      myPrediction={predMap.get(m.id)}
                      onClick={() => setSelected(m)}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>

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
