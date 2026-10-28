// The daily caption: yesterday against a normal day, the busiest hours, today's rush-hour weather, and on
// Fridays and Sundays when the cabin traffic is heaviest. Written to be shared by commuters. Every number is
// checked against the summary (factCheck).

import type { Config } from './config.ts';
import { dayText, DAYS_PLURAL, weekday } from './dates.ts';
import type { Rush } from './data/weather.ts';
import type { DaySummary, Peak } from './summary.ts';

/** "452 300" (Norwegian thousands). */
export const fmt = (n: number) => n.toLocaleString('nb-NO');
/** "07–08" */
export const hourSpan = (h: number) => `${String(h).padStart(2, '0')}–${String(h + 1).padStart(2, '0')}`;
export const signed = (d: number) => (d > 0 ? `+${d} %` : d < 0 ? `−${-d} %` : '±0 %');

const NUMBERS_WORDS = ['null', 'én', 'to', 'tre', 'fire', 'fem', 'seks', 'sju', 'åtte'];
const count = (n: number) => NUMBERS_WORDS[n] ?? String(n);

export function compared(diff: number, weekdayName: string): string {
  if (diff === 0) return `like mye som en vanlig ${weekdayName}`;
  return `${Math.abs(diff)} % ${diff > 0 ? 'mer' : 'mindre'} enn en vanlig ${weekdayName}`;
}

const peakLine = (label: string, p: { yesterday: Peak; normal: Peak }) =>
  `${label} ${hourSpan(p.yesterday.hour)} med ${fmt(p.yesterday.volume)} kjøretøy${p.yesterday.hour !== p.normal.hour ? ` (vanligvis ${hourSpan(p.normal.hour)})` : ''}`;

const rushText = (r: Rush) => `${r.temp}° og ${r.sky === 'opphold' ? 'opphold' : `${r.sky} (${String(r.precipitation).replace('.', ',')} mm)`} i ${r.label}`;

export function weatherLine(s: DaySummary): string | null {
  const w = s.weather;
  const parts = [w?.morning, w?.afternoon].filter((r): r is Rush => !!r);
  if (!parts.length) return null;
  const slippery = parts.some((r) => r.sky === 'snø' || r.sky === 'sludd' || (r.temp <= 0 && r.sky !== 'opphold'));
  return `🌦️ I dag: ${parts.map(rushText).join(', ')}.${slippery ? ' Ta det rolig – det kan bli glatt.' : ''}`;
}

/** "Roligere før kl. 12 eller fra kl. 19" */
export function quietText(c: NonNullable<DaySummary['cabin']>): string | null {
  const parts = [c.quietBefore !== null ? `før kl. ${c.quietBefore}` : '', c.quietAfter !== null ? `fra kl. ${c.quietAfter}` : ''].filter(Boolean);
  return parts.length ? `Roligere ${parts.join(' eller ')}` : null;
}

export function cabinLine(s: DaySummary): string | null {
  const c = s.cabin;
  if (!c) return null;
  const n = count(c.days.length);
  const days = DAYS_PLURAL[weekday(s.date)];
  const quieter = quietText(c);
  return c.kind === 'out'
    ? `🏕️ Skal du på hytta i dag? De siste ${n} ${days} kjørte flest ut av byen mellom kl. ${c.busyFrom} og ${c.busyTo}.${quieter ? ` ${quieter}.` : ''}`
    : `🏠 Hjem fra hytta i dag? De siste ${n} ${days} kom flest inn mot Oslo mellom kl. ${c.busyFrom} og ${c.busyTo}.${quieter ? ` ${quieter}.` : ''}`;
}

export function caption(s: DaySummary, config: Config): string {
  const up = [...s.rows].sort((a, b) => b.diff - a.diff)[0];
  const down = [...s.rows].sort((a, b) => a.diff - b.diff)[0];
  const lines = [
    `🚗 Trafikken i går, ${dayText(s.yesterday)}${s.holiday ? ` (${s.holiday})` : ''}`,
    `${fmt(s.total)} kjøretøy passerte våre ${s.rows.length} tellepunkter – ${compared(s.diff, s.weekdayName)}.`,
    '',
    up && up.diff > 0 ? `📈 Mest over normalen: ${up.name} (${signed(up.diff)})` : '',
    down && down.diff < 0 ? `📉 Mest under normalen: ${down.name} (${signed(down.diff)})` : '',
    `⏰ ${peakLine('Morgenrushet toppet seg kl.', s.morning)}`,
    `⏰ ${peakLine('Ettermiddagen toppet seg kl.', s.afternoon)}`,
    '',
    weatherLine(s) ?? '',
    cabinLine(s) ?? '',
    '',
    'Send til en som pendler 👇 Følg for trafikken hver morgen.',
    `${config.source.short}`,
    config.brand.hashtags.join(' '),
  ];
  return lines.filter((l, i, a) => l !== '' || (i > 0 && a[i - 1] !== '')).join('\n').replace(/\n{3,}/g, '\n\n');
}

/** Numbers in the caption that are not in the summary. "452 300" is one number; hashtags and road names are skipped. */
export function factCheck(text: string, s: DaySummary): string[] {
  const peaks = [s.morning.yesterday, s.morning.normal, s.afternoon.yesterday, s.afternoon.normal];
  const rush = [s.weather?.morning, s.weather?.afternoon].filter((r): r is Rush => !!r);
  const allowed = new Set<number>([
    Number(s.yesterday.slice(8, 10)),
    s.total,
    s.rows.length,
    ...s.rows.map((r) => Math.abs(r.diff)),
    Math.abs(s.diff),
    ...peaks.flatMap((p) => [p.hour, p.hour + 1, p.volume]),
    ...rush.flatMap((r) => [Math.abs(r.temp), ...String(r.precipitation).split('.').map(Number)]),
    ...(s.cabin ? [s.cabin.busyFrom, s.cabin.busyTo, s.cabin.quietBefore ?? -1, s.cabin.quietAfter ?? -1] : []),
    // "1. mai", "17. mai", "2. pinsedag"
    ...(s.holiday?.match(/\d+/g)?.map(Number) ?? []),
  ]);
  let body = text.replace(/#[\p{L}\p{N}_]+/gu, ' ');
  // Road names carry numbers ("E18 Høvik", "Ring 3 Smestad").
  for (const name of [...s.rows.map((r) => r.name), ...(s.cabin?.routes.map((r) => r.name) ?? [])]) body = body.split(name).join(' ');
  return [...body.matchAll(/\d{1,3}(?:[   ]\d{3})+|\d+/g)]
    .map((m) => Number(m[0].replace(/[   ]/g, '')))
    .filter((x) => !allowed.has(x))
    .map((x) => `number "${x}" is not in the data`);
}
