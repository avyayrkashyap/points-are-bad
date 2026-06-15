import { useRef, useState } from 'react';
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer,
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import type { LeaderboardEntry } from '../lib/leaderboard';

interface Props {
  player: LeaderboardEntry;
  rank: number;
  onClose: () => void;
}

const MEDALS = ['🥇', '🥈', '🥉'];

export function PlayerProfile({ player, rank, onClose }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [chartIndex, setChartIndex] = useState(0);
  const ppg = player.matchesScored > 0
    ? (player.totalPoints / player.matchesScored).toFixed(2)
    : '–';
  const winnerPct = player.totalPredicted > 0
    ? Math.round((player.correctWinner / player.totalPredicted) * 100)
    : 0;

  // Radar: each axis is % of total predicted matches
  const total = player.totalPredicted || 1;
  const radarData = [
    { label: '🎯 Perfect', value: Math.round((player.perfect / total) * 100) },
    { label: '+1',          value: Math.round((player.plusOne  / total) * 100) },
    { label: '+2',          value: Math.round((player.plusTwo  / total) * 100) },
    { label: '+3',          value: Math.round((player.plusThree / total) * 100) },
    { label: '4+',          value: Math.round((player.fourPlus / total) * 100) },
  ];

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm"
      onClick={(e) => e.target === overlayRef.current && onClose()}
    >
      <div className="w-full max-w-lg bg-white rounded-t-3xl px-6 pt-5 pb-10 shadow-2xl">
        {/* Drag handle */}
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-gray-900 flex items-center justify-center flex-shrink-0">
              {player.photoURL ? (
                <img src={player.photoURL} alt={player.displayName} className="w-11 h-11 rounded-full object-cover" />
              ) : (
                <span className="text-yellow-300 font-black text-lg">
                  {player.displayName[0].toUpperCase()}
                </span>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-lg text-gray-900 leading-tight">{player.displayName}</span>
                {rank <= 3 && <span className="text-lg">{MEDALS[rank - 1]}</span>}
              </div>
              <span className="text-xs text-gray-400 font-medium">Rank #{rank}</span>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-300 hover:text-gray-500 text-2xl leading-none">×</button>
        </div>

        {/* Key stats row */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <StatBox label="Total pts" value={String(player.totalPoints)} highlight />
          <StatBox label="Pts / game" value={ppg} />
          <StatBox label="Winner %" value={`${winnerPct}%`} />
        </div>

        {/* Chart carousel */}
        <div className="mb-4">
          {/* Slide titles + dots */}
          <div className="flex items-center justify-center gap-3 mb-2">
            <button
              onClick={() => setChartIndex(0)}
              className={`text-[11px] font-semibold tracking-widest uppercase transition-colors ${chartIndex === 0 ? 'text-gray-700' : 'text-gray-300'}`}
            >
              Distribution
            </button>
            <div className="flex gap-1.5">
              {[0, 1].map(i => (
                <div
                  key={i}
                  onClick={() => setChartIndex(i)}
                  className={`w-1.5 h-1.5 rounded-full cursor-pointer transition-colors ${chartIndex === i ? 'bg-yellow-400' : 'bg-gray-200'}`}
                />
              ))}
            </div>
            <button
              onClick={() => setChartIndex(1)}
              className={`text-[11px] font-semibold tracking-widest uppercase transition-colors ${chartIndex === 1 ? 'text-gray-700' : 'text-gray-300'}`}
            >
              Game by game
            </button>
          </div>

          {/* Slides */}
          <div className="overflow-hidden">
            <div
              className="flex transition-transform duration-300 ease-in-out"
              style={{ transform: `translateX(-${chartIndex * 100}%)` }}
            >
              {/* Slide 1 — Radar */}
              <div className="w-full flex-shrink-0">
                <ResponsiveContainer width="100%" height={220}>
                  <RadarChart data={radarData} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
                    <PolarGrid stroke="#EEEEEE" />
                    <PolarAngleAxis
                      dataKey="label"
                      tick={{ fontFamily: 'Lexend, sans-serif', fontSize: 12, fontWeight: 600, fill: '#555' }}
                    />
                    <Radar
                      dataKey="value"
                      stroke="#F5C842"
                      fill="#F5C842"
                      fillOpacity={0.35}
                      strokeWidth={2}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>

              {/* Slide 2 — Pts per game area chart */}
              <div className="w-full flex-shrink-0">
                {(player.matchHistory ?? []).length < 2 ? (
                  <div className="h-[220px] flex items-center justify-center text-sm text-gray-400">
                    Not enough games yet
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart
                      data={(player.matchHistory ?? []).reduce<{ game: number; pts: number; avg: number; miss: boolean }[]>((acc, m, i) => {
                        const prevTotal = acc[i - 1] ? acc[i - 1].avg * i : 0;
                        const avg = parseFloat(((prevTotal + m.pts) / (i + 1)).toFixed(2));
                        acc.push({ game: i + 1, pts: m.pts, avg, miss: m.miss });
                        return acc;
                      }, [])}
                      margin={{ top: 10, right: 16, bottom: 0, left: -20 }}
                    >
                      <defs>
                        <linearGradient id="ptsFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#F5C842" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#F5C842" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" vertical={false} />
                      <XAxis
                        dataKey="game"
                        tick={{ fontFamily: 'Lexend, sans-serif', fontSize: 11, fill: '#AAAAAA' }}
                        axisLine={false}
                        tickLine={false}
                        label={{ value: 'Game', position: 'insideBottom', offset: -2, fontSize: 10, fill: '#CCCCCC', fontFamily: 'Lexend, sans-serif' }}
                      />
                      <YAxis
                        tick={{ fontFamily: 'Lexend, sans-serif', fontSize: 11, fill: '#AAAAAA' }}
                        axisLine={false}
                        tickLine={false}
                        allowDecimals={false}
                      />
                      <Tooltip
                        contentStyle={{ fontFamily: 'Lexend, sans-serif', fontSize: 12, borderRadius: 8, border: '1px solid #EEE' }}
                        formatter={(val, name, entry) => {
                          if (name === 'avg') return [`${val} avg`, 'Rolling avg'];
                          return [(entry.payload as { miss: boolean }).miss ? `${val} pts (missed)` : `${val} pts`, 'This game'];
                        }}
                        labelFormatter={(label) => `Game ${label}`}
                      />
                      <Area
                        type="monotone"
                        dataKey="pts"
                        stroke="#F5C842"
                        strokeWidth={2}
                        fill="url(#ptsFill)"
                        dot={(props) => {
                          const { cx, cy, payload } = props;
                          return (
                            <circle
                              key={`dot-${payload.game}`}
                              cx={cx}
                              cy={cy}
                              r={3}
                              fill={payload.miss ? '#EE4444' : '#F5C842'}
                              stroke="white"
                              strokeWidth={1.5}
                            />
                          );
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="avg"
                        stroke="#0A0A0A"
                        strokeWidth={1.5}
                        strokeDasharray="4 3"
                        fill="none"
                        dot={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Secondary stats */}
        <div className="grid grid-cols-3 gap-3">
          <StatBox label="Perfect" value={String(player.perfect)} />
          <StatBox label="Predicted" value={`${player.totalPredicted}/${player.matchesScored}`} />
          <StatBox label="Missed" value={String(player.missed)} dim={player.missed > 0} />
        </div>
      </div>
    </div>
  );
}

function StatBox({ label, value, highlight, dim }: {
  label: string; value: string; highlight?: boolean; dim?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl px-3 py-3 flex flex-col items-center gap-0.5 ${highlight ? 'bg-yellow-300' : 'bg-gray-50'}`}
    >
      <span
        className="font-black text-2xl leading-tight tracking-tight"
        style={{ color: dim ? '#AAAAAA' : '#0A0A0A' }}
      >
        {value}
      </span>
      <span className="text-[10px] font-semibold tracking-widest uppercase text-gray-400">{label}</span>
    </div>
  );
}
