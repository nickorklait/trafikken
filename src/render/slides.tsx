// The daily post: yesterday against a normal day (cover), the rush hours with today's weather, and on
// Fridays and Sundays the cabin traffic. Norwegian, for commuters in the Oslo area.

import type { ReactNode } from 'react';
import { fmt, hourSpan, quietText, signed } from '../caption.ts';
import type { Config } from '../config.ts';
import { dayText, DAYS_PLURAL, weekday } from '../dates.ts';
import type { Rush } from '../data/weather.ts';
import { CABIN_HOURS, type DaySummary } from '../summary.ts';
import { SIZES, type Format } from './render.ts';

export const DISPLAY = 'Barlow Condensed';
export const TEXT = 'Inter';
export const hh = (h: number) => String(h).padStart(2, '0');
const tone = (diff: number, c: Config['colors']) => (diff > 0 ? c.up : diff < 0 ? c.down : c.muted);

function Car({ size, c }: { size: number; c: Config['colors'] }) {
  return (
    <div style={{ width: size, height: size, borderRadius: size, backgroundColor: c.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <svg width={size * 0.6} height={size * 0.6} viewBox="0 0 24 24">
        <path d="M5 11 L7 6 H17 L19 11 Z" fill={c.surface} />
        <path d="M3 11 H21 V17 H3 Z" fill={c.surface} />
        <circle cx="7" cy="17.5" r="2.2" fill={c.surface} />
        <circle cx="17" cy="17.5" r="2.2" fill={c.surface} />
      </svg>
    </div>
  );
}

function Frame({ config, format, kicker, footnote, children }: { config: Config; format: Format; kicker: string; footnote: string; children: ReactNode }) {
  const c = config.colors;
  const { width, height } = SIZES[format];
  const story = format === 'story';
  return (
    <div style={{ width, height, display: 'flex', flexDirection: 'column', backgroundColor: c.surface, color: c.text, fontFamily: TEXT }}>
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: `${story ? 200 : 56}px 56px 0` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <Car size={64} c={c} />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontWeight: 800, fontSize: 24, letterSpacing: 3, textTransform: 'uppercase' }}>{config.brand.name}</span>
            <span style={{ fontWeight: 600, fontSize: 20, letterSpacing: 2, color: c.muted, textTransform: 'uppercase' }}>{kicker}</span>
          </div>
        </div>
        {children}
        <span style={{ fontSize: 17, color: c.muted, marginTop: 'auto', marginBottom: 14, lineHeight: 1.4 }}>{footnote}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 24, backgroundColor: '#ffffff', padding: '20px 56px', marginBottom: story ? 190 : 0 }}>
        <span style={{ fontWeight: 600, fontSize: 15, letterSpacing: 2, color: '#6b7280', textTransform: 'uppercase' }}>{config.sponsor.label}</span>
        <div style={{ display: 'flex', flex: 1, height: 64, alignItems: 'center', justifyContent: 'center', border: `3px dashed ${c.surface}`, borderRadius: 12 }}>
          <span style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 30, color: c.surface, textTransform: 'uppercase' }}>{config.sponsor.text}</span>
        </div>
      </div>
    </div>
  );
}

const footnote = (s: DaySummary, config: Config) =>
  `Kjøretøy i begge retninger på faste tellepunkter. Normal: snittet av de siste ${s.normalDays.length} ${DAYS_PLURAL[weekday(s.yesterday)]} uten helligdager. ${config.source.traffic}.`;

export function Cover({ s, config, format }: { s: DaySummary; config: Config; format: Format }) {
  const c = config.colors;
  const story = format === 'story';
  const max = Math.max(10, ...s.rows.map((r) => Math.abs(r.diff)));
  const row = story ? 78 : 64;
  return (
    <Frame config={config} format={format} kicker={`I går · ${dayText(s.yesterday)}`} footnote={footnote(s, config)}>
      <span style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: story ? 200 : 170, lineHeight: 0.9, marginTop: story ? 40 : 24, color: tone(s.diff, c) }}>{signed(s.diff)}</span>
      <span style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: story ? 64 : 54, lineHeight: 1, textTransform: 'uppercase' }}>{s.diff === 0 ? `Som en vanlig ${s.weekdayName}` : `${s.diff > 0 ? 'Mer' : 'Mindre'} trafikk enn en vanlig ${s.weekdayName}`}</span>
      <span style={{ fontSize: story ? 30 : 26, color: c.muted, marginTop: 10 }}>{`${fmt(s.total)} kjøretøy på ${s.rows.length} tellepunkter${s.holiday ? ` · ${s.holiday}` : ''}`}</span>
      <div style={{ display: 'flex', flexDirection: 'column', marginTop: story ? 44 : 28, backgroundColor: c.panel, borderRadius: 16, padding: '10px 22px' }}>
        {s.rows.map((r) => (
          <div key={r.name} style={{ display: 'flex', alignItems: 'center', height: row, borderBottom: `1px solid ${c.line}` }}>
            <span style={{ width: 330, fontWeight: 600, fontSize: story ? 28 : 25 }}>{r.name}</span>
            <span style={{ width: 150, fontSize: story ? 24 : 21, color: c.muted, textAlign: 'right' }}>{fmt(r.yesterday)}</span>
            {/* Diverging bar: less to the left of the middle line, more to the right. */}
            <div style={{ display: 'flex', flex: 1, alignItems: 'center', marginLeft: 26, height: 30 }}>
              <div style={{ display: 'flex', flex: 1, justifyContent: 'flex-end' }}>{r.diff < 0 && <div style={{ width: `${(Math.abs(r.diff) / max) * 100}%`, height: 22, backgroundColor: c.down, borderRadius: '6px 0 0 6px' }} />}</div>
              <div style={{ width: 2, height: 34, backgroundColor: c.muted }} />
              <div style={{ display: 'flex', flex: 1 }}>{r.diff > 0 && <div style={{ width: `${(r.diff / max) * 100}%`, height: 22, backgroundColor: c.up, borderRadius: '0 6px 6px 0' }} />}</div>
            </div>
            <span style={{ width: 110, textAlign: 'right', fontWeight: 800, fontSize: story ? 28 : 25, color: tone(r.diff, c) }}>{signed(r.diff)}</span>
          </div>
        ))}
      </div>
    </Frame>
  );
}

function RushPanel({ r, c, story }: { r: Rush; c: Config['colors']; story: boolean }) {
  const icon = { snø: '❄', sludd: '❄', regn: '☂', opphold: '☀' }[r.sky];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, backgroundColor: c.panel, borderRadius: 16, padding: '14px 20px', border: r.sky === 'snø' || r.sky === 'sludd' ? `2px solid ${c.accent}` : 'none' }}>
      <span style={{ fontWeight: 600, fontSize: 20, color: c.muted }}>{`I dag, ${r.label} (kl. ${hh(r.hours[0])}–${hh(r.hours[r.hours.length - 1] + 1)})`}</span>
      <span style={{ fontWeight: 800, fontSize: story ? 44 : 38, marginTop: 4 }}>{`${r.temp}° · ${r.sky}`}</span>
      {r.sky !== 'opphold' && <span style={{ fontSize: 20, color: c.muted }}>{`${String(r.precipitation).replace('.', ',')} mm ${icon}`}</span>}
    </div>
  );
}

export function RushHour({ s, config, format }: { s: DaySummary; config: Config; format: Format }) {
  const c = config.colors;
  const story = format === 'story';
  const hours = Array.from({ length: 18 }, (_, i) => 5 + i);
  const max = Math.max(...hours.map((h) => Math.max(s.hourly.yesterday[h], s.hourly.normal[h])), 1);
  const h = story ? 560 : 470;
  const peaks = new Set([s.morning.yesterday.hour, s.afternoon.yesterday.hour]);
  const rush = [s.weather?.morning, s.weather?.afternoon].filter((r): r is Rush => !!r);
  return (
    <Frame config={config} format={format} kicker={`Rushtiden i går · ${dayText(s.yesterday)}`} footnote={`Kjøretøy per time, alle tellepunktene til sammen. Strek: en vanlig ${s.weekdayName}. ${config.source.traffic}. ${config.source.met}.`}>
      <span style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: story ? 104 : 88, lineHeight: 0.95, marginTop: 24, textTransform: 'uppercase' }}>Rushtiden</span>
      <span style={{ fontSize: story ? 28 : 24, color: c.muted, marginTop: 8 }}>{`Travlest kl. ${hourSpan(s.morning.yesterday.hour)} (${fmt(s.morning.yesterday.volume)}) og ${hourSpan(s.afternoon.yesterday.hour)} (${fmt(s.afternoon.yesterday.volume)})`}</span>
      <div style={{ display: 'flex', flexDirection: 'column', marginTop: story ? 40 : 26, backgroundColor: c.panel, borderRadius: 16, padding: '18px 18px 10px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: h + 40 }}>
          {hours.map((hr) => {
            const y = s.hourly.yesterday[hr];
            const n = s.hourly.normal[hr];
            return (
              <div key={hr} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', width: 48, height: h + 40, position: 'relative' }}>
                <div style={{ width: 34, height: Math.max(3, (y / max) * h), backgroundColor: peaks.has(hr) ? c.accent : c.normal, borderRadius: '5px 5px 0 0' }} />
                {/* The normal day: a white tick at its height. */}
                <div style={{ position: 'absolute', bottom: (n / max) * h, left: 2, width: 44, height: 4, backgroundColor: c.text, borderRadius: 2 }} />
              </div>
            );
          })}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: `1px solid ${c.line}`, paddingTop: 6 }}>
          {hours.map((hr) => (
            <span key={hr} style={{ width: 48, textAlign: 'center', fontSize: 17, color: c.muted }}>{hr % 2 ? '' : hh(hr)}</span>
          ))}
        </div>
      </div>
      {rush.length > 0 && <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>{rush.map((r) => <RushPanel key={r.label} r={r} c={c} story={story} />)}</div>}
    </Frame>
  );
}

export function Cabin({ s, config, format }: { s: DaySummary; config: Config; format: Format }) {
  const cab = s.cabin!;
  const c = config.colors;
  const story = format === 'story';
  const max = Math.max(...cab.total, 1);
  const h = story ? 460 : 330;
  const days = DAYS_PLURAL[weekday(s.date)];
  const out = cab.kind === 'out';
  return (
    <Frame config={config} format={format} kicker={`I dag · ${dayText(s.date)}`} footnote={`Kjøretøy per time ${out ? 'ut av' : 'inn mot'} Oslo, snitt av de siste ${cab.days.length} ${days}: ${cab.routes.map((r) => `${r.name} ved ${r.where}`).join(', ')}. Antall biler, ikke kø. ${config.source.traffic}.`}>
      <span style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: story ? 112 : 92, lineHeight: 0.92, marginTop: 24, textTransform: 'uppercase' }}>{out ? 'Skal du på hytta?' : 'Hjem fra hytta?'}</span>
      <span style={{ fontSize: story ? 30 : 26, marginTop: 14 }}>{`Flest ${out ? 'ut av byen' : 'inn mot Oslo'} kl. ${cab.busyFrom}–${cab.busyTo}`}</span>
      {quietText(cab) && <span style={{ fontWeight: 800, fontSize: story ? 34 : 30, color: c.down, marginTop: 4 }}>{quietText(cab)}</span>}
      <div style={{ display: 'flex', flexDirection: 'column', marginTop: story ? 40 : 26, backgroundColor: c.panel, borderRadius: 16, padding: '18px 18px 10px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: h + 34 }}>
          {CABIN_HOURS.map((hr, i) => {
            const busy = hr >= cab.busyFrom && hr < cab.busyTo;
            const quiet = (cab.quietBefore !== null && hr < cab.quietBefore) || (cab.quietAfter !== null && hr >= cab.quietAfter);
            return (
              <div key={hr} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', width: 72 }}>
                {hr === cab.peak.hour && <span style={{ fontWeight: 800, fontSize: 20, marginBottom: 6 }}>{fmt(cab.total[i])}</span>}
                <div style={{ width: 50, height: Math.max(3, (cab.total[i] / max) * h), backgroundColor: busy ? c.up : quiet ? c.down : c.normal, borderRadius: '6px 6px 0 0' }} />
              </div>
            );
          })}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: `1px solid ${c.line}`, paddingTop: 6 }}>
          {CABIN_HOURS.map((hr) => (
            <span key={hr} style={{ width: 72, textAlign: 'center', fontSize: 19, color: c.muted }}>{hh(hr)}</span>
          ))}
        </div>
      </div>
      {/* Each road's own busiest hour: they differ a little. */}
      <div style={{ display: 'flex', flexDirection: 'column', marginTop: 16, backgroundColor: c.panel, borderRadius: 16, padding: '8px 22px' }}>
        {cab.routes.map((r) => {
          const top = r.hours.indexOf(Math.max(...r.hours));
          return (
            <div key={r.name} style={{ display: 'flex', alignItems: 'center', height: story ? 70 : 58, borderBottom: `1px solid ${c.line}` }}>
              <span style={{ width: 330, fontWeight: 600, fontSize: story ? 27 : 24 }}>{r.name}</span>
              <span style={{ flex: 1, fontSize: story ? 23 : 20, color: c.muted }}>{`ved ${r.where}, mot ${r.heading}`}</span>
              <span style={{ fontWeight: 800, fontSize: story ? 26 : 23 }}>{`travlest ${hourSpan(CABIN_HOURS[top])}`}</span>
            </div>
          );
        })}
      </div>
    </Frame>
  );
}
