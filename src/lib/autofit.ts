import type { ComponentDef, PortDef } from './types';
import { normSize } from './geometry';

export interface FitResult {
  status: 'none' | 'ok' | 'missing';
  def?: ComponentDef;
  /** hva som trengs, i tekst */
  need?: string;
  /** alternativer brukeren kan velge mellom (rette og vinkler) */
  candidates: ComponentDef[];
  overridden?: boolean;
  /** true når det kan velges kobling her (også når ingen er nødvendig) */
  choosable?: boolean;
}

/** Hvem porten tilhører – avgjør om det trengs kobling ved lik dimensjon */
export type PortOwner = 'equip' | 'fitting' | 'python' | 'free';

interface Want { kind: 'push' | 'stem' | 'thread'; size: string; std?: string; gender?: 'M' | 'F' }
interface Query { a: Want; b: Want; text: string }

const STD_FAMILY: Record<string, string> = { BSP: 'BSP', BSPP: 'BSP', BSPT: 'BSP', NPTF: 'NPT', NPT: 'NPT', NPS: 'NPS', NPSM: 'NPS', NPSH: 'NPS' };
const fam = (s?: string) => { const u = (s ?? '').toUpperCase().replace(/[^A-Z0-9.]/g, ''); return STD_FAMILY[u] ?? u; };
const same = (a?: string, b?: string) => normSize(a) === normSize(b);

export const SERIES_PREF = ['Acetal grå (tommer)', 'Acetal hvit (tommer)', 'Acetal svart (metrisk)', 'Polypropylen hvit (tommer)', 'Messing', 'Power-koblinger', 'Clean-koblinger'];
const FAMILY_PREF = ['UC', 'RD', 'EU', 'TEU', 'EL', 'MCB', 'MC', 'MCBT', 'FAB', 'FA', 'SUC', 'FAUF', 'FAU', 'FAUN', 'FAN', 'MCF', 'MCW', 'BBC'];

function famOf(d: ComponentDef) {
  return (d.note ?? '').split(' – ')[0];
}

function portMatches(p: PortDef, w: Want): boolean {
  if (p.kind !== w.kind) return false;
  if (!same(p.size, w.size)) return false;
  if (w.kind === 'thread') {
    if (w.std && p.std && fam(w.std) !== fam(p.std)) return false;
    if (w.gender && p.gender && w.gender !== p.gender) return false;
  }
  return true;
}

export function queryFor(port: PortDef, hoseSize: string, owner: PortOwner = 'equip'): (Query & { optional?: boolean }) | null {
  const hose: Want = { kind: 'push', size: hoseSize };
  switch (port.kind) {
    case 'push':
      if (!port.size) return null;
      if (same(port.size, hoseSize)) {
        // slangen går rett inn – men på utstyr kan man velge f.eks. vinkel med stamme
        if (owner === 'fitting') return null;
        return { a: hose, b: { kind: 'stem', size: port.size }, text: `kobling ${hoseSize} i port ${port.size}`, optional: true };
      }
      return { a: hose, b: { kind: 'stem', size: port.size }, text: `overgang ${hoseSize} → ${port.size}` };
    case 'tube':
      // slange mot slange (f.eks. pytonrør) trenger alltid skjøt
      if (!port.size) return null;
      return { a: hose, b: { kind: 'push', size: port.size }, text: `skjøt ${hoseSize} → ${port.size}` };
    case 'stem':
      return { a: hose, b: { kind: 'push', size: port.size }, text: `skjøt for stamme ${port.size}` };
    case 'thread': {
      const g = port.gender === 'M' ? 'F' : port.gender === 'F' ? 'M' : undefined;
      return {
        a: hose,
        b: { kind: 'thread', size: port.size, std: port.std, gender: g },
        text: `${g === 'F' ? 'hunn' : g === 'M' ? 'hann' : ''}gjenge ${[port.std, port.size].filter(Boolean).join(' ')} → slange ${hoseSize}`,
      };
    }
    default:
      return null;
  }
}

const cache = new WeakMap<ComponentDef[], Map<string, ComponentDef[]>>();

export function findFittings(q: Query, lib: ComponentDef[]): ComponentDef[] {
  let m = cache.get(lib);
  if (!m) { m = new Map(); cache.set(lib, m); }
  const key = JSON.stringify(q);
  const hit = m.get(key);
  if (hit) return hit;
  const out: ComponentDef[] = [];
  for (const d of lib) {
    if (d.group === 'Utstyr' || d.ports.length !== 2) continue;
    const [p1, p2] = d.ports;
    if ((portMatches(p1, q.a) && portMatches(p2, q.b)) || (portMatches(p2, q.a) && portMatches(p1, q.b))) out.push(d);
  }
  const rank = (d: ComponentDef) => {
    const si = SERIES_PREF.indexOf(d.category);
    const fi = FAMILY_PREF.indexOf(famOf(d));
    const valve = d.symbol !== 'fit' ? 50 : 0;
    const elbow = isUBend(d) ? 30 : d.ports.some((p) => p.side === 'bottom' || p.side === 'top') ? 20 : 0;
    const exactStd = q.b.std && d.ports.some((p) => p.kind === 'thread' && (p.std ?? '').toUpperCase() === q.b.std!.toUpperCase()) ? 0 : 5;
    return (si < 0 ? 9 : si) * 1000 + valve + elbow + exactStd + (fi < 0 ? 40 : fi);
  };
  out.sort((x, y) => rank(x) - rank(y) || (x.artnr ?? '').localeCompare(y.artnr ?? ''));
  m.set(key, out);
  return out;
}

export function endFitting(port: PortDef | undefined, hoseSize: string, override: string | undefined, lib: ComponentDef[], owner: PortOwner = 'equip'): FitResult {
  if (!port || owner === 'free') return { status: 'none', candidates: [] };
  const q = queryFor(port, hoseSize, owner);
  if (!q) return { status: 'none', candidates: [] };
  const candidates = findFittings(q, lib);
  const choosable = candidates.length > 0;
  if (override === 'none') return { status: 'none', need: q.text, candidates, choosable, overridden: true };
  if (override) {
    const d = lib.find((x) => x.id === override);
    if (d) return { status: 'ok', def: d, need: q.text, candidates, overridden: true, choosable: true };
  }
  if (q.optional) return { status: 'none', need: q.text, candidates, choosable };
  if (!candidates.length) return { status: 'missing', need: q.text, candidates };
  return { status: 'ok', def: candidates[0], need: q.text, candidates, choosable };
}

const horiz = (s: string) => s === 'left' || s === 'right';
/** 90°-vinkel: to porter på sider som står vinkelrett på hverandre */
export function isElbow(d: ComponentDef): boolean {
  return d.ports.length === 2 && horiz(d.ports[0].side) !== horiz(d.ports[1].side);
}
/** U-bend: begge portene på samme side */
export function isUBend(d: ComponentDef): boolean {
  return d.ports.length === 2 && d.ports[0].side === d.ports[1].side;
}

/** Kort navn for tegningen med dimensjoner: «Vinkel 3/8"», «Rett skjøt 3/8" – 1/2"» */
export function fitLabel(d: ComponentDef): string {
  if (d.generic) return `${d.name} (størrelse ?)`;
  if (/\d/.test(d.name)) return d.name.replace(/ × /g, ' – ');
  const sizes: string[] = [];
  for (const p of d.ports) {
    const t = (p.kind === 'thread' && p.std ? p.std + ' ' : '') + p.size;
    if (p.size && !sizes.includes(t)) sizes.push(t);
  }
  return sizes.length ? `${d.name} ${sizes.join(' – ')}` : d.name;
}

/** Grå acetal i 5/16, 3/8 og 1/2 – det som brukes mest */
const STD_SIZES = new Set(['5/16', '3/8', '1/2']);
export const STANDARD_GROUPS: { title: string; fams: string[]; cats: string[] }[] = [
  { title: 'Rette skjøter', fams: ['UC'], cats: ['Acetal grå (tommer)'] },
  { title: 'Vinkler', fams: ['EU'], cats: ['Acetal grå (tommer)'] },
  { title: 'T-stykker', fams: ['TU'], cats: ['Acetal grå (tommer)'] },
  { title: 'Y-stykker', fams: ['TWD'], cats: ['Acetal grå (tommer)'] },
  { title: 'U-bend', fams: ['UB'], cats: ['Acetal grå (tommer)'] },
  { title: 'Håndventiler', fams: ['HUC', 'HUCS', 'HVEU'], cats: ['Håndventiler'] },
  { title: 'Reduksjoner', fams: ['RD'], cats: ['Acetal grå (tommer)'] },
];

export function isStandard(d: ComponentDef): string | null {
  if (d.source !== 'dmfit') return null;
  const f = famOf(d);
  for (const g of STANDARD_GROUPS) {
    if (!g.fams.includes(f) || !g.cats.includes(d.category)) continue;
    if (!d.ports.every((p) => STD_SIZES.has(p.size.replace(/"/g, '')))) continue;
    return g.title;
  }
  return null;
}

/** Nøkkel for en port-type (brukes for å finne likeverdige koblinger) */
function specKey(p: PortDef): string {
  return [p.kind, normSize(p.size), p.kind === 'thread' ? fam(p.std) : '', p.kind === 'thread' ? p.gender ?? '' : ''].join('|');
}

/** Andre koblinger med samme porter (rett ↔ vinkel, T ↔ Y osv.) */
export function alternatives(def: ComponentDef, lib: ComponentDef[]): ComponentDef[] {
  if (def.group === 'Utstyr' || def.ports.length < 2) return [];
  const want = def.ports.map(specKey).sort().join(',');
  const out = lib.filter((d) => d.group !== 'Utstyr' && d.ports.length === def.ports.length && d.ports.map(specKey).sort().join(',') === want);
  const rank = (d: ComponentDef) => {
    const si = SERIES_PREF.indexOf(d.category);
    return (d.category === def.category ? 0 : 1) * 10000 + (si < 0 ? 9 : si) * 1000 + (d.symbol !== 'fit' ? 50 : 0) + (isElbow(d) ? 20 : 0);
  };
  return out.sort((a, b) => rank(a) - rank(b) || (a.artnr ?? '').localeCompare(b.artnr ?? ''));
}

/** Hvilken port i ny komponent svarer til hver port i den gamle */
export function portMapping(from: ComponentDef, to: ComponentDef): Record<string, string> {
  const map: Record<string, string> = {};
  const free = [...to.ports];
  for (const p of from.ports) {
    const i = free.findIndex((q) => specKey(q) === specKey(p));
    if (i >= 0) { map[p.id] = free[i].id; free.splice(i, 1); }
  }
  return map;
}
