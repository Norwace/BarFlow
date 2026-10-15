import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../store';
import { findPort } from '../lib/compat';
import { directCompatible, portAbs, portSideAbs, opposite, rotationFor, positionForPort, sideToward } from '../lib/place';
import { normSize } from '../lib/geometry';
import { SymbolPreview } from '../lib/symbols';
import type { ComponentDef, PortDef } from '../lib/types';
import { isStandard } from '../lib/autofit';

const SERIES_ORDER = ['Acetal grå (tommer)', 'Acetal hvit (tommer)', 'Polypropylen hvit (tommer)', 'Acetal svart (metrisk)', 'Håndventiler', 'Kontrollventiler', 'Tilbakeslagsventiler', 'Stoppventiler', 'Stopp- og kranadaptere', 'Silfilter', 'Messing', 'Power-koblinger', 'Clean-koblinger'];
const FAMILY_ORDER = ['UC', 'EU', 'TU', 'RD', 'TWD', 'THWD', 'CR', 'TES', 'MC', 'MCB', 'ME', 'MES', 'MESB', 'FA', 'FAB', 'FAUF', 'BU', 'HUC', 'CUC', 'CHV', 'TEU', 'PL', 'SA', 'SAB', 'EL', 'UB'];

function matchPort(def: ComponentDef, from: PortDef): { port: PortDef; mode: 'hose' | 'direct' } | null {
  if (from.kind === 'stem' || from.kind === 'thread') {
    const p = def.ports.find((q) => directCompatible(from, q));
    return p ? { port: p, mode: 'direct' } : null;
  }
  const size = from.kind === 'push' || from.kind === 'tube' ? from.size : '';
  if (!size) {
    const p = def.ports.find((q) => q.kind === 'push') ?? def.ports[0];
    return p ? { port: p, mode: 'hose' } : null;
  }
  const p = def.ports.find((q) => (q.kind === 'push') && normSize(q.size) === normSize(size));
  return p ? { port: p, mode: 'hose' } : null;
}

export default function FittingPicker() {
  const picker = useStore((s) => s.picker);
  const library = useStore((s) => s.library);
  const favorites = useStore((s) => s.userLib.favorites);
  const [q, setQ] = useState('');
  const [all, setAll] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setQ(''); setAll(false); setTimeout(() => inputRef.current?.focus(), 0); }, [picker]);

  const st = useStore.getState();
  const fromNode = picker ? st.nodes.find((n) => n.id === picker.fromNode) : undefined;
  const freeEdge = picker?.freeEnd ? st.edges.find((e) => e.id === picker.freeEnd!.edgeId) : undefined;
  const fromPort: PortDef | undefined = picker?.freeEnd
    ? (freeEdge ? { id: 'p', name: 'Slangeende', side: 'left', pos: 0.5, kind: 'tube', size: (freeEdge.data as any).size } : undefined)
    : picker ? findPort(fromNode, picker.fromHandle, st.pythons) : undefined;

  const list = useMemo(() => {
    if (!picker || !fromPort) return [];
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    const out: { def: ComponentDef; port: PortDef | null; mode: 'hose' | 'direct' }[] = [];
    for (const def of library) {
      let m = matchPort(def, fromPort);
      if (picker.direct) {
        // kobling rett på slangen i pytonrøret
        const p = def.group !== 'Utstyr' ? def.ports.find((q) => directCompatible(fromPort, q)) : undefined;
        m = p ? { port: p, mode: 'direct' } : null;
      }
      if (!m && !all) continue;
      if (words.length) {
        const hay = `${def.name} ${def.artnr ?? ''} ${def.category} ${def.tags ?? ''} ${def.note ?? ''}`.toLowerCase();
        if (!words.every((w) => hay.includes(w))) continue;
      }
      out.push({ def, port: m?.port ?? null, mode: m?.mode ?? 'hose' });
    }
    const fav = new Set(favorites);
    // favoritter først, så egne, så vanlige koblinger i vanlige serier
    const rank = (d: ComponentDef) => {
      if (fav.has(d.id)) return 0;
      if (d.source === 'user') return 1;
      if (isStandard(d)) return 2;
      if (d.group === 'Utstyr') return 900;
      const fam = (d.note ?? '').split(' – ')[0];
      const fi = FAMILY_ORDER.indexOf(fam);
      const si = SERIES_ORDER.indexOf(d.category);
      return 10 + (si < 0 ? 20 : si) * 100 + (fi < 0 ? 99 : fi);
    };
    out.sort((a, b) => rank(a.def) - rank(b.def) || a.def.name.localeCompare(b.def.name, 'no'));
    return out;
  }, [picker, fromPort, library, q, all, favorites]);

  if (!picker || !fromNode || !fromPort) return null;
  const isFree = !!picker.freeEnd;

  const close = () => st.openPicker(null);

  const choose = (def: ComponentDef, port: PortDef | null, mode: 'hose' | 'direct') => {
    const s = useStore.getState();
    if (picker.freeEnd && freeEdge) {
      // kobling på åpen slangeende: koblingens port settes der enden er
      const end: 'source' | 'target' = freeEdge.source === picker.freeEnd.nodeId ? 'source' : 'target';
      const otherId = end === 'source' ? freeEdge.target : freeEdge.source;
      const otherH = end === 'source' ? freeEdge.targetHandle : freeEdge.sourceHandle;
      const otherNode = s.nodes.find((n) => n.id === otherId);
      const endPt = portAbs(fromNode!, 'p', s.pythons)!;
      const pts = (freeEdge.data as any).points as { x: number; y: number }[] | undefined;
      const toward = pts?.length ? (end === 'source' ? pts[0] : pts[pts.length - 1]) : otherNode && otherH ? portAbs(otherNode, otherH, s.pythons) : null;
      const p = port ?? def.ports.find((q) => q.kind === 'push') ?? def.ports[0];
      if (!p) { close(); return; }
      const rotation = toward ? rotationFor(p, sideToward(endPt, toward)) : 0;
      const pos = positionForPort(def, p, rotation, endPt);
      const nid = s.addComponent(def, pos, rotation);
      s.moveNode(nid, pos);
      s.rewireEnd(freeEdge.id, end, nid, p.id, false);
      close();
      s.selectOnly({ nodes: [nid] });
      return;
    }
    const fromPt = portAbs(fromNode, picker.fromHandle, s.pythons)!;
    const p = port ?? def.ports[0];
    if (!p) { close(); return; }
    let rotation = 0;
    let pos;
    if (mode === 'direct') {
      const desired = opposite(portSideAbs(fromNode, fromPort));
      rotation = rotationFor(p, desired);
      pos = positionForPort(def, p, rotation, fromPt);
    } else {
      const desired = sideToward(picker.flow, fromPt);
      rotation = rotationFor(p, desired);
      pos = positionForPort(def, p, rotation, { x: Math.round(picker.flow.x / 10) * 10, y: Math.round(picker.flow.y / 10) * 10 });
    }
    const nid = s.addComponent(def, pos, rotation);
    // juster til eksakt posisjon (addComponent runder til rutenett)
    if (mode === 'direct') s.moveNode(nid, pos);
    const eid = s.connect({ source: picker.fromNode, sourceHandle: picker.fromHandle, target: nid, targetHandle: p.id }, mode);
    close();
    if (eid && mode === 'hose') s.selectOnly({ edges: [eid] });
    else s.selectOnly({ nodes: [nid] });
  };

  const left = Math.min(picker.screen.x + 8, window.innerWidth - 700);
  const top = Math.max(8, Math.min(picker.screen.y - 20, window.innerHeight - 520));
  const desc = picker.direct ? `Koblinger som settes rett på slangen (${fromPort.size})` : isFree ? `Koblinger med push-fit ${fromPort.size} – settes på slangeenden` : fromPort.kind === 'stem' || fromPort.kind === 'thread'
    ? `Koblinger som passer direkte på ${[fromPort.std, fromPort.size].filter(Boolean).join(' ')} ${fromPort.kind === 'stem' ? 'stamme' : fromPort.gender === 'M' ? 'hanngjenge' : 'hunngjenge'}`
    : `Koblinger med push-fit ${fromPort.size || ''} – slange legges fra porten`;

  return (
    <>
      <div className="bf-picker-backdrop" onMouseDown={close} />
      <div className="bf-picker" style={{ left, top }} onKeyDown={(e) => { if (e.key === 'Escape') close(); }}>
        <div className="hd">
          <div className="t">Velg kobling</div>
          <div className="d">{desc}</div>
          <input ref={inputRef} placeholder="Søk (navn, art.nr, type) …" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && list[0]) choose(list[0].def, list[0].port, list[0].mode); }} />
          <label className="chk"><input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} /> Vis alt i biblioteket</label>
        </div>
        <div className="list">
          {list.slice(0, 300).map(({ def, port, mode }) => (
            <button key={def.id} className="row" onClick={() => choose(def, port, mode)}>
              <SymbolPreview def={def} size={34} />
              <span className="nm">{def.name}<span className="sub">{[def.artnr, def.category].filter(Boolean).join(' · ')}</span></span>
              <span className={`tag ${mode}`}>{port ? (mode === 'direct' ? 'direkte' : 'slange') : '—'}</span>
            </button>
          ))}
          {list.length === 0 && <div className="none">Ingen treff. Huk av «Vis alt i biblioteket» eller endre søket.</div>}
          {list.length > 300 && <div className="none">Viser 300 av {list.length} – skriv mer i søket.</div>}
        </div>
      </div>
    </>
  );
}
