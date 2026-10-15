import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Edge, Node } from '@xyflow/react';
import { useStore } from '../store';
import type { ComponentDef, HoseData, HoseDir, PythonDef } from '../lib/types';
import { TUBE_COLORS, TUBE_COLOR_HEX, TUBE_SIZES, DEFAULT_PYTHON_ORDER, PYTHON_COLORS, PRODUCT_MEDIA, COOL_MEDIA, MEDIA, DEFAULT_FLAVORS, mediumName, pythonColorHex, type Flavor } from '../lib/constants';
import { flavorsOf, type HoseFav } from '../lib/library';
import { uid } from '../lib/ids';
import { SymbolPreview } from '../lib/symbols';
import { pythonColors } from '../lib/python';
import { alternatives, endFitting, fitLabel, isElbow, isUBend, portMapping } from '../lib/autofit';
import { findPort, ownerOf, canSetMedium } from '../lib/compat';
import { portSideAbs } from '../lib/place';
import { useAnalysis, useSim } from './flow/context';
import { simKind, isOn, simOf, towerTaps } from '../lib/sim';

function LenInput({ value, onChange, onEnter, autoFocus = true }: { value: number | null; onChange: (v: number | null) => void; onEnter: () => void; autoFocus?: boolean }) {
  const [txt, setTxt] = useState(value == null ? '' : String(value).replace('.', ','));
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (autoFocus) setTimeout(() => { ref.current?.focus(); ref.current?.select(); }, 0); }, [autoFocus]);
  const commit = (t: string) => {
    const s = t.trim().replace(',', '.');
    if (s === '') return onChange(null);
    const n = parseFloat(s);
    if (!isNaN(n) && n >= 0) onChange(Math.round(n * 100) / 100);
  };
  return (
    <input ref={ref} className="len" inputMode="decimal" value={txt} placeholder="0"
      onChange={(e) => { setTxt(e.target.value); commit(e.target.value); }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onEnter();
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          e.preventDefault();
          const cur = parseFloat(txt.replace(',', '.')) || 0;
          const n = Math.max(0, Math.round((cur + (e.key === 'ArrowUp' ? 0.5 : -0.5)) * 100) / 100);
          setTxt(String(n).replace('.', ','));
          onChange(n);
        }
      }} />
  );
}

type Anchor = { left: number; top: number; right: number; bottom: number };

/** Popup som legges ved siden av det som ble klikket, og kan dras i tittellinja */
function Frame({ title, x, y, w = 280, hgt = 300, onClose, children, className, anchor }: { title: React.ReactNode; x: number; y: number; w?: number; hgt?: number; onClose: () => void; children: React.ReactNode; className?: string; anchor?: Anchor }) {
  const wrap = document.querySelector('.bf-canvas') as HTMLElement | null;
  const W = wrap?.clientWidth ?? 800, H = wrap?.clientHeight ?? 600;
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const drag = useRef<{ sx: number; sy: number; l: number; t: number } | null>(null);
  let autoLeft: number, autoTop: number;
  if (anchor) {
    // til høyre for komponenten, ellers til venstre, ellers under
    const gap = 14;
    if (anchor.right + gap + w <= W - 8) autoLeft = anchor.right + gap;
    else if (anchor.left - gap - w >= 8) autoLeft = anchor.left - gap - w;
    else autoLeft = Math.max(8, Math.min(anchor.left, W - w - 10));
    autoTop = Math.max(8, Math.min(anchor.top - 10, H - hgt));
  } else {
    autoLeft = Math.max(8, Math.min(x + 14, W - w - 10));
    autoTop = Math.max(8, Math.min(y + 14, H - hgt));
  }
  const left = pos ? Math.max(0, Math.min(pos.left, W - 60)) : autoLeft;
  const top = pos ? Math.max(0, Math.min(pos.top, H - 40)) : autoTop;
  const down = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { sx: e.clientX, sy: e.clientY, l: left, t: top };
  };
  const move = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    setPos({ left: d.l + e.clientX - d.sx, top: d.t + e.clientY - d.sy });
  };
  const up = () => { drag.current = null; };
  return (
    <div className={`bf-popup ${className ?? ''}`} style={{ left, top, width: w, maxHeight: H - top - 10 }} onPointerDown={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
      <div className="ph drag" onPointerDown={down} onPointerMove={move} onPointerUp={up} title="Dra for å flytte boksen">
        <span>{title}</span>
        <button className="x" onClick={onClose} title="Lukk (Esc)">×</button>
      </div>
      {children}
    </div>
  );
}

/** Valg av medium (slange og komponent) */
function MediumSelect({ value, onChange, autoLabel }: { value: string | undefined; onChange: (v: string) => void; autoLabel: string }) {
  return (
    <select value={value ?? 'auto'} onChange={(e) => onChange(e.target.value)}>
      <option value="auto">{autoLabel}</option>
      {MEDIA.filter((m) => m.id !== 'kjol').map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
    </select>
  );
}

/** Smaksliste for BIB: velg smak, eller legg til og endre smaker */
export function FlavorFields({ node }: { node: Node }) {
  const st = useStore.getState();
  const flavors = useStore((s) => flavorsOf(s.userLib));
  const [edit, setEdit] = useState(false);
  const d = node.data as any;
  const setList = (f: Flavor[]) => st.setFlavors(f);
  return (
    <>
      <label>Smak</label>
      <div className="flavorrow">
        <select value={d.flavor ?? ''} onChange={(e) => st.updateNodeData(node.id, { flavor: e.target.value || undefined })}>
          <option value="">Ingen smak valgt</option>
          {flavors.map((f) => <option key={f.name} value={f.name}>{f.name} ({f.color})</option>)}
          {d.flavor && !flavors.some((f) => f.name === d.flavor) && <option value={d.flavor}>{d.flavor}</option>}
        </select>
        <button className="btn small" onClick={() => setEdit(!edit)} title="Legg til eller endre smaker">{edit ? 'Ferdig' : 'Smaker …'}</button>
      </div>
      {edit && (
        <div className="flavoredit">
          {flavors.map((f, i) => (
            <div key={i} className="flv">
              <span className="dot" style={{ background: TUBE_COLOR_HEX[f.color] ?? '#ccc' }} />
              <input value={f.name} onChange={(e) => setList(flavors.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
              <select value={f.color} onChange={(e) => setList(flavors.map((x, j) => (j === i ? { ...x, color: e.target.value } : x)))}>
                {TUBE_COLORS.filter(Boolean).map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <button className="ic" title="Fjern smaken" onClick={() => setList(flavors.filter((_, j) => j !== i))}>×</button>
            </div>
          ))}
          <div className="btnrow tight">
            <button className="btn small" onClick={() => setList([...flavors, { name: 'Ny smak', color: 'Grå' }])}>+ Ny smak</button>
            <button className="btn small" onClick={() => { if (confirm('Sette smakslista tilbake til standard?')) setList(DEFAULT_FLAVORS); }}>Standardliste</button>
          </div>
        </div>
      )}
    </>
  );
}

const MORE = () => { useStore.getState().setRightTab('props'); useStore.getState().openPopup(null); };

/* ---------------- slange ---------------- */
function HoseBox({ edge, x, y, close }: { edge: Edge; x: number; y: number; close: () => void }) {
  const st = useStore.getState();
  const analysis = useAnalysis();
  const h = edge.data as HoseData;
  const eff = analysis?.hoseMedium.get(edge.id);
  const flavor = analysis?.hoseFlavor.get(edge.id);
  const up = (p: Partial<HoseData>) => st.updateEdgeData(edge.id, p);
  const sizes = TUBE_SIZES.includes(h.size) ? TUBE_SIZES : [h.size, ...TUBE_SIZES];
  return (
    <Frame title="Slange" x={x} y={y} hgt={360} onClose={close}>
      <label>Navn</label>
      <input value={h.name ?? ''} placeholder="F.eks. Øl 1" onChange={(e) => up({ name: e.target.value })} />
      <div className="row2">
        <div>
          <label>Dimensjon</label>
          <select value={h.size} onChange={(e) => up({ size: e.target.value })}>
            {sizes.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label>Lengde (m)</label>
          <LenInput value={h.length} onChange={(v) => up({ length: v })} onEnter={close} />
        </div>
      </div>
      <label>Medium</label>
      <MediumSelect value={h.medium} onChange={(v) => up({ medium: v })} autoLabel={`Automatisk${eff ? ` (${mediumName(eff)})` : ''}`} />
      <label>Farge{flavor ? ` (smak: ${flavor})` : ''}</label>
      <div className="swatches">
        {TUBE_COLORS.map((c) => (
          <button key={c || 'auto'} className={`swb ${h.color === c ? 'on' : ''} ${c ? '' : 'auto'}`} title={c || (flavor ? 'Etter smak' : 'Etter medium')}
            style={c ? { background: TUBE_COLOR_HEX[c] } : undefined} onClick={() => up({ color: c })}>
            {c ? '' : 'A'}
          </button>
        ))}
      </div>
      <div className="pf">
        <button className="btn small" onClick={MORE}>Flere valg</button>
        <button className="btn small" title="Lagre dimensjon, farge og medium som favorittslange (høyreklikk på tomt sted for å sette inn)"
          onClick={() => { st.addHoseFav({ id: uid('hf'), name: h.name, size: h.size, color: h.color, medium: h.medium, tube: h.tube }); st.showToast('Lagt til som favorittslange'); }}>★ Favoritt</button>
        {h.points && <button className="btn small" onClick={() => up({ points: undefined })} title="Fjern bøyer og la programmet legge slangen">Rett ut</button>}
        <button className="btn small danger" onClick={() => { close(); st.deleteSelected(); }}>Slett</button>
      </div>
    </Frame>
  );
}

/* ---------------- automatisk kobling i slangeende ---------------- */
function FitBox({ edge, end, x, y, close }: { edge: Edge; end: 's' | 't'; x: number; y: number; close: () => void }) {
  const analysis = useAnalysis();
  const st = useStore.getState();
  const nodes = useStore((s) => s.nodes);
  const pythons = useStore((s) => s.pythons);
  const library = useStore((s) => s.library);
  const h = edge.data as HoseData;
  const fit = analysis?.fits.get(edge.id)?.[end];
  const nodeId = end === 's' ? edge.source : edge.target;
  const handle = end === 's' ? edge.sourceHandle : edge.targetHandle;
  const node = nodes.find((n) => n.id === nodeId);
  const port = findPort(node, handle, pythons);
  const cur = end === 's' ? h.fitS : h.fitT;
  const auto = useMemo(() => endFitting(port, h.size, undefined, library, ownerOf(node)), [port, h.size, library, node]);
  const [all, setAll] = useState(false);
  if (!fit) return null;
  const set = (v: string | undefined) => { st.updateEdgeData(edge.id, end === 's' ? { fitS: v } : { fitT: v }); close(); };
  const cands = fit.candidates;
  const lim = all ? 40 : 4;
  const straight = cands.filter((d) => d.symbol === 'fit' && !isElbow(d) && !isUBend(d));
  const elbows = cands.filter((d) => d.symbol === 'fit' && isElbow(d));
  const other = cands.filter((d) => d.symbol !== 'fit' || isUBend(d));
  const more = straight.length > lim || elbows.length > lim || other.length > lim;
  const Row = ({ d }: { d: ComponentDef }) => (
    <button className={`fitopt ${cur === d.id ? 'on' : ''}`} onClick={() => set(d.id)}>
      <span>{fitLabel(d)}</span><span className="mut small">{d.artnr} · {d.category}</span>
    </button>
  );
  const autoTxt = auto.status === 'ok' && auto.def ? fitLabel(auto.def) : auto.status === 'missing' ? 'ingen funnet' : 'ingen kobling';
  // retning ut av porten: rett ut, eller vinkel til en av sidene
  const side = node && port ? portSideAbs(node, port) : 'right';
  const perp: HoseDir[] = side === 'left' || side === 'right' ? ['up', 'down'] : ['left', 'right'];
  const curDir = end === 's' ? h.dirS : h.dirT;
  const curDef = fit.status === 'ok' ? fit.def : undefined;
  const setDir = (d: HoseDir | undefined) => {
    const patch: Partial<HoseData> = end === 's' ? { dirS: d } : { dirT: d };
    const fk = end === 's' ? 'fitS' : 'fitT';
    // vinkel ut av porten: bruk vinkelkobling hvis det finnes; rett ut: ta bort valgt vinkel
    if (d && d !== 'straight' && elbows.length && !(curDef && isElbow(curDef))) (patch as any)[fk] = elbows[0].id;
    if (d === 'straight' && cur && curDef && isElbow(curDef)) (patch as any)[fk] = undefined;
    st.updateEdgeData(edge.id, patch);
  };
  const ARROW: Record<string, string> = { up: '↑', down: '↓', left: '←', right: '→' };
  const NAME: Record<string, string> = { up: 'opp', down: 'ned', left: 'venstre', right: 'høyre' };
  return (
    <Frame title="Slangeende" x={x} y={y} w={300} hgt={460} onClose={close} className="fitpop">
      <div className="mut small">{port?.name ?? '?'} · slange {h.size}{fit.need ? ` · ${fit.need}` : ''}</div>
      <label>Retning ut av porten</label>
      <div className="dirbtns">
        <button className={`btn small ${!curDir ? 'on' : ''}`} onClick={() => setDir(undefined)} title="Rett ut, eller vinkel når koblingen er en vinkel">Auto</button>
        <button className={`btn small ${curDir === 'straight' ? 'on' : ''}`} onClick={() => setDir('straight')}>{ARROW[side]} Rett ut</button>
        {perp.map((d) => <button key={d} className={`btn small ${curDir === d ? 'on' : ''}`} onClick={() => setDir(d)} title={`Slangen svinger ${NAME[d]} rett ved porten`}>{ARROW[d]} Vinkel {NAME[d]}</button>)}
      </div>
      <label>Kobling</label>
      <div className="fitlist">
        <button className={`fitopt ${!cur ? 'on' : ''}`} onClick={() => set(undefined)}><span>Automatisk</span><span className="mut small">{autoTxt}</span></button>
        <button className={`fitopt ${cur === 'none' ? 'on' : ''}`} onClick={() => set('none')}><span>Ingen kobling</span><span className="mut small">slangen går rett i porten</span></button>
        {straight.length > 0 && <div className="sub-h">Rette</div>}
        {straight.slice(0, lim).map((d) => <Row key={d.id} d={d} />)}
        {elbows.length > 0 && <div className="sub-h">Vinkler</div>}
        {elbows.slice(0, lim).map((d) => <Row key={d.id} d={d} />)}
        {other.length > 0 && <div className="sub-h">Andre</div>}
        {other.slice(0, lim).map((d) => <Row key={d.id} d={d} />)}
        {more && <button className="link small" onClick={() => setAll(!all)}>{all ? 'Vis færre' : 'Vis flere (andre serier)'}</button>}
        {!cands.length && <div className="mut small pad">Fant ingen koblinger i biblioteket for dette.</div>}
      </div>
    </Frame>
  );
}

/* ---------------- pytonrør ---------------- */
function PythonBox({ py, x, y, close, endNode, anchor }: { py: PythonDef; x: number; y: number; close: () => void; endNode?: Node; anchor?: Anchor }) {
  const st = useStore.getState();
  const analysis = useAnalysis();
  const cols = pythonColors(py);
  const up = (p: Partial<PythonDef>) => st.updatePython(py.id, p);
  const names = py.productNames ?? [];
  const media = py.productMedia ?? [];
  const setAt = <K extends 'productNames' | 'productMedia' | 'productColors'>(key: K, i: number, v: string) => {
    const arr = [...((py[key] as string[] | undefined) ?? [])];
    while (arr.length < py.products) arr.push(key === 'productMedia' ? 'any' : key === 'productColors' ? cols[arr.length] : '');
    arr[i] = v;
    up({ [key]: arr } as Partial<PythonDef>);
  };
  const body = st.edges.find((e) => e.type === 'python' && (e.data as any).pythonId === py.id);
  return (
    <Frame anchor={anchor} title={endNode ? `Pytonrør – ende ${(endNode.data as any).end}` : 'Pytonrør'} x={x} y={y} w={360} hgt={Math.min(600, 310 + py.products * 30)} onClose={close} className="pypop">
      {endNode && (
        <div className="btnrow tight">
          <button className="btn small" onClick={() => st.rotateSelected(-1)} title="Roter mot klokka (Shift+R)">⟲</button>
          <button className="btn small" onClick={() => st.rotateSelected(1)} title="Roter med klokka (R)">⟳</button>
          <button className="btn small" onClick={() => st.flipSelected()} title="Speil (F)">⇋ Speil</button>
        </div>
      )}
      <label>Navn</label>
      <input value={py.name} onChange={(e) => up({ name: e.target.value })} />
      <div className="row3">
        <div>
          <label>Produktslanger</label>
          <select value={py.products} onChange={(e) => {
            const n = parseInt(e.target.value);
            const c = [...cols];
            while (c.length < n) c.push(DEFAULT_PYTHON_ORDER.find((x) => !c.includes(x)) ?? 'Grå');
            up({ products: n, productColors: c.slice(0, n) });
          }}>
            {[2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => <option key={n} value={n}>{n} + 2 kjøl</option>)}
          </select>
        </div>
        <div>
          <label>Kjøleloop</label>
          <select value={py.coolMedium ?? 'vann'} onChange={(e) => up({ coolMedium: e.target.value })}>
            {COOL_MEDIA.map((m) => <option key={m} value={m}>{mediumName(m)}</option>)}
          </select>
        </div>
        <div>
          <label>Lengde (m)</label>
          <LenInput value={py.length} onChange={(v) => up({ length: v })} onEnter={close} autoFocus={!endNode} />
        </div>
      </div>
      <div className="row2">
        <div>
          <label>Dimensjon produkt</label>
          <select value={py.productSize} onChange={(e) => up({ productSize: e.target.value })}>
            {(TUBE_SIZES.includes(py.productSize) ? TUBE_SIZES : [py.productSize, ...TUBE_SIZES]).map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label>Dimensjon kjøleloop</label>
          <select value={py.coolSize} onChange={(e) => up({ coolSize: e.target.value })}>
            {(TUBE_SIZES.includes(py.coolSize) ? TUBE_SIZES : [py.coolSize, ...TUBE_SIZES]).map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>
      <label>Innhold i slangene</label>
      <div className="pytubes">
        {cols.map((c, i) => (
          <div key={i} className="pytube">
            <span className="n">{i + 1}</span>
            <select className="col" value={c} style={{ borderLeft: `10px solid ${pythonColorHex(c)}` }} onChange={(e) => setAt('productColors', i, e.target.value)} title="Farge">
              {PYTHON_COLORS.map((pc) => <option key={pc.name} value={pc.name}>{pc.name}</option>)}
            </select>
            <input value={names[i] ?? ''} placeholder={analysis?.tubeFlavor.get(`${py.id}:p${i + 1}`) ? `${analysis.tubeFlavor.get(`${py.id}:p${i + 1}`)} (fra BIB)` : 'Innhold, f.eks. Pils'} onChange={(e) => setAt('productNames', i, e.target.value)} />
            <select value={media[i] ?? 'any'} onChange={(e) => setAt('productMedia', i, e.target.value)} title="Medium">
              {PRODUCT_MEDIA.map((m) => <option key={m} value={m}>{m === 'any' ? 'Medium …' : mediumName(m)}</option>)}
            </select>
          </div>
        ))}
        <div className="pytube cool">
          <span className="n">K</span>
          <span className="mut small">Kjøleloop {py.coolSize}: 1 hvit + 1 svart – {mediumName(py.coolMedium ?? 'vann')}</span>
        </div>
      </div>
      <div className="pf">
        <button className="btn small" onClick={MORE}>Flere valg</button>
        {(body?.data as any)?.points && <button className="btn small" onClick={() => body && st.updateEdgeData(body.id, { points: undefined })}>Rett ut</button>}
        <button className="btn small danger" onClick={() => {
          close();
          const ends = st.nodes.filter((n) => n.type === 'pyEnd' && (n.data as any).pythonId === py.id).map((n) => n.id);
          st.onNodesChange(ends.map((id) => ({ type: 'remove', id })));
        }}>Slett</button>
      </div>
    </Frame>
  );
}

/* ---------------- komponent ---------------- */
function CompBox({ node, x, y, close, anchor }: { node: Node; x: number; y: number; close: () => void; anchor?: Anchor }) {
  const st = useStore.getState();
  const library = useStore((s) => s.library);
  const d = node.data as any;
  const def = d.def as ComponentDef;
  const isEquip = def.group === 'Utstyr';
  const alts = useMemo(() => alternatives(def, library), [def, library]);
  const libDef = library.find((x) => x.id === def.id);
  const swap = (id: string) => {
    const nd = library.find((x) => x.id === id);
    if (!nd) return;
    st.replaceNodeDef(node.id, nd, portMapping(def, nd));
  };
  const two = def.ports.length === 2;
  const altStraight = two ? alts.filter((a) => !isElbow(a) && !isUBend(a)) : alts;
  const altElbow = two ? alts.filter((a) => isElbow(a)) : [];
  const altOther = two ? alts.filter((a) => isUBend(a)) : [];
  return (
    <Frame anchor={anchor} title={isEquip ? def.name : fitLabel(def)} x={x} y={y} w={300} hgt={380} onClose={close}>
      <div className="mut small">{[def.artnr, def.maker, def.category].filter(Boolean).join(' · ')}</div>
      <DriftFields node={node} def={def} />
      <label>Etikett</label>
      <input value={d.label ?? ''} placeholder={isEquip ? d.flavor || def.name : fitLabel(def)} onChange={(e) => st.updateNodeData(node.id, { label: e.target.value })} />
      <div className="btnrow tight">
        <button className="btn small" onClick={() => st.rotateSelected(-1)} title="Roter mot klokka (Shift+R)">⟲ Roter</button>
        <button className="btn small" onClick={() => st.rotateSelected(1)} title="Roter med klokka (R)">⟳ Roter</button>
        <button className="btn small" onClick={() => st.flipSelected()} title="Speil (F)">⇋ Speil</button>
      </div>
      {alts.length > 1 && (
        <>
          <label>Bytt kobling</label>
          <select value={def.id} onChange={(e) => swap(e.target.value)}>
            {altStraight.length > 0 && <optgroup label={two ? 'Rette' : 'Alternativer'}>{altStraight.slice(0, two ? 15 : 25).map((a) => <option key={a.id} value={a.id}>{fitLabel(a)} – {a.artnr} ({a.category})</option>)}</optgroup>}
            {altElbow.length > 0 && <optgroup label="Vinkler">{altElbow.slice(0, 15).map((a) => <option key={a.id} value={a.id}>{fitLabel(a)} – {a.artnr} ({a.category})</option>)}</optgroup>}
            {altOther.length > 0 && <optgroup label="Andre">{altOther.slice(0, 10).map((a) => <option key={a.id} value={a.id}>{fitLabel(a)} – {a.artnr} ({a.category})</option>)}</optgroup>}
            {!alts.some((a) => a.id === def.id) && <option value={def.id}>{def.artnr ?? def.name}</option>}
          </select>
        </>
      )}
      {def.symbol === 'bib' && <FlavorFields node={node} />}
      {canSetMedium(def) && (
        <>
          <label>Medium{isEquip ? ' (porter uten fast medium)' : ''}</label>
          <MediumSelect value={d.medium} onChange={(v) => st.updateNodeData(node.id, { medium: v === 'auto' ? undefined : v })} autoLabel="Som komponenten (alle)" />
        </>
      )}
      <label>Notat</label>
      <input value={d.note ?? ''} placeholder="Valgfritt" onChange={(e) => st.updateNodeData(node.id, { note: e.target.value })} />
      <div className="pf">
        <button className="btn small" onClick={MORE}>Flere valg</button>
        {isEquip && <button className="btn small" onClick={() => { close(); st.openEditor(libDef ?? def, false); }}>✎ Rediger</button>}
        <button className="btn small danger" onClick={() => { close(); st.deleteSelected(); }}>Slett</button>
      </div>
    </Frame>
  );
}

/* ---------------- drift-modus ---------------- */
function DriftFields({ node, def }: { node: Node; def: ComponentDef }) {
  const st = useStore.getState();
  const sim = useSim();
  const nodes = useStore((s) => s.nodes);
  const edges = useStore((s) => s.edges);
  const k = simKind(def);
  if (!sim || !k) return null;
  const on = isOn(node, k);
  const set = (patch: Record<string, unknown>) => st.setSim(node.id, patch);
  const Two = ({ a, b, val, onA, onB }: { a: string; b: string; val: boolean; onA: () => void; onB: () => void }) => (
    <div className="dirbtns">
      <button className={`btn small ${val ? 'on' : ''}`} onClick={onA}>{a}</button>
      <button className={`btn small ${!val ? 'on' : ''}`} onClick={onB}>{b}</button>
    </div>
  );
  // bagveksler: hvilken BIB sitter på hver inngang
  const bagName = (portId: string) => {
    const e = edges.find((x) => (x.target === node.id && x.targetHandle === portId) || (x.source === node.id && x.sourceHandle === portId));
    if (!e) return 'ikke koblet';
    const other = nodes.find((n) => n.id === (e.source === node.id ? e.target : e.source));
    const od = other && (other.data as any);
    return od?.label || od?.flavor || od?.def?.name || '?';
  };
  return (
    <div className="driftbox">
      <div className="sub-h">Drift</div>
      {(k === 'tap' || k === 'valve' || k === 'supply') && <Two a="Åpen" b="Stengt" val={on} onA={() => set({ open: true })} onB={() => set({ open: false })} />}
      {k === 'bag' && <Two a="Full" b="Tom" val={on} onA={() => set({ full: true })} onB={() => set({ full: false })} />}
      {(k === 'power' || k === 'machine') && <Two a="På" b="Av" val={on} onA={() => set({ on: true })} onB={() => set({ on: false })} />}
      {k === 'bibswitch' && (() => {
        const ins = def.ports.filter((p) => /inn/i.test(p.name));
        const want = simOf(node).active ?? 1;
        const act = sim.bagActive.get(node.id) ?? 0;
        return (
          <>
            <div className="dirbtns">
              {ins.map((p, i) => <button key={p.id} className={`btn small ${want === i + 1 ? 'on' : ''}`} onClick={() => set({ active: i + 1 })}>Bag {i + 1}: {bagName(p.id)}</button>)}
            </div>
            <div className="mut small">{act ? `Trekker fra bag ${act}${act !== want ? ' (byttet automatisk – valgt bag er tom)' : ''}` : 'Ingen bag gir sirup'}</div>
          </>
        );
      })()}
      {k === 'tower' && (
        <div className="taplist">
          {towerTaps(def).map((p) => {
            const open = !!simOf(node).taps?.[p.id];
            return <label key={p.id} className="chk"><input type="checkbox" checked={open} onChange={() => set({ taps: { ...(simOf(node).taps ?? {}), [p.id]: !open } })} /> {p.name.replace('Produkt inn', 'Kran')}</label>;
          })}
        </div>
      )}
      {k === 'drain' && <div className="mut small">Tar imot det som kommer.</div>}
    </div>
  );
}

/* ---------------- strek / boks ---------------- */
export const SHAPE_COLORS = ['#475569', '#111827', '#2563eb', '#dc2626', '#16a34a', '#ea580c', '#9333ea'];
export const SHAPE_FILLS = ['', '#f1f5f9', '#e0f2fe', '#fef9c3', '#dcfce7', '#fee2e2', '#f3e8ff'];

export function ShapeFields({ node }: { node: Node }) {
  const st = useStore.getState();
  const d = node.data as any;
  const up = (p: Record<string, unknown>) => st.updateNodeData(node.id, p);
  return (
    <>
      <label>Tekst</label>
      <input value={d.label ?? ''} placeholder={d.shape === 'rect' ? 'F.eks. Hylle, Kjølerom' : 'Valgfritt'} onChange={(e) => up({ label: e.target.value })} />
      <label>Farge</label>
      <div className="swatches">
        {SHAPE_COLORS.map((c) => <button key={c} className={`swb ${d.stroke === c ? 'on' : ''}`} style={{ background: c }} onClick={() => up({ stroke: c })} />)}
      </div>
      {d.shape === 'rect' && (
        <>
          <label>Fyll</label>
          <div className="swatches">
            {SHAPE_FILLS.map((c) => <button key={c || 'none'} className={`swb ${(d.fill ?? '') === c ? 'on' : ''} ${c ? '' : 'auto'}`} style={c ? { background: c } : undefined} title={c ? '' : 'Ingen fyll'} onClick={() => up({ fill: c })}>{c ? '' : '–'}</button>)}
          </div>
        </>
      )}
      <div className="row2">
        <div>
          <label>Strek</label>
          <select value={d.dash ? 'dash' : 'solid'} onChange={(e) => up({ dash: e.target.value === 'dash' })}>
            <option value="solid">Hel</option>
            <option value="dash">Stiplet</option>
          </select>
        </div>
        <div>
          <label>Tykkelse</label>
          <select value={d.sw ?? 2} onChange={(e) => up({ sw: parseInt(e.target.value) })}>
            {[1, 2, 3, 5, 8].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      </div>
    </>
  );
}

function ShapeBox({ node, x, y, close, anchor }: { node: Node; x: number; y: number; close: () => void; anchor?: Anchor }) {
  const st = useStore.getState();
  const d = node.data as any;
  return (
    <Frame anchor={anchor} title={d.shape === 'rect' ? 'Boks' : 'Strek'} x={x} y={y} w={270} hgt={320} onClose={close}>
      <ShapeFields node={node} />
      <div className="pf">
        <button className="btn small danger" onClick={() => { close(); st.deleteSelected(); }}>Slett</button>
      </div>
    </Frame>
  );
}

/* ---------------- høyreklikk på tomt sted: sett inn ---------------- */
function InsertMenu({ x, y, flow, close }: { x: number; y: number; flow: { x: number; y: number }; close: () => void }) {
  const st = useStore.getState();
  const favs = useStore((s) => s.userLib.favorites);
  const hoseFavs = useStore((s) => s.userLib.hoseFavs) ?? [];
  const library = useStore((s) => s.library);
  const blueprints = useStore((s) => s.userLib.blueprints) ?? [];
  const favDefs = favs.map((id) => library.find((d) => d.id === id)).filter(Boolean) as ComponentDef[];
  const equip = favDefs.filter((d) => d.group === 'Utstyr');
  // koblinger: bare formen – størrelsen settes når den kobles til slange eller port
  const fits = library.filter((d) => d.generic);
  const stdHoses: HoseFav[] = ['5/16"', '3/8"', '1/2"'].filter((sz) => !hoseFavs.some((h) => h.size === sz && !h.color && !h.name)).map((sz) => ({ id: 'std' + sz, size: sz, color: '', medium: 'auto', tube: 'PE' }));
  const addHose = (h: HoseFav) => {
    const eid = st.addFreeHose(flow);
    const s2 = useStore.getState();
    useStore.setState({ edges: s2.edges.map((e) => (e.id === eid ? { ...e, data: { ...e.data, size: h.size, color: h.color, medium: h.medium, tube: h.tube, name: h.name || undefined } } : e)) });
    s2.selectOnly({ edges: [eid] });
    close();
  };
  const addComp = (d: ComponentDef) => {
    const id = st.addComponent(d, { x: flow.x - d.w / 2, y: flow.y - d.h / 2 });
    st.selectOnly({ nodes: [id] });
    close();
  };
  const hoseText = (h: HoseFav) => [h.name, h.size, h.color, h.medium && h.medium !== 'auto' ? mediumName(h.medium) : ''].filter(Boolean).join(' · ');
  return (
    <Frame title="Sett inn" x={x} y={y} w={290} hgt={420} onClose={close} className="insmenu">
      <div className="sub-h">Slanger</div>
      {[...hoseFavs, ...stdHoses].map((h) => (
        <div key={h.id} className="insrow">
          <button className="insbtn" onClick={() => addHose(h)}>
            <span className="hsw" style={{ background: h.color ? TUBE_COLOR_HEX[h.color] : '#334155' }} />{hoseText(h)}
          </button>
          {!h.id.startsWith('std') && <button className="ic" title="Fjern fra favoritter" onClick={() => st.removeHoseFav(h.id)}>×</button>}
        </div>
      ))}
      {equip.length > 0 && <div className="sub-h">Utstyr</div>}
      {equip.map((d) => <button key={d.id} className="insbtn" onClick={() => addComp(d)}><SymbolPreview def={d} size={20} />{d.name}</button>)}
      {fits.length > 0 && <div className="sub-h">Koblinger – størrelse settes når du drar dem til slange eller port</div>}
      <div className="insgrid">
        {fits.map((d) => (
          <button key={d.id} className="insbtn tile" draggable title="Klikk for å legge den her, eller dra den rett til en slange eller port"
            onDragStart={(e) => { e.dataTransfer.setData('application/barflow', d.id); e.dataTransfer.effectAllowed = 'copy'; }}
            onDragEnd={() => close()}
            onClick={() => addComp(d)}>
            <SymbolPreview def={d} size={26} />{d.name}
          </button>
        ))}
      </div>
      {blueprints.length > 0 && <div className="sub-h">Blueprints</div>}
      {blueprints.slice(0, 8).map((b) => <button key={b.id} className="insbtn" onClick={() => { st.insertBlueprint(b.id, flow); close(); }}>▦ {b.name}</button>)}
      <div className="sub-h">Annet</div>
      <div className="dirbtns">
        <button className="btn small" onClick={() => { st.addPython(flow); close(); }}>Pytonrør</button>
        <button className="btn small" onClick={() => { st.addText(flow); close(); }}>Tekst</button>
      </div>
      {!equip.length && <div className="mut small">Marker utstyr med ★ i biblioteket for å få det her. Slanger legges til med ★ i slange-boksen.</div>}
    </Frame>
  );
}

/* ---------------- flere valgt ---------------- */
function SelectionBox({ x, y, close }: { x: number; y: number; close: () => void }) {
  const st = useStore.getState();
  const nN = useStore((s) => s.nodes.filter((n) => n.selected && n.type !== 'hoseEnd').length);
  const nE = useStore((s) => s.edges.filter((e) => e.selected && e.type === 'hose').length);
  return (
    <Frame title={`${nN} komponenter og ${nE} slanger valgt`} x={x} y={y} w={260} hgt={200} onClose={close}>
      <div className="selmenu">
        <button className="btn small primary" onClick={() => st.openBpSave(true)}>Lagre som blueprint …</button>
        <button className="btn small" onClick={() => { st.copySelected(); close(); }}>Kopier</button>
        <button className="btn small" onClick={() => { st.copySelected(); st.paste(); close(); }}>Dupliser</button>
        <button className="btn small" onClick={() => st.rotateSelected(1)}>⟳ Roter</button>
        <button className="btn small danger" onClick={() => { close(); st.deleteSelected(); }}>Slett</button>
      </div>
    </Frame>
  );
}

export default function Popups() {
  const popup = useStore((s) => s.popup);
  const edge = useStore((s) => (s.popup && s.popup.kind !== 'node' ? s.edges.find((e) => e.id === s.popup!.id) : undefined));
  const node = useStore((s) => (s.popup?.kind === 'node' ? s.nodes.find((n) => n.id === s.popup!.id) : undefined));
  const pyId = edge?.type === 'python' ? (edge.data as any).pythonId : node?.type === 'pyEnd' ? (node.data as any).pythonId : undefined;
  const py = useStore((s) => (pyId ? s.pythons.find((p) => p.id === pyId) : undefined));
  useEffect(() => {
    if (!popup) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') useStore.getState().openPopup(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [popup]);
  // lukk når elementet ikke lenger er valgt
  const target = edge ?? node;
  const anySel = useStore((s) => s.nodes.some((n) => n.selected));
  useEffect(() => {
    if (!popup) return;
    if (popup.kind === 'pane') return;
    if (popup.kind === 'selection' ? !anySel : !target || !target.selected) useStore.getState().openPopup(null);
  }, [popup, target, anySel]);
  if (!popup) return null;
  const close = () => useStore.getState().openPopup(null);
  const { x, y } = popup;
  if (popup.kind === 'selection') return anySel ? <SelectionBox x={x} y={y} close={close} /> : null;
  if (popup.kind === 'pane') return <InsertMenu x={x} y={y} flow={popup.flow ?? { x: 0, y: 0 }} close={close} />;
  if (!target) return null;
  if (popup.kind === 'fit' && edge?.type === 'hose') return <FitBox key={edge.id + popup.end + popup.x} edge={edge} end={popup.end ?? 's'} x={x} y={y} close={close} />;
  if (edge?.type === 'python' && py) return <PythonBox key={edge.id + x + ',' + y} py={py} x={x} y={y} close={close} />;
  if (edge?.type === 'hose') return <HoseBox key={edge.id + popup.x} edge={edge} x={x} y={y} close={close} />;
  // rammen til en stor boks (rom) dekker alt – da legges popupen ved klikkpunktet
  const anchor = node?.type === 'shape' ? undefined : popup.anchor;
  if (node?.type === 'pyEnd' && py) return <PythonBox key={node.id + x + ',' + y} py={py} x={x} y={y} close={close} endNode={node} anchor={anchor} />;
  if (node?.type === 'comp') return <CompBox key={node.id + x + ',' + y} node={node} x={x} y={y} close={close} anchor={anchor} />;
  if (node?.type === 'shape') return <ShapeBox key={node.id + x + ',' + y} node={node} x={x} y={y} close={close} />;
  return null;
}
