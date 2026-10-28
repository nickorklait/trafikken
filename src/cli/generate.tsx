// npm run generate [-- --date 2026-10-28] [--refresh]
// Today's post about yesterday's traffic: fetches the counts (saved in data/traffic/<date>.json; --refresh
// fetches again) and today's rush-hour weather, checks them, and renders the cover, the rush hours and on
// Fridays and Sundays the cabin traffic (feed + story) and the caption to output/<date>/.

import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { caption, factCheck } from '../caption.ts';
import { loadConfig, paths } from '../config.ts';
import { osloToday } from '../dates.ts';
import { loadSnapshot } from '../data/traffic.ts';
import { loadRushWeather } from '../data/weather.ts';
import { renderPng, SIZES } from '../render/render.ts';
import { Cabin, Cover, RushHour } from '../render/slides.tsx';
import { updateStatus } from '../status.ts';
import { summarize } from '../summary.ts';

const { values: args } = parseArgs({ options: { date: { type: 'string' }, refresh: { type: 'boolean', default: false } } });
const config = loadConfig();
const date = args.date ?? osloToday();

// The weather is today's forecast; for an older date it is left out rather than shown wrong.
const weather = date === osloToday() ? await loadRushWeather(date, config) : null;
let s = summarize(await loadSnapshot(date, config, { refresh: args.refresh }), config, weather);
// A saved snapshot from an early run may have caught yesterday before it was fully counted: fetch once more.
if (s.validation.errors.length && !args.refresh) s = summarize(await loadSnapshot(date, config, { refresh: true }), config, weather);
const v = s.validation;
updateStatus('generate', { date, total: s.total, diff: s.diff, passed: v.passed.length, errors: v.errors, warnings: v.warnings });
console.log(`${date} (traffic ${s.yesterday}): ${s.total} vehicles, ${s.diff} % against normal; ${v.passed.length} checks passed`);
for (const w of v.warnings) console.warn(`  ! ${w}`);
if (v.errors.length) throw new Error(`Traffic data failed the checks: ${v.errors.join('; ')}`);

const text = caption(s, config);
const problems = factCheck(text, s);
if (problems.length) throw new Error(`Caption failed the fact-check: ${problems.join('; ')}`);

const outDir = path.join(paths.output, date);
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });
const images = { feed: [] as string[], story: [] as string[] };
// Fridays and Sundays the cabin traffic comes first: it is what people plan the day by.
const slides = [...(s.cabin ? [['hytta', Cabin] as const] : []), ['igar', Cover] as const, ['rushtid', RushHour] as const];
for (const [i, [name, Slide]] of slides.entries()) {
  for (const format of ['feed', 'story'] as const) {
    const file = `trafikken_${date}_${i + 1}_${name}${format === 'story' ? '_story' : ''}.png`;
    fs.writeFileSync(path.join(outDir, file), await renderPng(<Slide s={s} config={config} format={format} />, SIZES[format]));
    images[format].push(file);
  }
}
fs.writeFileSync(path.join(outDir, 'post.json'), JSON.stringify({ date, images, caption: text, total: s.total, diff: s.diff, rows: s.rows, cabin: s.cabin, weather: s.weather, validation: v }, null, 2));
fs.writeFileSync(path.join(outDir, 'caption.txt'), text);
console.log(`  ✓ ${images.feed.join(', ')}\n\n${text}\n\n(${text.length} characters)`);
