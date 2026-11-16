import { excelRound, SECONDS_PER_DAY, wrapToDay } from '@/lib/excel';

export interface ClockTime {
  readonly hours: number;
  readonly minutes: number;
}

/** TIME(h; m; 0): tronca gli argomenti e "avvolge" oltre le 24 ore. */
export function clockToSeconds({ hours, minutes }: ClockTime): number {
  return wrapToDay(Math.trunc(hours) * 3600 + Math.trunc(minutes) * 60);
}

const pad = (value: number): string => String(value).padStart(2, '0');

/** Formato hh:mm:ss, arrotondato al secondo come la visualizzazione di Excel. */
export function formatClock(secondsOfDay: number): string {
  const total = excelRound(secondsOfDay) % SECONDS_PER_DAY;
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}
