import React, { useEffect, useRef, useState } from 'react';
import type { Edge, Node } from '@xyflow/react';
import { useStore } from '../store';
import type { ComponentDef, HoseData, HoseDir, PythonDef } from '../lib/types';
import type { FitResult } from '../lib/autofit';
import { TUBE_COLOR_HEX } from '../lib/constants';
import { MEDIA, TUBE_COLORS, TUBE_SIZES, TUBE_TYPES, PYTHON_COLORS, DEFAULT_PYTHON_ORDER, mediumName, pythonColorHex } from '../lib/constants';
import { SymbolPreview } from '../lib/symbols';
import { findPort, nodeDef, portLabel, warnKey, canSetMedium, type Analysis } from '../lib/compat';
import { ShapeFields, FlavorFields } from './HosePopup';
import { PRODUCT_MEDIA, COOL_MEDIA } from '../lib/constants';
import { pythonColors } from '../lib/python';

function NumInput({ value, onChange, autoFocusKey, placeholder, step = 0.1 }: { value: number | null; onChange: (v: number | null) => void; autoFocusKey?: number; placeholder?: string; step?: number }) {
  const [txt, setTxt] = useState(value == null ? '' : String(value).replace('.', ','));
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { setTxt(value == null ? '' : String(value).replace('.', ',')); }, [value]);
  useEffect(() => { if (autoFocusKey) { ref.current?.focus(); ref.current?.select(); } }, [autoFocusKey]);
  const commit = (t: string) => {
    const s = t.trim().replace(',', '.');
    if (s === '') return onChange(null);
    const n = parseFloat(s);
    if (!isNaN(n) && n >= 0) onChange(Math.round(n * 100) / 100);
  };
  return (
    <input
      ref={ref}
      className="num"
      inputMode="decimal"
      value={txt}
      placeholder={placeholder}
      onChange={(e) => { setTxt(e.target.value); commit(e.target.value); }}
      onKeyDown={(e) => {
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          e.preventDefault();
          const cur = parseFloat(txt.replace(',', '.')) || 0;
          const n = Math.max(0, Math.round((cur + (e.key === 'ArrowUp' ? step : -step)) * 100) / 100);
          setTxt(String(n).replace('.', ','));
          onChange(n);
        }
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
      }}
    />
  );
}

function SizeSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const opts = TUBE_SIZES.includes(value) ? TUBE_SIZES : [value, ...TUBE_SIZES];
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      {opts.map((s) => <option key={s} value={s}>{s}</option>)}
    </select>
  );
}

function nodeName(n: Node | undefined, pythons: PythonDef[]) {
  if (!n) return '?';
  if (n.type === 'pyEnd') {
    const py = pythons.find((p) => p.id === (n.data as any).pythonId);
    return `${py?.name ?? 'Pytonrør'} ende ${(n.data as any).end}`;
  }
  const d = nodeDef(n, pythons);
  return (n.data as any).label || (n.data as any).flavor || d?.name || '?';
}

function FitSelect({ label, fit, value, onChange }: { label: string; fit: FitResult; value?: string; onChange: (v: string | undefined) => void }) {
  const cur = value ?? '';
  const autoTxt = fit.status === 'missing' && !value ? 'Auto – ingen funnet' : !value && fit.def ? `Auto: ${fit.def.artnr ?? fit.def.name}` : !value ? 'Auto (ingen trengs)' : 'Auto';
  const opts = fit.candidates.slice(0, 25);
  const curDef = value && value !== 'none' && !opts.some((o) => o.id === value) ? fit.def : undefined;
  return (
    <>
      <label>{label}</label>
      <select value={cur} onChange={(e) => onChange(e.target.value || undefined)} title={fit.need ? `Trengs: ${fit.need}` : ''}>
        <option value="">{autoTxt}</option>
        <option value="none">Ingen kobling</option>
        {curDef && <option value={curDef.id}>{curDef.artnr} – {curDef.name}</option>}
        {opts.map((d) => <option key={d.id} value={d.id}>{d.artnr} – {d.name}</option>)}
      </select>
    </>
  );
}

/** Varsler for valgt slange, med avkryssing for å ignorere hvert enkelt */
function WarnBox({ id, analysis }: { id: string; analysis: Analysis }) {
  const toggle = useStore((s) => s.toggleIgnore);
  const list = analysis.warnings.filter((w) => w.target.id === id);
  if (!list.length) return null;
  return (
    <div className="warnbox">
      {list.map((w) => (
        <div key={w.id} className={`wbrow ${w.ignored ? 'ign' : ''}`}>
          <span>⚠ {w.text}</span>
          <label className="wign" title={w.ignored ? 'Vis varselet i tegningen igjen' : 'Ignorer – varselet vises ikke i tegningen'}><input type="checkbox" checked={!!w.ignored} onChange={() => toggle(warnKey(w))} /> Ignorer</label>
        </div>
      ))}
    </div>
  );
}

function ShapeProps({ node }: { node: Node }) {
  const st = useStore();
  const d = node.data as any;
  return (
    <div className="props shapeprops">
      <div className="ph">{d.shape === 'rect' ? 'Boks' : 'Strek'}</div>
      <ShapeFields node={node} />
      <p className="mut small">{d.shape === 'rect' ? 'Dra i hjørnene for å endre størrelsen.' : 'Dra endepunktene for å flytte dem. Hold Shift for fri vinkel.'}</p>
      <div className="btnrow"><button className="btn danger" onClick={() => st.deleteSelected()}>Slett</button></div>
    </div>
  );
}

function DirSelect({ value, onChange }: { value?: HoseDir; onChange: (v: HoseDir | undefined) => void }) {
  return (
    <select value={value ?? ''} onChange={(e) => onChange((e.target.value || undefined) as HoseDir | undefined)} title="Hvordan slangen går ut av porten">
      <option value="">Auto (vinkel hvis vinkelkobling)</option>
      <option value="straight">Rett ut</option>
      <option value="up">Vinkel opp</option>
      <option value="down">Vinkel ned</option>
      <option value="left">Vinkel venstre</option>
      <option value="right">Vinkel høyre</option>
    </select>
  );
}

function HoseEndProps({ node }: { node: Node }) {
  const st = useStore();
  const e = st.edges.find((x) => x.source === node.id || x.target === node.id);
  return (
    <div className="props">
      <div className="ph">Åpen slangeende</div>
      <p className="mut">Dra enden til en port for å koble den til, eller dra en kobling inn på enden.</p>
      <div className="btnrow">
        <button className="btn" onClick={() => {
          if (!e) return;
          const el = document.querySelector(`.react-flow__node[data-id="${CSS.escape(node.id)}"]`) as HTMLElement | null;
          el?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
        }}>Sett på kobling …</button>
        {e && <button className="btn" onClick={() => st.selectOnly({ edges: [e.id] })}>Velg slangen</button>}
        <button className="btn danger" onClick={() => st.deleteSelected()}>Slett slangen</button>
      </div>
    </div>
  );
}

function HoseProps({ edge, analysis }: { edge: Edge; analysis: Analysis }) {
  const st = useStore();
  const h = edge.data as HoseData;
  const focusTick = useStore((s) => s.focusTick);
  const up = (p: Partial<HoseData>) => st.updateEdgeData(edge.id, p);
  const sn = st.nodes.find((n) => n.id === edge.source), tn = st.nodes.find((n) => n.id === edge.target);
  const sp = findPort(sn, edge.sourceHandle, st.pythons), tp = findPort(tn, edge.targetHandle, st.pythons);
  const eff = analysis.hoseMedium.get(edge.id);
  const warn = analysis.edgeWarn.get(edge.id);
  const fits = analysis.fits.get(edge.id);
  return (
    <div className="props">
      <div className="ph"><span className="sw" style={{ background: (h.color && TUBE_COLOR_HEX[h.color]) || MEDIA.find((m) => m.id === eff)?.color || '#334155' }} /> Slange</div>
      <div className="len-box">
        <label>Lengde (meter)</label>
        <NumInput value={h.length} onChange={(v) => up({ length: v })} placeholder="Skriv inn meter" step={0.5} />
      </div>
      <div className="grid2">
        <label>Navn</label><input value={h.name ?? ''} placeholder="F.eks. Øl 1" onChange={(e) => up({ name: e.target.value })} />
        <label>Dimensjon</label><SizeSelect value={h.size} onChange={(v) => up({ size: v })} />
        <label>Type</label>
        <select value={h.tube} onChange={(e) => up({ tube: e.target.value })}>{TUBE_TYPES.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
        <label>Medium</label>
        <select value={h.medium} onChange={(e) => up({ medium: e.target.value })}>
          <option value="auto">Automatisk{h.medium === 'auto' ? ` (${eff ? mediumName(eff) : 'ukjent'})` : ''}</option>
          {MEDIA.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <label>Slangefarge</label>
        <select value={h.color} onChange={(e) => up({ color: e.target.value })}>{TUBE_COLORS.map((c) => <option key={c} value={c}>{c || '–'}</option>)}</select>
        <label>Deleliste</label>
        <label className="chk"><input type="checkbox" checked={h.counted !== false} onChange={(e) => up({ counted: e.target.checked })} /> Telles med</label>
        <label>Notat</label>
        <input value={h.note ?? ''} onChange={(e) => up({ note: e.target.value })} placeholder="F.eks. går i himling" />
      </div>
      <WarnBox id={edge.id} analysis={analysis} />
      <div className="conn">
        <div><b>Fra:</b> {nodeName(sn, st.pythons)} – <span className="mut">{portLabel(sp)}</span></div>
        <div><b>Til:</b> {nodeName(tn, st.pythons)} – <span className="mut">{portLabel(tp)}</span></div>
      </div>
      {fits && (fits.s.status !== 'none' || fits.t.status !== 'none' || h.fitS || h.fitT) && (
        <div className="grid2">
          <FitSelect label="Kobling fra-ende" fit={fits.s} value={h.fitS} onChange={(v) => up({ fitS: v })} />
          <FitSelect label="Kobling til-ende" fit={fits.t} value={h.fitT} onChange={(v) => up({ fitT: v })} />
        </div>
      )}
      <div className="grid2">
        {sn?.type !== 'hoseEnd' && <><label>Retning fra-ende</label><DirSelect value={h.dirS} onChange={(v) => up({ dirS: v })} /></>}
        {tn?.type !== 'hoseEnd' && <><label>Retning til-ende</label><DirSelect value={h.dirT} onChange={(v) => up({ dirT: v })} /></>}
      </div>
      <div className="btnrow">
        {h.points && <button className="btn" onClick={() => up({ points: undefined })} title="Fjern egne bøyer">Rett ut</button>}
        {sn?.type !== 'hoseEnd' && tn?.type !== 'hoseEnd' && <button className="btn" onClick={() => st.setEdgeType(edge.id, 'direct')} title="Portene kobles direkte (stamme i push-fit eller gjenge i gjenge)">Gjør til direkte kobling</button>}
        <button className="btn danger" onClick={() => st.deleteSelected()}>Slett</button>
      </div>
    </div>
  );
}

function DirectProps({ edge, analysis }: { edge: Edge; analysis: Analysis }) {
  const st = useStore();
  const sn = st.nodes.find((n) => n.id === edge.source), tn = st.nodes.find((n) => n.id === edge.target);
  const sp = findPort(sn, edge.sourceHandle, st.pythons), tp = findPort(tn, edge.targetHandle, st.pythons);
  const warn = analysis.edgeWarn.get(edge.id);
  return (
    <div className="props">
      <div className="ph">Direkte kobling</div>
      <p className="mut">Portene er koblet direkte sammen uten slange.</p>
      <WarnBox id={edge.id} analysis={analysis} />
      <div className="conn">
        <div><b>Fra:</b> {nodeName(sn, st.pythons)} – <span className="mut">{portLabel(sp)}</span></div>
        <div><b>Til:</b> {nodeName(tn, st.pythons)} – <span className="mut">{portLabel(tp)}</span></div>
      </div>
      <div className="btnrow">
        <button className="btn" onClick={() => st.setEdgeType(edge.id, 'hose')}>Gjør til slange</button>
        <button className="btn danger" onClick={() => st.deleteSelected()}>Slett</button>
      </div>
    </div>
  );
}

function PythonProps({ py, analysis }: { py: PythonDef; analysis?: Analysis }) {
  const st = useStore();
  const tubeFl = (i: number) => analysis?.tubeFlavor.get(`${py.id}:p${i + 1}`);
  const focusTick = useStore((s) => s.focusTick);
  const up = (p: Partial<PythonDef>) => st.updatePython(py.id, p);
  const cols = pythonColors(py);
  const setCount = (n: number) => {
    const c = [...cols];
    while (c.length < n) c.push(DEFAULT_PYTHON_ORDER.find((x) => !c.includes(x)) ?? 'Grå');
    up({ products: n, productColors: c.slice(0, n) });
  };
  return (
    <div className="props">
      <div className="ph"><span className="sw" style={{ background: '#111827' }} /> Pytonrør</div>
      <div className="len-box">
        <label>Lengde (meter)</label>
        <NumInput value={py.length} onChange={(v) => up({ length: v })} placeholder="Skriv inn meter" step={0.5} />
      </div>
      <div className="grid2">
        <label>Navn</label><input value={py.name} onChange={(e) => up({ name: e.target.value })} />
        <label>Produktslanger</label>
        <select value={py.products} onChange={(e) => setCount(parseInt(e.target.value))}>
          {[2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
        <label>Dimensjon produkt</label><SizeSelect value={py.productSize} onChange={(v) => up({ productSize: v })} />
        <label>Kjøleloop</label><div className="mut"><SizeSelect value={py.coolSize} onChange={(v) => up({ coolSize: v })} /> 1 hvit + 1 svart</div>
        <label>Kjølemedium</label>
        <select value={py.coolMedium ?? 'vann'} onChange={(e) => up({ coolMedium: e.target.value })}>
          {COOL_MEDIA.map((m) => <option key={m} value={m}>{mediumName(m)}</option>)}
        </select>
        <label>Art.nr</label><input value={py.artnr ?? ''} onChange={(e) => up({ artnr: e.target.value })} placeholder="Valgfritt" />
        <label>Notat</label><input value={py.note ?? ''} onChange={(e) => up({ note: e.target.value })} />
      </div>
      <div className="sub-h">Produktslanger</div>
      <div className="pytubes">
        {cols.map((c, i) => {
          const setAt = (key: 'productNames' | 'productMedia' | 'productColors', v: string) => {
            const arr = [...((py[key] as string[] | undefined) ?? [])];
            while (arr.length < py.products) arr.push(key === 'productMedia' ? 'any' : key === 'productColors' ? cols[arr.length] : '');
            arr[i] = v;
            up({ [key]: arr } as Partial<PythonDef>);
          };
          return (
            <div key={i} className="pytube">
              <span className="n">{i + 1}</span>
              <select className="col" value={c} style={{ borderLeft: `10px solid ${pythonColorHex(c)}` }} onChange={(e) => setAt('productColors', e.target.value)} title="Farge">
                {PYTHON_COLORS.map((pc) => <option key={pc.name} value={pc.name}>{pc.name}</option>)}
              </select>
              <input value={py.productNames?.[i] ?? ''} placeholder={st.pythons && tubeFl(i) ? `${tubeFl(i)} (fra BIB)` : 'Innhold'} onChange={(e) => setAt('productNames', e.target.value)} />
              <select value={py.productMedia?.[i] ?? 'any'} onChange={(e) => setAt('productMedia', e.target.value)} title="Medium">
                {PRODUCT_MEDIA.map((m) => <option key={m} value={m}>{m === 'any' ? 'Medium …' : mediumName(m)}</option>)}
              </select>
            </div>
          );
        })}
      </div>
      <p className="mut small">Produktslangene er stripete (hvit + farge). Slangene stikker ut i begge ender (A og B). Produktslange 1 i ende A er den samme som slange 1 i ende B.</p>
      <div className="btnrow">
        {(st.edges.find((e) => e.type === 'python' && (e.data as any).pythonId === py.id)?.data as any)?.points && (
          <button className="btn" onClick={() => { const e = st.edges.find((x) => x.type === 'python' && (x.data as any).pythonId === py.id); if (e) st.updateEdgeData(e.id, { points: undefined }); }}>Rett ut</button>
        )}
        <button className="btn danger" onClick={() => {
          const ends = st.nodes.filter((n) => n.type === 'pyEnd' && (n.data as any).pythonId === py.id).map((n) => n.id);
          st.onNodesChange(ends.map((id) => ({ type: 'remove', id })));
        }}>Slett pytonrør</button>
      </div>
    </div>
  );
}

function NodeProps({ node, analysis }: { node: Node; analysis: Analysis }) {
  const st = useStore();
  const def = (node.data as any).def as ComponentDef;
  const d = node.data as any;
  const libDef = st.library.find((x) => x.id === def.id);
  const outdated = libDef && JSON.stringify(libDef) !== JSON.stringify(def);
  const connOf = (pid: string) => {
    const e = st.edges.find((x) => (x.source === node.id && x.sourceHandle === pid) || (x.target === node.id && x.targetHandle === pid));
    if (!e) return null;
    const otherId = e.source === node.id ? e.target : e.source;
    return { e, other: st.nodes.find((n) => n.id === otherId) };
  };
  return (
    <div className="props">
      <div className="ph big"><SymbolPreview def={def} size={44} /> <div><div>{def.name}</div><div className="mut small">{[def.artnr, def.maker, def.category].filter(Boolean).join(' · ')}</div></div></div>
      <div className="grid2">
        <label>Etikett</label><input value={d.label ?? ''} placeholder={def.group === 'Utstyr' ? d.flavor || def.name : def.artnr || def.name} onChange={(e) => st.updateNodeData(node.id, { label: e.target.value })} />
        <label>Notat</label><input value={d.note ?? ''} onChange={(e) => st.updateNodeData(node.id, { note: e.target.value })} />
        {canSetMedium(def) && (
          <>
            <label>Medium</label>
            <select value={d.medium ?? 'auto'} onChange={(e) => st.updateNodeData(node.id, { medium: e.target.value === 'auto' ? undefined : e.target.value })} title="Gjelder porter som ikke har fast medium">
              <option value="auto">Som komponenten (alle)</option>
              {MEDIA.filter((m) => m.id !== 'kjol').map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </>
        )}
      </div>
      {def.symbol === 'bib' && <div className="grid1"><FlavorFields node={node} /></div>}
      {def.note && <p className="mut small">{def.note}</p>}
      <div className="btnrow">
        <button className="btn" onClick={() => st.rotateSelected(1)} title="R">⟳ Roter</button>
        <button className="btn" onClick={() => st.flipSelected()} title="F">⇋ Speil</button>
        <button className="btn" onClick={() => st.openEditor(libDef ?? def, false)}>✎ Rediger komponent</button>
        <button className="btn danger" onClick={() => st.deleteSelected()}>Slett</button>
      </div>
      {outdated && (
        <div className="infobox">Komponenten er endret i biblioteket. <button className="link" onClick={() => st.refreshNodesFromLibrary(def.id)}>Oppdater alle i tegningen</button></div>
      )}
      <div className="sub-h">Porter</div>
      <table className="ports">
        <tbody>
          {def.ports.map((p) => {
            const c = connOf(p.id);
            return (
              <tr key={p.id} className={c ? '' : 'free'}>
                <td><span className="sw" style={{ background: MEDIA.find((m) => m.id === p.medium)?.color ?? '#94a3b8' }} /></td>
                <td>{p.name}<div className="mut small">{portLabel({ ...p, name: '' }).replace(/^ · /, '')}</div></td>
                <td className="small">{c ? <>→ {nodeName(c.other, st.pythons)}{c.e.type === 'hose' ? <span className="mut"> (slange)</span> : null}</> : <span className="mut">ledig</span>}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function PyEndProps({ node, analysis }: { node: Node; analysis: Analysis }) {
  const py = useStore((s) => s.pythons.find((p) => p.id === (node.data as any).pythonId));
  const st = useStore();
  if (!py) return null;
  return (
    <>
      <div className="btnrow pad">
        <button className="btn" onClick={() => st.rotateSelected(1)}>⟳ Roter ende</button>
        <button className="btn" onClick={() => st.flipSelected()}>⇋ Speil ende</button>
      </div>
      <PythonProps py={py} analysis={analysis} />
    </>
  );
}

function TextProps({ node }: { node: Node }) {
  const st = useStore();
  const d = node.data as any;
  return (
    <div className="props">
      <div className="ph">Tekst</div>
      <textarea rows={4} value={d.text} onChange={(e) => st.updateNodeData(node.id, { text: e.target.value })} />
      <div className="grid2">
        <label>Størrelse</label>
        <select value={d.size ?? 14} onChange={(e) => st.updateNodeData(node.id, { size: parseInt(e.target.value) })}>
          {[10, 12, 14, 18, 24, 32, 48].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <div className="btnrow"><button className="btn danger" onClick={() => st.deleteSelected()}>Slett</button></div>
    </div>
  );
}

export default function PropertiesPanel({ analysis }: { analysis: Analysis }) {
  const nodes = useStore((s) => s.nodes);
  const edges = useStore((s) => s.edges);
  const pythons = useStore((s) => s.pythons);
  const info = useStore((s) => s.info);
  const st = useStore();
  const selN = nodes.filter((n) => n.selected);
  const selE = edges.filter((e) => e.selected);

  if (selN.length + selE.length > 1) {
    return (
      <div className="props">
        <div className="ph">{selN.length} element og {selE.length} slanger valgt</div>
        <div className="btnrow">
          <button className="btn primary" onClick={() => st.openBpSave(true)} title="Lagre utvalget i biblioteket (Ctrl+B)">Lagre som blueprint …</button>
          <button className="btn" onClick={() => st.rotateSelected(1)}>⟳ Roter</button>
          <button className="btn" onClick={() => st.copySelected()}>Kopier</button>
          <button className="btn danger" onClick={() => st.deleteSelected()}>Slett</button>
        </div>
        {selE.some((e) => e.type === 'hose') && (
          <div className="grid2">
            <label>Dimensjon (alle)</label>
            <SizeSelect value={(selE.find((e) => e.type === 'hose')!.data as HoseData).size} onChange={(v) => { st.snapshot(); useStore.setState({ edges: useStore.getState().edges.map((e) => (e.selected && e.type === 'hose' ? { ...e, data: { ...e.data, size: v } } : e)) }); }} />
          </div>
        )}
      </div>
    );
  }
  if (selE.length === 1) {
    const e = selE[0];
    if (e.type === 'hose') return <HoseProps key={e.id} edge={e} analysis={analysis} />;
    if (e.type === 'direct') return <DirectProps edge={e} analysis={analysis} />;
    if (e.type === 'python') {
      const py = pythons.find((p) => p.id === (e.data as any).pythonId);
      return py ? <PythonProps key={py.id} py={py} analysis={analysis} /> : null;
    }
  }
  if (selN.length === 1) {
    const n = selN[0];
    if (n.type === 'comp') return <NodeProps key={n.id} node={n} analysis={analysis} />;
    if (n.type === 'pyEnd') return <PyEndProps key={n.id} node={n} analysis={analysis} />;
    if (n.type === 'text') return <TextProps key={n.id} node={n} />;
    if (n.type === 'hoseEnd') return <HoseEndProps key={n.id} node={n} />;
    if (n.type === 'shape') return <ShapeProps key={n.id} node={n} />;
  }
  return (
    <div className="props">
      <div className="ph">Prosjekt</div>
      <div className="kv">
        <div><span>Kunde</span>{info.kunde || '–'}</div>
        <div><span>Prosjekt</span>{info.prosjekt || '–'}</div>
        <div><span>Adresse</span>{info.adresse || '–'}</div>
        <div><span>Dato</span>{info.dato || '–'}</div>
      </div>
      <button className="btn" onClick={() => st.setInfoOpen(true)}>Rediger prosjektinfo</button>
      <div className="sub-h">Slik bruker du BarFlow</div>
      <ul className="tips">
        <li>Dra utstyr og koblinger fra biblioteket inn på tegningen.</li>
        <li>Dra fra en port (prikk) til en annen for å legge slange. Riktig overgang legges på automatisk.</li>
        <li>Slipp slangen på et tomt sted for en åpen ende. Hold Shift når du slipper for å velge kobling.</li>
        <li>Dra en kobling inn på en slange for å sette den inn i slangen.</li>
        <li>Høyreklikk på koblingssymbolet i slangeenden for å velge rett, vinkel eller ingen.</li>
        <li>Dra en åpen slangeende mot en annen åpen ende for å skjøte dem.</li>
        <li>Klikk på noe for å se alt som henger sammen med det (lyser i sin egen farge).</li>
        <li>▶ Drift: se hvor det strømmer. Hold musa over kraner, ventiler, BIB, bagveksler og utstyr – klikk bryteren som dukker opp for å endre.</li>
        <li>Dra en kobling mot en ledig port eller åpen slangeende – den snapper på.</li>
        <li>Klikk velger. Høyreklikk på en komponent eller slange åpner boksen for å endre den.</li>
        <li>Velg flere og høyreklikk (eller Ctrl+B) for å lagre dem som blueprint.</li>
        <li>Slangen legger seg selv. Dobbeltklikk på slangen for en bøy der du vil ha den, og dra bøyen. Dobbeltklikk på bøyen fjerner den.</li>
        <li>Velg slangen og dra enden bort fra porten for å flytte den.</li>
        <li><b>R</b> roter · <b>F</b> speil · <b>Del</b> slett · <b>Ctrl+Z</b> angre · <b>Ctrl+C/V</b> kopier/lim inn</li>
        <li>Venstre dra på tomt område: velg flere. Høyre/midtre dra eller mellomrom + dra: flytt visningen.</li>
      </ul>
    </div>
  );
}
