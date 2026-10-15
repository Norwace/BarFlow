import { create } from 'zustand';
import { applyEdgeChanges, applyNodeChanges, type Connection, type Edge, type EdgeChange, type Node, type NodeChange } from '@xyflow/react';
import type { Blueprint, ComponentDef, HoseData, ProjectFile, ProjectInfo, PythonDef } from './lib/types';
import { uid } from './lib/ids';
import { newPython, pythonEndDef, PY_W } from './lib/python';
import { findPort, nodeDef } from './lib/compat';
import { portAbs, hoseSizeFor } from './lib/place';
import { HOSE_END_SIZE } from './lib/compat';
import { effectiveLibrary, emptyUserLib, loadUserLibrary, saveUserLibrary, type UserLibrary } from './lib/library';
import { api } from './lib/api';
import { GRID } from './lib/constants';
import { resolveGeneric } from './lib/generic';

export interface Settings {
  showFittingLabels: boolean;
  showHoseLabels: boolean;
  edgeStyle: 'smoothstep' | 'straight' | 'bezier';
  pageSize: 'A4' | 'A3';
  autoFittings: boolean;
}

export interface PickerState {
  screen: { x: number; y: number };
  flow: { x: number; y: number };
  fromNode: string;
  fromHandle: string;
  /** satt når en åpen slangeende skal få kobling */
  freeEnd?: { nodeId: string; edgeId: string };
  /** koblingen settes rett på porten (f.eks. slange i pytonrør) */
  direct?: boolean;
}

export interface PopupState {
  kind: 'edge' | 'node' | 'fit' | 'selection' | 'pane'; id: string;
  /** høyreklikk på tomt sted: hvor nye ting settes inn */
  flow?: { x: number; y: number }; end?: 's' | 't'; x: number; y: number;
  /** rammen til det som ble klikket (popupen legges ved siden av) */
  anchor?: { left: number; top: number; right: number; bottom: number };
}
export type DrawTool = 'line' | 'rect' | null;

interface Snap { nodes: Node[]; edges: Edge[]; pythons: PythonDef[]; info: ProjectInfo }

export const emptyInfo = (): ProjectInfo => ({
  kunde: '', prosjekt: '', adresse: '', dato: new Date().toLocaleDateString('nb-NO'), tegnetAv: '', notat: '',
});

interface State {
  nodes: Node[];
  edges: Edge[];
  pythons: PythonDef[];
  info: ProjectInfo;
  filePath: string | null;
  dirty: boolean;
  past: Snap[];
  future: Snap[];
  userLib: UserLibrary;
  library: ComponentDef[];
  settings: Settings;
  rightTab: 'props' | 'parts' | 'warnings';
  picker: PickerState | null;
  popup: PopupState | null;
  drawTool: DrawTool;
  ignored: string[];
  /** valgt enkeltslange i pytonrør-ende («nodeId:portId») */
  focusPort: string | null;
  /** dialog for å lagre utvalget som blueprint */
  bpSave: boolean;
  /** drift-modus (simulering) */
  simOn: boolean;
  editor: { def: ComponentDef; isNew: boolean } | null;
  infoOpen: boolean;
  focusTick: number;
  clipboard: Snap | null;
  toast: string | null;

  init(): Promise<void>;
  snapshot(key?: string): void;
  undo(): void;
  redo(): void;
  markDirty(): void;
  setRightTab(t: State['rightTab']): void;
  setSettings(p: Partial<Settings>): void;
  showToast(t: string): void;

  onNodesChange(ch: NodeChange[]): void;
  onEdgesChange(ch: EdgeChange[]): void;
  connect(c: Connection, kind?: 'hose' | 'direct'): string | null;
  addComponent(def: ComponentDef, pos: { x: number; y: number }, rotation?: number): string;
  addPython(pos: { x: number; y: number }): void;
  addText(pos: { x: number; y: number }): void;
  updateNodeData(id: string, patch: Record<string, unknown>): void;
  updateEdgeData(id: string, patch: Record<string, unknown>): void;
  setEdgeType(id: string, type: 'hose' | 'direct'): void;
  updatePython(id: string, patch: Partial<PythonDef>): void;
  setInfo(p: Partial<ProjectInfo>): void;
  rotateSelected(dir?: 1 | -1): void;
  flipSelected(): void;
  deleteSelected(): void;
  copySelected(): void;
  paste(): void;
  selectOnly(ids: { nodes?: string[]; edges?: string[] }): void;
  replaceEdges(remove: string[], add: Edge[]): void;
  moveNode(id: string, pos: { x: number; y: number }): void;
  addFreeEnd(pos: { x: number; y: number }): string;
  hoseToFree(fromNode: string, fromHandle: string, pos: { x: number; y: number }): string | null;
  addFreeHose(pos: { x: number; y: number }): string;
  rewireEnd(edgeId: string, end: 'source' | 'target', nodeId: string, handle: string, snapshot?: boolean): boolean;
  openPopup(p: PopupState | null): void;
  setDrawTool(t: DrawTool): void;
  addShape(shape: 'line' | 'rect', a: { x: number; y: number }, b: { x: number; y: number }): string;
  toggleIgnore(key: string): void;
  setFlavors(f: import('./lib/constants').Flavor[]): Promise<void>;
  setLibOrder(key: string, ids: string[]): Promise<void>;
  addHoseFav(f: import('./lib/library').HoseFav): Promise<void>;
  removeHoseFav(id: string): Promise<void>;
  openBpSave(open: boolean): void;
  setSimOn(on: boolean): void;
  /** endre drift-tilstand på en komponent (ingen angre-steg) */
  setSim(nodeId: string, patch: Record<string, unknown>): void;
  /** lager blueprint av det som er valgt (uten å lagre) */
  blueprintFromSelection(): Blueprint | null;
  saveBlueprint(bp: Blueprint, replaceId?: string): Promise<void>;
  updateBlueprint(id: string, patch: Partial<Blueprint>): Promise<void>;
  deleteBlueprint(id: string): Promise<void>;
  insertBlueprint(id: string, center: { x: number; y: number }): void;
  resetLibOrder(): Promise<void>;
  /** bytt komponenten i en node (f.eks. rett ↔ vinkel). swap = bytt slangene mellom port 1 og 2 */
  replaceNodeDef(nodeId: string, def: ComponentDef, handleMap?: Record<string, string>): void;
  /** koble to åpne slangeender sammen med en skjøt */
  joinFreeEnds(aEnd: string, bEnd: string, def: ComponentDef): boolean;
  /** koblingsform uten størrelse: bytt til riktig kobling i gitt størrelse (uten angre-steg) */
  resolveGenericNode(nodeId: string, size: string): boolean;

  newProject(): void;
  serialize(): string;
  loadProject(content: string, path: string | null): boolean;
  setFilePath(p: string | null): void;

  openPicker(p: PickerState | null): void;
  openEditor(def: ComponentDef | null, isNew?: boolean): void;
  setInfoOpen(o: boolean): void;
  saveComponent(def: ComponentDef): Promise<void>;
  deleteComponent(id: string): Promise<void>;
  toggleFavorite(id: string): Promise<void>;
  importUserLib(lib: UserLibrary): Promise<void>;
  refreshNodesFromLibrary(defId: string): void;
}

const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
/** eldre tegninger: gamle navn på standardutstyr */
const OLD_NAMES: Record<string, [string, string]> = { 'start-bib-pumpe': ['BIB-pumpe (gassdrevet)', 'Pumpe'] };
const migrateNode = (n: Node): Node => {
  const def = n.type === 'comp' ? ((n.data as any)?.def as ComponentDef | undefined) : undefined;
  const o = def && OLD_NAMES[def.id];
  return o && def!.name === o[0] ? { ...n, data: { ...n.data, def: { ...def!, name: o[1] } } } : n;
};
let lastSnapKey: string | null = null;
let lastSnapTime = 0;

function cleanNode(n: Node): Node {
  const { measured, dragging, resizing, ...rest } = n as any;
  return rest;
}

export function newHoseData(size: string): HoseData {
  return { kind: 'hose', tube: 'PE', size, medium: 'auto', color: '', length: null, counted: true };
}

export const useStore = create<State>((set, get) => ({
  nodes: [],
  edges: [],
  pythons: [],
  info: emptyInfo(),
  filePath: null,
  dirty: false,
  past: [],
  future: [],
  userLib: emptyUserLib(),
  library: effectiveLibrary(emptyUserLib()),
  settings: { showFittingLabels: true, showHoseLabels: true, edgeStyle: 'smoothstep', pageSize: 'A3', autoFittings: true },
  rightTab: 'props',
  picker: null,
  popup: null,
  drawTool: null,
  ignored: [],
  focusPort: null,
  bpSave: false,
  simOn: false,
  editor: null,
  infoOpen: false,
  focusTick: 0,
  clipboard: null,
  toast: null,

  async init() {
    const userLib = await loadUserLibrary();
    set({ userLib, library: effectiveLibrary(userLib) });
    try {
      const s = localStorage.getItem('barflow.settings');
      if (s) set({ settings: { ...get().settings, ...JSON.parse(s) } });
    } catch { /* */ }
  },

  snapshot(key?: string) {
    const now = Date.now();
    if (key && key === lastSnapKey && now - lastSnapTime < 1200) {
      lastSnapTime = now;
      get().markDirty();
      return;
    }
    lastSnapKey = key ?? null;
    lastSnapTime = now;
    const { nodes, edges, pythons, info, past } = get();
    const snap = clone({ nodes: nodes.map(cleanNode), edges, pythons, info });
    set({ past: [...past.slice(-99), snap], future: [] });
    get().markDirty();
  },
  undo() {
    const { past, future, nodes, edges, pythons, info } = get();
    if (!past.length) return;
    const prev = past[past.length - 1];
    set({
      past: past.slice(0, -1),
      future: [clone({ nodes: nodes.map(cleanNode), edges, pythons, info }), ...future].slice(0, 100),
      nodes: prev.nodes, edges: prev.edges, pythons: prev.pythons, info: prev.info,
    });
    get().markDirty();
  },
  redo() {
    const { past, future, nodes, edges, pythons, info } = get();
    if (!future.length) return;
    const next = future[0];
    set({
      future: future.slice(1),
      past: [...past, clone({ nodes: nodes.map(cleanNode), edges, pythons, info })],
      nodes: next.nodes, edges: next.edges, pythons: next.pythons, info: next.info,
    });
    get().markDirty();
  },
  markDirty() {
    if (!get().dirty) {
      set({ dirty: true });
      api.setDirty(true);
    }
  },
  setRightTab(t) { set({ rightTab: t }); },
  setSettings(p) {
    const settings = { ...get().settings, ...p };
    set({ settings });
    try { localStorage.setItem('barflow.settings', JSON.stringify(settings)); } catch { /* */ }
  },
  showToast(t) {
    set({ toast: t });
    setTimeout(() => { if (get().toast === t) set({ toast: null }); }, 3500);
  },

  onNodesChange(changes) {
    const removes = changes.filter((c) => c.type === 'remove').map((c) => (c as any).id as string);
    if (removes.length) {
      get().snapshot();
      const { nodes, edges, pythons } = get();
      const removeSet = new Set(removes);
      // pytonrør: fjern begge ender og selve røret
      const pyIds = new Set<string>();
      for (const n of nodes) if (removeSet.has(n.id) && n.type === 'pyEnd') pyIds.add((n.data as any).pythonId);
      for (const n of nodes) if (n.type === 'pyEnd' && pyIds.has((n.data as any).pythonId)) removeSet.add(n.id);
      const others = changes.filter((c) => c.type !== 'remove');
      // slanger til slettede komponenter beholdes med åpen ende (hvis ikke selve slangen er valgt eller begge ender slettes)
      const newNodes: Node[] = [];
      const newEdges: Edge[] = [];
      for (const e of edges) {
        const sDel = removeSet.has(e.source), tDel = removeSet.has(e.target);
        if (!sDel && !tDel) { newEdges.push(e); continue; }
        const sNode = nodes.find((n) => n.id === e.source);
        const tNode = nodes.find((n) => n.id === e.target);
        const freeDel = (sDel && sNode?.type === 'hoseEnd') || (tDel && tNode?.type === 'hoseEnd');
        if (e.type !== 'hose' || e.selected || (sDel && tDel) || freeDel) continue;
        const ne = { ...e };
        for (const end of ['source', 'target'] as const) {
          const del = end === 'source' ? sDel : tDel;
          if (!del) continue;
          const n = end === 'source' ? sNode : tNode;
          const h = end === 'source' ? e.sourceHandle : e.targetHandle;
          const pt = n && h ? portAbs(n, h, pythons) : null;
          if (!pt) continue;
          const id = uid('he');
          newNodes.push({ id, type: 'hoseEnd', position: { x: pt.x - HOSE_END_SIZE / 2, y: pt.y - HOSE_END_SIZE / 2 }, data: {} });
          if (end === 'source') { ne.source = id; ne.sourceHandle = 'p'; } else { ne.target = id; ne.targetHandle = 'p'; }
        }
        newEdges.push(ne);
      }
      // fjern løse ender som ikke lenger har slange
      const stillUsed = new Set(newEdges.flatMap((e) => [e.source, e.target]));
      const keptNodes = nodes.filter((n) => !removeSet.has(n.id) && (n.type !== 'hoseEnd' || stillUsed.has(n.id)));
      set({
        nodes: applyNodeChanges(others, [...keptNodes, ...newNodes]),
        edges: newEdges,
        pythons: pythons.filter((p) => !pyIds.has(p.id)),
      });
      return;
    }
    const meaningful = changes.some((c) => (c.type === 'position' && (c as any).dragging === false) || (c.type === 'dimensions' && (c as any).resizing === false));
    // flytting av flere noder samtidig: knekkpunkter på slanger mellom dem følger med
    const deltas = new Map<string, { dx: number; dy: number }>();
    const cur = get().nodes;
    for (const c of changes) {
      if (c.type !== 'position' || !(c as any).position) continue;
      const n = cur.find((x) => x.id === (c as any).id);
      if (!n) continue;
      const pos = (c as any).position;
      deltas.set(n.id, { dx: pos.x - n.position.x, dy: pos.y - n.position.y });
    }
    let edges = get().edges;
    if (deltas.size > 1) {
      edges = edges.map((e) => {
        const pts = (e.data as any)?.points as { x: number; y: number }[] | undefined;
        if (!pts || !pts.length) return e;
        const a = deltas.get(e.source), b = deltas.get(e.target);
        if (!a || !b) return e;
        // snapping kan gi litt ulik forskyvning per node – bruk snittet
        const dx = Math.round((a.dx + b.dx) / 2), dy = Math.round((a.dy + b.dy) / 2);
        if (dx === 0 && dy === 0) return e;
        if (Math.abs(a.dx - b.dx) > GRID * 2 || Math.abs(a.dy - b.dy) > GRID * 2) return e;
        return { ...e, data: { ...e.data, points: pts.map((q) => ({ x: q.x + dx, y: q.y + dy })) } };
      });
    }
    set({ nodes: applyNodeChanges(changes, cur), edges });
    if (meaningful) get().markDirty();
  },
  onEdgesChange(changes) {
    const removes = changes.filter((c) => c.type === 'remove').map((c) => (c as any).id as string);
    if (removes.length) {
      get().snapshot();
      const { edges, nodes, pythons } = get();
      // sletting av pytonrør-kroppen fjerner hele pytonrøret
      const pyIds = new Set<string>();
      for (const e of edges) if (removes.includes(e.id) && e.type === 'python') pyIds.add((e.data as any).pythonId);
      if (pyIds.size) {
        const endIds = new Set(nodes.filter((n) => n.type === 'pyEnd' && pyIds.has((n.data as any).pythonId)).map((n) => n.id));
        set({
          nodes: nodes.filter((n) => !endIds.has(n.id)),
          edges: applyEdgeChanges(changes, edges).filter((e) => !endIds.has(e.source) && !endIds.has(e.target)),
          pythons: pythons.filter((p) => !pyIds.has(p.id)),
        });
        return;
      }
    }
    const nextEdges = applyEdgeChanges(changes, get().edges);
    if (removes.length) {
      const stillUsed = new Set(nextEdges.flatMap((e) => [e.source, e.target]));
      set({ edges: nextEdges, nodes: get().nodes.filter((n) => n.type !== 'hoseEnd' || stillUsed.has(n.id)) });
    } else set({ edges: nextEdges });
  },

  connect(c, kind) {
    const { nodes, edges, pythons } = get();
    if (!c.source || !c.target || c.source === c.target) return null;
    const used = (n: string, h?: string | null) => edges.some((e) => (e.source === n && e.sourceHandle === h) || (e.target === n && e.targetHandle === h));
    if (used(c.source, c.sourceHandle) || used(c.target, c.targetHandle)) return null;
    const sn = nodes.find((n) => n.id === c.source);
    const tn = nodes.find((n) => n.id === c.target);
    const sp = findPort(sn, c.sourceHandle, pythons);
    const tp = findPort(tn, c.targetHandle, pythons);
    if (!sp || !tp) return null;
    let type = kind;
    if (!type) {
      const a = sn && c.sourceHandle ? portAbs(sn, c.sourceHandle, pythons) : null;
      const b = tn && c.targetHandle ? portAbs(tn, c.targetHandle, pythons) : null;
      const dist = a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 999;
      type = dist < 16 && sp.kind !== 'tube' && tp.kind !== 'tube' ? 'direct' : 'hose';
      if (dist < 16 && (sp.kind === 'stem' || tp.kind === 'stem' || sp.kind === 'thread' || tp.kind === 'thread')) type = 'direct';
    }
    get().snapshot();
    const id = uid('e');
    const edge: Edge = type === 'direct'
      ? { id, type: 'direct', source: c.source, sourceHandle: c.sourceHandle, target: c.target, targetHandle: c.targetHandle, data: { kind: 'direct' } }
      : { id, type: 'hose', source: c.source, sourceHandle: c.sourceHandle, target: c.target, targetHandle: c.targetHandle, data: newHoseData(hoseSizeFor(sp, tp)) };
    set({ edges: [...get().edges, edge] });
    // koblingsform uten størrelse: får størrelsen til porten i andre enden
    const sized = (p: typeof sp) => !!p?.size && (p.kind === 'push' || p.kind === 'tube' || p.kind === 'stem' || p.kind === 'hosetail');
    if (!sp.size && sized(tp)) get().resolveGenericNode(c.source, tp.size);
    if (!tp.size && sized(sp)) get().resolveGenericNode(c.target, sp.size);
    return id;
  },

  addComponent(def, pos, rotation = 0) {
    get().snapshot();
    const id = uid('n');
    const node: Node = {
      id,
      type: 'comp',
      position: { x: Math.round(pos.x / GRID) * GRID, y: Math.round(pos.y / GRID) * GRID },
      data: { def: clone(def), rotation, flip: false },
    };
    set({ nodes: [...get().nodes, node] });
    return id;
  },

  addPython(pos) {
    get().snapshot();
    const py = newPython(4);
    const defA = pythonEndDef(py, 'A');
    const x = Math.round(pos.x / GRID) * GRID, y = Math.round(pos.y / GRID) * GRID;
    const a: Node = { id: uid('pyA'), type: 'pyEnd', position: { x, y }, data: { pythonId: py.id, end: 'A', rotation: 0, flip: true } };
    const b: Node = { id: uid('pyB'), type: 'pyEnd', position: { x: x + PY_W + 200, y }, data: { pythonId: py.id, end: 'B', rotation: 0, flip: false } };
    const e: Edge = { id: uid('py'), type: 'python', source: a.id, sourceHandle: 'body', target: b.id, targetHandle: 'body', data: { kind: 'python', pythonId: py.id } };
    void defA;
    set({ pythons: [...get().pythons, py], nodes: [...get().nodes, a, b], edges: [...get().edges, e] });
  },

  addText(pos) {
    get().snapshot();
    const node: Node = { id: uid('t'), type: 'text', position: { x: Math.round(pos.x / GRID) * GRID, y: Math.round(pos.y / GRID) * GRID }, data: { text: 'Tekst', size: 14 } };
    set({ nodes: [...get().nodes, node] });
  },

  updateNodeData(id, patch) {
    get().snapshot(`n:${id}:${Object.keys(patch).join(',')}`);
    set({ nodes: get().nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)) });
  },
  updateEdgeData(id, patch) {
    get().snapshot(`e:${id}:${Object.keys(patch).join(',')}`);
    set({ edges: get().edges.map((e) => (e.id === id ? { ...e, data: { ...e.data, ...patch } } : e)) });
  },
  setEdgeType(id, type) {
    get().snapshot();
    const { edges, nodes, pythons } = get();
    set({
      edges: edges.map((e) => {
        if (e.id !== id) return e;
        if (type === 'direct') return { ...e, type: 'direct', data: { kind: 'direct' } };
        const sp = findPort(nodes.find((n) => n.id === e.source), e.sourceHandle, pythons);
        const tp = findPort(nodes.find((n) => n.id === e.target), e.targetHandle, pythons);
        return { ...e, type: 'hose', data: newHoseData(hoseSizeFor(sp, tp)) };
      }),
    });
  },
  updatePython(id, patch) {
    get().snapshot(`p:${id}:${Object.keys(patch).join(',')}`);
    const pythons = get().pythons.map((p) => (p.id === id ? { ...p, ...patch } : p));
    const py = pythons.find((p) => p.id === id)!;
    // hold listene like lange som antall produktslanger
    const fit = <T,>(arr: T[] | undefined, fill: T) => { const a = [...(arr ?? [])]; while (a.length < py.products) a.push(fill); return a.slice(0, Math.max(py.products, a.length)); };
    py.productColors = fit(py.productColors, 'Grå');
    py.productMedia = fit(py.productMedia, 'any');
    py.productNames = fit(py.productNames, '');
    if (!py.coolMedium) py.coolMedium = 'vann';
    const valid = new Set(pythonEndDef(py, 'A').ports.map((p) => p.id));
    const endIds = new Set(get().nodes.filter((n) => n.type === 'pyEnd' && (n.data as any).pythonId === id).map((n) => n.id));
    const edges = get().edges.filter((e) => {
      if (e.type === 'python') return true;
      if (endIds.has(e.source) && !valid.has(e.sourceHandle ?? '')) return false;
      if (endIds.has(e.target) && !valid.has(e.targetHandle ?? '')) return false;
      return true;
    });
    // tving ny måling av håndtak
    const nodes = get().nodes.map((n) => (endIds.has(n.id) ? { ...n, data: { ...n.data, v: ((n.data as any).v ?? 0) + 1 } } : n));
    set({ pythons, edges, nodes });
  },
  setInfo(p) {
    get().snapshot(`i:${Object.keys(p).join(',')}`);
    set({ info: { ...get().info, ...p } });
  },

  rotateSelected(dir = 1) {
    const sel = get().nodes.filter((n) => n.selected && (n.type === 'comp' || n.type === 'pyEnd'));
    if (!sel.length) return;
    get().snapshot();
    const { pythons } = get();
    set({
      nodes: get().nodes.map((n) => {
        if (!n.selected || (n.type !== 'comp' && n.type !== 'pyEnd')) return n;
        const def = nodeDef(n, pythons)!;
        const d = n.data as any;
        const oldRot = d.rotation ?? 0;
        const rot = (oldRot + (dir === 1 ? 90 : 270)) % 360;
        // roter rundt senter
        const ow = oldRot % 180 ? def.h : def.w, oh = oldRot % 180 ? def.w : def.h;
        const nw = rot % 180 ? def.h : def.w, nh = rot % 180 ? def.w : def.h;
        const cx = n.position.x + ow / 2, cy = n.position.y + oh / 2;
        const pos = { x: Math.round((cx - nw / 2) / GRID) * GRID, y: Math.round((cy - nh / 2) / GRID) * GRID };
        return { ...n, position: pos, data: { ...d, rotation: rot } };
      }),
    });
  },
  flipSelected() {
    const sel = get().nodes.filter((n) => n.selected && (n.type === 'comp' || n.type === 'pyEnd'));
    if (!sel.length) return;
    get().snapshot();
    set({ nodes: get().nodes.map((n) => (n.selected && (n.type === 'comp' || n.type === 'pyEnd') ? { ...n, data: { ...n.data, flip: !(n.data as any).flip } } : n)) });
  },
  deleteSelected() {
    const { nodes, edges } = get();
    const nch: NodeChange[] = nodes.filter((n) => n.selected).map((n) => ({ type: 'remove', id: n.id }));
    const ech: EdgeChange[] = edges.filter((e) => e.selected).map((e) => ({ type: 'remove', id: e.id }));
    if (nch.length) get().onNodesChange(nch);
    const remaining = new Set(get().edges.map((e) => e.id));
    const ech2 = ech.filter((c) => remaining.has((c as any).id));
    if (ech2.length) get().onEdgesChange(ech2);
  },
  copySelected() {
    const { nodes, edges, pythons } = get();
    const sel = nodes.filter((n) => n.selected);
    if (!sel.length) return;
    const ids = new Set(sel.map((n) => n.id));
    // ta med begge pytonrørender
    const pyIds = new Set(sel.filter((n) => n.type === 'pyEnd').map((n) => (n.data as any).pythonId));
    for (const n of nodes) if (n.type === 'pyEnd' && pyIds.has((n.data as any).pythonId)) ids.add(n.id);
    // ta med åpne ender til valgte slanger og slanger mellom valgte noder
    for (const e of edges) if (e.selected) for (const id of [e.source, e.target]) if (nodes.find((n) => n.id === id)?.type === 'hoseEnd') ids.add(id);
    for (const e of edges) if (ids.has(e.source) || ids.has(e.target)) for (const id of [e.source, e.target]) {
      const n = nodes.find((x) => x.id === id);
      if (n?.type === 'hoseEnd' && (ids.has(e.source) || ids.has(e.target))) ids.add(id);
    }
    const cn = nodes.filter((n) => ids.has(n.id)).map(cleanNode);
    const ce = edges.filter((e) => ids.has(e.source) && ids.has(e.target));
    set({ clipboard: clone({ nodes: cn, edges: ce, pythons: pythons.filter((p) => pyIds.has(p.id)), info: get().info }) });
    get().showToast(`Kopierte ${cn.length} element`);
  },
  paste() {
    const cb = get().clipboard;
    if (!cb) return;
    get().snapshot();
    const map = new Map<string, string>();
    const pymap = new Map<string, string>();
    const pys = cb.pythons.map((p) => { const nid = uid('py'); pymap.set(p.id, nid); return { ...clone(p), id: nid }; });
    const nodes = cb.nodes.map((n) => {
      const nid = uid('n');
      map.set(n.id, nid);
      const data = clone(n.data) as any;
      if (n.type === 'pyEnd') data.pythonId = pymap.get(data.pythonId);
      return { ...n, id: nid, selected: true, position: { x: n.position.x + 40, y: n.position.y + 40 }, data };
    });
    const edges = cb.edges.map((e) => {
      const data = clone(e.data) as any;
      if (e.type === 'python') data.pythonId = pymap.get(data.pythonId);
      if (Array.isArray(data.points)) data.points = data.points.map((q: any) => ({ x: q.x + 40, y: q.y + 40 }));
      return { ...e, id: uid('e'), source: map.get(e.source)!, target: map.get(e.target)!, selected: false, data };
    });
    set({
      nodes: [...get().nodes.map((n) => ({ ...n, selected: false })), ...nodes],
      edges: [...get().edges.map((e) => ({ ...e, selected: false })), ...edges],
      pythons: [...get().pythons, ...pys],
      clipboard: {
        ...cb,
        nodes: cb.nodes.map((n) => ({ ...n, position: { x: n.position.x + 40, y: n.position.y + 40 } })),
        edges: cb.edges.map((e) => {
          const pts = (e.data as any)?.points;
          return Array.isArray(pts) ? { ...e, data: { ...e.data, points: pts.map((q: any) => ({ x: q.x + 40, y: q.y + 40 })) } } : e;
        }),
      },
    });
  },
  selectOnly({ nodes: ns = [], edges: es = [] }) {
    const nset = new Set(ns), eset = new Set(es);
    const fp = get().focusPort;
    if (fp && !nset.has(fp.split(':')[0])) set({ focusPort: null });
    set({
      nodes: get().nodes.map((n) => (!!n.selected === nset.has(n.id) ? n : { ...n, selected: nset.has(n.id) })),
      edges: get().edges.map((e) => (!!e.selected === eset.has(e.id) ? e : { ...e, selected: eset.has(e.id) })),
      focusTick: get().focusTick + 1,
    });
  },
  replaceEdges(remove, add) {
    get().snapshot();
    const rs = new Set(remove);
    set({ edges: [...get().edges.filter((e) => !rs.has(e.id)), ...add] });
  },
  moveNode(id, pos) {
    set({ nodes: get().nodes.map((n) => (n.id === id ? { ...n, position: pos } : n)) });
  },
  addFreeEnd(pos) {
    const id = uid('he');
    const c = { x: Math.round(pos.x / GRID) * GRID, y: Math.round(pos.y / GRID) * GRID };
    set({ nodes: [...get().nodes, { id, type: 'hoseEnd', position: { x: c.x - HOSE_END_SIZE / 2, y: c.y - HOSE_END_SIZE / 2 }, data: {} }] });
    return id;
  },
  hoseToFree(fromNode, fromHandle, pos) {
    const { nodes, pythons } = get();
    const n = nodes.find((x) => x.id === fromNode);
    const p = findPort(n, fromHandle, pythons);
    if (!n || !p) return null;
    get().snapshot();
    const endId = get().addFreeEnd(pos);
    const id = uid('e');
    const edge: Edge = { id, type: 'hose', source: fromNode, sourceHandle: fromHandle, target: endId, targetHandle: 'p', data: newHoseData(hoseSizeFor(p)) };
    set({ edges: [...get().edges, edge] });
    return id;
  },
  addFreeHose(pos) {
    get().snapshot();
    const a = get().addFreeEnd({ x: pos.x - 60, y: pos.y });
    const b = get().addFreeEnd({ x: pos.x + 60, y: pos.y });
    const id = uid('e');
    set({ edges: [...get().edges, { id, type: 'hose', source: a, sourceHandle: 'p', target: b, targetHandle: 'p', data: newHoseData('3/8"') }] });
    return id;
  },
  rewireEnd(edgeId, end, nodeId, handle, snapshot = true) {
    const { edges, nodes, pythons } = get();
    const e = edges.find((x) => x.id === edgeId);
    if (!e) return false;
    const used = edges.some((x) => x.id !== edgeId && ((x.source === nodeId && x.sourceHandle === handle) || (x.target === nodeId && x.targetHandle === handle)));
    if (used) return false;
    const other = end === 'source' ? e.target : e.source;
    if (other === nodeId) return false;
    if (snapshot) get().snapshot();
    const oldNode = end === 'source' ? e.source : e.target;
    const ne: Edge = end === 'source' ? { ...e, source: nodeId, sourceHandle: handle } : { ...e, target: nodeId, targetHandle: handle };
    // slange med åpen ende i andre enden: ta dimensjonen fra porten
    const otherNode = nodes.find((n) => n.id === other);
    if (e.type === 'hose' && otherNode?.type === 'hoseEnd') {
      const p = findPort(nodes.find((n) => n.id === nodeId), handle, pythons);
      if (p && (p.kind === 'push' || p.kind === 'tube') && p.size) ne.data = { ...ne.data, size: p.size };
    }
    // koblingsform uten størrelse i en av endene: får slangens / portens størrelse
    const newPort = findPort(nodes.find((n) => n.id === nodeId), handle, pythons);
    const otherDef = otherNode?.type === 'comp' ? ((otherNode.data as any).def as ComponentDef) : undefined;
    if (e.type === 'hose' && otherDef?.generic && newPort?.size && (newPort.kind === 'push' || newPort.kind === 'tube')) ne.data = { ...ne.data, size: newPort.size };
    const nextEdges = edges.map((x) => (x.id === edgeId ? ne : x));
    const stillUsed = new Set(nextEdges.flatMap((x) => [x.source, x.target]));
    set({ edges: nextEdges, nodes: nodes.filter((n) => n.id !== oldNode || n.type !== 'hoseEnd' || stillUsed.has(n.id)) });
    if (e.type === 'hose') {
      const hs = (ne.data as any).size as string;
      if (otherDef?.generic) get().resolveGenericNode(other, hs);
      if (!newPort?.size) get().resolveGenericNode(nodeId, hs);
    }
    return true;
  },
  openPopup(p) { set({ popup: p }); },
  setDrawTool(t) { set({ drawTool: t, popup: null }); },
  addShape(shape, a, b) {
    get().snapshot();
    const id = uid('s');
    const g = (v: number) => Math.round(v / GRID) * GRID;
    const x0 = g(Math.min(a.x, b.x)), y0 = g(Math.min(a.y, b.y));
    const x1 = g(Math.max(a.x, b.x)), y1 = g(Math.max(a.y, b.y));
    const node: Node = shape === 'rect'
      ? { id, type: 'shape', position: { x: x0, y: y0 }, width: Math.max(GRID * 2, x1 - x0), height: Math.max(GRID * 2, y1 - y0), zIndex: -1, data: { shape: 'rect', stroke: '#475569', dash: false, sw: 2, fill: '', label: '' } }
      : { id, type: 'shape', position: { x: x0, y: y0 }, zIndex: -1, data: { shape: 'line', ax: g(a.x) - x0, ay: g(a.y) - y0, bx: g(b.x) - x0, by: g(b.y) - y0, stroke: '#475569', dash: false, sw: 2, label: '' } };
    set({ nodes: [...get().nodes, node] });
    return id;
  },
  replaceNodeDef(nodeId, def, handleMap) {
    get().snapshot();
    const map = handleMap ?? {};
    set({
      nodes: get().nodes.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, def: clone(def) } } : n)),
      edges: get().edges.map((e) => {
        let ne = e;
        if (e.source === nodeId && e.sourceHandle && map[e.sourceHandle]) ne = { ...ne, sourceHandle: map[e.sourceHandle] };
        if (e.target === nodeId && e.targetHandle && map[e.targetHandle]) ne = { ...ne, targetHandle: map[e.targetHandle] };
        return ne;
      }),
    });
  },
  resolveGenericNode(nodeId, size) {
    const n = get().nodes.find((x) => x.id === nodeId);
    const def = n && n.type === 'comp' ? ((n.data as any).def as ComponentDef) : undefined;
    if (!def?.generic || !size) return false;
    const c = resolveGeneric(def.generic, size, get().library);
    if (!c) { get().showToast(`Fant ingen ${def.name.toLowerCase()} i ${size}`); return false; }
    set({ nodes: get().nodes.map((x) => (x.id === nodeId ? { ...x, data: { ...x.data, def: clone(c) } } : x)) });
    return true;
  },
  joinFreeEnds(aEnd, bEnd, def) {
    const { nodes, edges } = get();
    const A = nodes.find((n) => n.id === aEnd), B = nodes.find((n) => n.id === bEnd);
    const ea = edges.find((e) => e.source === aEnd || e.target === aEnd);
    const eb = edges.find((e) => e.source === bEnd || e.target === bEnd);
    if (!A || !B || !ea || !eb || ea.id === eb.id || def.ports.length !== 2) return false;
    const center = (n: Node) => ({ x: n.position.x + HOSE_END_SIZE / 2, y: n.position.y + HOSE_END_SIZE / 2 });
    const otherEndPos = (e: Edge, me: string) => {
      const oid = e.source === me ? e.target : e.source;
      const oh = e.source === me ? e.targetHandle : e.sourceHandle;
      const on = nodes.find((n) => n.id === oid);
      return (on && oh ? portAbs(on, oh, get().pythons) : null) ?? center(A);
    };
    const pa = otherEndPos(ea, aEnd), pb = otherEndPos(eb, bEnd);
    const c = center(B);
    const horizontal = Math.abs(pb.x - pa.x) >= Math.abs(pb.y - pa.y);
    const rotation = horizontal ? 0 : 90;
    const w = horizontal ? def.w : def.h, h = horizontal ? def.h : def.w;
    get().snapshot();
    const id = uid('n');
    const node: Node = { id, type: 'comp', position: { x: Math.round((c.x - w / 2) / GRID) * GRID, y: c.y - h / 2 }, data: { def: clone(def), rotation, flip: false, auto: true } };
    // port 1 sitter til venstre/øverst: gi den slangen som kommer fra den siden
    const [p1, p2] = def.ports;
    const aFirst = horizontal ? pa.x <= pb.x : pa.y <= pb.y;
    const sizeA = (ea.data as any)?.size, sizeB = (eb.data as any)?.size;
    let pA = aFirst ? p1 : p2, pB = aFirst ? p2 : p1;
    // reduksjon: dimensjonen må stemme
    if (p1.size !== p2.size && (pA.size !== sizeA || pB.size !== sizeB) && p1.size === sizeB && p2.size === sizeA) { pA = p2; pB = p1; }
    set({ nodes: [...nodes, node] });
    get().rewireEnd(ea.id, ea.source === aEnd ? 'source' : 'target', id, pA.id, false);
    get().rewireEnd(eb.id, eb.source === bEnd ? 'source' : 'target', id, pB.id, false);
    return true;
  },
  openBpSave(open) { set({ bpSave: open, popup: null }); },
  setSimOn(on) { set({ simOn: on, popup: null, drawTool: null }); },
  setSim(nodeId, patch) {
    set({ nodes: get().nodes.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, sim: { ...((n.data as any).sim ?? {}), ...patch } } } : n)) });
    get().markDirty();
  },
  blueprintFromSelection() {
    const { nodes, edges, pythons } = get();
    const ids = new Set(nodes.filter((n) => n.selected).map((n) => n.id));
    // begge pytonrør-endene
    const pyIds = new Set(nodes.filter((n) => ids.has(n.id) && n.type === 'pyEnd').map((n) => (n.data as any).pythonId));
    for (const n of nodes) if (n.type === 'pyEnd' && pyIds.has((n.data as any).pythonId)) ids.add(n.id);
    // åpne ender på slanger som er med
    const type = new Map(nodes.map((n) => [n.id, n.type]));
    for (const e of edges) {
      const sIn = ids.has(e.source), tIn = ids.has(e.target);
      if (sIn && type.get(e.target) === 'hoseEnd') ids.add(e.target);
      if (tIn && type.get(e.source) === 'hoseEnd') ids.add(e.source);
      if (e.selected) for (const id of [e.source, e.target]) if (type.get(id) === 'hoseEnd' && (ids.has(e.source) || ids.has(e.target))) ids.add(id);
    }
    const sel = nodes.filter((n) => ids.has(n.id));
    if (!sel.some((n) => n.type !== 'hoseEnd')) return null;
    // slanger som går ut av utvalget tas ikke med
    const es = edges.filter((e) => ids.has(e.source) && ids.has(e.target));
    // åpne ender som ikke lenger har slange droppes
    const used = new Set(es.flatMap((e) => [e.source, e.target]));
    const ns = sel.filter((n) => n.type !== 'hoseEnd' || used.has(n.id));
    const sizeOf = (n: Node) => ({ w: n.measured?.width ?? (n.width as number | undefined) ?? 40, h: n.measured?.height ?? (n.height as number | undefined) ?? 40 });
    const x0 = Math.min(...ns.map((n) => n.position.x)), y0 = Math.min(...ns.map((n) => n.position.y));
    const x1 = Math.max(...ns.map((n) => n.position.x + sizeOf(n).w)), y1 = Math.max(...ns.map((n) => n.position.y + sizeOf(n).h));
    const gx = Math.floor(x0 / GRID) * GRID, gy = Math.floor(y0 / GRID) * GRID;
    const outNodes = ns.map((n) => {
      const c = cleanNode(n) as any;
      delete c.selected;
      return { ...clone(c), position: { x: n.position.x - gx, y: n.position.y - gy } };
    });
    const outEdges = es.map((e) => {
      const c: any = clone({ ...e, selected: undefined });
      delete c.selected;
      if (c.type === 'hose') c.data = { ...c.data, length: null };
      if (Array.isArray(c.data?.points)) c.data.points = c.data.points.map((q: any) => ({ x: q.x - gx, y: q.y - gy }));
      return c;
    });
    const pys = pythons.filter((p) => pyIds.has(p.id)).map((p) => ({ ...clone(p), length: null }));
    return { id: uid('bp'), name: '', category: 'Egne', nodes: outNodes, edges: outEdges, pythons: pys, w: x1 - gx, h: y1 - gy, created: new Date().toISOString() };
  },
  async saveBlueprint(bp, replaceId) {
    const ul = get().userLib;
    const list = [...(ul.blueprints ?? [])];
    if (replaceId) {
      const i = list.findIndex((b) => b.id === replaceId);
      if (i >= 0) list[i] = { ...bp, id: replaceId };
      else list.push(bp);
    } else list.push(bp);
    const nl = { ...ul, blueprints: list };
    set({ userLib: nl });
    await saveUserLibrary(nl);
  },
  async updateBlueprint(id, patch) {
    const ul = get().userLib;
    const nl = { ...ul, blueprints: (ul.blueprints ?? []).map((b) => (b.id === id ? { ...b, ...patch } : b)) };
    set({ userLib: nl });
    await saveUserLibrary(nl);
  },
  async deleteBlueprint(id) {
    const ul = get().userLib;
    const nl = { ...ul, blueprints: (ul.blueprints ?? []).filter((b) => b.id !== id) };
    set({ userLib: nl });
    await saveUserLibrary(nl);
  },
  insertBlueprint(id, center) {
    const bp = (get().userLib.blueprints ?? []).find((b) => b.id === id);
    if (!bp) return;
    get().snapshot();
    const dx = Math.round((center.x - bp.w / 2) / GRID) * GRID, dy = Math.round((center.y - bp.h / 2) / GRID) * GRID;
    const map = new Map<string, string>(), pymap = new Map<string, string>();
    const pys = bp.pythons.map((p) => { const nid = uid('py'); pymap.set(p.id, nid); return { ...clone(p), id: nid }; });
    const nodes = bp.nodes.map((n: Node) => {
      const nid = n.type === 'hoseEnd' ? uid('he') : n.type === 'pyEnd' ? uid('py' + ((n.data as any).end ?? '')) : uid('n');
      map.set(n.id, nid);
      const data = clone(n.data) as any;
      if (n.type === 'pyEnd') data.pythonId = pymap.get(data.pythonId);
      return migrateNode({ ...clone(n), id: nid, selected: true, position: { x: n.position.x + dx, y: n.position.y + dy }, data });
    });
    const edges = bp.edges.map((e: Edge) => {
      const data = clone(e.data) as any;
      if (e.type === 'python') data.pythonId = pymap.get(data.pythonId);
      if (Array.isArray(data?.points)) data.points = data.points.map((q: any) => ({ x: q.x + dx, y: q.y + dy }));
      return { ...clone(e), id: uid('e'), source: map.get(e.source)!, target: map.get(e.target)!, selected: false, data };
    }).filter((e: Edge) => e.source && e.target);
    set({
      nodes: [...get().nodes.map((n) => (n.selected ? { ...n, selected: false } : n)), ...nodes],
      edges: [...get().edges.map((e) => (e.selected ? { ...e, selected: false } : e)), ...edges],
      pythons: [...get().pythons, ...pys],
      popup: null,
    });
    get().showToast(`Satte inn «${bp.name}»`);
  },
  async addHoseFav(f) {
    const ul = { ...get().userLib, hoseFavs: [...(get().userLib.hoseFavs ?? []), f] };
    set({ userLib: ul });
    await saveUserLibrary(ul);
  },
  async removeHoseFav(id) {
    const ul = { ...get().userLib, hoseFavs: (get().userLib.hoseFavs ?? []).filter((h) => h.id !== id) };
    set({ userLib: ul });
    await saveUserLibrary(ul);
  },
  async setLibOrder(key, ids) {
    const ul = { ...get().userLib, order: { ...(get().userLib.order ?? {}), [key]: ids } };
    set({ userLib: ul });
    await saveUserLibrary(ul);
  },
  async resetLibOrder() {
    const ul = { ...get().userLib, order: {} };
    set({ userLib: ul });
    await saveUserLibrary(ul);
  },
  async setFlavors(f) {
    const ul = { ...get().userLib, flavors: f };
    set({ userLib: ul });
    await saveUserLibrary(ul);
  },
  toggleIgnore(key) {
    get().snapshot(`ign:${key}`);
    const ig = get().ignored;
    set({ ignored: ig.includes(key) ? ig.filter((k) => k !== key) : [...ig, key] });
  },

  newProject() {
    set({ nodes: [], edges: [], pythons: [], ignored: [], info: emptyInfo(), filePath: null, dirty: false, past: [], future: [] });
    api.setDirty(false);
  },
  serialize() {
    const { nodes, edges, pythons, info } = get();
    const file: ProjectFile = {
      app: 'BarFlow', version: 1, info,
      nodes: nodes.map((n) => { const c = cleanNode(n) as any; delete c.selected; return c; }),
      edges: edges.map((e) => { const c = { ...e } as any; delete c.selected; return c; }),
      pythons,
      ignored: get().ignored,
    };
    return JSON.stringify(file, null, 1);
  },
  loadProject(content, path) {
    try {
      const f = JSON.parse(content) as ProjectFile;
      if (f.app !== 'BarFlow') throw new Error('ukjent fil');
      set({
        nodes: (f.nodes ?? []).map(migrateNode), edges: f.edges ?? [], pythons: f.pythons ?? [], ignored: f.ignored ?? [], info: { ...emptyInfo(), ...(f.info ?? {}) },
        filePath: path, dirty: false, past: [], future: [],
      });
      api.setDirty(false);
      return true;
    } catch {
      return false;
    }
  },
  setFilePath(p) {
    set({ filePath: p, dirty: false });
    api.setDirty(false);
  },

  openPicker(p) { set({ picker: p }); },
  openEditor(def, isNew = false) { set({ editor: def ? { def: clone(def), isNew } : null }); },
  setInfoOpen(o) { set({ infoOpen: o }); },
  async saveComponent(def) {
    const ul = clone(get().userLib);
    ul.items = ul.items.filter((i) => i.id !== def.id);
    ul.items.push(def);
    ul.hidden = ul.hidden.filter((h) => h !== def.id);
    set({ userLib: ul, library: effectiveLibrary(ul) });
    await saveUserLibrary(ul);
  },
  async deleteComponent(id) {
    const ul = clone(get().userLib);
    const wasUser = ul.items.find((i) => i.id === id && i.source === 'user');
    ul.items = ul.items.filter((i) => i.id !== id);
    if (!wasUser) ul.hidden.push(id);
    set({ userLib: ul, library: effectiveLibrary(ul) });
    await saveUserLibrary(ul);
  },
  async toggleFavorite(id) {
    const ul = clone(get().userLib);
    ul.favorites = ul.favorites.includes(id) ? ul.favorites.filter((f) => f !== id) : [...ul.favorites, id];
    set({ userLib: ul });
    await saveUserLibrary(ul);
  },
  async importUserLib(lib) {
    const ul = { ...emptyUserLib(), ...lib };
    set({ userLib: ul, library: effectiveLibrary(ul) });
    await saveUserLibrary(ul);
  },
  refreshNodesFromLibrary(defId) {
    const def = get().library.find((d) => d.id === defId);
    if (!def) return;
    get().snapshot();
    const valid = new Set(def.ports.map((p) => p.id));
    const ids = new Set(get().nodes.filter((n) => n.type === 'comp' && (n.data as any).def.id === defId).map((n) => n.id));
    set({
      nodes: get().nodes.map((n) => (ids.has(n.id) ? { ...n, data: { ...n.data, def: clone(def) } } : n)),
      edges: get().edges.filter((e) => !(ids.has(e.source) && !valid.has(e.sourceHandle ?? '')) && !(ids.has(e.target) && !valid.has(e.targetHandle ?? ''))),
    });
  },
}));
