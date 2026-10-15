import React, { useMemo, useState } from 'react';
import { useStore } from '../store';
import type { ComponentDef, PortDef, Side } from '../lib/types';
import { SYMBOLS, SymbolArt } from '../lib/symbols';
import { MEDIA, THREAD_STDS, THREAD_SIZES, PORT_SIZES, KIND_NAMES } from '../lib/constants';
import { portPoint } from '../lib/geometry';
import { uid } from '../lib/ids';
import { isBuiltin } from '../lib/library';
import { inferFlow, FLOW_NAMES, portFlow } from '../lib/portflow';
import { ROLE_NAMES, autoRole, autoNeeds } from '../lib/sim';
import type { SimRole } from '../lib/types';

const SIDES: { id: Side; name: string }[] = [
  { id: 'left', name: 'Venstre' }, { id: 'right', name: 'Høyre' }, { id: 'top', name: 'Topp' }, { id: 'bottom', name: 'Bunn' },
];

function Preview({ def }: { def: ComponentDef }) {
  const pad = 24;
  const scale = Math.min(260 / (def.w + pad * 2), 220 / (def.h + pad * 2), 2.2);
  return (
    <svg width={(def.w + pad * 2) * scale} height={(def.h + pad * 2) * scale} viewBox={`${-pad} ${-pad} ${def.w + pad * 2} ${def.h + pad * 2}`} className="ed-prev">
      <rect x={0} y={0} width={def.w} height={def.h} fill="none" stroke="#cbd5e1" strokeDasharray="3 3" />
      <SymbolArt def={def} />
      {def.ports.map((p, i) => {
        const pt = portPoint(p, def.w, def.h);
        const col = MEDIA.find((m) => m.id === p.medium)?.color ?? '#1f2937';
        return (
          <g key={p.id}>
            <circle cx={pt.x} cy={pt.y} r={4} fill="#fff" stroke={col} strokeWidth={2} />
            <text x={pt.x + (p.side === 'left' ? -7 : p.side === 'right' ? 7 : 0)} y={pt.y + (p.side === 'top' ? -8 : p.side === 'bottom' ? 12 : 3)} fontSize={7} textAnchor={p.side === 'left' ? 'end' : p.side === 'right' ? 'start' : 'middle'} fill="#475569">{i + 1}</text>
          </g>
        );
      })}
    </svg>
  );
}

const EQUIP_CATS = ['Gass', 'Øl', 'Postmix', 'Vann', 'Annet'];

/** Nedtrekksliste med dimensjoner (gjenger har egen liste). «Annen …» for egne verdier */
function SizePick({ value, kind, onChange }: { value: string; kind: PortDef['kind']; onChange: (v: string) => void }) {
  const list = kind === 'thread' ? THREAD_SIZES : PORT_SIZES;
  const opts = value && !list.includes(value) ? [value, ...list] : list;
  return (
    <select className="sizepick" value={value} onChange={(e) => {
      if (e.target.value === '__other') {
        const v = window.prompt('Skriv inn dimensjon (f.eks. 3/8" eller 9,5mm)', value);
        if (v && v.trim()) onChange(v.trim());
      } else onChange(e.target.value);
    }}>
      {(kind === 'other' || !value) && <option value="">–</option>}
      {opts.map((s) => <option key={s} value={s}>{s}</option>)}
      <option value="__other">Annen …</option>
    </select>
  );
}

/** Kategori: velg fra lista eller lag ny */
function CategoryPick({ value, options, onChange }: { value: string; options: string[]; onChange: (v: string) => void }) {
  const opts = value && !options.includes(value) ? [...options, value] : options;
  return (
    <select value={value} onChange={(e) => {
      if (e.target.value === '__new') {
        const v = window.prompt('Navn på ny kategori');
        if (v && v.trim()) onChange(v.trim());
      } else onChange(e.target.value);
    }}>
      {opts.map((c) => <option key={c} value={c}>{c}</option>)}
      <option value="__new">Ny kategori …</option>
    </select>
  );
}

export default function ComponentEditor() {
  const editor = useStore((s) => s.editor);
  const library = useStore((s) => s.library);
  const [def, setDef] = useState<ComponentDef | null>(editor?.def ?? null);
  const [lastEditor, setLastEditor] = useState(editor);
  if (editor !== lastEditor) { setLastEditor(editor); setDef(editor?.def ?? null); }
  const isEq = (def?.group ?? 'Utstyr') === 'Utstyr';
  const categories = useMemo(() => {
    const extra = [...new Set(library.filter((d) => (d.group === 'Utstyr') === isEq).map((d) => d.category))].sort((a, b) => a.localeCompare(b, 'no'));
    return isEq ? [...EQUIP_CATS, ...extra.filter((c) => !EQUIP_CATS.includes(c))] : extra;
  }, [library, isEq]);
  if (!editor || !def) return null;
  const st = useStore.getState();
  const close = () => st.openEditor(null);
  const set = (p: Partial<ComponentDef>) => setDef({ ...def, ...p });
  const setPort = (i: number, p: Partial<PortDef>) => {
    const ports = def.ports.map((q, j) => (j === i ? { ...q, ...p } : q));
    setDef({ ...def, ports });
  };
  const sideLen = (s: Side) => (s === 'left' || s === 'right' ? def.h : def.w);
  const addPort = () => {
    const n = def.ports.length + 1;
    const used = def.ports.filter((p) => p.side === 'right').map((p) => Math.round(p.pos * def.h));
    let at = 20; while (used.includes(at) && at < def.h) at += 20;
    setDef({ ...def, ports: [...def.ports, { id: uid('p'), name: `Port ${n}`, side: 'right', pos: Math.min(1, at / def.h), kind: 'push', size: '3/8"', medium: 'any' }] });
  };
  const builtin = isBuiltin(def.id);
  const save = async (asCopy = false) => {
    const out: ComponentDef = { ...def, name: def.name.trim() || 'Uten navn' };
    if (asCopy || (editor.isNew && !out.id.startsWith('user'))) {
      out.id = uid('user');
      out.source = 'user';
      if (asCopy) out.name = out.name + ' (kopi)';
    }
    await st.saveComponent(out);
    close();
    st.showToast('Lagret i biblioteket');
  };
  const del = async () => {
    if (!confirm(builtin ? 'Skjule denne komponenten fra biblioteket?' : 'Slette denne komponenten fra biblioteket?')) return;
    await st.deleteComponent(def.id);
    close();
  };
  const reset = async () => {
    const ul = useStore.getState().userLib;
    const items = ul.items.filter((i) => i.id !== def.id);
    const nl = { ...ul, items };
    const { effectiveLibrary, saveUserLibrary } = await import('../lib/library');
    useStore.setState({ userLib: nl, library: effectiveLibrary(nl) });
    await saveUserLibrary(nl);
    close();
  };
  const overridden = builtin && st.userLib.items.some((i) => i.id === def.id);

  return (
    <div className="modal-bg" onMouseDown={close}>
      <div className="modal editor" onMouseDown={(e) => e.stopPropagation()}>
        <div className="mh">
          <div className="t">{editor.isNew ? 'Nytt utstyr' : 'Rediger komponent'}</div>
          <button className="x" onClick={close}>×</button>
        </div>
        <div className="mb ed">
          <div className="ed-left">
            <div className="grid2">
              <label>Navn</label><input value={def.name} onChange={(e) => set({ name: e.target.value })} autoFocus />
              <label>Art.nr</label><input value={def.artnr ?? ''} onChange={(e) => set({ artnr: e.target.value })} />
              <label>Produsent</label><input value={def.maker ?? ''} onChange={(e) => set({ maker: e.target.value })} />
              <label>Type</label>
              <select value={def.group} onChange={(e) => set({ group: e.target.value })}>
                <option value="Utstyr">Utstyr (vises med navn)</option>
                <option value="Koblinger">Kobling (vises med art.nr)</option>
                {def.group !== 'Utstyr' && def.group !== 'Koblinger' && <option value={def.group}>{def.group}</option>}
              </select>
              <label>Kategori</label>
              <CategoryPick value={def.category} options={categories} onChange={(v) => set({ category: v })} />
              <label>Symbol</label>
              <select value={def.symbol} onChange={(e) => set({ symbol: e.target.value })}>
                {SYMBOLS.map((s) => <option key={s.key} value={s.key}>{s.group}: {s.name}</option>)}
              </select>
              <label>Størrelse</label>
              <div className="inline">
                <input type="number" step={20} min={20} value={def.w} onChange={(e) => set({ w: Math.max(20, Math.round((parseInt(e.target.value) || 20) / 10) * 10) })} /> ×
                <input type="number" step={20} min={20} value={def.h} onChange={(e) => set({ h: Math.max(20, Math.round((parseInt(e.target.value) || 20) / 10) * 10) })} /> px
              </div>
              <label>Notat</label><input value={def.note ?? ''} onChange={(e) => set({ note: e.target.value })} />
            </div>
          </div>
          <div className="ed-right"><Preview def={def} /></div>
        </div>
        <div className="mb">
          <div className="sub-h">Porter (tilkoblinger)</div>
          <table className="ed-ports">
            <thead>
              <tr><th>#</th><th>Navn</th><th>Side</th><th>Posisjon</th><th>Type</th><th>Dimensjon</th><th>Gjenge</th><th>Medium</th><th title="Hvilken vei det strømmer (brukes i drift-modus)">Retning</th><th>Intern link</th><th /></tr>
            </thead>
            <tbody>
              {def.ports.map((p, i) => (
                <tr key={p.id}>
                  <td>{i + 1}</td>
                  <td><input value={p.name} onChange={(e) => setPort(i, { name: e.target.value })} /></td>
                  <td>
                    <select value={p.side} onChange={(e) => setPort(i, { side: e.target.value as Side })}>
                      {SIDES.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </td>
                  <td>
                    <input className="sm" type="number" step={10} min={0} max={sideLen(p.side)} value={Math.round(p.pos * sideLen(p.side))}
                      onChange={(e) => setPort(i, { pos: Math.max(0, Math.min(1, (parseInt(e.target.value) || 0) / sideLen(p.side))) })} />
                  </td>
                  <td>
                    <select value={p.kind} onChange={(e) => setPort(i, { kind: e.target.value as any })}>
                      {Object.entries(KIND_NAMES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </td>
                  <td>
                    <SizePick value={p.size} kind={p.kind} onChange={(v) => setPort(i, { size: v })} />
                  </td>
                  <td>
                    {p.kind === 'thread' ? (
                      <div className="inline">
                        <select value={p.std ?? ''} onChange={(e) => setPort(i, { std: e.target.value })}>
                          <option value="">–</option>
                          {THREAD_STDS.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <select value={p.gender ?? 'M'} onChange={(e) => setPort(i, { gender: e.target.value as any })}>
                          <option value="M">Hann</option><option value="F">Hunn</option>
                        </select>
                      </div>
                    ) : <span className="mut">–</span>}
                  </td>
                  <td>
                    <select value={p.medium ?? 'any'} onChange={(e) => setPort(i, { medium: e.target.value })}>
                      <option value="any">Alle</option>
                      {MEDIA.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                  </td>
                  <td>
                    <select value={p.flow ?? ''} onChange={(e) => setPort(i, { flow: (e.target.value || undefined) as any })} title="Inn = det strømmer inn i utstyret, Ut = ut av utstyret">
                      <option value="">Auto ({FLOW_NAMES[def.group === 'Utstyr' ? inferFlow(p.name) : 'both']})</option>
                      <option value="in">Inn</option>
                      <option value="out">Ut</option>
                      <option value="both">Begge veier</option>
                    </select>
                  </td>
                  <td><input className="sm" value={p.link ?? ''} placeholder="–" title="Porter med lik link henger sammen inni utstyret (f.eks. inn 1 og ut 1 i en kjøler)" onChange={(e) => setPort(i, { link: e.target.value || undefined })} /></td>
                  <td><button className="ic" title="Fjern port" onClick={() => setDef({ ...def, ports: def.ports.filter((_, j) => j !== i) })}>×</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <button className="btn small" onClick={addPort}>+ Legg til port</button>
          {def.group === 'Utstyr' && (() => {
            const role = (def.sim?.role ?? 'auto') as SimRole;
            const auto = !def.sim?.needs;
            const autoList = autoNeeds({ ...def, sim: { ...def.sim, needs: undefined } }).map((p) => p.id);
            const needs = def.sim?.needs ?? autoList;
            const ins = def.ports.filter((p) => portFlow(p, def) !== 'out');
            const setSim = (patch: Partial<NonNullable<ComponentDef['sim']>>) => set({ sim: { ...def.sim, ...patch } });
            return (
              <div className="ed-sim">
                <div className="sub-h">Drift (simulering)</div>
                <div className="grid2">
                  <label>Rolle</label>
                  <select value={role} onChange={(e) => setSim({ role: e.target.value as SimRole })}>
                    {(Object.keys(ROLE_NAMES) as SimRole[]).map((r) => (
                      <option key={r} value={r}>{r === 'auto' ? `Automatisk (${ROLE_NAMES[autoRole(def)].split(' (')[0]})` : ROLE_NAMES[r]}</option>
                    ))}
                  </select>
                  <label>Må ha for å gå</label>
                  <div className="needs">
                    <label className="chk"><input type="checkbox" checked={auto} onChange={(e) => setSim({ needs: e.target.checked ? undefined : autoList })} /> Automatisk</label>
                    {ins.length === 0 && <span className="mut small">Ingen innganger</span>}
                    {ins.map((p) => (
                      <label key={p.id} className={`chk ${auto ? 'mut' : ''}`}>
                        <input type="checkbox" disabled={auto} checked={needs.includes(p.id)}
                          onChange={(e) => setSim({ needs: e.target.checked ? [...needs, p.id] : needs.filter((x) => x !== p.id) })} />
                        {p.name}
                      </label>
                    ))}
                  </div>
                </div>
                <p className="mut small">Utstyret står i drift-modus til det har noe på alle avkryssede innganger (gass, vann og luft må ha trykk, sirup gjennom pumpe trenger bare å stå der).</p>
              </div>
            );
          })()}
        </div>
        <div className="mf">
          {!editor.isNew && <button className="btn danger" onClick={del}>{builtin ? 'Skjul' : 'Slett'}</button>}
          {overridden && <button className="btn" onClick={reset}>Tilbakestill til original</button>}
          <div className="sp" />
          {!editor.isNew && <button className="btn" onClick={() => save(true)}>Lagre som kopi</button>}
          <button className="btn" onClick={close}>Avbryt</button>
          <button className="btn primary" onClick={() => save(false)}>Lagre</button>
        </div>
      </div>
    </div>
  );
}
