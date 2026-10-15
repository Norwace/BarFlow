import type { Edge, Node } from '@xyflow/react';
import type { ComponentDef, PortDef, PythonDef, SimRole } from './types';
import { nodeDef } from './compat';
import { portFlow, inferFlow } from './portflow';
import { mediumName } from './constants';

/** Tilstand for en komponent i drift-modus (lagres i tegningen) */
export interface SimState {
  open?: boolean;
  full?: boolean;
  on?: boolean;
  /** bagveksler: valgt bag (1 eller 2) */
  active?: 1 | 2;
  /** tårn: åpne kraner per port */
  taps?: Record<string, boolean>;
}

export type SimKind = 'tap' | 'tower' | 'bag' | 'supply' | 'power' | 'machine' | 'bibswitch' | 'valve' | 'drain';

export const ROLE_NAMES: Record<SimRole, string> = {
  auto: 'Automatisk',
  source: 'Kilde med trykk (gassflaske, vanninntak, kompressor)',
  bib: 'Kilde uten trykk (som BIB – trenger pumpe)',
  container: 'Beholder som trenger trykk inn (som fat)',
  pump: 'Pumpe (gir trykk når den får det den trenger)',
  power: 'Utstyr som må ha drift (av/på, går med det det trenger)',
  machine: 'Maskin som bruker vann o.l. når den er på',
  tap: 'Kran (åpne/stenge)',
  drain: 'Avløp (tar imot)',
  passive: 'Bare gjennomløp (filter, regulator …)',
};

/** Rollen ut fra symbolet når den ikke er satt */
export function autoRole(def: ComponentDef): SimRole {
  switch (def.symbol) {
    case 'gas-bottle': case 'water-in': case 'compressor': return 'source';
    case 'bib': return 'bib';
    case 'keg': return 'container';
    case 'pump': return 'pump';
    case 'cooler': case 'carbonator': case 'n2gen': case 'mixer': return 'power';
    case 'icemaker': case 'coffee': return 'machine';
    case 'tap': case 'tower': return 'tap';
    case 'drain': return 'drain';
  }
  const ins = def.ports.filter((p) => portFlow(p, def) !== 'out');
  const outs = def.ports.filter((p) => portFlow(p, def) === 'out');
  if (!ins.length && outs.length) return 'source';
  return 'passive';
}

export function simRole(def: ComponentDef): SimRole {
  const r = def.sim?.role;
  return r && r !== 'auto' ? r : autoRole(def);
}

/** Hva slags styring komponenten har i drift-modus */
export function simKind(def: ComponentDef): SimKind | null {
  const r = def.sim?.role;
  if (r && r !== 'auto' && def.group === 'Utstyr') {
    switch (r) {
      case 'source': return 'supply';
      case 'bib': case 'container': return 'bag';
      case 'power': return 'power';
      case 'machine': return 'machine';
      case 'tap': return def.symbol === 'tower' ? 'tower' : 'tap';
      case 'drain': return 'drain';
      default: return null;
    }
  }
  if (def.group !== 'Utstyr') {
    if (def.symbol === 'fit-valve' && def.category !== 'Stopp- og kranadaptere') return 'valve';
    return null;
  }
  switch (def.symbol) {
    case 'tap': return 'tap';
    case 'tower': return 'tower';
    case 'bib': case 'keg': return 'bag';
    case 'gas-bottle': case 'water-in': return 'supply';
    case 'compressor': case 'cooler': case 'carbonator': case 'n2gen': return 'power';
    case 'icemaker': case 'coffee': return 'machine';
    case 'bibswitch': return 'bibswitch';
    case 'drain': return 'drain';
    default: return null;
  }
}

export function simOf(n: Node): SimState {
  return ((n.data as any)?.sim ?? {}) as SimState;
}

/** Standardtilstand: kraner stengt, maskiner av, alt annet åpent/på/fullt */
export function isOn(n: Node, kind: SimKind | null): boolean {
  const s = simOf(n);
  switch (kind) {
    case 'tap': return s.open ?? false;
    case 'bag': return s.full ?? true;
    case 'supply': return s.open ?? true;
    case 'power': return s.on ?? true;
    case 'machine': return s.on ?? false;
    case 'valve': return s.open ?? true;
    default: return true;
  }
}

export function stateLabel(n: Node, def: ComponentDef): { text: string; ok: boolean } | null {
  const k = simKind(def);
  const on = isOn(n, k);
  switch (k) {
    case 'tap': return { text: on ? 'ÅPEN' : 'STENGT', ok: on };
    case 'bag': return { text: on ? 'FULL' : 'TOM', ok: on };
    case 'supply': return { text: on ? 'ÅPEN' : 'STENGT', ok: on };
    case 'power': case 'machine': return { text: on ? 'PÅ' : 'AV', ok: on };
    case 'valve': return { text: on ? 'ÅPEN' : 'STENGT', ok: on };
    case 'tower': {
      const t = simOf(n).taps ?? {};
      const open = def.ports.filter((p) => portFlow(p, def) === 'in' && !/kjøleloop/i.test(p.name) && t[p.id]).length;
      return { text: open ? `${open} ÅPEN` : 'STENGT', ok: open > 0 };
    }
    default: return null;
  }
}

export interface SimResult {
  /** porter med medium («nodeId:portId») */
  fed: Set<string>;
  /** porter der det strømmer */
  flowing: Set<string>;
  /** slanger/direkte koblinger som har medium */
  edgeFed: Set<string>;
  /** slanger som strømmer: 1 = fra source til target, -1 motsatt */
  edgeFlow: Map<string, 1 | -1>;
  /** pytonrør-kropp som strømmer */
  pyFlow: Map<string, 1 | -1>;
  /** bagveksler: hvilken bag som trekkes fra (0 = ingen) */
  bagActive: Map<string, 0 | 1 | 2>;
  /** åpne slangeender med medium (lekkasje) */
  leaks: Set<string>;
  /** porter med trykk */
  pressed: Set<string>;
  /** utstyr som trenger noe inn: går det, og hva mangler */
  running: Map<string, { ok: boolean; missing: PortDef[] }>;
  /** ledige porter på koblinger og pytonslanger med medium (lekkasje), «nodeId:portId» */
  leakPorts: Set<string>;
  /** hvilke medier som er i slangen (fra kildene, gjennom åpne ventiler, pumper og utstyr). «sirup|Cola» = sirup med smak */
  edgeMedia: Map<string, string[]>;
  /** slanger med to eller flere medier samtidig */
  mixed: Map<string, string[]>;
}

/** «sirup|Cola» → medium og smak */
export function splitToken(t: string): { medium: string; flavor?: string } {
  const i = t.indexOf('|');
  return i < 0 ? { medium: t } : { medium: t.slice(0, i), flavor: t.slice(i + 1) };
}

/** «Sirup (Cola)» */
export function tokenName(t: string): string {
  const { medium, flavor } = splitToken(t);
  return flavor ? `${mediumName(medium)} (${flavor})` : mediumName(medium);
}

/** Tilbakeslagsventil: slipper bare gjennom fra «Inn» til «Ut» */
export function isCheckValve(def: ComponentDef): boolean {
  return def.group !== 'Utstyr' && (def.symbol === 'fit-check' || /tilbakeslag/i.test(def.name));
}

const K = (n: string, p: string) => `${n}:${p}`;

export function simulate(nodes: Node[], edges: Edge[], pythons: PythonDef[], portMedium?: Map<string, string>): SimResult {
  const defs = new Map<string, ComponentDef>();
  for (const n of nodes) { const d = nodeDef(n, pythons); if (d) defs.set(n.id, d); }

  // passivt nett: slanger, direkte koblinger, koblinger (fittings) og pytonrør
  // back = bare for sporing bakover (enveis gjennom tilbakeslagsventil)
  const adj = new Map<string, { to: string; edge?: string; dir?: 1 | -1; back?: boolean }[]>();
  const link = (a: string, b: string, edge?: string) => {
    if (!adj.has(a)) adj.set(a, []);
    if (!adj.has(b)) adj.set(b, []);
    adj.get(a)!.push({ to: b, edge, dir: 1 });
    adj.get(b)!.push({ to: a, edge, dir: -1 });
  };
  const link1 = (a: string, b: string) => {
    if (!adj.has(a)) adj.set(a, []);
    if (!adj.has(b)) adj.set(b, []);
    adj.get(a)!.push({ to: b });
    adj.get(b)!.push({ to: a, back: true });
  };
  for (const e of edges) {
    if (e.type === 'python') continue;
    link(K(e.source, e.sourceHandle ?? ''), K(e.target, e.targetHandle ?? ''), e.id);
  }
  const equip: Node[] = [];
  const consumers: string[] = [];
  const leaks = new Set<string>();
  for (const n of nodes) {
    const d = defs.get(n.id);
    if (!d) continue;
    if (n.type === 'pyEnd') {
      for (const p of d.ports) link(K(n.id, p.id), `py:${(n.data as any).pythonId}:${p.link}`);
    } else if (n.type === 'comp' && d.group !== 'Utstyr') {
      // kobling: alle porter henger sammen, med mindre det er en stengt ventil
      const kind = simKind(d);
      if (kind === 'valve' && !isOn(n, kind)) continue;
      const check = isCheckValve(d);
      for (const p of d.ports) {
        const f = check ? (p.flow ?? inferFlow(p.name)) : 'both';
        if (f === 'in') link1(K(n.id, p.id), `${n.id}:*`);
        else if (f === 'out') link1(`${n.id}:*`, K(n.id, p.id));
        else link(K(n.id, p.id), `${n.id}:*`);
      }
    } else if (n.type === 'comp') equip.push(n);
  }

  const isLoop = (d: ComponentDef, p: PortDef) => (d.symbol === 'cooler' || d.sim?.role === 'power') && /kjøleloop/i.test(p.name);
  // utstyr som ikke trenger noe inn for å «gå» (kraner, tårn, avløp)
  const passiveKinds = new Set(['tap', 'tower', 'drain']);

  /**
   * Sprer medium gjennom anlegget.
   * fill: hvor det står noe (også sirup fra BIB uten pumpe).
   * press: hvor det står trykk – fra gassflaske, vanninntak, kompressor, fat med gass, pumpe med drivgass og kjøler som går.
   */
  const run = (mode: 'fill' | 'press', fillDist?: Map<string, number>) => {
    const dist = new Map<string, number>();
    const deps = new Map<string, string[]>();
    const running = new Map<string, { ok: boolean; missing: PortDef[] }>();
    const bagActive = new Map<string, 0 | 1 | 2>();
    // for medier: kilder, gjennomløp (inn → ut) og omforming (karbonator, fat …) i siste runde
    const srcSeeds = new Set<string>();
    let roundSeeds = new Set<string>();
    let passFrom = new Map<string, string[]>();
    let conv = new Set<string>();
    const queue: string[] = [];
    const feed = (k: string, d: number, from: string[]) => {
      if (dist.has(k) && dist.get(k)! <= d) return false;
      dist.set(k, d);
      deps.set(k, from);
      queue.push(k);
      return true;
    };
    // kilder: utstyr uten innganger (BIB gir ikke trykk – den trenger pumpe)
    for (const n of equip) {
      const d = defs.get(n.id)!;
      const kind = simKind(d);
      const ins = d.ports.filter((p) => portFlow(p, d) !== 'out');
      const outs = d.ports.filter((p) => portFlow(p, d) === 'out');
      const role = simRole(d);
      if (mode === 'press' && role === 'bib') continue;
      const isSrc = role === 'source' || role === 'bib' || (!ins.length && outs.length > 0 && role !== 'passive');
      if (isSrc && outs.length && isOn(n, kind)) for (const p of outs) { feed(K(n.id, p.id), 0, []); srcSeeds.add(K(n.id, p.id)); }
    }
    for (let round = 0; round < 60; round++) {
      while (queue.length) {
        const k = queue.shift()!;
        const dk = dist.get(k)!;
        for (const nb of adj.get(k) ?? []) if (!nb.back) feed(nb.to, dk + 1, [k]);
      }
      let changed = false;
      roundSeeds = new Set(); passFrom = new Map(); conv = new Set();
      for (const n of equip) {
        const d = defs.get(n.id)!;
        const kind = simKind(d);
        const on = isOn(n, kind);
        const has = (p: PortDef) => dist.has(K(n.id, p.id));
        const filled = (p: PortDef) => (fillDist ?? dist).has(K(n.id, p.id));
        const fl = (p: PortDef) => portFlow(p, d);
        const role = simRole(d);
        const isPump = role === 'pump';
        const unlinkedIns = d.ports.filter((p) => !p.link && fl(p) !== 'out' && !isLoop(d, p));
        // går utstyret? Det trenger det som er valgt under «Må ha for å gå» (automatisk: alt uten link inn, pumpe også sirup)
        const needs = requiredPorts(d);
        if (!passiveKinds.has(kind ?? '') && role !== 'passive' && d.symbol !== 'gauge' && (needs.length || d.symbol === 'cooler' || isPump || role === 'power')) {
          // innganger med link (sirup gjennom pumpa) trenger bare å stå der, resten må ha trykk
          const missing = needs.filter((p) => !(p.link ? filled(p) : has(p)));
          const ok = on && !missing.length;
          const prev = running.get(n.id);
          if (!prev || prev.ok !== ok || prev.missing.length !== missing.length) { running.set(n.id, { ok, missing }); changed = true; }
        }
        const isRunning = running.get(n.id)?.ok ?? on;
        // kjøleloop: kjøleren pumper når den går
        if (d.symbol === 'cooler' && isRunning) {
          for (const p of d.ports) if (isLoop(d, p) && fl(p) === 'out') { roundSeeds.add(K(n.id, p.id)); if (feed(K(n.id, p.id), 0, [])) changed = true; }
        }
        // gjennomløp via link
        const groups = new Map<string, PortDef[]>();
        for (const p of d.ports) if (p.link && !isLoop(d, p)) { if (!groups.has(p.link)) groups.set(p.link, []); groups.get(p.link)!.push(p); }
        for (const [, ps] of groups) {
          // pumpa: sirupen trenger bare å stå der (fra BIB), trykket kommer fra drivgassen
          const inOk = (p: PortDef) => (isPump ? filled(p) : has(p));
          let srcIns = ps.filter((p) => fl(p) !== 'out' && inOk(p));
          if (d.symbol === 'bibswitch') {
            const inl = ps.filter((p) => fl(p) === 'in');
            const want = (simOf(n).active ?? 1) - 1;
            const pref = inl[want], other = inl[1 - want];
            const use = pref && filled(pref) ? pref : other && filled(other) ? other : undefined;
            bagActive.set(n.id, use ? ((inl.indexOf(use) + 1) as 1 | 2) : 0);
            srcIns = use && has(use) ? [use] : [];
          }
          if (!srcIns.length) continue;
          if (isPump && !isRunning) continue;
          const base = Math.max(...srcIns.map((p) => dist.get(K(n.id, p.id)) ?? fillDist?.get(K(n.id, p.id)) ?? 0));
          const extra = isPump ? needs.filter((q) => !q.link) : [];
          const outKeys: string[] = [];
          for (const p of ps) {
            if (fl(p) === 'in' || srcIns.includes(p)) continue;
            outKeys.push(K(n.id, p.id));
            if (feed(K(n.id, p.id), base + 1, [...srcIns, ...extra].map((q) => K(n.id, q.id)))) changed = true;
          }
          for (const q of srcIns) passFrom.set(K(n.id, q.id), outKeys);
        }
        // omforming: utganger uten link (karbonator, gassblander, fat …)
        if (!on) continue;
        for (const p of d.ports) {
          if (p.link || fl(p) !== 'out' || isLoop(d, p)) continue;
          if (!unlinkedIns.length && !d.sim?.needs?.length) continue;
          // samme medium inn som ut (vann inn → stille vann ut): bare den trengs. Ellers trengs alt, og utstyret må gå
          const same = unlinkedIns.find((q) => (q.medium ?? 'any') === (p.medium ?? 'any'));
          const need = same ? [same] : d.sim?.needs ? needs : unlinkedIns;
          if (!need.length) continue;
          if (!need.every(has)) continue;
          if (!same && !isRunning) continue;
          const base = Math.max(...need.map((q) => dist.get(K(n.id, q.id))!));
          conv.add(K(n.id, p.id));
          if (feed(K(n.id, p.id), base + 1, need.map((q) => K(n.id, q.id)))) changed = true;
        }
      }
      if (!changed && !queue.length) break;
    }
    const seeds = new Set([...srcSeeds, ...roundSeeds]);
    return { dist, deps, running, bagActive, seeds, passFrom, conv };
  };

  const fill = run('fill');
  const press = run('press', fill.dist);
  // rekkefølgen (avstand fra kilden) og avhengigheter tas fra «fill», trykket fra «press»
  const dist = fill.dist;
  const deps = fill.deps;
  const pressed = press.dist;
  const bagActive = fill.bagActive;
  const running = press.running;

  // forbrukere: åpne kraner, avløp, maskiner, kjøleloop-retur, åpne slangeender
  const used = new Set<string>();
  for (const e of edges) {
    if (e.type === 'python') continue;
    used.add(K(e.source, e.sourceHandle ?? ''));
    used.add(K(e.target, e.targetHandle ?? ''));
  }
  const leakPorts = new Set<string>();
  for (const n of nodes) {
    if (n.type === 'hoseEnd') {
      const k = K(n.id, 'p');
      if (pressed.has(k)) { leaks.add(n.id); consumers.push(k); }
      continue;
    }
    const d = defs.get(n.id);
    if (!d) continue;
    // ledig port på kobling eller slange i pytonrøret: det renner ut
    if (n.type === 'pyEnd' || (n.type === 'comp' && d.group !== 'Utstyr')) {
      for (const p of d.ports) {
        const k = K(n.id, p.id);
        if (pressed.has(k) && !used.has(k)) { leakPorts.add(k); consumers.push(k); }
      }
      continue;
    }
    if (n.type !== 'comp' || d.group !== 'Utstyr') continue;
    const kind = simKind(d);
    const on = isOn(n, kind);
    const runOk = running.get(n.id)?.ok ?? on;
    // kjøleren: vannet renner inn hele tiden når den går og kjøleloopen går rundt
    const loopBack = d.symbol === 'cooler' && runOk && d.ports.some((p) => isLoop(d, p) && portFlow(p, d) !== 'out' && pressed.has(K(n.id, p.id)));
    for (const p of d.ports) {
      const k = K(n.id, p.id);
      if (!pressed.has(k) || portFlow(p, d) === 'out') continue;
      if (kind === 'tap' && on && !p.link) consumers.push(k);
      else if (kind === 'tower' && !/kjøleloop/i.test(p.name) && simOf(n).taps?.[p.id]) consumers.push(k);
      else if (kind === 'drain') consumers.push(k);
      else if (kind === 'machine' && runOk && p.medium !== 'avlop') consumers.push(k);
      else if (isLoop(d, p) && runOk) consumers.push(k);
      else if (loopBack && !p.link && p.medium === 'vann') consumers.push(k);
    }
  }

  // bakover fra forbrukerne: alt som strømmer
  const flowing = new Set<string>();
  const edgeFlow = new Map<string, 1 | -1>();
  const stack = [...consumers];
  while (stack.length) {
    const k = stack.pop()!;
    if (flowing.has(k)) continue;
    flowing.add(k);
    const dk = dist.get(k);
    if (dk == null) continue;
    for (const dep of deps.get(k) ?? []) {
      // utstyr: videre til inngangene som mater utgangen
      if (!adj.get(k)?.some((x) => x.to === dep)) stack.push(dep);
    }
    for (const nb of adj.get(k) ?? []) {
      const dn = dist.get(nb.to);
      if (dn == null || dn >= dk) continue;
      if (nb.edge) edgeFlow.set(nb.edge, nb.dir === 1 ? -1 : 1);
      stack.push(nb.to);
    }
  }

  // medier: sprer hvert medium fra kilden dit det når (gjennom slanger, åpne ventiler, pumper som går og utstyr)
  const portDef = (k: string) => {
    const i = k.lastIndexOf(':');
    return defs.get(k.slice(0, i))?.ports.find((p) => p.id === k.slice(i + 1));
  };
  const mediumOf = (k: string) => {
    const p = portDef(k);
    return p?.medium && p.medium !== 'any' ? p.medium : portMedium?.get(k);
  };
  const media = new Map<string, Set<string>>();
  const work: [string, string][] = [];
  const addM = (k: string, m?: string) => {
    if (!m || m === 'any' || !dist.has(k)) return;
    let set = media.get(k);
    if (!set) media.set(k, (set = new Set()));
    if (set.has(m)) return;
    set.add(m);
    work.push([k, m]);
  };
  // BIB med smak: «sirup|Cola», så smaken følger med
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const seedToken = (k: string) => {
    const m = mediumOf(k);
    const fl = (nodeById.get(k.slice(0, k.lastIndexOf(':')))?.data as any)?.flavor as string | undefined;
    return m && fl ? `${m}|${fl}` : m;
  };
  for (const k of fill.seeds) addM(k, seedToken(k));
  for (const k of fill.conv) addM(k, mediumOf(k));
  while (work.length) {
    const [k, m] = work.pop()!;
    for (const nb of adj.get(k) ?? []) if (!nb.back) addM(nb.to, m);
    for (const o of fill.passFrom.get(k) ?? []) addM(o, m);
  }
  const edgeMedia = new Map<string, string[]>();
  const mixed = new Map<string, string[]>();
  for (const e of edges) {
    if (e.type === 'python') continue;
    const set = new Set([...(media.get(K(e.source, e.sourceHandle ?? '')) ?? []), ...(media.get(K(e.target, e.targetHandle ?? '')) ?? [])]);
    if (!set.size) continue;
    const list = [...set].sort();
    edgeMedia.set(e.id, list);
    if (list.length > 1) mixed.set(e.id, list);
  }
  // gass og luft strømmer så lenge kilden er på og det står trykk, også når utstyret ikke bruker noe
  const GAS = new Set(['co2', 'n2', 'blandgass', 'luft']);
  for (const e of edges) {
    if (e.type === 'python' || edgeFlow.has(e.id)) continue;
    const a = K(e.source, e.sourceHandle ?? ''), b = K(e.target, e.targetHandle ?? '');
    if (!pressed.has(a) && !pressed.has(b)) continue;
    const ms = edgeMedia.get(e.id);
    if (!ms?.length || !ms.every((t) => GAS.has(splitToken(t).medium))) continue;
    edgeFlow.set(e.id, (pressed.get(a) ?? Infinity) <= (pressed.get(b) ?? Infinity) ? 1 : -1);
  }

  const fed = new Set(dist.keys());
  const edgeFed = new Set<string>();
  for (const e of edges) {
    if (e.type === 'python') continue;
    if (fed.has(K(e.source, e.sourceHandle ?? '')) || fed.has(K(e.target, e.targetHandle ?? ''))) edgeFed.add(e.id);
  }
  // pytonrøret: strømmer når en slange i det strømmer
  const pyFlow = new Map<string, 1 | -1>();
  for (const e of edges) {
    if (e.type !== 'python') continue;
    const a = nodes.find((n) => n.id === e.source), b = nodes.find((n) => n.id === e.target);
    const da = a && defs.get(a.id);
    if (!a || !b || !da) continue;
    let dir: 1 | -1 | 0 = 0;
    for (const p of da.ports) {
      const ka = K(a.id, p.id), kb = K(b.id, p.id);
      if (!flowing.has(ka) || !flowing.has(kb)) continue;
      const d = (dist.get(ka) ?? 0) <= (dist.get(kb) ?? 0) ? 1 : -1;
      if (!dir || p.id.startsWith('p')) dir = d;
      if (p.id.startsWith('p')) break;
    }
    if (dir) pyFlow.set(e.id, dir);
  }
  return { fed, flowing, edgeFed, edgeFlow, pyFlow, bagActive, leaks, leakPorts, pressed: new Set(pressed.keys()), running, edgeMedia, mixed };
}

/** Det som skjer ved klikk i drift-modus (åpne/stenge, full/tom, på/av, bytte bag) */
export function primaryToggle(n: Node, def: ComponentDef): Record<string, unknown> | null {
  const k = simKind(def);
  const s = simOf(n);
  switch (k) {
    case 'tap': case 'valve': case 'supply': return { open: !isOn(n, k) };
    case 'bag': return { full: !isOn(n, k) };
    case 'power': case 'machine': return { on: !isOn(n, k) };
    case 'bibswitch': return { active: (s.active ?? 1) === 1 ? 2 : 1 };
    case 'tower': {
      const ps = towerTaps(def);
      const anyOpen = ps.some((p) => s.taps?.[p.id]);
      return { taps: Object.fromEntries(ps.map((p) => [p.id, !anyOpen])) };
    }
    default: return null;
  }
}

/** Kranene i et tårn (produktportene) */
export function towerTaps(def: ComponentDef): PortDef[] {
  return def.ports.filter((p) => portFlow(p, def) === 'in' && !/kjøleloop/i.test(p.name));
}

/** «mangler gass og vann» – hva utstyret mangler for å gå */
export function missingText(missing: PortDef[]): string {
  const words: string[] = [];
  for (const p of missing) {
    const m = p.medium;
    const w = m === 'co2' || m === 'n2' || m === 'blandgass' ? 'gass' : m === 'luft' ? 'luft' : m === 'vann' || m === 'kullsyrevann' ? 'vann' : m === 'sirup' ? 'sirup' : m === 'ol' ? 'øl'
      : /gass/i.test(p.name) ? 'gass' : /sirup/i.test(p.name) ? 'sirup' : /vann/i.test(p.name) ? 'vann' : /luft/i.test(p.name) ? 'luft' : p.name.replace(/\s*inn\s*\d*$/i, '').toLowerCase();
    if (!words.includes(w)) words.push(w);
  }
  return words.join(' og ');
}

/** Porter utstyret må ha noe på for å gå (valgt i editoren, ellers automatisk) */
export function requiredPorts(d: ComponentDef): PortDef[] {
  if (d.sim?.needs) return d.ports.filter((p) => d.sim!.needs!.includes(p.id));
  return autoNeeds(d);
}

export function autoNeeds(d: ComponentDef): PortDef[] {
  const loop = (p: PortDef) => /kjøleloop/i.test(p.name);
  const role = simRole(d);
  if (role === 'passive' || role === 'tap' || role === 'drain' || role === 'source' || role === 'bib') return [];
  const ins = d.ports.filter((p) => !p.link && portFlow(p, d) !== 'out' && !loop(p));
  if (role === 'pump') ins.push(...d.ports.filter((p) => p.link && portFlow(p, d) === 'in'));
  return ins;
}
