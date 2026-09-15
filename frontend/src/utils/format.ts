/**
 * Safe formatting utilities to prevent any TypeError or decimal floating issues.
 */

export const safeNum = (val: unknown, fallback: number = 0): number => {
  if (val === null || val === undefined || val === '') return fallback;
  const n = Number(val);
  return isNaN(n) ? fallback : n;
};

export const formatMoney = (val: unknown): string => {
  return safeNum(val).toFixed(2);
};

export const formatSeconds = (totalSeconds: unknown): string => {
  const total = Math.max(0, Math.floor(safeNum(totalSeconds)));
  if (total <= 0) return '00:00:00';
  const hrs = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};
