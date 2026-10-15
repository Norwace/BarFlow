import React, { memo, useEffect, useRef, useState } from 'react';
import { Handle, NodeResizer, Position, useReactFlow, useUpdateNodeInternals, type NodeProps } from '@xyflow/react';
import type { ComponentDef, PortDef, Side } from '../../lib/types';
import { SymbolArt } from '../../lib/symbols';
import { portPoint, rotatedSize, svgTransform, transformPoint, transformSide } from '../../lib/geometry';
import { mediumById } from '../../lib/constants';
import { portLabel, withMedium } from '../../lib/compat';
import { flavorsOf } from '../../lib/library';
import { flavorColorName, glowColor, tintColor } from '../../lib/colors';
import { TUBE_COLOR_HEX } from '../../lib/constants';
import { useAnalysis, useHighlight, useSim } from './context';
import { simKind, stateLabel, isOn, missingText, simRole, simOf, primaryToggle, towerTaps, type SimKind } from '../../lib/sim';
import { fitLabel } from '../../lib/autofit';
import { GRID } from '../../lib/constants';
import { useStore } from '../../store';
import { pythonEndDef, pythonLabel } from '../../lib/python';

const POS: Record<Side, Position> = { left: Position.Left, right: Position.Right, top: Position.Top, bottom: Position.Bottom };

function Ports({ nodeId, def, rotation, flip, hideBody, active }: { nodeId: string; def: ComponentDef; rotation: number; flip: boolean; hideBody?: boolean; active?: string }) {
  const analysis = useAnalysis();
  const sim = useSim();
  return (
    <>
      {def.ports.map((p: PortDef) => {
        const pt = transformPoint(portPoint(p, def.w, def.h), def.w, def.h, rotation, flip);
        const side = transformSide(p.side, rotation, flip);
        const used = analysis?.used.has(`${nodeId}:${p.id}`);
        const col = p.color === '#ffffff' ? '#64748b' : p.color || mediumById(p.medium)?.color || '#1f2937';
        return (
          <Handle
            key={p.id}
            id={p.id}
            type="source"
            position={POS[side]}
            className={`bf-handle ${used ? 'used' : 'free'} kind-${p.kind} ${active === p.id ? 'simactive' : ''} ${sim?.leakPorts.has(`${nodeId}:${p.id}`) ? 'leak' : ''}`}
            style={{ left: pt.x, top: pt.y, right: 'auto', bottom: 'auto', transform: p.kind === 'thread' ? 'translate(-50%, -50%) rotate(45deg)' : 'translate(-50%, -50%)', ['--pc' as any]: col }}
            title={portLabel(p)}
          />
        );
      })}
      {hideBody !== undefined && null}
    </>
  );
}

export const ComponentNode = memo(function ComponentNode({ id, data, selected }: NodeProps) {
  const d = data as any;
  const def = withMedium(d.def as ComponentDef, d.medium);
  const rotation = d.rotation ?? 0;
  const flip = !!d.flip;
  const { w, h } = rotatedSize(def.w, def.h, rotation);
  const update = useUpdateNodeInternals();
  const showFit = useStore((s) => s.settings.showFittingLabels);
  const flavors = useStore((s) => flavorsOf(s.userLib));
  useEffect(() => { update(id); }, [id, rotation, flip, def, update]);
  const isEquip = def.group === 'Utstyr';
  const hl = useHighlight();
  const lit = !!hl?.nodes.has(id);
  const hc = hl ? (lit ? 'lit' : 'dim') : '';
  // drift-modus: tilstand og aktiv bag
  const sim = useSim();
  // state = bare tilstand (vises i bryteren ved hover), ellers f.eks. «MANGLER GASS» som står ved siden av
  let badge: { text: string; cls: string; state?: boolean } | null = null;
  let bagPort: string | undefined;
  if (sim && isEquip) {
    if (def.symbol === 'bibswitch') {
      const a = sim.bagActive.get(id) ?? 0;
      const ins = def.ports.filter((p) => /inn/i.test(p.name));
      bagPort = a ? ins[a - 1]?.id : undefined;
      badge = { text: a ? `BAG ${a}` : 'INGEN BAG', cls: a ? 'ok' : 'bad', state: !!a };
    } else {
      const k = simKind(def);
      const l = stateLabel({ data: d } as any, def);
      const r = sim.running.get(id);
      if (r && !r.ok && isOn({ data: d } as any, k) && r.missing.length) {
        // slått på, men mangler noe inn: står
        badge = { text: `MANGLER ${missingText(r.missing).toUpperCase()}`, cls: 'bad' };
      } else if (l) badge = { text: l.text, cls: l.ok ? 'ok' : k === 'bag' ? 'bad' : 'off', state: true };
      else if (r && (simRole(def) === 'pump' || simRole(def) === 'container')) badge = { text: r.ok ? 'GÅR' : 'STÅR', cls: r.ok ? 'ok' : 'off' };
    }
  }
  const fcName = flavorColorName(d.flavor, flavors);
  const tint = fcName ? TUBE_COLOR_HEX[fcName] : undefined;
  // koblinger: størrelse som tekst (fast når valgt i menyen eller kretsen lyser, ellers ved hover)
  // BIB med smak: etiketten er smaken
  const label = d.label || (isEquip ? d.flavor || def.name : fitLabel(def));
  const fixedLabel = isEquip || !!d.label || showFit || lit;
  // tekst og status legges på en side uten porter, så de ikke dekker koblingene
  const portSides = new Set(def.ports.map((p) => transformSide(p.side, rotation, flip)));
  const labelSide = (['bottom', 'right', 'left', 'top'] as Side[]).find((x) => !portSides.has(x)) ?? 'bottom';
  const chipSide = (['top', 'right', 'left'] as Side[]).find((x) => !portSides.has(x) && x !== labelSide) ?? 'corner';
  const tKind = sim ? simKind(def) : null;
  const hasToggle = !!tKind && tKind !== 'drain';
  return (
    <div className={`bf-node ${selected ? 'sel' : ''} ${isEquip ? 'equip' : 'fit'} ${fixedLabel ? '' : 'hovertip'} ${hc}`}
      style={{ width: w, height: h, ['--hl' as any]: hl?.nodeColor.get(id) }}
      title={isEquip ? undefined : fitLabel(def) + (def.artnr ? ` · ${def.artnr}` : '')}>
      <svg width={w} height={h} className="bf-svg">
        <g transform={svgTransform(def.w, def.h, rotation, flip)}>
          <SymbolArt def={def} tint={tint ? tintColor(tint, 0.45) : undefined} />
        </g>
      </svg>
      <Ports nodeId={id} def={def} rotation={rotation} flip={flip} active={bagPort} />
      {sim && (badge || hasToggle) && (
        <div className={`bf-simchip at-${chipSide} ${hasToggle ? 'has-toggle' : ''}`}>
          {hasToggle && <SimToggle id={id} data={d} def={def} kind={tKind!} />}
          {badge && <div className={`bf-simbadge ${badge.cls} ${badge.state ? 'state' : ''}`}>{badge.text}</div>}
        </div>
      )}
      {sim && simKind(def) === 'valve' && !isOn({ data: d } as any, 'valve') && <div className="bf-valveshut" title="Ventilen er stengt">✕</div>}
      <div className={`bf-label ${isEquip ? 'equip' : 'fit'} lab-${labelSide}`}>
        {label}
      </div>
    </div>
  );
});

/** Drift-modus: bryter som dukker opp når musa er over komponenten */
function SimToggle({ id, data, def, kind }: { id: string; data: any; def: ComponentDef; kind: SimKind }) {
  const n = { data } as any;
  const sim = useSim();
  const set = (patch: Record<string, unknown> | null) => { if (patch) useStore.getState().setSim(id, patch); };
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();
  let body: React.ReactNode;
  if (kind === 'bibswitch') {
    const want = simOf(n).active ?? 1;
    // gul ring: bagen det faktisk trekkes fra når valgt bag er tom
    const act = sim?.bagActive.get(id) ?? 0;
    body = ([1, 2] as const).map((i) => (
      <button key={i} className={want === i ? 'on' : act === i ? 'cur' : ''} title={act === i && want !== i ? `Trekker fra bag ${i} (valgt bag er tom)` : `Trekk fra bag ${i}`} onClick={() => set({ active: i })}>Bag {i}</button>
    ));
  } else if (kind === 'tower') {
    const t = simOf(n).taps ?? {};
    body = towerTaps(def).map((p, i) => (
      <button key={p.id} className={t[p.id] ? 'on' : ''} title={`${p.name.replace('Produkt inn', 'Kran')}: ${t[p.id] ? 'åpen' : 'stengt'}`}
        onClick={() => set({ taps: { ...t, [p.id]: !t[p.id] } })}>{p.name.match(/\d+\s*$/)?.[0].trim() ?? i + 1}</button>
    ));
  } else {
    const on = isOn(n, kind);
    const [a, b] = kind === 'bag' ? ['FULL', 'TOM'] : kind === 'power' || kind === 'machine' ? ['PÅ', 'AV'] : ['ÅPEN', 'STENGT'];
    body = (
      <button className={`swt ${on ? 'on' : ''} ${!on && kind === 'bag' ? 'bad' : ''}`} title="Klikk for å endre" onClick={() => set(primaryToggle(n, def))}>
        <i /> {on ? a : b}
      </button>
    );
  }
  return (
    <div className="bf-simtoggle nodrag nopan" onPointerDown={stop} onMouseDown={stop} onClick={stop} onDoubleClick={stop}>
      {body}
    </div>
  );
}

export const PythonEndNode = memo(function PythonEndNode({ id, data, selected }: NodeProps) {
  const d = data as any;
  const py = useStore((s) => s.pythons.find((p) => p.id === d.pythonId));
  const update = useUpdateNodeInternals();
  const rotation = d.rotation ?? 0;
  const flip = !!d.flip;
  const analysis = useAnalysis();
  const hl = useHighlight();
  // tomt innhold i slangen: vis smaken fra BIB
  const pyShown = py && analysis ? { ...py, productNames: Array.from({ length: py.products }, (_, i) => py.productNames?.[i] || analysis.tubeFlavor.get(`${py.id}:p${i + 1}`) || '') } : py;
  const def = pyShown ? pythonEndDef(pyShown, d.end) : null;
  useEffect(() => { update(id); }, [id, rotation, flip, def?.h, py?.products, py?.productColors?.join(), update]);
  const tubeEvt = (e: React.MouseEvent | React.PointerEvent) => (e.target as Element).getAttribute?.('data-port');
  const onDown = (e: React.PointerEvent) => {
    const port = tubeEvt(e);
    useStore.setState({ focusPort: port ? `${id}:${port}` : null });
  };
  const onDbl = (e: React.MouseEvent) => {
    const port = tubeEvt(e);
    if (!port) return;
    e.stopPropagation();
    const st = useStore.getState();
    const el = document.querySelector('.bf-canvas') as HTMLElement;
    const r = el.getBoundingClientRect();
    const n = st.nodes.find((x) => x.id === id);
    st.openPopup(null);
    st.openPicker({ screen: { x: e.clientX - r.left, y: e.clientY - r.top }, flow: { x: n?.position.x ?? 0, y: n?.position.y ?? 0 }, fromNode: id, fromHandle: port, direct: true });
  };
  if (!py || !def) return <div className="bf-node" style={{ width: 20, height: 20 }} />;
  const { w, h } = rotatedSize(def.w, def.h, rotation);
  const bodyPt = transformPoint({ x: 0, y: def.h / 2 }, def.w, def.h, rotation, flip);
  const bodySide = transformSide('left', rotation, flip);
  return (
    <PyFrame id={id} selected={selected} w={w} h={h}>
      <svg width={w} height={h} className="bf-svg" onPointerDown={onDown} onDoubleClick={onDbl}>
        <g transform={svgTransform(def.w, def.h, rotation, flip)}>
          <rect x={0} y={4} width={26} height={def.h - 8} rx={8} fill="#111827" />
          {def.ports.map((p) => {
            const y = p.pos * def.h;
            const clear = p.color === '#ffffff';
            const pl = hl?.ports.has(`${id}:${p.id}`);
            return (
              <g key={p.id}>
                {pl && <line x1={20} y1={y} x2={def.w + 2} y2={y} stroke={glowColor(p.color ?? '#64748b')} strokeWidth={13} strokeOpacity={0.45} strokeLinecap="round" />}
                <line x1={22} y1={y} x2={def.w} y2={y} stroke={p.color === '#111827' ? '#475569' : '#111827'} strokeWidth={6} opacity={hl && !pl ? 0.35 : 1} />
                {p.id.startsWith('p') ? (
                  // produktslanger: stripete hvit og farge
                  <g opacity={hl && !pl ? 0.35 : 1}>
                    <line x1={22} y1={y} x2={def.w - 1} y2={y} stroke="#ffffff" strokeWidth={4} />
                    <line x1={22} y1={y} x2={def.w - 1} y2={y} stroke={p.color} strokeWidth={4} strokeDasharray="4 3" />
                  </g>
                ) : (
                  <line x1={22} y1={y} x2={def.w - 1} y2={y} stroke={p.color} strokeWidth={clear ? 3.5 : 4} opacity={hl && !pl ? 0.35 : 1} />
                )}
                <line className="bf-tubehit" data-port={p.id} x1={24} y1={y} x2={def.w - 7} y2={y} stroke="transparent" strokeWidth={12}>
                  <title>{`${p.name} – klikk for å se hva den er koblet til, høyreklikk for innstillinger, dobbeltklikk for å sette på kobling`}</title>
                </line>
              </g>
            );
          })}
          <rect x={4} y={def.h / 2 - 8} width={18} height={16} rx={3} fill="#374151" />
        </g>
        <text x={transformPoint({ x: 13, y: def.h / 2 - 16 }, def.w, def.h, rotation, flip).x} y={transformPoint({ x: 13, y: def.h / 2 - 16 }, def.w, def.h, rotation, flip).y} fontSize={11} fontWeight={800} fill="#fff" textAnchor="middle" dominantBaseline="middle" style={{ userSelect: 'none', pointerEvents: 'none' }}>
          {d.end}
        </text>
      </svg>
      <Handle
        id="body"
        type="source"
        position={{ left: Position.Left, right: Position.Right, top: Position.Top, bottom: Position.Bottom }[bodySide]}
        isConnectable={false}
        className="bf-handle body"
        style={{ left: bodyPt.x, top: bodyPt.y, right: 'auto', bottom: 'auto', transform: 'translate(-50%, -50%)' }}
      />
      <Ports nodeId={id} def={def} rotation={rotation} flip={flip} />
      <div className="bf-label equip">{py.name} {pythonLabel(py)} – {d.end}</div>
    </PyFrame>
  );
});

function PyFrame({ id, selected, w, h, children }: { id: string; selected?: boolean; w: number; h: number; children: React.ReactNode }) {
  const hl = useHighlight();
  // pytonrør-enden gløder ikke som helhet – slangene i den lyser hver for seg
  const hc = hl ? (hl.nodes.has(id) ? 'litpy' : 'dim') : '';
  return <div className={`bf-node py ${selected ? 'sel' : ''} ${hc}`} style={{ width: w, height: h }}>{children}</div>;
}

export const TextNode = memo(function TextNode({ id, data, selected }: NodeProps) {
  const d = data as any;
  const [edit, setEdit] = useState(false);
  const [val, setVal] = useState<string>(d.text);
  const ref = useRef<HTMLTextAreaElement>(null);
  const updateNodeData = useStore((s) => s.updateNodeData);
  useEffect(() => { setVal(d.text); }, [d.text]);
  useEffect(() => { if (edit) { ref.current?.focus(); ref.current?.select(); } }, [edit]);
  const finish = () => {
    setEdit(false);
    if (val !== d.text) updateNodeData(id, { text: val });
  };
  return (
    <div className={`bf-text ${selected ? 'sel' : ''}`} style={{ fontSize: d.size ?? 14 }} onDoubleClick={() => setEdit(true)}>
      {edit ? (
        <textarea
          ref={ref}
          className="nodrag"
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onBlur={finish}
          onKeyDown={(e) => { if (e.key === 'Escape') { setVal(d.text); setEdit(false); } if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) finish(); e.stopPropagation(); }}
          rows={Math.max(1, val.split('\n').length)}
        />
      ) : (
        <div className="bf-text-view">{d.text || ' '}</div>
      )}
    </div>
  );
});

export const HoseEndNode = memo(function HoseEndNode({ id, selected }: NodeProps) {
  const hl = useHighlight();
  const simR = useSim();
  const hc = (hl ? (hl.nodes.has(id) ? 'lit' : 'dim') : '') + (simR?.leaks.has(id) ? ' leak' : '');
  const openFor = () => {
    const st = useStore.getState();
    const e = st.edges.find((x) => x.source === id || x.target === id);
    const n = st.nodes.find((x) => x.id === id);
    if (!e || !n) return;
    const el = document.querySelector('.bf-canvas') as HTMLElement;
    const r = el.getBoundingClientRect();
    const node = document.querySelector(`.react-flow__node[data-id="${CSS.escape(id)}"]`) as HTMLElement | null;
    const nr = node?.getBoundingClientRect();
    st.openPicker({
      screen: { x: (nr?.left ?? r.left) - r.left + 10, y: (nr?.top ?? r.top) - r.top },
      flow: { x: n.position.x + 10, y: n.position.y + 10 },
      fromNode: id, fromHandle: 'p', freeEnd: { nodeId: id, edgeId: e.id },
    });
  };
  return (
    <div className={`bf-hend ${selected ? 'sel' : ''} ${hc}`} style={{ ['--hl' as any]: hl?.nodeColor.get(id) }} onDoubleClick={openFor} title="Åpen slangeende. Dra den til en port for å koble til, eller dobbeltklikk for å velge kobling.">
      <svg width={20} height={20} className="bf-svg">
        <circle cx={10} cy={10} r={5.5} fill="#fff" stroke="#334155" strokeWidth={2} />
        <circle cx={10} cy={10} r={1.8} fill="#334155" />
      </svg>
      <Handle id="p" type="source" position={Position.Left} isConnectable={false} className="bf-hend-handle"
        style={{ left: 10, top: 10, width: 2, height: 2, minWidth: 0, minHeight: 0, border: 'none', background: 'transparent', transform: 'translate(-50%, -50%)', pointerEvents: 'none' }} />
    </div>
  );
});

const g = (v: number) => Math.round(v / GRID) * GRID;

/** Strek og boks (hyller, benker, rom …) */
export const ShapeNode = memo(function ShapeNode({ id, data, selected, width, height, positionAbsoluteX, positionAbsoluteY }: NodeProps) {
  const d = data as any;
  const rf = useReactFlow();
  const sw = d.sw ?? 2;
  const dash = d.dash ? `${sw * 4} ${sw * 2.5}` : undefined;
  const drag = useRef<{ which: 'a' | 'b'; moved: boolean } | null>(null);
  if (d.shape === 'rect') {
    const w = width ?? 100, h = height ?? 60;
    return (
      <div className={`bf-shape rect ${selected ? 'sel' : ''}`} style={{ width: w, height: h }}>
        <NodeResizer isVisible={!!selected} minWidth={20} minHeight={20} color="#2563eb" handleStyle={{ width: 9, height: 9 }}
          onResizeStart={() => useStore.getState().snapshot()} />
        <svg width={w} height={h} className="bf-svg" style={{ overflow: 'visible' }}>
          {d.fill && <rect x={0} y={0} width={w} height={h} fill={d.fill} />}
          <rect x={sw / 2} y={sw / 2} width={Math.max(0, w - sw)} height={Math.max(0, h - sw)} fill="none" stroke={d.stroke} strokeWidth={sw} strokeDasharray={dash} />
          <rect className="hit" x={0} y={0} width={w} height={h} fill="none" stroke="transparent" strokeWidth={12} />
        </svg>
        {d.label && <div className="bf-shape-label">{d.label}</div>}
      </div>
    );
  }
  // strek: endepunkter relativt til nodens posisjon
  const ax = d.ax ?? 0, ay = d.ay ?? 0, bx = d.bx ?? 100, by = d.by ?? 0;
  const w = Math.max(1, Math.abs(bx - ax)), h = Math.max(1, Math.abs(by - ay));
  const ox = positionAbsoluteX ?? 0, oy = positionAbsoluteY ?? 0;
  const down = (e: React.PointerEvent, which: 'a' | 'b') => {
    e.stopPropagation();
    e.preventDefault();
    (e.target as Element).setPointerCapture(e.pointerId);
    drag.current = { which, moved: false };
  };
  const move = (e: React.PointerEvent) => {
    const dr = drag.current;
    if (!dr) return;
    if (!dr.moved) { dr.moved = true; useStore.getState().snapshot(); }
    const f = rf.screenToFlowPosition({ x: e.clientX, y: e.clientY });
    let A = { x: ox + ax, y: oy + ay }, B = { x: ox + bx, y: oy + by };
    const p = { x: g(f.x), y: g(f.y) };
    const other = dr.which === 'a' ? B : A;
    // rett linje når den nesten er vannrett/loddrett
    if (!e.shiftKey) {
      if (Math.abs(p.y - other.y) < Math.abs(p.x - other.x) * 0.15) p.y = other.y;
      else if (Math.abs(p.x - other.x) < Math.abs(p.y - other.y) * 0.15) p.x = other.x;
    }
    if (dr.which === 'a') A = p; else B = p;
    const x0 = Math.min(A.x, B.x), y0 = Math.min(A.y, B.y);
    const st = useStore.getState();
    useStore.setState({
      nodes: st.nodes.map((n) => (n.id === id ? { ...n, position: { x: x0, y: y0 }, data: { ...n.data, ax: A.x - x0, ay: A.y - y0, bx: B.x - x0, by: B.y - y0 } } : n)),
    });
    st.markDirty();
  };
  const up = () => { drag.current = null; };
  return (
    <div className={`bf-shape line ${selected ? 'sel' : ''}`} style={{ width: w, height: h }}>
      <svg width={w} height={h} className="bf-svg" style={{ overflow: 'visible' }}>
        {selected && <line x1={ax} y1={ay} x2={bx} y2={by} stroke="#60a5fa" strokeWidth={sw + 8} strokeOpacity={0.4} strokeLinecap="round" />}
        <line x1={ax} y1={ay} x2={bx} y2={by} stroke={d.stroke} strokeWidth={sw} strokeDasharray={dash} strokeLinecap="round" />
        <line className="hit" x1={ax} y1={ay} x2={bx} y2={by} stroke="transparent" strokeWidth={14} />
        {selected && (['a', 'b'] as const).map((k) => (
          <circle key={k} className="bf-lend nodrag nopan" cx={k === 'a' ? ax : bx} cy={k === 'a' ? ay : by} r={5}
            onPointerDown={(e) => down(e, k)} onPointerMove={move} onPointerUp={up} />
        ))}
      </svg>
      {d.label && <div className="bf-shape-label line" style={{ left: (ax + bx) / 2, top: (ay + by) / 2 }}>{d.label}</div>}
    </div>
  );
});

export const nodeTypes = { comp: ComponentNode, pyEnd: PythonEndNode, text: TextNode, hoseEnd: HoseEndNode, shape: ShapeNode };
