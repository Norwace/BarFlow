import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ReactFlow, Background, BackgroundVariant, Controls, MiniMap, ConnectionMode, SelectionMode, useReactFlow,
  type Connection, type Edge, type Node, type FinalConnectionState, type OnConnectStartParams, type HandleType,
} from '@xyflow/react';
import { useStore } from '../store';
import { nodeTypes } from './flow/nodes';
import { edgeTypes } from './flow/edges';
import { AnalysisContext, DragHintContext, HighlightContext, SimContext, type DragHint } from './flow/context';
import { simKind, towerTaps, type SimResult } from '../lib/sim';
import { connectedSet } from '../lib/connected';
import { hoseLook, glowColor, shownHose } from '../lib/colors';
import { flavorsOf } from '../lib/library';
import { pythonEndDef } from '../lib/python';
import type { Analysis } from '../lib/compat';
import { nodeDef, HOSE_END_SIZE } from '../lib/compat';
import { portAbs, directCompatible, portLocal, nodeRot, opposite, portSideAbs, rotationFor, positionForPort } from '../lib/place';
import { normSize, transformSide, rotatedSize } from '../lib/geometry';
import { uid } from '../lib/ids';
import { GRID } from '../lib/constants';
import type { ComponentDef, HoseData, PortDef } from '../lib/types';
import Popups from './HosePopup';
import { findFittings, isElbow, isStandard, isUBend } from '../lib/autofit';

const SNAP_DIST = 22;
type Pt = { x: number; y: number };

function hosePathEl(id: string) {
  return document.querySelector(`.react-flow__edge[data-id="${CSS.escape(id)}"] path.react-flow__edge-path`) as SVGPathElement | null;
}

/** nærmeste punkt på en SVG-sti */
function closestOnPath(el: SVGPathElement, pt: Pt): { s: number; d: number; len: number } {
  const len = el.getTotalLength();
  let best = { s: 0, d: Infinity, len };
  const step = Math.max(2, len / 300);
  for (let s = 0; s <= len; s += step) {
    const q = el.getPointAtLength(s);
    const d = Math.hypot(q.x - pt.x, q.y - pt.y);
    if (d < best.d) best = { s, d, len };
  }
  return best;
}

function nearestHose(pt: Pt, maxD = 14, filter?: (e: Edge) => boolean): string | null {
  const st = useStore.getState();
  let best: string | null = null, bd = maxD;
  for (const e of st.edges) {
    if (e.type !== 'hose' || (filter && !filter(e))) continue;
    const el = hosePathEl(e.id);
    if (!el) continue;
    const bb = el.getBBox();
    if (pt.x < bb.x - maxD || pt.x > bb.x + bb.width + maxD || pt.y < bb.y - maxD || pt.y > bb.y + bb.height + maxD) continue;
    const c = closestOnPath(el, pt);
    if (c.d < bd) { bd = c.d; best = e.id; }
  }
  return best;
}

type Snap =
  | { kind: 'port'; mine: string; other: Node; otherHandle: string; dx: number; dy: number; at: Pt }
  | { kind: 'toFree'; mine: string; endNode: Node; edgeId: string; end: 'source' | 'target'; dx: number; dy: number; at: Pt }
  | { kind: 'freeToPort'; other: Node; otherHandle: string; edgeId: string; end: 'source' | 'target'; at: Pt }
  | { kind: 'freeToFree'; other: Node; at: Pt };

/** Finn ledig port der en kobling kan settes rett på når den slippes ved punktet */
export function dropSnap(def: ComponentDef, at: Pt, radius = 45): { rotation: number; pos: Pt; mine: string; other: string; otherHandle: string } | null {
  const st = useStore.getState();
  const used = new Set(st.edges.flatMap((e) => [`${e.source}:${e.sourceHandle}`, `${e.target}:${e.targetHandle}`]));
  let best: { rotation: number; pos: Pt; mine: string; other: string; otherHandle: string } | null = null;
  let bd = radius;
  for (const o of st.nodes) {
    if (o.type !== 'comp' && o.type !== 'pyEnd') continue;
    const od = nodeDef(o, st.pythons);
    if (!od) continue;
    for (const q of od.ports) {
      if (used.has(`${o.id}:${q.id}`)) continue;
      const b = portAbs(o, q.id, st.pythons);
      if (!b || Math.hypot(b.x - at.x, b.y - at.y) > radius + Math.max(def.w, def.h)) continue;
      const want = opposite(portSideAbs(o, q));
      for (const p of def.ports) {
        if (!directCompatible(p, q)) continue;
        const rotation = rotationFor(p, want);
        const pos = positionForPort(def, p, rotation, b);
        const sz = rotatedSize(def.w, def.h, rotation);
        const dd = Math.hypot(pos.x + sz.w / 2 - at.x, pos.y + sz.h / 2 - at.y);
        if (dd < bd) { bd = dd; best = { rotation, pos, mine: p.id, other: o.id, otherHandle: q.id }; }
      }
    }
  }
  return best;
}

/** Sett en kobling inn i en eksisterende slange */
export function insertIntoHose(nodeId: string, edgeId: string): boolean {
  const st = useStore.getState();
  let node = st.nodes.find((n) => n.id === nodeId);
  const e = st.edges.find((x) => x.id === edgeId);
  if (!node || !e || node.type !== 'comp') return false;
  const hd = e.data as HoseData;
  // koblingsform uten størrelse: får slangens størrelse
  if ((nodeDef(node, st.pythons) as ComponentDef).generic) {
    if (!st.resolveGenericNode(nodeId, hd.size)) return false;
    node = useStore.getState().nodes.find((n) => n.id === nodeId)!;
  }
  const def = nodeDef(node, st.pythons) as ComponentDef;
  const el = hosePathEl(e.id);
  if (!el) return false;
  const w0 = node.measured?.width ?? def.w, h0 = node.measured?.height ?? def.h;
  const center = { x: node.position.x + w0 / 2, y: node.position.y + h0 / 2 };
  const c = closestOnPath(el, center);
  const P = el.getPointAtLength(c.s);
  const A = el.getPointAtLength(Math.max(0, c.s - 5)), B = el.getPointAtLength(Math.min(c.len, c.s + 5));
  const horizontal = Math.abs(B.x - A.x) >= Math.abs(B.y - A.y);
  const ports = def.ports.filter((p) => p.kind === 'push' || p.kind === 'stem' || p.kind === 'tube');
  if (ports.length < 2) return false;
  const opp = (a: PortDef, b: PortDef) => (a.side === 'left' && b.side === 'right') || (a.side === 'right' && b.side === 'left') || (a.side === 'top' && b.side === 'bottom') || (a.side === 'bottom' && b.side === 'top');
  let best: [PortDef, PortDef] | null = null, bs = Infinity;
  for (let i = 0; i < ports.length; i++) for (let j = i + 1; j < ports.length; j++) {
    const a = ports[i], b = ports[j];
    const sc = (opp(a, b) ? 0 : 10) + (normSize(a.size) === normSize(hd.size) ? 0 : 3) + (normSize(b.size) === normSize(hd.size) ? 0 : 3) + (a.kind === 'push' ? 0 : 2) + (b.kind === 'push' ? 0 : 2);
    if (sc < bs) { bs = sc; best = [a, b]; }
  }
  if (!best) return false;
  let [pa, pb] = best;
  const { flip } = nodeRot(node);
  let rot = nodeRot(node).rotation;
  if (opp(pa, pb)) {
    const sideH = (s: string) => s === 'left' || s === 'right';
    if (sideH(transformSide(pa.side, rot, flip)) !== horizontal) rot = (rot + 90) % 360;
  }
  const la = portLocal(def, pa, rot, flip), lb = portLocal(def, pb, rot, flip);
  const mid = { x: (la.x + lb.x) / 2, y: (la.y + lb.y) / 2 };
  let pos = { x: P.x - mid.x, y: P.y - mid.y };
  pos = horizontal ? { x: Math.round(pos.x / GRID) * GRID, y: P.y - la.y } : { x: P.x - la.x, y: Math.round(pos.y / GRID) * GRID };
  // hvilken port skal mot kilden?
  const absA = { x: pos.x + la.x, y: pos.y + la.y }, absB = { x: pos.x + lb.x, y: pos.y + lb.y };
  const towardSrc = el.getPointAtLength(Math.max(0, c.s - 40));
  if (Math.hypot(absB.x - towardSrc.x, absB.y - towardSrc.y) < Math.hypot(absA.x - towardSrc.x, absA.y - towardSrc.y)) [pa, pb] = [pb, pa];
  // fordel knekkpunkter
  let pts1: Pt[] | undefined, pts2: Pt[] | undefined;
  if (hd.points) {
    pts1 = []; pts2 = [];
    for (const q of hd.points) {
      const cq = closestOnPath(el, q);
      (cq.s < c.s ? pts1 : pts2).push(q);
    }
  }
  const half = hd.length != null ? Math.round((hd.length / 2) * 100) / 100 : null;
  const e1: Edge = { id: uid('e'), type: 'hose', source: e.source, sourceHandle: e.sourceHandle, target: node.id, targetHandle: pa.id, data: { ...hd, length: half, points: pts1, fitT: undefined } };
  const e2: Edge = { id: uid('e'), type: 'hose', source: node.id, sourceHandle: pb.id, target: e.target, targetHandle: e.targetHandle, data: { ...hd, length: half, points: pts2, fitS: undefined } };
  st.snapshot();
  const fresh = useStore.getState();
  useStore.setState({
    nodes: fresh.nodes.map((n) => (n.id === node!.id ? { ...n, position: pos, data: { ...n.data, rotation: rot } } : n)),
    edges: [...fresh.edges.filter((x) => x.id !== e.id), e1, e2],
  });
  st.showToast('Satt inn i slangen');
  return true;
}

export default function Canvas({ analysis, sim }: { analysis: Analysis; sim: SimResult | null }) {
  const nodes = useStore((s) => s.nodes);
  const storeEdges = useStore((s) => s.edges);
  const onNodesChange = useStore((s) => s.onNodesChange);
  const onEdgesChange = useStore((s) => s.onEdgesChange);
  const connect = useStore((s) => s.connect);
  const rf = useReactFlow();
  const wrapper = useRef<HTMLDivElement>(null);
  const connectStart = useRef<OnConnectStartParams | null>(null);
  const reconnecting = useRef<{ edgeId: string; moving: 'source' | 'target'; done: boolean } | null>(null);
  const [hint, setHint] = useState<DragHint>({});

  const pythons = useStore((s) => s.pythons);
  const drawTool = useStore((s) => s.drawTool);
  const lastDragEnd = useRef(0);

  // åpne slangeender ligger over (valgte) slanger så de kan dras. Streker/bokser tar bare klikk på kanten
  const rfNodes = useMemo(() => nodes.map((n) => {
    if (n.type === 'hoseEnd' && n.zIndex !== 2000) return { ...n, zIndex: 2000 };
    if (n.type === 'shape' && n.style?.pointerEvents !== 'none') return { ...n, style: { ...n.style, pointerEvents: 'none' as const } };
    return n;
  }), [nodes]);

  // lys opp alt som henger sammen med det som er valgt
  const focusPort = useStore((s) => s.focusPort);
  const flavors = useStore((s) => flavorsOf(s.userLib));
  const selKey = nodes.filter((n) => n.selected).map((n) => n.id).join(',') + '|' + storeEdges.filter((e) => e.selected).map((e) => e.id).join(',');
  const simOn = useStore((s) => s.simOn);
  const highlight = useMemo(() => {
    const st = useStore.getState();
    const sn = st.nodes.filter((n) => n.selected), se = st.edges.filter((e) => e.selected);
    if (sn.length + se.length !== 1) return null;
    if (sn[0] && (sn[0].type === 'text' || sn[0].type === 'shape')) return null;
    const tube = sn[0]?.type === 'pyEnd' && focusPort && focusPort.startsWith(sn[0].id + ':') ? focusPort : null;
    const h = connectedSet(st.nodes, st.edges, st.pythons, tube ? { ports: [tube] } : { nodes: sn.map((n) => n.id), edges: se.map((e) => e.id) });
    const edgeColor = new Map<string, string>();
    const nodeColor = new Map<string, string>();
    for (const e of st.edges) {
      if (e.type !== 'hose' || !h.edges.has(e.id)) continue;
      const sh = shownHose(e.data as HoseData, analysis.hoseMedium.get(e.id), analysis.hoseFlavor.get(e.id), sim?.edgeMedia.get(e.id));
      edgeColor.set(e.id, glowColor(hoseLook(sh.data, sh.medium, sh.flavor, flavors).color));
    }
    for (const e of st.edges) {
      if (e.type !== 'hose' || !h.edges.has(e.id)) continue;
      for (const nid of [e.source, e.target]) if (h.nodes.has(nid) && !nodeColor.has(nid)) nodeColor.set(nid, edgeColor.get(e.id)!);
    }
    // fargen til slangen i pytonrøret
    const tubeColor = (key: string) => {
      const [nid, pid] = key.split(':');
      const n = st.nodes.find((x) => x.id === nid);
      const py = n && st.pythons.find((p) => p.id === (n.data as any).pythonId);
      const c = py ? pythonEndDef(py, (n!.data as any).end).ports.find((q) => q.id === pid)?.color : undefined;
      return c ? glowColor(c) : undefined;
    };
    const startColor = (tube && tubeColor(tube)) ?? (se[0] && edgeColor.get(se[0].id)) ?? (sn[0] && nodeColor.get(sn[0].id)) ?? '#f59e0b';
    for (const nid of h.nodes) if (!nodeColor.has(nid)) nodeColor.set(nid, startColor);
    for (const e of st.edges) {
      if (!h.edges.has(e.id) || edgeColor.has(e.id)) continue;
      if (e.type === 'python') {
        // én slange i røret: rørets glød i slangens farge
        const lit = [...h.ports].filter((k) => k.startsWith(e.source + ':') && /:p\d+$/.test(k));
        const whole = se[0]?.id === e.id || (sn[0]?.type === 'pyEnd' && !tube);
        edgeColor.set(e.id, !whole && lit.length === 1 ? tubeColor(lit[0]) ?? '#64748b' : '#64748b');
      } else edgeColor.set(e.id, nodeColor.get(e.source) ?? startColor);
    }
    return { ...h, nodeColor, edgeColor };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selKey, analysis, pythons, focusPort, flavors, simOn, sim]);

  // åpne ender skal kunne dras som noder, ikke via ende-ankeret
  const edges = useMemo(() => {
    const types = new Map(nodes.map((n) => [n.id, n.type]));
    return storeEdges.map((e) => {
      // endene kan bare flyttes når slangen er valgt (ellers ligger håndtaket over koblingssymbolet)
      if (e.type !== 'hose' || !e.selected) return e.reconnectable === false ? e : { ...e, reconnectable: false };
      const sFree = types.get(e.source) === 'hoseEnd', tFree = types.get(e.target) === 'hoseEnd';
      const r: Edge['reconnectable'] = sFree && tFree ? false : sFree ? 'target' : tFree ? 'source' : true;
      return e.reconnectable === r ? e : { ...e, reconnectable: r };
    });
  }, [storeEdges, nodes]);

  const isValidConnection = useCallback((c: Connection | Edge) => {
    if (c.source === c.target) return false;
    if (c.sourceHandle === 'body' || c.targetHandle === 'body') return false;
    const { edges, nodes } = useStore.getState();
    const types = new Map(nodes.map((n) => [n.id, n.type]));
    const skip = reconnecting.current?.edgeId;
    let fixedNode: string | null = null;
    if (reconnecting.current) {
      const re = edges.find((e) => e.id === skip);
      fixedNode = re ? (reconnecting.current.moving === 'source' ? re.target : re.source) : null;
    }
    for (const id of [c.source, c.target]) if (types.get(id) === 'hoseEnd' && id !== fixedNode) return false;
    const used = (n: string, h?: string | null) => edges.some((e) => e.id !== skip && ((e.source === n && e.sourceHandle === h) || (e.target === n && e.targetHandle === h)));
    return !used(c.source, c.sourceHandle) && !used(c.target, c.targetHandle);
  }, []);

  const onConnect = useCallback((c: Connection) => {
    const id = connect(c);
    if (id) {
      const e = useStore.getState().edges.find((x) => x.id === id);
      if (e?.type === 'hose') useStore.getState().selectOnly({ edges: [id] });
    }
  }, [connect]);

  const onConnectStart = useCallback((_: any, params: OnConnectStartParams) => {
    connectStart.current = params;
  }, []);

  const onConnectEnd = useCallback((event: MouseEvent | TouchEvent, state: FinalConnectionState) => {
    const start = connectStart.current;
    connectStart.current = null;
    if (reconnecting.current) return;
    if (state.isValid || !start?.nodeId || !start.handleId) return;
    const target = event.target as HTMLElement;
    if (!target || target.closest?.('.react-flow__node') || !target.closest?.('.react-flow')) return;
    const { clientX, clientY } = 'changedTouches' in event ? event.changedTouches[0] : (event as MouseEvent);
    const flow = rf.screenToFlowPosition({ x: clientX, y: clientY });
    const st = useStore.getState();
    if ((event as MouseEvent).shiftKey) {
      const rect = wrapper.current!.getBoundingClientRect();
      st.openPicker({ screen: { x: clientX - rect.left, y: clientY - rect.top }, flow, fromNode: start.nodeId, fromHandle: start.handleId });
      return;
    }
    // sluppet på en annen slange: sett inn T-stykke og koble til grenen
    const hoseId = nearestHose(flow, 10);
    if (hoseId) {
      const hose = st.edges.find((e) => e.id === hoseId)!;
      const size = (hose.data as HoseData).size;
      const tee = st.library.find((d) => (d.note ?? '').startsWith('TU ') && isStandard(d) && d.ports.every((p) => normSize(p.size) === normSize(size)))
        ?? st.library.find((d) => (d.note ?? '').startsWith('TU ') && d.ports.every((p) => normSize(p.size) === normSize(size)));
      if (tee) {
        const nid = st.addComponent(tee, { x: flow.x - tee.w / 2, y: flow.y - tee.h / 2 });
        if (insertIntoHose(nid, hoseId)) {
          const st2 = useStore.getState();
          const used = new Set(st2.edges.flatMap((e) => [e.source === nid ? e.sourceHandle : null, e.target === nid ? e.targetHandle : null]));
          const free = tee.ports.find((p) => !used.has(p.id));
          if (free) {
            const eid = st2.connect({ source: start.nodeId, sourceHandle: start.handleId, target: nid, targetHandle: free.id }, 'hose');
            if (eid) st2.selectOnly({ edges: [eid] });
            st2.showToast(`T-stykke ${tee.artnr ?? ''} satt inn`);
          }
          return;
        }
        // klarte ikke å sette inn: fjern T-stykket igjen
        useStore.getState().undo();
      }
    }
    const eid = st.hoseToFree(start.nodeId, start.handleId, flow);
    if (eid) st.selectOnly({ edges: [eid] });
  }, [rf]);

  // flytte slangeende fra én port til en annen (eller til tomt område)
  const onReconnectStart = useCallback((_: any, edge: Edge, handleType: HandleType) => {
    reconnecting.current = { edgeId: edge.id, moving: handleType === 'target' ? 'source' : 'target', done: false };
  }, []);
  const onReconnect = useCallback((old: Edge, c: Connection) => {
    const r = reconnecting.current;
    if (!r) return;
    const fixedNode = r.moving === 'source' ? old.target : old.source;
    const fixedHandle = r.moving === 'source' ? old.targetHandle : old.sourceHandle;
    const isFixedSource = c.source === fixedNode && c.sourceHandle === fixedHandle;
    const nn = isFixedSource ? c.target : c.source;
    const nh = isFixedSource ? c.targetHandle : c.sourceHandle;
    if (nn && nh) r.done = useStore.getState().rewireEnd(old.id, r.moving, nn, nh);
  }, []);
  const onReconnectEnd = useCallback((event: MouseEvent | TouchEvent, edge: Edge) => {
    const r = reconnecting.current;
    setTimeout(() => { reconnecting.current = null; }, 0);
    if (!r || r.done) return;
    const target = event.target as HTMLElement;
    if (!target?.classList?.contains('react-flow__pane')) return;
    const { clientX, clientY } = 'changedTouches' in event ? event.changedTouches[0] : (event as MouseEvent);
    const flow = rf.screenToFlowPosition({ x: clientX, y: clientY });
    const st = useStore.getState();
    st.snapshot();
    const endId = st.addFreeEnd(flow);
    st.rewireEnd(edge.id, r.moving, endId, 'p', false);
  }, [rf]);

  const dragOverTimer = useRef(0);
  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    const now = performance.now();
    if (now - dragOverTimer.current < 80) return;
    dragOverTimer.current = now;
    if (e.dataTransfer.types.includes('application/barflow-bp')) return;
    const f = rf.screenToFlowPosition({ x: e.clientX, y: e.clientY });
    const ins = nearestHose(f);
    setHint((h) => (h.insertEdge === ins ? h : { insertEdge: ins }));
  }, [rf]);

  const onDragLeave = useCallback(() => setHint({}), []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setHint({});
    const id = e.dataTransfer.getData('application/barflow');
    if (!id) return;
    const pos = rf.screenToFlowPosition({ x: e.clientX, y: e.clientY });
    const st = useStore.getState();
    if (id === '__python__') return st.addPython({ x: pos.x - 20, y: pos.y - 60 });
    if (id === '__text__') return st.addText(pos);
    if (id === '__hose__') { const eid = st.addFreeHose(pos); st.selectOnly({ edges: [eid] }); return; }
    if (id.startsWith('__bp__:')) { st.insertBlueprint(id.slice(7), pos); return; }
    const def = st.library.find((d) => d.id === id);
    if (!def) return;
    // kobling sluppet ved en ledig port (f.eks. slange i pytonrør): sett den rett på
    if (def.group !== 'Utstyr') {
      const sn = dropSnap(def, pos);
      if (sn) {
        const nid = st.addComponent(def, sn.pos, sn.rotation);
        st.moveNode(nid, sn.pos);
        st.connect({ source: nid, sourceHandle: sn.mine, target: sn.other, targetHandle: sn.otherHandle }, 'direct');
        st.selectOnly({ nodes: [nid] });
        st.showToast('Satt på porten');
        return;
      }
    }
    const nid = st.addComponent(def, { x: pos.x - def.w / 2, y: pos.y - def.h / 2 });
    // sluppet på en slange? sett inn
    if (def.group !== 'Utstyr') {
      const hoseId = nearestHose(pos);
      if (hoseId && insertIntoHose(nid, hoseId)) { st.selectOnly({ nodes: [nid] }); return; }
    }
    st.selectOnly({ nodes: [nid] });
  }, [rf]);

  /** Finn slange under node / port å snappe til */
  const computeDragTargets = useCallback((node: Node): { insertEdge: string | null; snap: Snap | null } => {
    const st = useStore.getState();
    const usedAll = analysis.used;
    // åpen slangeende: snapp til ledig port
    if (node.type === 'hoseEnd') {
      const e = st.edges.find((x) => x.source === node.id || x.target === node.id);
      if (!e) return { insertEdge: null, snap: null };
      const end: 'source' | 'target' = e.source === node.id ? 'source' : 'target';
      const otherId = end === 'source' ? e.target : e.source;
      const c = { x: node.position.x + HOSE_END_SIZE / 2, y: node.position.y + HOSE_END_SIZE / 2 };
      let snap: Snap | null = null, best = SNAP_DIST;
      // åpen ende mot åpen ende: skjøt
      for (const o of st.nodes) {
        if (o.type !== 'hoseEnd' || o.id === node.id || o.id === otherId) continue;
        const b = { x: o.position.x + HOSE_END_SIZE / 2, y: o.position.y + HOSE_END_SIZE / 2 };
        const dd = Math.hypot(b.x - c.x, b.y - c.y);
        if (dd < best) { best = dd; snap = { kind: 'freeToFree', other: o, at: b }; }
      }
      for (const o of st.nodes) {
        if ((o.type !== 'comp' && o.type !== 'pyEnd') || o.id === otherId) continue;
        const od = nodeDef(o, st.pythons);
        if (!od) continue;
        if (Math.abs(o.position.x - c.x) > od.w + od.h + 40 || Math.abs(o.position.y - c.y) > od.w + od.h + 40) continue;
        for (const q of od.ports) {
          if (usedAll.has(`${o.id}:${q.id}`)) continue;
          const b = portAbs(o, q.id, st.pythons);
          if (!b) continue;
          const dd = Math.hypot(b.x - c.x, b.y - c.y);
          if (dd < best) { best = dd; snap = { kind: 'freeToPort', other: o, otherHandle: q.id, edgeId: e.id, end, at: b }; }
        }
      }
      return { insertEdge: null, snap };
    }
    if (node.type !== 'comp') return { insertEdge: null, snap: null };
    const def = nodeDef(node, st.pythons) as ComponentDef;
    const usedHere = new Set(st.edges.flatMap((e) => [e.source === node.id ? e.sourceHandle : null, e.target === node.id ? e.targetHandle : null]).filter(Boolean) as string[]);
    const freePorts = def.ports.filter((p) => !usedHere.has(p.id));
    let snap: Snap | null = null;
    let best = SNAP_DIST;
    const freeEnds = st.nodes.filter((n) => n.type === 'hoseEnd');
    for (const p of freePorts) {
      const a = portAbs(node, p.id, st.pythons);
      if (!a) continue;
      // port mot port (direkte)
      for (const o of st.nodes) {
        if (o.id === node.id || (o.type !== 'comp' && o.type !== 'pyEnd')) continue;
        const od = nodeDef(o, st.pythons);
        if (!od) continue;
        if (Math.abs(o.position.x - a.x) > od.w + od.h + 40 || Math.abs(o.position.y - a.y) > od.w + od.h + 40) continue;
        for (const q of od.ports) {
          if (usedAll.has(`${o.id}:${q.id}`)) continue;
          if (!directCompatible(p, q)) continue;
          const b = portAbs(o, q.id, st.pythons);
          if (!b) continue;
          const dd = Math.hypot(a.x - b.x, a.y - b.y);
          if (dd < best) { best = dd; snap = { kind: 'port', mine: p.id, other: o, otherHandle: q.id, dx: b.x - a.x, dy: b.y - a.y, at: b }; }
        }
      }
      // port mot åpen slangeende
      if (p.kind === 'other') continue;
      for (const fe of freeEnds) {
        const b = { x: fe.position.x + HOSE_END_SIZE / 2, y: fe.position.y + HOSE_END_SIZE / 2 };
        const dd = Math.hypot(a.x - b.x, a.y - b.y);
        if (dd >= best) continue;
        const e = st.edges.find((x) => x.source === fe.id || x.target === fe.id);
        if (!e) continue;
        const end: 'source' | 'target' = e.source === fe.id ? 'source' : 'target';
        if ((end === 'source' ? e.target : e.source) === node.id) continue;
        best = dd;
        snap = { kind: 'toFree', mine: p.id, endNode: fe, edgeId: e.id, end, dx: b.x - a.x, dy: b.y - a.y, at: b };
      }
    }
    // innsetting i slange (koblinger uten tilkoblinger med minst 2 push-porter)
    let insertEdge: string | null = null;
    const pushFree = freePorts.filter((p) => p.kind === 'push' || p.kind === 'stem');
    if (!snap && usedHere.size === 0 && pushFree.length >= 2 && def.group !== 'Utstyr') {
      const cx = node.position.x + (node.measured?.width ?? def.w) / 2;
      const cy = node.position.y + (node.measured?.height ?? def.h) / 2;
      insertEdge = nearestHose({ x: cx, y: cy });
    }
    return { insertEdge, snap };
  }, [analysis]);

  const pendingDrag = useRef<Node | null>(null);
  const dragTimer = useRef<number | null>(null);
  const onNodeDrag = useCallback((_: any, node: Node) => {
    pendingDrag.current = node;
    if (dragTimer.current != null) return;
    dragTimer.current = window.setTimeout(() => {
      dragTimer.current = null;
      const n = pendingDrag.current;
      if (!n) return;
      const st = useStore.getState();
      const cur = st.nodes.find((x) => x.id === n.id) ?? n;
      const { insertEdge, snap } = computeDragTargets(cur);
      const snapPort = snap ? snap.at : null;
      setHint((h) => (h.insertEdge === insertEdge && h.snapPort?.x === snapPort?.x && h.snapPort?.y === snapPort?.y ? h : { insertEdge, snapPort }));
    }, 50);
  }, [computeDragTargets]);

  const onNodeDragStart = useCallback(() => {
    useStore.getState().snapshot();
    useStore.getState().openPopup(null);
  }, []);

  const onNodeDragStop = useCallback((_: any, node: Node) => {
    lastDragEnd.current = performance.now();
    pendingDrag.current = null;
    if (dragTimer.current != null) { clearTimeout(dragTimer.current); dragTimer.current = null; }
    setHint({});
    const st = useStore.getState();
    const cur = st.nodes.find((n) => n.id === node.id) ?? node;
    const { insertEdge, snap } = computeDragTargets(cur);
    if (snap?.kind === 'port') {
      st.moveNode(cur.id, { x: cur.position.x + snap.dx, y: cur.position.y + snap.dy });
      if (st.connect({ source: cur.id, sourceHandle: snap.mine, target: snap.other.id, targetHandle: snap.otherHandle }, 'direct')) st.showToast('Koblet sammen');
      return;
    }
    if (snap?.kind === 'toFree') {
      st.moveNode(cur.id, { x: cur.position.x + snap.dx, y: cur.position.y + snap.dy });
      if (st.rewireEnd(snap.edgeId, snap.end, cur.id, snap.mine)) st.showToast('Koblet på slangen');
      return;
    }
    if (snap?.kind === 'freeToPort') {
      if (st.rewireEnd(snap.edgeId, snap.end, snap.other.id, snap.otherHandle)) st.showToast('Slangen er koblet til');
      return;
    }
    if (snap?.kind === 'freeToFree') {
      const ea = st.edges.find((x) => x.source === cur.id || x.target === cur.id);
      const eb = st.edges.find((x) => x.source === snap.other.id || x.target === snap.other.id);
      const sa = (ea?.data as HoseData | undefined)?.size ?? '3/8"', sb = (eb?.data as HoseData | undefined)?.size ?? '3/8"';
      const cands = findFittings({ a: { kind: 'push', size: sa }, b: { kind: 'push', size: sb }, text: '' }, st.library).filter((d) => d.symbol === 'fit' && !isElbow(d) && !isUBend(d));
      const def = cands.find((d) => isStandard(d)) ?? cands[0];
      if (!def) { st.showToast(`Fant ingen skjøt for ${sa} – ${sb}`); return; }
      if (st.joinFreeEnds(cur.id, snap.other.id, def)) st.showToast(`Skjøtet sammen (${def.artnr})`);
      return;
    }
    if (insertEdge) insertIntoHose(cur.id, insertEdge);
  }, [computeDragTargets]);

  // venstreklikk velger, høyreklikk åpner popup
  const onEdgeClick = useCallback((ev: React.MouseEvent, e: Edge) => {
    const st = useStore.getState();
    st.openPopup(null);
    st.setRightTab('props');
    if (!(ev.shiftKey || ev.ctrlKey || ev.metaKey)) st.selectOnly({ edges: [e.id] });
  }, []);

  const onEdgeContextMenu = useCallback((ev: React.MouseEvent, e: Edge) => {
    ev.preventDefault();
    const st = useStore.getState();
    st.selectOnly({ edges: [e.id] });
    st.setRightTab('props');
    if (e.type === 'hose' || e.type === 'python') {
      const r = wrapper.current!.getBoundingClientRect();
      st.openPopup({ kind: 'edge', id: e.id, x: ev.clientX - r.left, y: ev.clientY - r.top });
    }
  }, []);

  const onNodeClick = useCallback((ev: React.MouseEvent, n: Node) => {
    const st = useStore.getState();
    st.setRightTab('props');
    st.openPopup(null);
    // drift-modus: av/på og status endres med bryteren som dukker opp over komponenten
  }, []);

  const openSelectionMenu = (ev: React.MouseEvent) => {
    const st = useStore.getState();
    const r = wrapper.current!.getBoundingClientRect();
    st.openPopup({ kind: 'selection', id: '', x: ev.clientX - r.left, y: ev.clientY - r.top });
  };

  const onNodeContextMenu = useCallback((ev: React.MouseEvent, n: Node) => {
    ev.preventDefault();
    const st = useStore.getState();
    st.setRightTab('props');
    // høyreklikk på noe i et flervalg: meny for hele utvalget
    const nSel = st.nodes.filter((x) => x.selected).length + st.edges.filter((x) => x.selected).length;
    if (n.selected && nSel > 1) { openSelectionMenu(ev); return; }
    if (n.type === 'hoseEnd') {
      const e = st.edges.find((x) => x.source === n.id || x.target === n.id);
      if (e) { onEdgeContextMenu(ev, e); }
      return;
    }
    st.selectOnly({ nodes: [n.id] });
    if (n.type !== 'comp' && n.type !== 'pyEnd' && n.type !== 'shape') { st.openPopup(null); return; }
    const r = wrapper.current!.getBoundingClientRect();
    const el = wrapper.current!.querySelector(`.react-flow__node[data-id="${CSS.escape(n.id)}"]`) as HTMLElement | null;
    const nr = el?.getBoundingClientRect();
    st.openPopup({
      kind: 'node', id: n.id, x: ev.clientX - r.left, y: ev.clientY - r.top,
      anchor: nr ? { left: nr.left - r.left, top: nr.top - r.top, right: nr.right - r.left, bottom: nr.bottom - r.top } : undefined,
    });
  }, [onEdgeContextMenu]);

  const onSelectionContextMenu = useCallback((ev: React.MouseEvent) => {
    ev.preventDefault();
    openSelectionMenu(ev);
  }, []);

  // høyreklikk på tomt sted: meny for å sette inn favoritter (ikke etter at visningen er dratt)
  const rightDown = useRef<{ x: number; y: number } | null>(null);
  const onPaneContextMenu = useCallback((ev: React.MouseEvent | MouseEvent) => {
    ev.preventDefault();
    const rd = rightDown.current;
    if (rd && Math.hypot(ev.clientX - rd.x, ev.clientY - rd.y) > 5) return;
    const st = useStore.getState();
    const r = wrapper.current!.getBoundingClientRect();
    st.openPopup({ kind: 'pane', id: '', x: ev.clientX - r.left, y: ev.clientY - r.top, flow: rf.screenToFlowPosition({ x: ev.clientX, y: ev.clientY }) });
  }, [rf]);

  const onPaneClick = useCallback(() => {
    useStore.getState().openPopup(null);
  }, []);

  // ved sletting av komponenter: behold slanger som bare henger på (de får åpen ende)
  const onBeforeDelete = useCallback(async ({ nodes: dn, edges: de }: { nodes: Node[]; edges: Edge[] }) => {
    const del = new Set(dn.map((n) => n.id));
    const keep = de.filter((e) => {
      if (e.type !== 'hose' || e.selected) return true;
      const sDel = del.has(e.source), tDel = del.has(e.target);
      if (sDel && tDel) return true;
      const st = useStore.getState();
      const freeEndDeleted = [e.source, e.target].some((id) => del.has(id) && st.nodes.find((n) => n.id === id)?.type === 'hoseEnd');
      return freeEndDeleted;
    });
    return { nodes: dn, edges: keep };
  }, []);

  const defaultEdgeOptions = useMemo(() => ({ type: 'hose' }), []);

  return (
    <AnalysisContext.Provider value={analysis}>
      <SimContext.Provider value={sim}>
      <HighlightContext.Provider value={highlight}>
      <DragHintContext.Provider value={hint}>
        <div className="bf-canvas" ref={wrapper} onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
          onPointerDownCapture={(e) => { if (e.button === 2) rightDown.current = { x: e.clientX, y: e.clientY }; }}>
          <ReactFlow
            nodes={rfNodes}
            edges={edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onConnectStart={onConnectStart}
            onConnectEnd={onConnectEnd}
            onReconnect={onReconnect}
            onReconnectStart={onReconnectStart}
            onReconnectEnd={onReconnectEnd}
            reconnectRadius={6}
            edgesReconnectable
            isValidConnection={isValidConnection}
            onBeforeDelete={onBeforeDelete}
            onNodeDragStart={onNodeDragStart}
            onNodeDrag={onNodeDrag}
            onNodeDragStop={onNodeDragStop}
            onEdgeClick={onEdgeClick}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            onEdgeContextMenu={onEdgeContextMenu}
            onNodeContextMenu={onNodeContextMenu}
            onSelectionContextMenu={onSelectionContextMenu}
            onPaneContextMenu={onPaneContextMenu}
            connectionMode={ConnectionMode.Loose}
            connectionRadius={22}
            snapToGrid
            snapGrid={[GRID, GRID]}
            defaultEdgeOptions={defaultEdgeOptions}
            deleteKeyCode={['Delete', 'Backspace']}
            multiSelectionKeyCode={['Shift', 'Control']}
            selectionMode={SelectionMode.Partial}
            selectionOnDrag
            panOnDrag={[1, 2]}
            selectionKeyCode={null}
            panActivationKeyCode="Space"
            zoomOnDoubleClick={false}
            minZoom={0.1}
            maxZoom={4}
            defaultViewport={{ x: 40, y: 40, zoom: 1 }}
            proOptions={{ hideAttribution: true }}
            connectionLineStyle={{ stroke: '#2563eb', strokeWidth: 3 }}
            elevateEdgesOnSelect
            elevateNodesOnSelect={false}
          >
            <Background variant={BackgroundVariant.Dots} gap={GRID * 2} size={1.2} color="#cbd5e1" />
            <Controls showInteractive={false} />
            <MiniMap pannable zoomable nodeColor={(n) => (n.type === 'pyEnd' ? '#111827' : n.type === 'text' ? '#cbd5e1' : n.type === 'shape' ? 'rgba(148,163,184,0.25)' : n.type === 'hoseEnd' ? '#94a3b8' : '#64748b')} maskColor="rgba(241,245,249,0.6)" />
          </ReactFlow>
          {hint.snapPort && <SnapMarker x={hint.snapPort.x} y={hint.snapPort.y} />}
          {drawTool && <DrawOverlay tool={drawTool} />}
          {sim && <DriftBar sim={sim} />}
          <Popups />
          {nodes.length === 0 && (
            <div className="bf-empty">
              <div className="t">Tom tegning</div>
              <div>Dra utstyr og koblinger inn fra biblioteket til venstre.</div>
              <div>Dra fra en port for å legge slange. Slipp den på en annen port, eller på et tomt sted for en åpen ende.</div>
            </div>
          )}
        </div>
      </DragHintContext.Provider>
      </HighlightContext.Provider>
      </SimContext.Provider>
    </AnalysisContext.Provider>
  );
}

/** Tegner strek eller boks: trykk, dra og slipp */
function DrawOverlay({ tool }: { tool: 'line' | 'rect' }) {
  const rf = useReactFlow();
  const [a, setA] = useState<Pt | null>(null);
  const [b, setB] = useState<Pt | null>(null);
  const g = (v: number) => Math.round(v / GRID) * GRID;
  const toFlow = (e: React.PointerEvent) => { const f = rf.screenToFlowPosition({ x: e.clientX, y: e.clientY }); return { x: g(f.x), y: g(f.y) }; };
  const ortho = (p: Pt, q: Pt, free: boolean): Pt => {
    if (tool !== 'line' || free) return q;
    if (Math.abs(q.y - p.y) < Math.abs(q.x - p.x) * 0.15) return { x: q.x, y: p.y };
    if (Math.abs(q.x - p.x) < Math.abs(q.y - p.y) * 0.15) return { x: p.x, y: q.y };
    return q;
  };
  const vp = rf.getViewport();
  const scr = (p: Pt) => ({ x: p.x * vp.zoom + vp.x, y: p.y * vp.zoom + vp.y });
  const end = (e: React.PointerEvent) => {
    const st = useStore.getState();
    if (a && b && Math.hypot(b.x - a.x, b.y - a.y) >= GRID) {
      const id = st.addShape(tool, a, b);
      st.selectOnly({ nodes: [id] });
    }
    setA(null); setB(null);
    void e;
    st.setDrawTool(null);
  };
  const A = a && scr(a), B = b && scr(b);
  return (
    <div className="bf-draw"
      onPointerDown={(e) => { if (e.button !== 0) { useStore.getState().setDrawTool(null); return; } (e.target as Element).setPointerCapture(e.pointerId); const p = toFlow(e); setA(p); setB(p); }}
      onPointerMove={(e) => { if (a) setB(ortho(a, toFlow(e), e.shiftKey)); }}
      onPointerUp={end}
      onContextMenu={(e) => e.preventDefault()}>
      <div className="bf-draw-hint">{tool === 'line' ? 'Strek: trykk og dra · Shift = fri vinkel' : 'Boks: trykk og dra fra hjørne til hjørne'} · Esc avbryter</div>
      {A && B && (
        <svg className="bf-draw-svg">
          {tool === 'line'
            ? <line x1={A.x} y1={A.y} x2={B.x} y2={B.y} stroke="#2563eb" strokeWidth={2} strokeDasharray="6 4" />
            : <rect x={Math.min(A.x, B.x)} y={Math.min(A.y, B.y)} width={Math.abs(B.x - A.x)} height={Math.abs(B.y - A.y)} fill="rgba(37,99,235,0.06)" stroke="#2563eb" strokeWidth={2} strokeDasharray="6 4" />}
        </svg>
      )}
    </div>
  );
}

function SnapMarker({ x, y }: { x: number; y: number }) {
  const rf = useReactFlow();
  const vp = rf.getViewport();
  return <div className="bf-snapmark" style={{ left: x * vp.zoom + vp.x, top: y * vp.zoom + vp.y }} />;
}

/** Linje øverst i drift-modus: forklaring og knapper */
function DriftBar({ sim }: { sim: SimResult }) {
  const st = useStore.getState();
  const setTaps = (open: boolean) => {
    const s = useStore.getState();
    for (const n of s.nodes) {
      if (n.type !== 'comp') continue;
      const def = nodeDef(n, s.pythons);
      if (!def) continue;
      const k = simKind(def);
      if (k === 'tap') s.setSim(n.id, { open });
      if (k === 'tower') s.setSim(n.id, { taps: Object.fromEntries(towerTaps(def).map((p) => [p.id, open])) });
    }
  };
  const flowing = sim.edgeFlow.size;
  const nLeak = sim.leaks.size + sim.leakPorts.size;
  const nMix = sim.mixed.size;
  return (
    <div className="bf-driftbar">
      <b>▶ DRIFT</b>
      <span className="lg"><i className="fl" /> strømmer</span>
      <span className="lg"><i className="pr" /> under trykk</span>
      <span className="lg"><i className="em" /> tom</span>
      {nMix > 0 && <span className="leak" title="To forskjellige medier går inn i samme slange">⚠ {nMix} {nMix > 1 ? 'slanger' : 'slange'} med to medier</span>}
      {nLeak > 0 && <span className="leak">⚠ {nLeak} {nLeak > 1 ? 'åpne ender' : 'åpen ende'} lekker</span>}
      <span className="mut">{flowing ? `${flowing} slanger i bruk` : 'Hold musa over en kran og klikk bryteren for å tappe'}</span>
      <button className="btn small" onClick={() => setTaps(true)}>Åpne alle kraner</button>
      <button className="btn small" onClick={() => setTaps(false)}>Steng alle kraner</button>
      <button className="btn small danger" onClick={() => st.setSimOn(false)}>■ Stopp drift</button>
    </div>
  );
}
