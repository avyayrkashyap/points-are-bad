/**
 * Points are bad — lower is better (like golf).
 * Score = |predicted_team1 - actual_team1| + |predicted_team2 - actual_team2|
 * A perfect prediction = 0 points.
 */

export function calcPoints(
  pred: { score1: number; score2: number },
  match: { actualScore1?: number; actualScore2?: number }
): number | null {
  if (match.actualScore1 == null || match.actualScore2 == null) return null;
  return (
    Math.abs(pred.score1 - match.actualScore1) +
    Math.abs(pred.score2 - match.actualScore2)
  );
}

export function pointsLabel(pts: number | null): string {
  if (pts === null) return '';
  if (pts === 0) return '🎯 Perfect';
  return `+${pts} pt${pts === 1 ? '' : 's'}`;
}
