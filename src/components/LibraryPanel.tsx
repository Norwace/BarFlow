import React, { useMemo, useState, memo } from 'react';
import { useReactFlow } from '@xyflow/react';
import { useStore } from '../store';
import { SymbolPreview } from '../lib/symbols';
import type { Blueprint, ComponentDef } from '../lib/types';
import { isBuiltin } from '../lib/library';
import { uid } from '../lib/ids';
import { exportLibrary, importLibrary } from '../actions';
import { isStandard, STANDARD_GROUPS } from '../lib/autofit';

/** Hva som dras i biblioteket akkurat nå (for å endre rekkefølge) */
type LibDrag = { kind: 'item'; id: string; group: string } | { kind: 'cat'; section: string; cat: string } | null;
let libDrag: LibDrag = null;

/** Sorter etter lagret rekkefølge; resten etter standard sortering */
function ordered<T>(list: T[], keyOf: (t: T) => string, order: string[] | undefined, fallback: (a: T, b: T) => number): T[] {
  const pos = new Map((order ?? []).map((k, i) => [k, i]));
  const known = list.filter((t) => pos.has(keyOf(t))).sort((a, b) => pos.get(keyOf(a))! - pos.get(keyOf(b))!);
  const rest = list.filter((t) => !pos.has(keyOf(t))).sort(fallback);
  // nye elementer som ikke er sortert ennå havner på sin vanlige plass: alfabetisk blant de andre
  if (!known.length) return rest;
  const out = [...known];
  for (const r of rest) {
    const i = out.findIndex((k) => fallback(r, k) < 0);
    if (i < 0) out.push(r); else out.splice(i, 0, r);
  }
  return out;
}

function moveInList(keys: string[], drag: string, target: string, before: boolean): string[] {
  const out = keys.filter((k) => k !== drag);
  const i = out.indexOf(target);
  if (i < 0) return keys;
  out.splice(before ? i : i + 1, 0, drag);
  return out;
}

const Item = memo(function Item({ def, fav, onAdd, group, onReorder, allowForeign }: { def: ComponentDef; fav: boolean; onAdd: (d: ComponentDef) => void; group: string; onReorder?: (drag: string, target: string, before: boolean, fromGroup: string) => void; allowForeign?: boolean }) {
  const openEditor = useStore((s) => s.openEditor);
  const toggleFavorite = useStore((s) => s.toggleFavorite);
  const [mark, setMark] = useState<'before' | 'after' | null>(null);
  const over = (e: React.DragEvent) => {
    if (!onReorder || libDrag?.kind !== 'item' || libDrag.id === def.id || (libDrag.group !== group && !allowForeign)) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setMark(e.clientY < r.top + r.height / 2 ? 'before' : 'after');
  };
  return (
    <div
      className={`lib-item ${mark ? 'mark-' + mark : ''}`}
      draggable
      onDragStart={(e) => { libDrag = { kind: 'item', id: def.id, group }; e.dataTransfer.setData('application/barflow', def.id); e.dataTransfer.setData('application/barflow-lib', def.id); e.dataTransfer.effectAllowed = 'copyMove'; }}
      onDragEnd={() => { libDrag = null; }}
      onDragOver={over}
      onDragLeave={() => setMark(null)}
      onDrop={(e) => {
        const m = mark;
        setMark(null);
        if (!onReorder || libDrag?.kind !== 'item' || !m) return;
        e.preventDefault();
        e.stopPropagation();
        onReorder(libDrag.id, def.id, m === 'before', libDrag.group);
        libDrag = null;
      }}
      onDoubleClick={() => onAdd(def)}
      title={`${def.name}${def.artnr ? '\nArt.nr: ' + def.artnr : ''}${def.note ? '\n' + def.note : ''}\n\nDra inn på tegningen, eller dobbeltklikk. Dra opp/ned i lista for å endre rekkefølgen.`}
    >
      <SymbolPreview def={def} size={30} />
      <div className="nm">
        <div className="n">{def.name}</div>
        {def.artnr && <div className="a">{def.artnr}</div>}
      </div>
      <div className="acts">
        <button className={`ic ${fav ? 'on' : ''}`} title={fav ? 'Fjern fra favoritter' : 'Legg til i favoritter'} onClick={(e) => { e.stopPropagation(); toggleFavorite(def.id); }}>★</button>
        <button className="ic" title="Rediger" onClick={(e) => { e.stopPropagation(); openEditor(def, false); }}>✎</button>
      </div>
    </div>
  );
});

/** Flytt en komponent til en annen kategori (dra den i biblioteket) */
async function moveToCategory(id: string, cat: string, equip: boolean): Promise<boolean> {
  const st = useStore.getState();
  const def = st.library.find((d) => d.id === id);
  if (!def || def.category === cat) return false;
  if ((def.group === 'Utstyr') !== equip) { st.showToast(equip ? 'Bare utstyr kan legges i denne kategorien' : 'Bare koblinger kan legges her'); return false; }
  await st.saveComponent({ ...def, category: cat });
  st.showToast(`${def.name} er flyttet til ${cat}`);
  return true;
}

interface GroupProps {
  title: string;
  items: ComponentDef[];
  favs: Set<string>;
  onAdd: (d: ComponentDef) => void;
  defaultOpen?: boolean;
  forceOpen?: boolean;
  /** kategori som utstyr kan dras inn i */
  dropCat?: { cat: string; equip: boolean };
  /** nøkkel for lagret rekkefølge på elementene */
  groupKey: string;
  /** seksjon og navn, så kategorien kan dras til ny plass */
  catKey?: { section: string; cat: string };
  onCatReorder?: (section: string, drag: string, target: string, before: boolean) => void;
  children?: React.ReactNode;
  /** blueprint-kategori: blueprints fra andre kategorier kan slippes her */
  bpCat?: string;
}

function Group({ title, items, favs, onAdd, defaultOpen = false, forceOpen = false, dropCat, groupKey, catKey, onCatReorder, children, bpCat }: GroupProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [over, setOver] = useState(false);
  const [mark, setMark] = useState<'before' | 'after' | null>(null);
  const isOpen = forceOpen || open;
  const setLibOrder = useStore((s) => s.setLibOrder);
  const reorder = async (drag: string, target: string, before: boolean, fromGroup: string) => {
    if (fromGroup !== groupKey) {
      // fra en annen kategori: flytt den hit først
      if (!dropCat) return;
      if (!(await moveToCategory(drag, dropCat.cat, dropCat.equip))) return;
    }
    const keys = items.map((d) => d.id);
    if (!keys.includes(drag)) keys.push(drag);
    setLibOrder(`items:${groupKey}`, moveInList(keys, drag, target, before));
  };
  const dnd = {
    onDragOver: (e: React.DragEvent) => {
      if (libDrag?.kind === 'cat' && catKey && libDrag.section === catKey.section && libDrag.cat !== catKey.cat) {
        e.preventDefault();
        const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
        setMark(e.clientY < r.top + Math.min(r.height, 30) / 2 ? 'before' : 'after');
        return;
      }
      if (dropCat && libDrag?.kind === 'item' && libDrag.group !== groupKey && !libDrag.group.startsWith('bp:')) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setOver(true); }
      if (bpCat && libDrag?.kind === 'item' && libDrag.group.startsWith('bp:') && libDrag.group !== groupKey) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setOver(true); }
    },
    onDragLeave: () => { setOver(false); setMark(null); },
    onDrop: (e: React.DragEvent) => {
      setOver(false);
      const m = mark;
      setMark(null);
      if (libDrag?.kind === 'cat' && catKey && onCatReorder && m) {
        e.preventDefault();
        onCatReorder(catKey.section, libDrag.cat, catKey.cat, m === 'before');
        libDrag = null;
        return;
      }
      if (dropCat && libDrag?.kind === 'item' && libDrag.group !== groupKey && !libDrag.group.startsWith('bp:')) {
        e.preventDefault();
        moveToCategory(libDrag.id, dropCat.cat, dropCat.equip);
        libDrag = null;
      }
      if (bpCat && libDrag?.kind === 'item' && libDrag.group.startsWith('bp:') && libDrag.group !== groupKey) {
        e.preventDefault();
        useStore.getState().updateBlueprint(libDrag.id, { category: bpCat });
        libDrag = null;
      }
    },
  };
  return (
    <div className={`lib-group ${over ? 'dropover' : ''} ${mark ? 'mark-' + mark : ''}`} {...dnd}>
      <button className="lib-gh" onClick={() => setOpen(!open)} draggable={!!catKey}
        onDragStart={(e) => { if (!catKey) return; libDrag = { kind: 'cat', ...catKey }; e.dataTransfer.setData('application/barflow-cat', catKey.cat); e.dataTransfer.effectAllowed = 'move'; }}
        onDragEnd={() => { libDrag = null; }}
        title={catKey ? 'Klikk for å åpne/lukke. Dra for å flytte kategorien.' : undefined}>
        <span className="car">{isOpen ? '▾' : '▸'}</span> {title} <span className="cnt">{items.length}</span>
      </button>
      {isOpen && (children ?? <div className="lib-gb">{items.map((d) => <Item key={d.id} def={d} fav={favs.has(d.id)} onAdd={onAdd} group={groupKey} onReorder={reorder} allowForeign={!!dropCat} />)}</div>)}
    </div>
  );
}

/** Liten skisse av en blueprint */
function BpIcon({ bp, size = 30 }: { bp: Blueprint; size?: number }) {
  const sz = (n: any) => {
    if (n.type === 'comp') { const d = n.data.def; const r = (n.data.rotation ?? 0) % 180; return r ? { w: d.h, h: d.w } : { w: d.w, h: d.h }; }
    if (n.type === 'shape') return { w: n.width ?? 60, h: n.height ?? 4 };
    if (n.type === 'pyEnd') return { w: 50, h: 100 };
    return { w: 20, h: 20 };
  };
  const pos = new Map(bp.nodes.map((n) => [n.id, { x: n.position.x + sz(n).w / 2, y: n.position.y + sz(n).h / 2 }]));
  const W = Math.max(bp.w, 40), H = Math.max(bp.h, 40);
  return (
    <svg width={size} height={size} viewBox={`-10 -10 ${W + 20} ${H + 20}`} preserveAspectRatio="xMidYMid meet" className="bpicon">
      <rect x={-10} y={-10} width={W + 20} height={H + 20} fill="#eff6ff" rx={12} />
      {bp.edges.map((e, i) => { const a = pos.get(e.source), b = pos.get(e.target); return a && b ? <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={e.type === 'python' ? '#111827' : '#2563eb'} strokeWidth={Math.max(W, H) / 40} /> : null; })}
      {bp.nodes.filter((n) => n.type === 'comp' || n.type === 'pyEnd').map((n) => <rect key={n.id} x={n.position.x} y={n.position.y} width={sz(n).w} height={sz(n).h} fill={n.type === 'pyEnd' ? '#111827' : '#fff'} stroke="#1e3a8a" strokeWidth={Math.max(W, H) / 60} />)}
    </svg>
  );
}

function BpItem({ bp, onReorder }: { bp: Blueprint; onReorder: (drag: string, target: string, before: boolean, fromGroup: string) => void }) {
  const rf = useReactFlow();
  const [mark, setMark] = useState<'before' | 'after' | null>(null);
  const group = `bp:${bp.category}`;
  const comps = bp.nodes.filter((n) => n.type === 'comp').length;
  const hoses = bp.edges.filter((e) => e.type === 'hose').length;
  const insert = () => {
    const r = (document.querySelector('.bf-canvas') as HTMLElement).getBoundingClientRect();
    useStore.getState().insertBlueprint(bp.id, rf.screenToFlowPosition({ x: r.left + r.width / 2, y: r.top + r.height / 2 }));
  };
  const rename = (e: React.MouseEvent) => {
    e.stopPropagation();
    const nm = window.prompt('Nytt navn på blueprint', bp.name);
    if (nm && nm.trim()) useStore.getState().updateBlueprint(bp.id, { name: nm.trim() });
  };
  const del = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm(`Slette blueprint «${bp.name}»?`)) useStore.getState().deleteBlueprint(bp.id);
  };
  return (
    <div className={`lib-item ${mark ? 'mark-' + mark : ''}`} draggable
      onDragStart={(e) => { libDrag = { kind: 'item', id: bp.id, group }; e.dataTransfer.setData('application/barflow', '__bp__:' + bp.id); e.dataTransfer.setData('application/barflow-bp', bp.id); e.dataTransfer.effectAllowed = 'copyMove'; }}
      onDragEnd={() => { libDrag = null; }}
      onDragOver={(e) => {
        if (libDrag?.kind !== 'item' || !libDrag.group.startsWith('bp:') || libDrag.id === bp.id) return;
        e.preventDefault(); e.stopPropagation();
        const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
        setMark(e.clientY < r.top + r.height / 2 ? 'before' : 'after');
      }}
      onDragLeave={() => setMark(null)}
      onDrop={(e) => {
        const m = mark; setMark(null);
        if (libDrag?.kind !== 'item' || !libDrag.group.startsWith('bp:') || !m) return;
        e.preventDefault(); e.stopPropagation();
        onReorder(libDrag.id, bp.id, m === 'before', libDrag.group);
        libDrag = null;
      }}
      onDoubleClick={insert}
      title={`${bp.name}\n${comps} komponenter, ${hoses} slanger\n\nDra inn på tegningen, eller dobbeltklikk`}>
      <BpIcon bp={bp} />
      <div className="nm">
        <div className="n">{bp.name}</div>
        <div className="a">{comps} komp. · {hoses} slanger{bp.pythons.length ? ` · ${bp.pythons.length} pyton` : ''}</div>
      </div>
      <div className="acts">
        <button className="ic" title="Endre navn" onClick={rename}>✎</button>
        <button className="ic" title="Slett" onClick={del}>×</button>
      </div>
    </div>
  );
}

function BpGroup({ cat, items, onCatReorder, forceOpen }: { cat: string; items: Blueprint[]; onCatReorder: (drag: string, target: string, before: boolean) => void; forceOpen: boolean }) {
  const setLibOrder = useStore((s) => s.setLibOrder);
  const key = `bp:${cat}`;
  const reorder = async (drag: string, target: string, before: boolean, fromGroup: string) => {
    if (fromGroup !== key) await useStore.getState().updateBlueprint(drag, { category: cat });
    const keys = items.map((b) => b.id);
    if (!keys.includes(drag)) keys.push(drag);
    setLibOrder(`items:${key}`, moveInList(keys, drag, target, before));
  };
  // Group trenger komponentliste for antall – lag en enkel stand-in
  const fake = items.map((b) => ({ id: b.id, name: b.name } as unknown as ComponentDef));
  return (
    <Group title={cat} items={fake} favs={new Set()} onAdd={() => {}} defaultOpen forceOpen={forceOpen} groupKey={key}
      catKey={{ section: 'bp', cat }} onCatReorder={(_s, d, t, b) => onCatReorder(d, t, b)} bpCat={cat}>
      <div className="lib-gb">{items.map((b) => <BpItem key={b.id} bp={b} onReorder={reorder} />)}</div>
    </Group>
  );
}

const SERIES_ORDER = ['Acetal grå (tommer)', 'Acetal hvit (tommer)', 'Polypropylen hvit (tommer)', 'Acetal svart (metrisk)', 'Stopp- og kranadaptere', 'Kontrollventiler', 'Håndventiler', 'Tilbakeslagsventiler', 'Stoppventiler', 'Silfilter', 'Messing', 'Power-koblinger', 'Clean-koblinger'];
const EQUIP_ORDER = ['Gass', 'Øl', 'Postmix', 'Vann', 'Annet'];
const byName = (a: ComponentDef, b: ComponentDef) => a.name.localeCompare(b.name, 'no', { numeric: true });
const keepOrder = () => 0;

export default function LibraryPanel() {
  const library = useStore((s) => s.library);
  const favorites = useStore((s) => s.userLib.favorites);
  const openEditor = useStore((s) => s.openEditor);
  const [q, setQ] = useState('');
  const [sizeFilter, setSizeFilter] = useState('');
  const rf = useReactFlow();
  const favs = useMemo(() => new Set(favorites), [favorites]);

  const onAdd = (def: ComponentDef) => {
    const st = useStore.getState();
    const el = document.querySelector('.bf-canvas') as HTMLElement;
    const r = el.getBoundingClientRect();
    const c = rf.screenToFlowPosition({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
    const id = st.addComponent(def, { x: c.x - def.w / 2 + (Math.random() * 40 - 20), y: c.y - def.h / 2 + (Math.random() * 40 - 20) });
    st.selectOnly({ nodes: [id] });
  };

  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const filtered = useMemo(() => {
    const sz = sizeFilter.replace(/"/g, '');
    return library.filter((d) => {
      if (sz && !d.ports.some((p) => p.size.replace(/"/g, '') === sz)) return false;
      if (!words.length) return true;
      const hay = `${d.name} ${d.artnr ?? ''} ${d.category} ${d.tags ?? ''} ${d.maker ?? ''}`.toLowerCase();
      return words.every((w) => hay.includes(w));
    });
  }, [library, q, sizeFilter]);

  const searching = words.length > 0 || !!sizeFilter;

  const equip = filtered.filter((d) => d.group === 'Utstyr');
  const fittings = filtered.filter((d) => d.group !== 'Utstyr');
  const user = filtered.filter((d) => d.source === 'user' && d.group !== 'Utstyr');
  const favItems = filtered.filter((d) => favs.has(d.id));
  const std = filtered.filter((d) => isStandard(d));
  const stdGroups = STANDARD_GROUPS.map((g) => [g.title, std.filter((d) => isStandard(d) === g.title)] as [string, ComponentDef[]]).filter(([, its]) => its.length);

  const order = useStore((s) => s.userLib.order) ?? {};
  const setLibOrder = useStore((s) => s.setLibOrder);
  const byCat = (items: ComponentDef[], section: string, def: string[]) => {
    const m = new Map<string, ComponentDef[]>();
    for (const d of items) {
      if (!m.has(d.category)) m.set(d.category, []);
      m.get(d.category)!.push(d);
    }
    const base = (a: [string, ComponentDef[]], b: [string, ComponentDef[]]) => {
      const ia = def.indexOf(a[0]), ib = def.indexOf(b[0]);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a[0].localeCompare(b[0], 'no');
    };
    return ordered([...m.entries()], (e) => e[0], order[`cat:${section}`], base);
  };
  const sortItems = (key: string, items: ComponentDef[], fallback: (a: ComponentDef, b: ComponentDef) => number) => ordered(items, (d) => d.id, order[`items:${key}`], fallback);
  const onCatReorder = (section: string, drag: string, target: string, before: boolean, all: string[]) => setLibOrder(`cat:${section}`, moveInList(all, drag, target, before));

  // DMfit: gruppér på serie og deretter familie (kode)
  const fitGroups = byCat(fittings.filter((d) => d.source !== 'user' && !d.generic), 'dmfit', SERIES_ORDER);
  const generics = fittings.filter((d) => d.generic);
  const equipGroups = byCat(equip, 'equip', EQUIP_ORDER);
  const userGroups = byCat(user, 'user', []);
  const stdOrdered = ordered(stdGroups, (g) => g[0], order['cat:std'], keepOrder);
  const blueprints = useStore((s) => s.userLib.blueprints) ?? [];
  const bpGroups = useMemo(() => {
    const m = new Map<string, Blueprint[]>();
    for (const b of blueprints) {
      if (words.length && !words.every((w) => `${b.name} ${b.category}`.toLowerCase().includes(w))) continue;
      if (!m.has(b.category)) m.set(b.category, []);
      m.get(b.category)!.push(b);
    }
    return ordered([...m.entries()], (e) => e[0], order['cat:bp'], (a, b) => a[0].localeCompare(b[0], 'no'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blueprints, q, order]);

  const newComponent = () => {
    const def: ComponentDef = {
      id: uid('user'), name: 'Nytt utstyr', group: 'Utstyr', category: 'Annet', symbol: 'box', w: 80, h: 40, source: 'user',
      ports: [
        { id: 'p1', name: 'Inn', side: 'left', pos: 0.5, kind: 'push', size: '3/8"', medium: 'any' },
        { id: 'p2', name: 'Ut', side: 'right', pos: 0.5, kind: 'push', size: '3/8"', medium: 'any' },
      ],
    };
    openEditor(def, true);
  };

  return (
    <div className="lib">
      <div className="lib-top">
        <input className="search" placeholder="Søk i biblioteket …" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="row">
          <select value={sizeFilter} onChange={(e) => setSizeFilter(e.target.value)} title="Filtrer på dimensjon">
            <option value="">Alle dimensjoner</option>
            {['5/32"', '3/16"', '1/4"', '5/16"', '3/8"', '1/2"', '5/8"', '3/4"', '4mm', '6mm', '8mm', '10mm', '12mm', '15mm', '22mm'].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <button className="btn small" onClick={newComponent}>+ Nytt utstyr</button>
          <details className="libmenu">
            <summary className="btn small" title="Ta vare på eller hent eget bibliotek">⋯</summary>
            <div className="libmenu-pop">
              <button onClick={(e) => { (e.currentTarget.closest('details') as HTMLDetailsElement).open = false; exportLibrary(); }}>Eksporter bibliotek …</button>
              <button onClick={(e) => { (e.currentTarget.closest('details') as HTMLDetailsElement).open = false; importLibrary(); }}>Importer bibliotek …</button>
              <button onClick={(e) => { (e.currentTarget.closest('details') as HTMLDetailsElement).open = false; if (confirm('Sette rekkefølgen i biblioteket tilbake til standard (alfabetisk)?')) useStore.getState().resetLibOrder(); }}>Tilbakestill rekkefølge</button>
            </div>
          </details>
        </div>
      </div>
      <div className="lib-body">
        {!searching && (
          <div className="lib-special">
            <div className="lib-item special" draggable onDragStart={(e) => e.dataTransfer.setData('application/barflow', '__python__')} onDoubleClick={() => { const r = (document.querySelector('.bf-canvas') as HTMLElement).getBoundingClientRect(); const c = rf.screenToFlowPosition({ x: r.left + r.width / 2, y: r.top + r.height / 2 }); useStore.getState().addPython(c); }} title="Dra inn et pytonrør">
              <svg width={30} height={30} viewBox="0 0 30 30"><path d="M3 22 Q15 4 27 22" stroke="#111827" strokeWidth={7} fill="none" strokeLinecap="round" /></svg>
              <div className="nm"><div className="n">Pytonrør</div><div className="a">2–10 produkt + 2 kjøl</div></div>
            </div>
            <div className="lib-item special" draggable onDragStart={(e) => e.dataTransfer.setData('application/barflow', '__hose__')} onDoubleClick={() => { const r = (document.querySelector('.bf-canvas') as HTMLElement).getBoundingClientRect(); const c = rf.screenToFlowPosition({ x: r.left + r.width / 2, y: r.top + r.height / 2 }); const st = useStore.getState(); st.selectOnly({ edges: [st.addFreeHose(c)] }); }} title="Dra inn en løs slange med to åpne ender">
              <svg width={30} height={30} viewBox="0 0 30 30"><path d="M4 22 L4 12 Q4 8 8 8 L26 8" stroke="#2563eb" strokeWidth={3} fill="none" /><circle cx={4} cy={23} r={3} fill="#fff" stroke="#334155" strokeWidth={1.5} /><circle cx={26} cy={8} r={3} fill="#fff" stroke="#334155" strokeWidth={1.5} /></svg>
              <div className="nm"><div className="n">Slange</div><div className="a">Løs, med åpne ender</div></div>
            </div>
            <div className="lib-item special" draggable onDragStart={(e) => e.dataTransfer.setData('application/barflow', '__text__')} title="Dra inn en tekstboks">
              <svg width={30} height={30} viewBox="0 0 30 30"><text x={15} y={21} fontSize={18} fontWeight={700} textAnchor="middle" fill="#334155">T</text></svg>
              <div className="nm"><div className="n">Tekst</div><div className="a">Merknad på tegningen</div></div>
            </div>
          </div>
        )}
        <div className="lib-sec">Utstyr</div>
        {equipGroups.map(([cat, items]) => (
          <Group key={'e' + cat} groupKey={`equip:${cat}`} title={cat} items={sortItems(`equip:${cat}`, items, byName)} favs={favs} onAdd={onAdd} defaultOpen={false} forceOpen={searching && filtered.length < 120} dropCat={{ cat, equip: true }}
            catKey={{ section: 'equip', cat }} onCatReorder={(sec, d, t, b) => onCatReorder(sec, d, t, b, equipGroups.map((g) => g[0]))} />
        ))}
        {!searching && <div className="mut small lib-hint">Dra komponenter og kategorier opp eller ned for å endre rekkefølgen. Dra utstyr til en annen kategori for å flytte det.</div>}
        {bpGroups.length > 0 && <div className="lib-sec">Blueprints</div>}
        {bpGroups.map(([cat, items]) => (
          <BpGroup key={'bp' + cat} cat={cat} items={ordered(items, (b) => b.id, order[`items:bp:${cat}`], (a, b) => a.name.localeCompare(b.name, 'no', { numeric: true }))} forceOpen={searching}
            onCatReorder={(d, t, b) => onCatReorder('bp', d, t, b, bpGroups.map((g) => g[0]))} />
        ))}
        {favItems.length > 0 && <Group title="★ Favoritter" groupKey="fav" items={sortItems('fav', favItems, byName)} favs={favs} onAdd={onAdd} defaultOpen forceOpen={searching} />}
        {userGroups.map(([cat, items]) => (
          <Group key={'u' + cat} groupKey={`user:${cat}`} title={`Egne koblinger: ${cat}`} items={sortItems(`user:${cat}`, items, byName)} favs={favs} onAdd={onAdd} defaultOpen forceOpen={searching} dropCat={{ cat, equip: false }}
            catKey={{ section: 'user', cat }} onCatReorder={(sec, d, t, b) => onCatReorder(sec, d, t, b, userGroups.map((g) => g[0]))} />
        ))}
        {(stdOrdered.length > 0 || generics.length > 0) && <div className="lib-sec">Standardkoblinger (grå acetal)</div>}
        {generics.length > 0 && <Group title="Form – størrelse settes automatisk" groupKey="generic" items={sortItems('generic', generics, keepOrder)} favs={favs} onAdd={onAdd} defaultOpen={!searching} forceOpen={searching} />}
        {stdOrdered.map(([t, items]) => (
          <Group key={'s' + t} groupKey={`std:${t}`} title={t} items={sortItems(`std:${t}`, items, keepOrder)} favs={favs} onAdd={onAdd} defaultOpen={!searching} forceOpen={searching && filtered.length < 120}
            catKey={{ section: 'std', cat: t }} onCatReorder={(sec, d, tt, b) => onCatReorder(sec, d, tt, b, stdOrdered.map((g) => g[0]))} />
        ))}
        <div className="lib-sec">Hele DMfit-katalogen</div>
        {fitGroups.map(([cat, items]) => (
          <SeriesGroup key={'f' + cat} title={cat} items={items} favs={favs} onAdd={onAdd} forceOpen={searching && filtered.length < 120}
            onCatReorder={(d, t, b) => onCatReorder('dmfit', d, t, b, fitGroups.map((g) => g[0]))} order={order} />
        ))}
        {filtered.length === 0 && <div className="none">Ingen treff</div>}
      </div>
    </div>
  );
}

function SeriesGroup({ title, items, favs, onAdd, forceOpen, onCatReorder, order }: { title: string; items: ComponentDef[]; favs: Set<string>; onAdd: (d: ComponentDef) => void; forceOpen: boolean; onCatReorder: (drag: string, target: string, before: boolean) => void; order: Record<string, string[]> }) {
  const fams = useMemo(() => {
    const m = new Map<string, ComponentDef[]>();
    for (const d of items) {
      const k = (d.note ?? '').split(' – ')[0] || 'Andre';
      const nm = d.name.replace(/\s[\d/.]+(?:"|mm).*$/, '').replace(/\s(BSP|BSPT|NPTF|UNF|UNS|UN|MFL|BSW|NH|NPSH|NPSM|UNEF|Kompresjon|NPS)\s.*$/, '');
      const key = `${nm} (${k})`;
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(d);
    }
    return ordered([...m.entries()], (e) => e[0], order[`cat:dmfit:${title}`], (a, b) => a[0].localeCompare(b[0], 'no'));
  }, [items, order, title]);
  const setLibOrder = useStore((s) => s.setLibOrder);
  return (
    <Group title={title} items={items} favs={favs} onAdd={onAdd} forceOpen={forceOpen} groupKey={`dmfit:${title}`} catKey={{ section: 'dmfit', cat: title }} onCatReorder={(_s, d, t, b) => onCatReorder(d, t, b)}>
      <div className="lib-gb sub">
        {fams.map(([f, its]) => (
          <Group key={f} title={f} items={ordered(its, (d) => d.id, order[`items:dmfit:${title}:${f}`], keepOrder)} favs={favs} onAdd={onAdd} forceOpen={forceOpen && items.length < 40}
            groupKey={`dmfit:${title}:${f}`} catKey={{ section: `dmfit:${title}`, cat: f }}
            onCatReorder={(sec, d, t, b) => setLibOrder(`cat:${sec}`, moveInList(fams.map((x) => x[0]), d, t, b))} />
        ))}
      </div>
    </Group>
  );
}
