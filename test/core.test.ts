import { test } from 'node:test';
import assert from 'node:assert/strict';
import { caption, factCheck } from '../src/caption.ts';
import { loadConfig } from '../src/config.ts';
import { easter, holidayName, osloMidnight } from '../src/dates.ts';
import { sameWeekdaysBefore, type Day, type Snapshot } from '../src/data/traffic.ts';
import { rushFrom, skyOf } from '../src/data/weather.ts';
import { summarize } from '../src/summary.ts';

const config = loadConfig();

test('Oslo midnight with the right offset, Easter and the public holidays', () => {
  assert.equal(osloMidnight('2026-10-24'), '2026-10-24T00:00:00+02:00');
  assert.equal(osloMidnight('2026-10-26'), '2026-10-26T00:00:00+01:00');
  assert.equal(easter(2026), '2026-04-05');
  assert.equal(easter(2027), '2027-03-28');
  assert.equal(holidayName('2026-05-14'), 'Kristi himmelfartsdag');
  assert.equal(holidayName('2026-04-02'), 'skjærtorsdag');
  assert.equal(holidayName('2026-10-27'), null);
  // The normal day skips holidays: the Tuesday after Easter is a working day, 2. påskedag (Monday) is not.
  assert.ok(!sameWeekdaysBefore('2026-04-13').includes('2026-04-06'));
});

/** A flat day: `total` spread evenly over hours 6–21, `perHour` per direction. */
const day = (date: string, total: number, coverage = 100, directions: Record<string, (number | null)[]> = {}): Day => {
  const hours = Array(24).fill(0).map((_, h) => (h >= 6 && h < 22 ? total / 16 : 0));
  return { date, total, coverage, hours, directions };
};

const normal = ['2026-10-20', '2026-10-13', '2026-10-06', '2026-09-29', '2026-09-22'];
function snapshot(yesterdayTotals: number[], o: Partial<Snapshot> = {}): Snapshot {
  return {
    fetchedAt: '',
    date: '2026-10-28',
    yesterday: '2026-10-27',
    normalDays: normal,
    points: config.points.map((p, i) => ({ ...p, days: [day('2026-10-27', yesterdayTotals[i] ?? 80000, yesterdayTotals[i] === 0 ? 0 : 100), ...normal.map((d) => day(d, 80000))] })),
    cabinDays: [],
    cabin: [],
    ...o,
  };
}

test('yesterday against the normal: per point and in total, incomplete points left out of both', () => {
  const s = summarize(snapshot([88000, 72000]), config);
  assert.deepEqual(s.rows.slice(0, 2).map((r) => [r.yesterday, r.normal, r.diff]), [[88000, 80000, 10], [72000, 80000, -10]]);
  assert.equal(s.normalDays.length, 4);
  assert.equal(s.diff, 0);
  assert.deepEqual(s.validation.errors, []);
  const gap = summarize(snapshot([0, 80000, 0, 80000, 80000, 80000, 80000, 80000]), config);
  assert.equal(gap.rows.length, 6);
  assert.match(gap.validation.warnings[0], /utelatt/);
  assert.match(summarize(snapshot([0, 0, 0, 80000]), config).validation.errors[0], /bare 5 av 8/);
});

test('the caption only uses numbers from the data, and the fact-check catches anything else', () => {
  const s = summarize(snapshot([88000, 72000, 80000, 80000, 80000, 80000, 80000, 84000]), config);
  const text = caption(s, config);
  assert.match(text, /Trafikken i går, tirsdag 27\. oktober/);
  assert.match(text, /Mest over normalen: E18 Slependen \(\+10 %\)/);
  assert.match(text, /Mest under normalen: E18 Høvik \(−10 %\)/);
  assert.deepEqual(factCheck(text, s), []);
  assert.deepEqual(factCheck(`${text}\nRundt 123 456 biler`, s), ['number "123456" is not in the data']);
});

test('Friday: the busy hours out of town and when it is quieter', () => {
  const route = config.cabin[0];
  const out = Array(24).fill(0).map((_, h) => [100, 120, 160, 180, 200, 190, 150, 100, 70, 50, 40, 30][h - 10] ?? 0);
  const cabinDays = ['2026-10-23', '2026-10-16', '2026-10-09'];
  const s = summarize(snapshot([], { date: '2026-10-30', yesterday: '2026-10-29', cabinDays, cabin: [{ ...route, days: cabinDays.map((d) => day(d, 50000, 100, { [route.out]: out, [route.home]: out })) }] }), config);
  assert.equal(s.cabin?.kind, 'out');
  assert.deepEqual([s.cabin?.peak.hour, s.cabin?.busyFrom, s.cabin?.busyTo, s.cabin?.quietBefore, s.cabin?.quietAfter], [14, 13, 16, 12, 17]);
  const text = caption(s, config);
  assert.match(text, /De siste tre fredagene kjørte flest ut av byen mellom kl\. 13 og 16\. Roligere før kl\. 12 eller fra kl\. 17\./);
  assert.deepEqual(factCheck(text, s), []);
});

test('rush-hour weather: snow beats rain, dry under 0.2 mm, the morning from the 07 and 08 steps', () => {
  assert.equal(skyOf(['lightsnow', 'rain'], 1), 'snø');
  assert.equal(skyOf(['rain'], 0.1), 'opphold');
  const step = (time: string, temp: number, mm: number, sym: string) => ({ time, data: { instant: { details: { air_temperature: temp } }, next_1_hours: { summary: { symbol_code: sym }, details: { precipitation_amount: mm } } } });
  const r = rushFrom([step('2026-10-28T06:00:00Z', -1, 0.4, 'lightsnow'), step('2026-10-28T07:00:00Z', 0, 0.3, 'sleet')], '2026-10-28', 'morgenrushet', [7, 8]);
  assert.deepEqual(r, { label: 'morgenrushet', hours: [7, 8], temp: 0, precipitation: 0.7, sky: 'snø' });
  assert.equal(rushFrom([step('2026-10-28T06:00:00Z', 1, 0, 'cloudy')], '2026-10-28', 'morgenrushet', [7, 8]), null);
});
