import type { Edge, Node } from '@xyflow/react';
import type { ComponentDef, HoseData, PortDef, PythonDef, Warning } from './types';
import { pythonEndDef } from './python';
import { mediumName, KIND_SHORT } from './constants';
import { normSize } from './geometry';
import { endFitting, type FitResult, type PortOwner } from './autofit';

export const HOSE_END_SIZE = 20;
const HOSE_END_DEF: ComponentDef = {
  id: '__hoseEnd', name: 'Åpen slangeende', group: 'Fri', category: 'Fri', symbol: 'none', w: HOSE_END_SIZE, h: HOSE_END_SIZE, source: 'start',
  ports: [{ id: 'p', name: 'Åpen ende', side: 'left', pos: 0.5, kind: 'other', size: '', medium: 'any' }],
};

const medCache = new WeakMap<ComponentDef, Map<string, ComponentDef>>();
/** Komponent med valgt medium på porter som ellers tar alle medier */
export function withMedium(def: ComponentDef, medium?: string): ComponentDef {
  if (!medium || medium === 'auto' || medium === 'any') return def;
  let m = medCache.get(def);
  if (!m) { m = new Map(); medCache.set(def, m); }
  let d = m.get(medium);
  if (!d) {
    d = { ...def, ports: def.ports.map((p) => (!p.medium || p.medium === 'any' ? { ...p, medium } : p)) };
    m.set(medium, d);
  }
  return d;
}

/** Kan komponenten få valgt medium? (har porter uten fast medium) */
export function canSetMedium(def: ComponentDef): boolean {
  return def.ports.some((p) => !p.medium || p.medium === 'any');
}

/**
 * Ventiler skiller medier: på hver side kan det gå noe forskjellig
 * (f.eks. nettvann inn på sirup-/sodalinja via ventil og T-stykke når man renser).
 */
export function isMediaBreak(def: ComponentDef): boolean {
  if (def.group === 'Utstyr') return false;
  if (def.symbol === 'fit-check' || /tilbakeslag/i.test(def.name)) return true;
  return def.symbol === 'fit-valve' && def.category !== 'Stopp- og kranadaptere';
}

export function nodeDef(node: Node, pythons: PythonDef[]): ComponentDef | null {
  if (node.type === 'comp') { const d = node.data as any; return withMedium(d.def as ComponentDef, d.medium); }
  if (node.type === 'pyEnd') {
    const d = node.data as any;
    const py = pythons.find((p) => p.id === d.pythonId);
    return py ? pythonEndDef(py, d.end) : null;
  }
  if (node.type === 'hoseEnd') return HOSE_END_DEF;
  return null;
}

export function findPort(node: Node | undefined, handle: string | null | undefined, pythons: PythonDef[]): PortDef | undefined {
  if (!node || !handle) return undefined;
  const def = nodeDef(node, pythons);
  return def?.ports.find((p) => p.id === handle);
}

export function portLabel(p?: PortDef): string {
  if (!p) return '?';
  const parts = [p.name];
  const spec = (p.std && p.std === p.size ? [p.size] : [p.std, p.size]).filter(Boolean).join(' ');
  if (spec) parts.push(spec);
  if (p.kind === 'thread' && p.gender) parts.push(p.gender === 'M' ? 'hann' : 'hunn');
  else if (p.kind !== 'other') parts.push(KIND_SHORT[p.kind] ?? p.kind);
  return parts.join(' · ');
}

const STD_FAMILY: Record<string, string> = { BSP: 'BSP', BSPP: 'BSP', BSPT: 'BSP', NPTF: 'NPT', NPT: 'NPT', NPS: 'NPS', NPSM: 'NPS', NPSH: 'NPS' };
function stdFam(s?: string) {
  const u = (s ?? '').toUpperCase().replace(/[^A-Z0-9.]/g, '');
  return STD_FAMILY[u] ?? u;
}

function sameSize(a?: string, b?: string) {
  return normSize(a) === normSize(b);
}

/** Problemer med en direkte kobling (port mot port uten slange) */
export function directIssues(a: PortDef, b: PortDef): string[] {
  const out: string[] = [];
  const kinds = [a.kind, b.kind].sort().join('+');
  if (a.kind === 'other' || b.kind === 'other') return out;
  if (kinds === 'push+stem' || kinds === 'push+tube') {
    if (!sameSize(a.size, b.size)) out.push(`Dimensjon passer ikke: ${a.size} mot ${b.size}`);
  } else if (kinds === 'thread+thread') {
    if (stdFam(a.std) !== stdFam(b.std) && a.std && b.std) out.push(`Gjengetype passer ikke: ${a.std} mot ${b.std}`);
    if (!sameSize(a.size, b.size)) out.push(`Gjengedimensjon passer ikke: ${a.size} mot ${b.size}`);
    if (a.gender && b.gender && a.gender === b.gender) out.push(`Begge gjengene er ${a.gender === 'M' ? 'hann' : 'hunn'}`);
  } else if (kinds === 'push+push') {
    out.push('To push-fit-porter kan ikke kobles direkte – bruk slange eller stamme');
  } else if (kinds === 'stem+stem' || kinds === 'stem+tube' || kinds === 'tube+tube') {
    out.push('To stammer/slangeender kan ikke kobles direkte – bruk en skjøt');
  } else if (kinds === 'hosetail+tube' || kinds === 'hosetail+stem' || kinds === 'hosetail+hosetail') {
    out.push('Slangestuss trenger slange');
  } else {
    out.push(`${KIND_SHORT[a.kind]} kan ikke kobles direkte mot ${KIND_SHORT[b.kind]}`);
  }
  return out;
}

/** Problemer med en slange mot en port */
export function hosePortIssues(h: HoseData, p: PortDef): string[] {
  const out: string[] = [];
  if (p.kind === 'stem') out.push(`«${p.name}» er en stamme – den skal plugges i en push-fit-kobling, ikke ha slange`);
  else if (p.kind === 'thread') out.push(`«${p.name}» har gjenger (${[p.std, p.size].filter(Boolean).join(' ')}) – trenger adapter til push-fit`);
  else if ((p.kind === 'push' || p.kind === 'tube') && p.size && h.size && !sameSize(p.size, h.size))
    out.push(`Slange ${h.size} passer ikke i «${p.name}» (${p.size})`);
  return out;
}

class UF {
  parent = new Map<string, string>();
  find(x: string): string {
    let p = this.parent.get(x);
    if (p === undefined) { this.parent.set(x, x); return x; }
    if (p === x) return x;
    const r = this.find(p);
    this.parent.set(x, r);
    return r;
  }
  union(a: string, b: string) {
    const ra = this.find(a), rb = this.find(b);
    if (ra !== rb) this.parent.set(ra, rb);
  }
}

export interface Analysis {
  hoseMedium: Map<string, string | undefined>;
  /** smak (fra BIB) som går i slangen */
  hoseFlavor: Map<string, string>;
  /** smak i pytonslange: nøkkel «pytonId:p1» */
  tubeFlavor: Map<string, string>;
  fits: Map<string, { s: FitResult; t: FitResult }>;
  edgeWarn: Map<string, string[]>;
  nodeWarn: Map<string, string[]>;
  /** alle feil, også ignorerte (merket ignored) */
  warnings: Warning[];
  info: Warning[];
  used: Set<string>;
  /** medium per port («nodeId:portId») når det er entydig */
  portMedium: Map<string, string>;
}

const pk = (n: string, h?: string | null) => `${n}:${h ?? ''}`;

export const warnKey = (w: { target: { id: string }; text: string }) => `${w.target.id}|${w.text}`;

export function ownerOf(n?: Node): PortOwner {
  if (!n) return 'free';
  if (n.type === 'hoseEnd') return 'free';
  if (n.type === 'pyEnd') return 'python';
  const d = (n.data as any).def as ComponentDef | undefined;
  return d && d.group !== 'Utstyr' ? 'fitting' : 'equip';
}

export function analyze(nodes: Node[], edges: Edge[], pythons: PythonDef[], library: ComponentDef[] = [], autoFit = true, ignored: Set<string> = new Set()): Analysis {
  const fits = new Map<string, { s: FitResult; t: FitResult }>();
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const defs = new Map<string, ComponentDef>();
  for (const n of nodes) {
    const d = nodeDef(n, pythons);
    if (d) defs.set(n.id, d);
  }
  const uf = new UF();
  const sources = new Map<string, Set<string>>(); // punkt -> medier
  const addSrc = (pt: string, m?: string) => {
    if (!m || m === 'any' || m === 'auto') return;
    if (!sources.has(pt)) sources.set(pt, new Set());
    sources.get(pt)!.add(m);
  };

  // interne koblinger
  const valvePorts: { ports: string[]; closed: boolean }[] = [];
  for (const n of nodes) {
    const d = defs.get(n.id);
    if (!d) continue;
    const fixed = new Set(d.ports.map((p) => p.medium).filter((m) => m && m !== 'any'));
    const isFitting = n.type === 'comp' && d.group !== 'Utstyr' && fixed.size <= 1;
    // ventil: hver side har sitt eget medium
    const split = isFitting && isMediaBreak(d);
    if (split) valvePorts.push({ ports: d.ports.map((p) => pk(n.id, p.id)), closed: (n.data as any)?.sim?.open === false });
    const links = new Map<string, string>();
    for (const p of d.ports) {
      const pt = pk(n.id, p.id);
      uf.find(pt);
      addSrc(pt, p.medium);
      if (isFitting) {
        if (!split && d.ports[0]) uf.union(pt, pk(n.id, d.ports[0].id));
      } else if (p.link) {
        const key = n.type === 'pyEnd' ? `py:${(n.data as any).pythonId}:${p.link}` : `${n.id}:link:${p.link}`;
        if (links.has(key)) uf.union(pt, links.get(key)!);
        else links.set(key, pt);
        if (n.type === 'pyEnd') uf.union(pt, key);
      }
    }
  }
  const used = new Set<string>();
  for (const e of edges) {
    if (e.type === 'python') continue;
    const a = pk(e.source, e.sourceHandle), b = pk(e.target, e.targetHandle);
    used.add(a); used.add(b);
    uf.union(a, b);
    const hd = e.data as HoseData | undefined;
    if (e.type === 'hose' && hd && hd.medium && hd.medium !== 'auto') addSrc(a, hd.medium);
  }
  // medier og smaker per gruppe
  const flavorPts: [string, string][] = [];
  for (const n of nodes) {
    const fl = n.type === 'comp' ? ((n.data as any).flavor as string | undefined) : undefined;
    const d = defs.get(n.id);
    if (fl && d) for (const p of d.ports) flavorPts.push([pk(n.id, p.id), fl]);
  }
  const mediaByRoot = () => {
    const gm = new Map<string, Set<string>>();
    for (const [pt, ms] of sources) {
      const r = uf.find(pt);
      if (!gm.has(r)) gm.set(r, new Set());
      for (const m of ms) gm.get(r)!.add(m);
    }
    // eldre tegninger: «kjøl» godtas sammen med vann/kullsyrevann
    for (const set of gm.values()) if (set.has('kjol') && set.size > 1) set.delete('kjol');
    return gm;
  };
  const flavorByRoot = () => {
    const gf = new Map<string, Set<string>>();
    for (const [pt, fl] of flavorPts) {
      const r = uf.find(pt);
      if (!gf.has(r)) gf.set(r, new Set());
      gf.get(r)!.add(fl);
    }
    return gf;
  };
  // ventil: sidene henger sammen når de har samme medium (smaken følger med).
  // Der mediet byttes (f.eks. vann inn på sirupslinja for rens) holdes de adskilt.
  // En side uten eget medium får det fra ventilen ved siden av. Er det flere å velge mellom,
  // vinner linja med smak (BIB), så den som ikke er vann. Stengt ventil gir ikke medium videre.
  const key = (m?: Set<string>) => (m?.size ? [...m].sort().join('+') : '');
  for (let it = 0; it < 2 * valvePorts.length + 2; it++) {
    const gm = mediaByRoot(), gf = flavorByRoot();
    const mk = (r: string) => key(gm.get(r)), fk = (r: string) => key(gf.get(r));
    const fits = (a: string, b: string) => mk(a) === mk(b) && (!fk(a) || !fk(b) || fk(a) === fk(b));
    let merged = false;
    // 1) begge sider har medium, og det er det samme
    for (const v of valvePorts) {
      const roots = [...new Set(v.ports.map((x) => uf.find(x)))];
      if (roots.length < 2 || roots.some((r) => !mk(r))) continue;
      if (!roots.every((r) => fits(r, roots[0]))) continue;
      for (const r of roots.slice(1)) uf.union(r, roots[0]);
      merged = true;
      break;
    }
    if (merged) continue;
    // 2) side uten medium: hent fra naboen bak åpen ventil
    const cand = new Map<string, Map<string, string>>();
    for (const v of valvePorts) {
      if (v.closed) continue;
      const roots = [...new Set(v.ports.map((x) => uf.find(x)))];
      for (const r of roots) {
        if (mk(r)) continue;
        for (const o of roots) {
          if (!mk(o)) continue;
          if (!cand.has(r)) cand.set(r, new Map());
          cand.get(r)!.set(`${mk(o)}#${fk(o)}`, o);
        }
      }
    }
    for (const [r, ks] of cand) {
      let pick: string | undefined;
      if (ks.size === 1) pick = [...ks.values()][0];
      else {
        const score = (o: string) => (fk(o) ? 2 : 0) + (mk(o) !== 'vann' ? 1 : 0);
        const list = [...ks.values()].sort((a, b) => score(b) - score(a));
        if (score(list[0]) > score(list[1])) pick = list[0];
      }
      if (!pick) continue;
      uf.union(r, pick);
      merged = true;
      break;
    }
    if (!merged) break;
  }
  const groupMedia = mediaByRoot();
  // smaker fra BIB følger hele linja
  const groupFlavor = flavorByRoot();
  const hoseFlavor = new Map<string, string>();
  const flavorWarned = new Set<string>();
  const tubeFlavor = new Map<string, string>();
  for (const py of pythons) {
    for (let i = 1; i <= py.products; i++) {
      const fs = groupFlavor.get(uf.find(`py:${py.id}:p${i}`));
      if (fs && fs.size === 1) tubeFlavor.set(`${py.id}:p${i}`, [...fs][0]);
    }
  }

  const hoseMedium = new Map<string, string | undefined>();
  const edgeWarn = new Map<string, string[]>();
  const nodeWarn = new Map<string, string[]>();
  const warnings: Warning[] = [];
  const info: Warning[] = [];
  const pushEdge = (id: string, txt: string) => {
    const w: Warning = { id: `${id}|${txt}`, target: { type: 'edge', id }, text: txt };
    if (warnings.some((x) => x.id === w.id)) return;
    // ignorerte varsler står fortsatt i lista, men vises ikke i tegningen
    if (ignored.has(warnKey(w))) w.ignored = true;
    else {
      if (!edgeWarn.has(id)) edgeWarn.set(id, []);
      edgeWarn.get(id)!.push(txt);
    }
    warnings.push(w);
  };
  const pushInfo = (id: string, txt: string) => {
    const w: Warning = { id: `${id}|${txt}`, target: { type: 'edge', id }, text: txt };
    if (ignored.has(warnKey(w))) w.ignored = true;
    info.push(w);
  };

  // koblingsformer som ikke har fått størrelse
  for (const n of nodes) {
    const d = n.type === 'comp' ? defs.get(n.id) : undefined;
    if (!d?.generic) continue;
    const w: Warning = { id: `${n.id}|gen`, target: { type: 'node', id: n.id }, text: `${d.name} uten størrelse – dra den til en slange eller port` };
    if (ignored.has(warnKey(w))) w.ignored = true;
    warnings.push(w);
  }
  for (const e of edges) {
    if (e.type === 'python') continue;
    const sn = byId.get(e.source), tn = byId.get(e.target);
    const sp = findPort(sn, e.sourceHandle, pythons);
    const tp = findPort(tn, e.targetHandle, pythons);
    const nameOf = (n?: Node) => (n ? (n.type === 'hoseEnd' ? 'åpen ende' : (n.data as any).label || (n.data as any).flavor || defs.get(n.id)?.name || '') : '');
    if (!sp || !tp) {
      pushEdge(e.id, 'Koblet til en port som ikke finnes lenger');
      continue;
    }
    const root = uf.find(pk(e.source, e.sourceHandle));
    const grp = groupMedia.get(root);
    const media = grp ? [...grp] : [];
    const fls = groupFlavor.get(root);
    if (fls && fls.size === 1 && e.type === 'hose') hoseFlavor.set(e.id, [...fls][0]);
    if (fls && fls.size > 1 && !flavorWarned.has(root)) { flavorWarned.add(root); pushEdge(e.id, `Ulike smaker i samme linje: ${[...fls].join(', ')}`); }
    if (e.type === 'hose') {
      const hd = e.data as HoseData;
      hoseMedium.set(e.id, hd.medium && hd.medium !== 'auto' ? hd.medium : media.length === 1 ? media[0] : undefined);
      if (autoFit) {
        const fs = endFitting(sp, hd.size, hd.fitS, library, ownerOf(sn));
        const ft = endFitting(tp, hd.size, hd.fitT, library, ownerOf(tn));
        fits.set(e.id, { s: fs, t: ft });
        for (const [f, p] of [[fs, sp], [ft, tp]] as const) {
          if (f.status === 'missing') pushEdge(e.id, `Fant ingen kobling for ${f.need} («${p.name}»)`);
        }
      } else {
        for (const t of [...hosePortIssues(hd, sp), ...hosePortIssues(hd, tp)]) pushEdge(e.id, t);
      }
      if (sn?.type === 'hoseEnd' || tn?.type === 'hoseEnd')
        pushInfo(e.id, `Slange ${hd.size}${hd.name ? ' «' + hd.name + '»' : ''} har åpen ende`);
      if (hd.counted !== false && (hd.length == null || isNaN(hd.length as number)))
        pushInfo(e.id, `Slange ${hd.size}${hd.name ? ' «' + hd.name + '»' : ''} (${nameOf(sn)} → ${nameOf(tn)}) mangler lengde`);
    } else {
      for (const t of directIssues(sp, tp)) pushEdge(e.id, t);
    }
    if (media.length > 1) pushEdge(e.id, `Blandede medier i samme linje: ${media.map(mediumName).join(', ')}`);
    else {
      const ms = sp.medium && sp.medium !== 'any' ? sp.medium : undefined;
      const mt = tp.medium && tp.medium !== 'any' ? tp.medium : undefined;
      if (ms && mt && ms !== mt) pushEdge(e.id, `Medium passer ikke: ${mediumName(ms)} mot ${mediumName(mt)}`);
    }
  }
  const portMedium = new Map<string, string>();
  for (const n of nodes) {
    const d = defs.get(n.id);
    if (!d) continue;
    for (const p of d.ports) {
      const g = groupMedia.get(uf.find(pk(n.id, p.id)));
      if (g?.size === 1) portMedium.set(pk(n.id, p.id), [...g][0]);
    }
  }
  return { hoseMedium, hoseFlavor, tubeFlavor, fits, edgeWarn, nodeWarn, warnings, info, used, portMedium };
}
