import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const paths = {
  fonts: path.join(ROOT, 'assets', 'fonts'),
  output: path.join(ROOT, 'output'),
  data: path.join(ROOT, 'data'),
};

/** A traffic registration point (trafikkdata.no) and the name we show. */
export interface Point {
  id: string;
  name: string;
}

/** A road out of town, counted in one direction: `out` towards the cabins (Friday), `home` back (Sunday). */
export interface CabinRoute extends Point {
  where: string;
  out: string;
  home: string;
}

export interface Config {
  brand: { name: string; tagline: string; hashtags: string[] };
  points: Point[];
  cabin: CabinRoute[];
  weather: { name: string; lat: number; lon: number };
  source: { traffic: string; met: string; short: string; userAgent: string };
  colors: { surface: string; panel: string; line: string; text: string; muted: string; accent: string; up: string; down: string; normal: string };
  sponsor: { label: string; text: string };
}

export function loadConfig(): Config {
  return JSON.parse(fs.readFileSync(path.join(ROOT, 'config', 'config.json'), 'utf8'));
}
