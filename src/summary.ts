// Everything a post says, computed once from the snapshot. Images and caption only use this, and the
// fact-check checks the caption against it.
//
// The normal day is the same weekday in the weeks before (NORMAL_WEEKS of them), only days measured fully at
// every point we use and no public holidays, so yesterday and the normal always cover the same points.

import type { Config } from './config.ts';
import { DAYS, holidayName, weekday } from './dates.ts';
import { MIN_COVERAGE, NORMAL_WEEKS, type Day, type PointDays, type Snapshot } from './data/traffic.ts';
import type { RushWeather } from './data/weather.ts';

/** At least this many of the points must be fully measured yesterday. */
export const MIN_POINTS = 6;
/** "Busy" cabin hours: at least this share of the busiest hour; "quieter": at most QUIET_SHARE. */
export const BUSY_SHARE = 0.9;
export const QUIET_SHARE = 0.7;
/** Cabin traffic is shown for leaving hours 10–21. */
export const CABIN_HOURS = Array.from({ length: 12 }, (_, i) => 10 + i);

export interface PointRow {
  name: string;
  yesterday: number;
  normal: number;
  /** Per cent against the normal, whole number. */
  diff: number;
}

export interface Peak {
  hour: number;
  volume: number;
}

export interface CabinRouteSummary {
  name: string;
  where: string;
  heading: string;
  /** Average vehicles per hour for CABIN_HOURS. */
  hours: number[];
}

export interface CabinSummary {
  kind: 'out' | 'home';
  /** Days averaged (same weekday, weeks before). */
  days: string[];
  routes: CabinRouteSummary[];
  /** All routes together, per CABIN_HOURS. */
  total: number[];
  peak: Peak;
  /** The busy stretch: hours from–to (to = the hour it ends). */
  busyFrom: number;
  busyTo: number;
  /** Clearly quieter: leave before this hour, or from this hour (null if none in the hours shown). */
  quietBefore: number | null;
  quietAfter: number | null;
}

export interface DaySummary {
  date: string;
  yesterday: string;
  weekdayName: string;
  holiday: string | null;
  normalDays: string[];
  rows: PointRow[];
  missing: string[];
  total: number;
  normalTotal: number;
  diff: number;
  /** Vehicles per hour 0–23 at all points together, yesterday and normal (rounded). */
  hourly: { yesterday: number[]; normal: number[] };
  morning: { yesterday: Peak; normal: Peak };
  afternoon: { yesterday: Peak; normal: Peak };
  cabin: CabinSummary | null;
  weather: RushWeather | null;
  validation: { passed: string[]; warnings: string[]; errors: string[] };
}

const pct = (a: number, b: number) => (b ? Math.round(((a - b) / b) * 100) : 0);
const complete = (d: Day | undefined) => !!d && d.coverage >= MIN_COVERAGE && d.total > 0;
const dayOf = (p: PointDays, date: string) => p.days.find((d) => d.date === date);
const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / Math.max(1, xs.length);

function peak(hours: number[], from: number, to: number): Peak {
  let best = from;
  for (let h = from; h <= to; h++) if (hours[h] > hours[best]) best = h;
  return { hour: best, volume: hours[best] };
}

function cabinSummary(s: Snapshot, config: Config): CabinSummary | null {
  if (!s.cabin.length) return null;
  const kind = weekday(s.date) === 5 ? 'out' : 'home';
  const routes: CabinRouteSummary[] = [];
  const used = new Set<string>();
  for (const r of config.cabin) {
    const p = s.cabin.find((x) => x.id === r.id);
    const heading = kind === 'out' ? r.out : r.home;
    const days = (p?.days ?? []).filter((d) => complete(d) && d.directions[heading]).slice(0, NORMAL_WEEKS);
    if (days.length < 2) continue;
    days.forEach((d) => used.add(d.date));
    routes.push({ name: r.name, where: r.where, heading, hours: CABIN_HOURS.map((h) => Math.round(mean(days.map((d) => d.directions[heading][h] ?? 0)))) });
  }
  if (!routes.length) return null;
  const total = CABIN_HOURS.map((_, i) => routes.reduce((sum, r) => sum + r.hours[i], 0));
  const top = total.indexOf(Math.max(...total));
  let from = top;
  let to = top;
  while (from > 0 && total[from - 1] >= total[top] * BUSY_SHARE) from--;
  while (to < total.length - 1 && total[to + 1] >= total[top] * BUSY_SHARE) to++;
  const quiet = (i: number) => total[i] <= total[top] * QUIET_SHARE;
  const before = [...total.keys()].filter((i) => i < from && quiet(i)).pop();
  const after = [...total.keys()].find((i) => i > to && quiet(i));
  return {
    kind,
    days: [...used].sort().reverse(),
    routes,
    total,
    peak: { hour: CABIN_HOURS[top], volume: total[top] },
    busyFrom: CABIN_HOURS[from],
    busyTo: CABIN_HOURS[to] + 1,
    quietBefore: before === undefined ? null : CABIN_HOURS[before] + 1,
    quietAfter: after === undefined ? null : CABIN_HOURS[after],
  };
}

export function summarize(s: Snapshot, config: Config, weather: RushWeather | null = null): DaySummary {
  const passed: string[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];
  const included = s.points.filter((p) => complete(dayOf(p, s.yesterday)));
  const missing = s.points.filter((p) => !included.includes(p)).map((p) => p.name);
  if (missing.length) warnings.push(`ikke fullt målt i går, utelatt: ${missing.join(', ')}`);
  if (included.length >= MIN_POINTS) passed.push(`${included.length} av ${s.points.length} punkter fullt målt i går`);
  else errors.push(`bare ${included.length} av ${s.points.length} punkter fullt målt i går (minst ${MIN_POINTS})`);
  // Normal days: measured fully at every point we use.
  const normalDays = s.normalDays.filter((d) => included.every((p) => complete(dayOf(p, d)))).slice(0, NORMAL_WEEKS);
  if (normalDays.length >= 2) passed.push(`normalen fra ${normalDays.length} ${DAYS[weekday(s.yesterday)]}er`);
  else errors.push(`for få hele dager til normalen (${normalDays.length})`);

  const rows = included.map((p) => {
    const y = dayOf(p, s.yesterday)!.total;
    const n = Math.round(mean(normalDays.map((d) => dayOf(p, d)!.total)));
    return { name: p.name, yesterday: y, normal: n, diff: pct(y, n) };
  });
  for (const r of rows) {
    if (r.yesterday > 250_000) errors.push(`${r.name}: urimelig mange (${r.yesterday})`);
    if (Math.abs(r.diff) > 60 && !holidayName(s.yesterday)) warnings.push(`${r.name}: ${r.diff} % mot normalen (stengt vei, omkjøring eller målefeil?)`);
  }
  const total = rows.reduce((sum, r) => sum + r.yesterday, 0);
  const normalTotal = rows.reduce((sum, r) => sum + r.normal, 0);
  const hourlyY = Array.from({ length: 24 }, (_, h) => included.reduce((sum, p) => sum + (dayOf(p, s.yesterday)!.hours[h] ?? 0), 0));
  const hourlyN = Array.from({ length: 24 }, (_, h) => Math.round(mean(normalDays.map((d) => included.reduce((sum, p) => sum + (dayOf(p, d)!.hours[h] ?? 0), 0)))));
  return {
    date: s.date,
    yesterday: s.yesterday,
    weekdayName: DAYS[weekday(s.yesterday)],
    holiday: holidayName(s.yesterday),
    normalDays,
    rows,
    missing,
    total,
    normalTotal,
    diff: pct(total, normalTotal),
    hourly: { yesterday: hourlyY, normal: hourlyN },
    morning: { yesterday: peak(hourlyY, 5, 10), normal: peak(hourlyN, 5, 10) },
    afternoon: { yesterday: peak(hourlyY, 13, 19), normal: peak(hourlyN, 13, 19) },
    cabin: cabinSummary(s, config),
    weather,
    validation: { passed, warnings, errors },
  };
}
