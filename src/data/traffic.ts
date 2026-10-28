// Traffic counts from Statens vegvesen (trafikkdata-api.atlas.vegvesen.no, open GraphQL API, NLOD).
// For a post on day D we need day D-1 ("i går") and the same weekday in the weeks before (the normal day),
// per point and per hour; on Fridays and Sundays also the cabin roads, per hour and direction, on the same
// weekday in the weeks before. Everything a post uses is saved in data/traffic/<D>.json.

import fs from 'node:fs';
import path from 'node:path';
import { paths, type Config } from '../config.ts';
import { addDays, holidayName, osloMidnight, weekday } from '../dates.ts';

const API = 'https://trafikkdata-api.atlas.vegvesen.no/';
/** A day counts when at least this share of it was measured. */
export const MIN_COVERAGE = 95;
/** Weeks of the same weekday that make the normal day (holidays and incomplete days skipped). */
export const NORMAL_WEEKS = 4;
const LOOKBACK_WEEKS = 8;
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface Day {
  date: string;
  total: number;
  coverage: number;
  /** Vehicles per hour 0–23 (null when the hour was not measured). */
  hours: (number | null)[];
  /** Per direction (heading, e.g. "Drammen"), per hour 0–23. */
  directions: Record<string, (number | null)[]>;
}

export interface PointDays {
  id: string;
  name: string;
  days: Day[];
}

export interface Snapshot {
  fetchedAt: string;
  /** The post's date; the traffic is from the day before. */
  date: string;
  yesterday: string;
  /** Candidate days for the normal (same weekday, before yesterday). */
  normalDays: string[];
  points: PointDays[];
  /** Fridays and Sundays: the cabin roads on the same weekday as the post, in the weeks before. */
  cabinDays: string[];
  cabin: PointDays[];
}

type Volume = { volumeNumbers: { volume: number } | null; coverage: { percentage: number } | null };
type Node = { from: string; total: Volume; byDirection: { heading: string; total: Volume }[] };

async function gql<T>(query: string, config: Config, fetchFn: typeof fetch): Promise<T> {
  const res = await fetchFn(API, { method: 'POST', headers: { 'Content-Type': 'application/json', 'User-Agent': config.source.userAgent }, body: JSON.stringify({ query }) });
  if (!res.ok) throw new Error(`Trafikkdata answered ${res.status}`);
  const j = (await res.json()) as { data?: T; errors?: { message: string }[] };
  if (j.errors?.length) throw new Error(`Trafikkdata: ${j.errors.map((e) => e.message).join('; ')}`);
  return j.data!;
}

const NODE = 'edges { node { from total { volumeNumbers { volume } coverage { percentage } } byDirection { heading total { volumeNumbers { volume } } } } }';

/** One request per point: the whole day and its hours, for every date (GraphQL aliases). */
export async function fetchDays(id: string, dates: string[], config: Config, fetchFn: typeof fetch = fetch): Promise<Day[]> {
  const parts = dates.map((d, i) => `d${i}: byDay(from: "${osloMidnight(d)}", to: "${osloMidnight(addDays(d, 1))}") { ${NODE} } h${i}: byHour(from: "${osloMidnight(d)}", to: "${osloMidnight(addDays(d, 1))}") { ${NODE} }`);
  const data = await gql<{ trafficData: { volume: Record<string, { edges: { node: Node }[] }> } }>(`{ trafficData(trafficRegistrationPointId: "${id}") { volume { ${parts.join(' ')} } } }`, config, fetchFn);
  const v = data.trafficData.volume;
  return dates.map((date, i) => {
    const day = v[`d${i}`].edges[0]?.node;
    const hours: (number | null)[] = Array(24).fill(null);
    const directions: Record<string, (number | null)[]> = {};
    for (const { node } of v[`h${i}`].edges) {
      // The hour in Oslo time (the API answers with the local offset, e.g. "2026-10-27T07:00:00+01:00").
      const h = Number(node.from.slice(11, 13));
      if ((node.total.coverage?.percentage ?? 0) < MIN_COVERAGE || !node.total.volumeNumbers) continue;
      hours[h] = node.total.volumeNumbers.volume;
      for (const d of node.byDirection) (directions[d.heading] ??= Array(24).fill(null))[h] = d.total.volumeNumbers?.volume ?? null;
    }
    return { date, total: day?.total.volumeNumbers?.volume ?? 0, coverage: day?.total.coverage?.percentage ?? 0, hours, directions };
  });
}

/** The same weekday as `day` in the weeks before it, newest first, without public holidays. */
export function sameWeekdaysBefore(day: string, weeks = LOOKBACK_WEEKS): string[] {
  return Array.from({ length: weeks }, (_, i) => addDays(day, -7 * (i + 1))).filter((d) => !holidayName(d));
}

const file = (date: string) => path.join(paths.data, 'traffic', `${date}.json`);

export function readSnapshot(date: string): Snapshot | null {
  return fs.existsSync(file(date)) ? (JSON.parse(fs.readFileSync(file(date), 'utf8')) as Snapshot) : null;
}

/** Fetches (or reads) everything the post for `date` needs. A saved snapshot is reused unless `refresh`. */
export async function loadSnapshot(date: string, config: Config, { refresh = false, fetchFn = fetch }: { refresh?: boolean; fetchFn?: typeof fetch } = {}): Promise<Snapshot> {
  const saved = readSnapshot(date);
  if (saved && !refresh) return saved;
  const yesterday = addDays(date, -1);
  const normalDays = sameWeekdaysBefore(yesterday);
  const points: PointDays[] = [];
  for (const p of config.points) {
    points.push({ ...p, days: await fetchDays(p.id, [yesterday, ...normalDays], config, fetchFn) });
    await pause(150);
  }
  const cabinDay = [5, 0].includes(weekday(date));
  const cabinDays = cabinDay ? sameWeekdaysBefore(date) : [];
  const cabin: PointDays[] = [];
  for (const r of cabinDay ? config.cabin : []) {
    cabin.push({ id: r.id, name: r.name, days: await fetchDays(r.id, cabinDays, config, fetchFn) });
    await pause(150);
  }
  const snap: Snapshot = { fetchedAt: new Date().toISOString(), date, yesterday, normalDays, points, cabinDays, cabin };
  fs.mkdirSync(path.dirname(file(date)), { recursive: true });
  fs.writeFileSync(file(date), JSON.stringify(snap));
  return snap;
}
