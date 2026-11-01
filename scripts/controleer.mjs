// Controle van de schemabibliotheek. Dezelfde regels als de import in de app (src/schemaimport.js en
// src/intervalregels.js in Moto Service Check) en dezelfde vergelijkregel als de app (#92). Houd ze gelijk.
// Gebruik: node scripts/controleer.mjs   (geen afhankelijkheden; Node 18+)
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MAX_KM = 500000;
const MAX_MAANDEN = 240;
const MAX_NAAM = 40;
const MAX_ONDERDELEN = 100;
const MAX_BESTAND_BYTES = 1024 * 1024;

const geheel = (x) => typeof x === 'number' && Number.isInteger(x);
/** Vergelijkregel: hoofdletters, zonder accenten, alleen letters en cijfers. */
export const normaliseer = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const naamSleutel = (s) => String(s ?? '').trim().toLocaleLowerCase('nl');

const fouten = [];
const fout = (waar, tekst) => fouten.push(`${waar}: ${tekst}`);

function intervalFout(waarde, max, veld) {
  if (waarde == null) return null;
  if (!geheel(waarde)) return `${veld} moet een geheel getal zijn (of null)`;
  if (waarde < 1) return `${veld} moet minstens 1 zijn`;
  if (waarde > max) return `${veld} is te groot (maximaal ${max})`;
  return null;
}

export function controleerSchema(data, waar) {
  if (!data || typeof data !== 'object' || Array.isArray(data) || data.formaat !== 'moto-service-schema') {
    return fout(waar, '"formaat" moet "moto-service-schema" zijn');
  }
  if (data.versie !== 1) fout(waar, '"versie" moet 1 zijn');
  if (typeof data.naam !== 'string' || !data.naam.trim()) fout(waar, '"naam" ontbreekt');
  if (typeof data.bron !== 'string' || !data.bron.trim()) fout(waar, '"bron" ontbreekt (handleiding en pagina\'s)');
  if (!Array.isArray(data.onderdelen) || !data.onderdelen.length) return fout(waar, '"onderdelen" ontbreekt of is leeg');
  if (data.onderdelen.length > MAX_ONDERDELEN) fout(waar, `te veel onderdelen (maximaal ${MAX_ONDERDELEN})`);
  const namen = new Set();
  const codes = new Set();
  data.onderdelen.forEach((o, i) => {
    const w = `${waar}, onderdeel ${i + 1}${o?.naam ? ` (${o.naam})` : ''}`;
    if (!o || typeof o !== 'object' || Array.isArray(o)) return fout(w, 'geen geldig onderdeel');
    const naam = typeof o.naam === 'string' ? o.naam.trim() : '';
    if (!naam) return fout(w, 'de naam ontbreekt');
    if (naam.length > MAX_NAAM && !o.code) fout(w, `naam te lang voor een nieuw onderdeel (maximaal ${MAX_NAAM} tekens)`);
    const km = intervalFout(o.intervalKm, MAX_KM, 'intervalKm');
    const mnd = intervalFout(o.intervalMaanden, MAX_MAANDEN, 'intervalMaanden');
    if (km) fout(w, km);
    if (mnd) fout(w, mnd);
    if (!km && !mnd && o.intervalKm == null && o.intervalMaanden == null) fout(w, 'geen interval (intervalKm en/of intervalMaanden)');
    if (o.code != null && (typeof o.code !== 'string' || !o.code.trim())) fout(w, '"code" moet tekst zijn');
    for (const veld of ['actie', 'toelichting', 'bron']) {
      if (o[veld] != null && typeof o[veld] !== 'string') fout(w, `"${veld}" moet tekst zijn`);
    }
    if (typeof o.bron !== 'string' || !o.bron.trim()) fout(w, '"bron" ontbreekt (paginanummer)');
    if (o.dagelijks != null && typeof o.dagelijks !== 'boolean') fout(w, '"dagelijks" moet true of false zijn');
    const sleutel = naamSleutel(naam);
    if (namen.has(sleutel)) fout(w, 'naam komt twee keer voor');
    namen.add(sleutel);
    if (typeof o.code === 'string' && o.code.trim()) {
      if (codes.has(o.code.trim())) fout(w, `code "${o.code}" komt twee keer voor`);
      codes.add(o.code.trim());
    }
  });
}

function leesJson(pad, waar) {
  if (!existsSync(pad)) { fout(waar, 'bestand bestaat niet'); return null; }
  const tekst = readFileSync(pad);
  if (tekst.length > MAX_BESTAND_BYTES) { fout(waar, 'bestand groter dan 1 MB'); return null; }
  try { return JSON.parse(tekst.toString('utf8').replace(/^﻿/, '')); } catch (e) { fout(waar, `geen geldige JSON (${e.message})`); return null; }
}

const index = leesJson(resolve(ROOT, 'index.json'), 'index.json');
if (index) {
  if (index.formaat !== 'moto-service-bibliotheek') fout('index.json', '"formaat" moet "moto-service-bibliotheek" zijn');
  if (index.versie !== 1) fout('index.json', '"versie" moet 1 zijn');
  if (!Array.isArray(index.schemas)) fout('index.json', '"schemas" moet een lijst zijn');
  const ids = new Set();
  const reeksen = [];
  (index.schemas ?? []).forEach((s, i) => {
    const w = `index.json, schema ${i + 1}${s?.id ? ` (${s.id})` : ''}`;
    if (!s || typeof s !== 'object') return fout(w, 'geen geldig item');
    if (typeof s.id !== 'string' || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(s.id)) fout(w, '"id" moet kleine letters, cijfers en streepjes zijn');
    else if (ids.has(s.id)) fout(w, 'id komt twee keer voor');
    ids.add(s.id);
    if (typeof s.naam !== 'string' || !s.naam.trim()) fout(w, '"naam" ontbreekt');
    if (!normaliseer(s.merk)) fout(w, '"merk" ontbreekt');
    if (!Array.isArray(s.typen) || !s.typen.length || s.typen.some((t) => !normaliseer(t))) fout(w, '"typen" moet een lijst met minstens één typenaam zijn');
    if (!geheel(s.bouwjaarVan) || s.bouwjaarVan < 1900) fout(w, '"bouwjaarVan" moet een jaartal zijn');
    if (s.bouwjaarTot !== null && (!geheel(s.bouwjaarTot) || s.bouwjaarTot < s.bouwjaarVan)) fout(w, '"bouwjaarTot" moet een jaartal ≥ bouwjaarVan zijn, of null');
    if (!geheel(s.schemaVersie) || s.schemaVersie < 1) fout(w, '"schemaVersie" moet een geheel getal ≥ 1 zijn');
    if (typeof s.bestand !== 'string' || !s.bestand.startsWith('schemas/') || !s.bestand.endsWith('.json')) fout(w, '"bestand" moet schemas/<naam>.json zijn');
    else {
      const schema = leesJson(resolve(ROOT, s.bestand), s.bestand);
      if (schema) controleerSchema(schema, s.bestand);
    }
    if (Array.isArray(s.typen) && geheel(s.bouwjaarVan)) {
      const tot = s.bouwjaarTot ?? 9999;
      for (const type of new Set(s.typen.map(normaliseer))) {
        for (const r of reeksen) {
          if (r.merk === normaliseer(s.merk) && r.type === type && s.bouwjaarVan <= r.tot && r.van <= tot) {
            fout(w, `bouwjaren overlappen met "${r.id}" voor ${s.merk} ${type}`);
          }
        }
        reeksen.push({ id: s.id, merk: normaliseer(s.merk), type, van: s.bouwjaarVan, tot });
      }
    }
  });
}

if (fouten.length) {
  console.error(`✗ ${fouten.length} fout(en):\n- ${fouten.join('\n- ')}`);
  process.exit(1);
}
console.log(`✓ Bibliotheek in orde (${index?.schemas?.length ?? 0} schema's).`);
