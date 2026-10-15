import React, { memo, useCallback, useMemo, useRef } from 'react';
import { EdgeLabelRenderer, getStraightPath, useInternalNode, useReactFlow, BaseEdge, type EdgeProps } from '@xyflow/react';
import type { HoseData } from '../../lib/types';
import { hoseLook, shownHose } from '../../lib/colors';
import { tokenName } from '../../lib/sim';
import { flavorsOf } from '../../lib/library';
import { useAnalysis, DragHintContext, useHighlight, useSim } from './context';
import { useStore } from '../../store';
import { pythonLabel } from '../../lib/python';
import { computeRoute, endTurn, insertIndexFor, nearestSegment, posDir, snapPoint, ELBOW_LEN, type HoseDirName, type Pt, type RouteGeom } from '../../lib/route';
import { fitLabel, isElbow, type FitResult } from '../../lib/autofit';

function fmtLen(n: number | null | undefined) {
  if (n == null || isNaN(n)) return '? m';
  return `${n.toLocaleString('nb-NO', { maximumFractionDigits: 2 })} m`;
}

function setPointsNoSnap(edgeId: string, points: Pt[] | undefined) {
  const st = useStore.getState();
  useStore.setState({ edges: st.edges.map((e) => (e.id === edgeId ? { ...e, data: { ...e.data, points } } : e)) });
  st.markDirty();
}

function useGeom(p: EdgeProps, style: 'smoothstep' | 'straight' | 'bezier', points: Pt[] | undefined, stub: number, turn?: { s?: HoseDirName; t?: HoseDirName; sElbow?: boolean; tElbow?: boolean }) {
  const src = useInternalNode(p.source);
  const tgt = useInternalNode(p.target);
  const sFree = src?.type === 'hoseEnd';
  const tFree = tgt?.type === 'hoseEnd';
  const ts = turn?.s, tt = turn?.t, se = !!turn?.sElbow, te = !!turn?.tElbow;
  return useMemo(() => {
    const S = { x: p.sourceX, y: p.sourceY }, T = { x: p.targetX, y: p.targetY };
    const sDir = sFree ? null : posDir(p.sourcePosition), tDir = tFree ? null : posDir(p.targetPosition);
    const firstS = points?.[0] ?? T, lastT = points?.[points.length - 1] ?? S;
    const sTurn = style === 'smoothstep' ? endTurn(ts, sDir, se, S, firstS) : null;
    const tTurn = style === 'smoothstep' ? endTurn(tt, tDir, te, T, lastT) : null;
    return computeRoute(S, sDir, T, tDir, points, style, stub, sTurn, tTurn);
  }, [p.sourceX, p.sourceY, p.targetX, p.targetY, p.sourcePosition, p.targetPosition, sFree, tFree, points, style, stub, ts, tt, se, te]);
}

/**
 * Egne bøyepunkter. Slangen legger seg automatisk; bare punkter du har laget selv (dobbeltklikk) vises og kan dras.
 * Dobbeltklikk på et punkt fjerner det.
 */
function Waypoints({ edgeId, geom }: { edgeId: string; geom: RouteGeom }) {
  const rf = useReactFlow();
  const drag = useRef<{ idx: number; pts: Pt[]; moved: boolean; sx: number; sy: number } | null>(null);
  if (geom.auto) return null;
  const neighbors = (pts: Pt[], idx: number): (Pt | undefined)[] => [
    idx === 0 ? geom.anchors[geom.dataStart - 1] : pts[idx - 1],
    idx === pts.length - 1 ? geom.anchors[geom.dataStart + geom.dataPts.length] : pts[idx + 1],
  ];
  const start = (e: React.PointerEvent, idx: number) => {
    e.stopPropagation();
    e.preventDefault();
    (e.target as Element).setPointerCapture(e.pointerId);
    drag.current = { idx, pts: geom.dataPts.map((q) => ({ ...q })), moved: false, sx: e.clientX, sy: e.clientY };
  };
  const move = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    if (!d.moved) {
      if (Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 3) return;
      d.moved = true;
      useStore.getState().snapshot();
    }
    const f = rf.screenToFlowPosition({ x: e.clientX, y: e.clientY });
    d.pts[d.idx] = snapPoint(f, neighbors(d.pts, d.idx));
    setPointsNoSnap(edgeId, [...d.pts]);
  };
  const end = () => { drag.current = null; };
  const remove = (e: React.MouseEvent, idx: number) => {
    e.stopPropagation();
    const pts = geom.dataPts.filter((_, i) => i !== idx);
    useStore.getState().snapshot();
    // ingen egne punkter igjen: tilbake til automatisk
    setPointsNoSnap(edgeId, pts.length ? pts : undefined);
  };
  return (
    <g className="bf-wps">
      {geom.dataPts.map((q, i) => (
        <rect key={'p' + i} className="bf-wp nodrag nopan" x={q.x - 5.5} y={q.y - 5.5} width={11} height={11} rx={2}
          onPointerDown={(e) => start(e as any, i)} onPointerMove={move as any} onPointerUp={end} onDoubleClick={(e) => remove(e as any, i)}>
          <title>Dra for å flytte bøyen. Dobbeltklikk for å fjerne den.</title>
        </rect>
      ))}
    </g>
  );
}

/** Dobbeltklikk på slangen: nytt bøyepunkt der du klikket (resten av slangen legger seg automatisk) */
function addPointAt(edgeId: string, geom: RouteGeom, f: Pt) {
  const ns = nearestSegment(geom, f);
  const p = snapPoint(ns.at, []);
  const pts = geom.auto ? [] : geom.dataPts.map((q) => ({ ...q }));
  const idx = geom.auto ? 0 : insertIndexFor(geom, ns.index);
  pts.splice(idx, 0, p);
  useStore.getState().snapshot();
  setPointsNoSnap(edgeId, pts);
}

function EdgeLabel({ id, geom, children, className }: { id: string; geom: RouteGeom; children: React.ReactNode; className?: string }) {
  const l = geom.label;
  const tr = l.horizontal ? `translate(-50%, calc(-100% - 5px)) translate(${l.x}px, ${l.y}px)` : `translate(7px, -50%) translate(${l.x}px, ${l.y}px)`;
  const onClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const st = useStore.getState();
    st.openPopup(null);
    st.setRightTab('props');
    st.selectOnly({ edges: [id] });
  };
  const onMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const st = useStore.getState();
    st.selectOnly({ edges: [id] });
    st.setRightTab('props');
    const el = document.querySelector('.bf-canvas') as HTMLElement;
    const r = el.getBoundingClientRect();
    st.openPopup({ kind: 'edge', id, x: e.clientX - r.left, y: e.clientY - r.top });
  };
  return (
    <EdgeLabelRenderer>
      <div className={`bf-elabel nodrag nopan ${className ?? ''}`} style={{ transform: tr }} onClick={onClick} onContextMenu={onMenu} onPointerDown={(e) => e.stopPropagation()} title="Klikk for å velge, høyreklikk for å endre">
        {children}
      </div>
    </EdgeLabelRenderer>
  );
}

function openFitPopup(e: React.MouseEvent, edgeId: string, end: 's' | 't') {
  e.preventDefault();
  e.stopPropagation();
  const st = useStore.getState();
  st.selectOnly({ edges: [edgeId] });
  st.setRightTab('props');
  const el = document.querySelector('.bf-canvas') as HTMLElement;
  const r = el.getBoundingClientRect();
  st.openPopup({ kind: 'fit', id: edgeId, end, x: e.clientX - r.left, y: e.clientY - r.top });
}

/** Lite symbol for automatisk kobling i slangeenden. Tekst vises når musa holdes over */
function FitGlyph({ edgeId, end, at, dir, turn, fit, selected, showText, atPort }: { edgeId: string; end: 's' | 't'; at: Pt; dir: Pt; turn?: Pt; fit?: FitResult; selected?: boolean; showText?: boolean; atPort?: boolean }) {
  const [hover, setHover] = React.useState(false);
  if (!fit) return null;
  // uten kobling: markør når slangen er valgt, så man kan velge kobling eller vinkel
  if (fit.status === 'none' && !(selected && atPort)) return null;
  const dd = turn ? ELBOW_LEN - 4 : 20;
  const x = at.x + dir.x * dd, y = at.y + dir.y * dd;
  // vinkelen tegnes mot svingen (lokal y-akse = dir rotert 90° med klokka)
  const flipY = turn ? turn.x * -dir.y + turn.y * dir.x < 0 : false;
  const ang = (Math.atan2(dir.y, dir.x) * 180) / Math.PI;
  const tip = fit.status === 'missing' ? `Mangler kobling: ${fit.need}` : fit.status === 'none' ? 'Høyreklikk for å velge kobling eller vinkel' : fitLabel(fit.def!);
  const handlers = {
    className: 'bf-fitglyph',
    style: { pointerEvents: 'all' as const, cursor: 'pointer' },
    onClick: (e: React.MouseEvent) => { e.stopPropagation(); const st = useStore.getState(); st.openPopup(null); st.setRightTab('props'); st.selectOnly({ edges: [edgeId] }); },
    onContextMenu: (e: React.MouseEvent) => openFitPopup(e, edgeId, end),
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
  };
  // teksten legges utenfor slangen, bort fra porten
  const tipStyle: React.CSSProperties = dir.y === 0
    ? { transform: `translate(${dir.x < 0 ? '-100%' : '0'}, calc(-100% - 8px)) translate(${x + (dir.x < 0 ? 6 : -6)}px, ${y}px)` }
    : { transform: `translate(10px, -50%) translate(${x}px, ${y}px)` };
  const fixed = showText && fit.status === 'ok';
  const tipEl = (hover || fixed) && (
    <EdgeLabelRenderer>
      <div className={`bf-fittip ${fit.status} ${fixed && !hover ? 'fixed' : ''}`} style={tipStyle}>{tip}</div>
    </EdgeLabelRenderer>
  );
  if (fit.status === 'missing') {
    return (
      <>
        <g transform={`translate(${x} ${y})`} {...handlers}>
          <circle r={6} fill="#dc2626" stroke="#fff" strokeWidth={1.5} />
          <text y={0.5} fontSize={9} fontWeight={800} fill="#fff" textAnchor="middle" dominantBaseline="middle">!</text>
        </g>
        {tipEl}
      </>
    );
  }
  if (fit.status === 'none') {
    return (
      <>
        <g transform={`translate(${x} ${y})`} {...handlers}>
          <circle r={5.5} fill="#fff" stroke="#64748b" strokeWidth={1.2} strokeDasharray="2 1.6" />
          <path d="M-2.8,0 H2.8 M0,-2.8 V2.8" stroke="#64748b" strokeWidth={1.2} />
        </g>
        {tipEl}
      </>
    );
  }
  const d = fit.def!;
  const hasThread = d.ports.some((q) => q.kind === 'thread');
  const hasStem = d.ports.some((q) => q.kind === 'stem');
  const elbow = isElbow(d);
  return (
    <>
      <g transform={`translate(${x} ${y}) rotate(${ang})${flipY ? ' scale(1 -1)' : ''}`} {...handlers}>
        <rect x={-9} y={-8} width={18} height={16} fill="transparent" />
        {elbow ? (
          <path d="M-7,-5 H3 A4,4 0 0 1 7,-1 V7 H1 V1 H-7 Z" fill="#374151" stroke="#fff" strokeWidth={1} />
        ) : hasStem ? (
          <path d="M-7,-5.5 L7,-3.5 L7,3.5 L-7,5.5 Z" fill="#374151" stroke="#fff" strokeWidth={1} />
        ) : (
          <rect x={-7} y={-5} width={14} height={10} rx={2} fill="#374151" stroke="#fff" strokeWidth={1} />
        )}
        {hasThread && [-3, 0, 3].map((k) => <line key={k} x1={k - 1.5} y1={-4} x2={k + 1.5} y2={4} stroke="#fff" strokeWidth={0.9} />)}
        {!hasThread && !elbow && <line x1={0} y1={-5} x2={0} y2={5} stroke="#fff" strokeWidth={1} />}
        {fit.overridden && <circle cx={6} cy={-5} r={2} fill="#2563eb" stroke="#fff" strokeWidth={0.6} />}
      </g>
      {tipEl}
    </>
  );
}

export const HoseEdge = memo(function HoseEdge(p: EdgeProps) {
  const data = p.data as HoseData;
  const analysis = useAnalysis();
  const style = useStore((s) => s.settings.edgeStyle);
  const showLabels = useStore((s) => s.settings.showHoseLabels);
  const hl = useHighlight();
  const hint = React.useContext(DragHintContext);
  const sFreeEnd = useInternalNode(p.source)?.type === 'hoseEnd';
  const tFreeEnd = useInternalNode(p.target)?.type === 'hoseEnd';
  const fitsEarly = analysis?.fits.get(p.id);
  const elb = (f?: FitResult) => !!(f?.status === 'ok' && f.def && isElbow(f.def));
  const geom = useGeom(p, style, data.points, 28, { s: data.dirS, t: data.dirT, sElbow: elb(fitsEarly?.s), tElbow: elb(fitsEarly?.t) });
  const rf = useReactFlow();
  const showFit = useStore((s) => s.settings.showFittingLabels);
  const flavors = useStore((s) => flavorsOf(s.userLib));
  const sim = useSim();
  // drift: fargen til mediet som er i slangen, varsel når det er to medier
  const shown = shownHose(data, analysis?.hoseMedium.get(p.id), analysis?.hoseFlavor.get(p.id), sim?.edgeMedia.get(p.id));
  const flavor = shown.flavor;
  const look = hoseLook(shown.data, shown.medium, flavor, flavors);
  const { color, light } = look;
  const mixText = shown.mixed ? `To medier i slangen: ${shown.mixed.map(tokenName).join(' og ')}` : undefined;
  const aWarn = analysis?.edgeWarn.get(p.id);
  const warn = mixText ? [...(aWarn ?? []), mixText] : aWarn;
  const fits = analysis?.fits.get(p.id);
  const insertTarget = hint.insertEdge === p.id;
  const w = 3.2;
  const onDbl = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    addPointAt(p.id, geom, rf.screenToFlowPosition({ x: e.clientX, y: e.clientY }));
  }, [geom, p.id, rf]);
  const lit = !!hl?.edges.has(p.id);
  const simEmpty = !!sim && !sim.edgeFed.has(p.id);
  const flow = sim?.edgeFlow.get(p.id);
  const dim = (!!hl && !lit) || simEmpty;
  const glow = hl?.edgeColor.get(p.id) ?? color;
  return (
    <g style={dim ? { opacity: simEmpty ? 0.25 : 0.3 } : undefined}>
      {lit && <path d={geom.d} fill="none" stroke={glow} strokeWidth={w + 10} strokeOpacity={0.4} strokeLinecap="round" strokeLinejoin="round" style={{ pointerEvents: 'none' }} />}
      {(p.selected || insertTarget) && <path d={geom.d} fill="none" stroke={insertTarget ? '#22c55e' : '#60a5fa'} strokeWidth={w + 5} strokeOpacity={0.55} strokeLinecap="round" strokeLinejoin="round" />}
      {light && <path d={geom.d} fill="none" stroke={look.outline ?? '#475569'} strokeWidth={w + 2} strokeLinejoin="round" />}
      <path d={geom.d} className="react-flow__edge-path" style={{ stroke: color, strokeWidth: w, strokeDasharray: look.dash, strokeLinejoin: 'round', fill: 'none' }} />
      {look.stripe && <path d={geom.d} fill="none" stroke={look.stripe} strokeWidth={w - 1.6} strokeDasharray="3 4" style={{ pointerEvents: 'none' }} />}
      {look.dots && <path d={geom.d} fill="none" stroke={look.dots} strokeWidth={2.5} strokeDasharray="0 7" strokeLinecap="round" style={{ pointerEvents: 'none' }} />}
      {flow && <path d={geom.d} fill="none" className={`bf-flowline ${flow === -1 ? 'rev' : ''}`} stroke={light ? '#334155' : '#ffffff'} strokeWidth={w - 0.6} strokeLinecap="round" />}
      <path d={geom.d} className="react-flow__edge-interaction" style={{ stroke: 'transparent', strokeWidth: 16, fill: 'none' }} onDoubleClick={onDbl} />
      {data.counted === false && <path d={geom.d} fill="none" stroke="#fff" strokeWidth={1} strokeDasharray="2 6" style={{ pointerEvents: 'none' }} />}
      {warn && <path d={geom.d} fill="none" stroke="#dc2626" strokeWidth={w + 2.5} strokeOpacity={0.55} strokeDasharray="6 5" style={{ pointerEvents: 'none' }} />}
      <FitGlyph edgeId={p.id} end="s" at={geom.pts[0]} dir={geom.startDir} turn={geom.startTurn} fit={fits?.s} selected={p.selected} atPort={!sFreeEnd} showText={showFit || lit} />
      <FitGlyph edgeId={p.id} end="t" at={geom.pts[geom.pts.length - 1]} dir={geom.endDir} turn={geom.endTurn} fit={fits?.t} selected={p.selected} atPort={!tFreeEnd} showText={showFit || lit} />
      {(showLabels || p.selected || warn || lit) && (
        <EdgeLabel id={p.id} geom={geom} className={`${warn ? 'warn' : ''} ${p.selected ? 'sel' : ''} ${data.length == null ? 'nolen' : ''} ${dim ? 'dim' : ''} ${lit ? 'lit' : ''}`}>
          <span className="sw" style={{ background: color, boxShadow: light ? 'inset 0 0 0 1px #475569' : undefined }} />
          {data.name ? <b>{data.name}</b> : flavor ? <b>{flavor}</b> : null}
          {data.name || flavor ? ' · ' : ''}{data.size} · {fmtLen(data.length)}
          {warn && <span className="wi" title={warn.join('\n')}>⚠</span>}
        </EdgeLabel>
      )}
      {p.selected && <Waypoints edgeId={p.id} geom={geom} />}
    </g>
  );
});

export const DirectEdge = memo(function DirectEdge(p: EdgeProps) {
  const analysis = useAnalysis();
  const hl = useHighlight();
  const sim = useSim();
  const mix = sim?.mixed.get(p.id);
  const aWarn = analysis?.edgeWarn.get(p.id);
  const warn = mix ? [...(aWarn ?? []), `To medier: ${mix.map(tokenName).join(' og ')}`] : aWarn;
  const [path, lx, ly] = getStraightPath({ sourceX: p.sourceX, sourceY: p.sourceY, targetX: p.targetX, targetY: p.targetY });
  const long = Math.hypot(p.sourceX - p.targetX, p.sourceY - p.targetY) > 24;
  const dim = (!!hl && !hl.edges.has(p.id)) || (!!sim && !sim.edgeFed.has(p.id));
  const lit = !!hl && hl.edges.has(p.id);
  return (
    <g style={dim ? { opacity: 0.3 } : undefined}>
      {lit && <path d={path} fill="none" stroke={hl!.edgeColor.get(p.id) ?? '#64748b'} strokeWidth={12} strokeOpacity={0.4} strokeLinecap="round" style={{ pointerEvents: 'none' }} />}
      {p.selected && <path d={path} fill="none" stroke="#60a5fa" strokeWidth={10} strokeOpacity={0.45} />}
      <BaseEdge id={p.id} path={path} interactionWidth={12} style={{ stroke: warn ? '#dc2626' : '#1f2937', strokeWidth: 4, strokeDasharray: long ? '1 4' : undefined, strokeLinecap: 'round' }} />
      {warn && (
        <EdgeLabelRenderer>
          <div className="bf-elabel warn nodrag nopan" style={{ transform: `translate(-50%, -130%) translate(${lx}px, ${ly}px)` }} title={warn.join('\n')}>⚠</div>
        </EdgeLabelRenderer>
      )}
    </g>
  );
});

export const PythonEdge = memo(function PythonEdge(p: EdgeProps) {
  const pyId = (p.data as any)?.pythonId;
  const py = useStore((s) => s.pythons.find((x) => x.id === pyId));
  const points = (p.data as any)?.points as Pt[] | undefined;
  const geom = useGeom(p, 'smoothstep', points, 26);
  const rf = useReactFlow();
  const onDbl = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    addPointAt(p.id, geom, rf.screenToFlowPosition({ x: e.clientX, y: e.clientY }));
  }, [geom, p.id, rf]);
  const hl = useHighlight();
  const sim = useSim();
  const pyFlow = sim?.pyFlow.get(p.id);
  if (!py) return null;
  const lit = !!hl?.edges.has(p.id);
  const dim = !!hl && !lit;
  return (
    <g style={dim ? { opacity: 0.3 } : undefined}>
      {lit && !p.selected && <path d={geom.d} fill="none" stroke={hl?.edgeColor.get(p.id) ?? '#64748b'} strokeWidth={34} strokeOpacity={0.45} strokeLinecap="round" strokeLinejoin="round" style={{ pointerEvents: 'none' }} />}
      {p.selected && <path d={geom.d} fill="none" stroke="#60a5fa" strokeWidth={32} strokeOpacity={0.4} strokeLinecap="round" strokeLinejoin="round" />}
      <path d={geom.d} className="react-flow__edge-path" style={{ stroke: '#111827', strokeWidth: 22, strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none' }} />
      {pyFlow ? (
        <path d={geom.d} fill="none" className={`bf-flowline py ${pyFlow === -1 ? 'rev' : ''}`} stroke="#e5e7eb" strokeWidth={4} strokeLinecap="round" />
      ) : (
        <path d={geom.d} fill="none" stroke="#374151" strokeWidth={2} strokeDasharray="10 14" style={{ pointerEvents: 'none' }} />
      )}
      <path d={geom.d} className="react-flow__edge-interaction" style={{ stroke: 'transparent', strokeWidth: 28, fill: 'none' }} onDoubleClick={onDbl} />
      <EdgeLabel id={p.id} geom={{ ...geom, label: { ...geom.label, y: geom.label.y - (geom.label.horizontal ? 9 : 0), x: geom.label.x + (geom.label.horizontal ? 0 : 9) } }} className={`py ${p.selected ? 'sel' : ''} ${py.length == null ? 'nolen' : ''} ${dim ? 'dim' : ''}`}>
        {py.name} {pythonLabel(py)} · {fmtLen(py.length)}
      </EdgeLabel>
      {p.selected && <Waypoints edgeId={p.id} geom={geom} />}
    </g>
  );
});

export const edgeTypes = { hose: HoseEdge, direct: DirectEdge, python: PythonEdge };
