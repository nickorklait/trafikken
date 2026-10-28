// npm run brand: profile picture and tekster.txt (name, bio, intro post, launch plan) in output/brand/. One-offs, by hand.

import fs from 'node:fs';
import path from 'node:path';
import { loadConfig, paths } from '../config.ts';
import { renderPng } from '../render/render.ts';

const config = loadConfig();
const c = config.colors;
const out = path.join(paths.output, 'brand');
fs.mkdirSync(out, { recursive: true });

const avatar = (
  <div style={{ width: 1080, height: 1080, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: c.surface }}>
    <div style={{ width: 780, height: 780, borderRadius: 780, backgroundColor: c.panel, border: `14px solid ${c.accent}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width={480} height={480} viewBox="0 0 24 24">
        <path d="M5 11 L7 6 H17 L19 11 Z" fill={c.accent} />
        <path d="M3 11 H21 V17 H3 Z" fill={c.accent} />
        <circle cx="7" cy="17.5" r="2.2" fill={c.accent} />
        <circle cx="17" cy="17.5" r="2.2" fill={c.accent} />
      </svg>
    </div>
  </div>
);
fs.writeFileSync(path.join(out, 'profilbilde.png'), await renderPng(avatar, { width: 1080, height: 1080 }));

const bio = `🚗 Trafikken i Oslo-området, hver morgen kl. 7\n📊 I går mot en vanlig dag + rushtid og vær\n🏕️ Fredag: når er det roligst å dra på hytta? 👇`;
fs.writeFileSync(
  path.join(out, 'tekster.txt'),
  `PROFILNAVN
${config.brand.name} · Oslo-området

BRUKERNAVN (forslag, sjekk hva som er ledig)
@trafikken.oslo · @trafikken.i.oslo · @rushtiden.oslo

KATEGORI
Nyheter og medier (eller Lokal tjeneste)

BIO (${bio.length} av 150 tegn)
${bio}

TEKST TIL INTRO-INNLEGGET (fest det øverst)
Hvordan var trafikken i går – og når er det lurt å kjøre i dag? 🚗

Hver morgen kl. 7: gårsdagens trafikk på ${config.points.length} tellepunkter i Oslo, Bærum og Asker mot en vanlig dag,
når rushet toppet seg, og været i rushtiden i dag. Fredag: når det er roligst å dra på hytta. Søndag: når det er
roligst å kjøre hjem.

Tallene kommer fra Statens vegvesens tellepunkter og MET Norge – ingen gjetting.
Send til en som pendler, og følg for trafikken hver morgen 👇

FØRSTE UKE
Dag 1: profilbilde, navn, bio og intro-innlegget (fest det). Det første innlegget kommer automatisk kl. 7.
Dag 1–3: følg lokale kontoer i Oslo, Bærum og Asker (aviser, kommuner, nabolag), og kommenter nyttig på
  trafikk- og kø-innlegg («Ring 3 var 6 % under normalen i går»).
Hver fredag: del hytte-innlegget i story – det er dagen folk deler det videre.
Etter 2–3 uker: tilby sponsorplassen («Sponset av») til lokale bilforhandlere, verksteder, dekkhoteller eller
  ladeoperatører – med tall fra vekstrapporten.
Mål første måned: 500–1 000 følgere (pendlere er mange, og innholdet er nytt hver dag).
`,
);
console.log(`Brand files in ${path.relative(process.cwd(), out)}: profilbilde.png, tekster.txt`);
