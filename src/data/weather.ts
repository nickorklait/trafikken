// Today's weather in the rush hours, from MET Norway's locationforecast (CC BY 4.0): it explains slow
// mornings (snow, rain, ice) and is the part of the post people act on.

import type { Config } from '../config.ts';

export type Sky = 'snø' | 'sludd' | 'regn' | 'opphold';

export interface Rush {
  label: 'morgenrushet' | 'ettermiddagsrushet';
  /** Oslo hours, e.g. [7, 8] = 07–09. */
  hours: number[];
  /** Whole degrees. */
  temp: number;
  /** Millimetres, one decimal. */
  precipitation: number;
  sky: Sky;
}

export interface RushWeather {
  date: string;
  morning: Rush | null;
  afternoon: Rush | null;
}

type Series = { time: string; data: { instant: { details: { air_temperature: number } }; next_1_hours?: { summary: { symbol_code: string }; details: { precipitation_amount: number } } } }[];

const osloHour = (iso: string) => {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Oslo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) };
};

/** The most telling sky in the hours: snow over sleet over rain (0.2 mm or more counts as wet). */
export function skyOf(symbols: string[], precipitation: number): Sky {
  if (precipitation < 0.2) return 'opphold';
  if (symbols.some((s) => s.includes('snow'))) return 'snø';
  if (symbols.some((s) => s.includes('sleet'))) return 'sludd';
  return 'regn';
}

export function rushFrom(series: Series, date: string, label: Rush['label'], hours: number[]): Rush | null {
  const steps = series.filter((s) => {
    const t = osloHour(s.time);
    return t.date === date && hours.includes(t.hour) && s.data.next_1_hours;
  });
  if (steps.length < hours.length) return null;
  const precipitation = Math.round(steps.reduce((sum, s) => sum + s.data.next_1_hours!.details.precipitation_amount, 0) * 10) / 10;
  return {
    label,
    hours,
    // "|| 0": never "-0°".
    temp: Math.round(steps.reduce((sum, s) => sum + s.data.instant.details.air_temperature, 0) / steps.length) || 0,
    precipitation,
    sky: skyOf(steps.map((s) => s.data.next_1_hours!.summary.symbol_code), precipitation),
  };
}

/** Never fails the post: without the forecast the weather line is left out. */
export async function loadRushWeather(date: string, config: Config, fetchFn: typeof fetch = fetch): Promise<RushWeather | null> {
  try {
    const { lat, lon } = config.weather;
    const res = await fetchFn(`https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${lat}&lon=${lon}`, { headers: { 'User-Agent': config.source.userAgent } });
    if (!res.ok) throw new Error(`MET answered ${res.status}`);
    const series = ((await res.json()) as { properties: { timeseries: Series } }).properties.timeseries;
    return { date, morning: rushFrom(series, date, 'morgenrushet', [7, 8]), afternoon: rushFrom(series, date, 'ettermiddagsrushet', [15, 16]) };
  } catch (e) {
    console.warn(`  ! No weather (${(e as Error).message}); the post goes out without it.`);
    return null;
  }
}
