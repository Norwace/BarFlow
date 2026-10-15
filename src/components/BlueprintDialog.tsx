import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../store';
import type { Blueprint } from '../lib/types';

/** Lagre det som er valgt som blueprint i biblioteket */
export default function BlueprintDialog() {
  const open = useStore((s) => s.bpSave);
  const blueprints = useStore((s) => s.userLib.blueprints) ?? [];
  const [bp, setBp] = useState<Blueprint | null>(null);
  const [name, setName] = useState('');
  const [cat, setCat] = useState('Egne');
  const [newCat, setNewCat] = useState('');
  const [replace, setReplace] = useState('');
  const ref = useRef<HTMLInputElement>(null);
  const cats = useMemo(() => {
    const c = [...new Set(blueprints.map((b) => b.category))];
    if (!c.includes('Egne')) c.unshift('Egne');
    return c;
  }, [blueprints]);

  useEffect(() => {
    if (!open) return;
    const b = useStore.getState().blueprintFromSelection();
    setBp(b);
    setName('');
    setReplace('');
    setNewCat('');
    setTimeout(() => ref.current?.focus(), 0);
  }, [open]);

  if (!open) return null;
  const st = useStore.getState();
  const close = () => st.openBpSave(false);
  const counts = bp ? {
    comp: bp.nodes.filter((n) => n.type === 'comp').length,
    hose: bp.edges.filter((e) => e.type === 'hose').length,
    py: bp.pythons.length,
  } : null;
  const category = cat === '__new' ? newCat.trim() || 'Egne' : cat;
  const save = async () => {
    if (!bp) return;
    const old = blueprints.find((b) => b.id === replace);
    const nm = name.trim() || old?.name || 'Blueprint';
    await st.saveBlueprint({ ...bp, name: nm, category }, replace || undefined);
    st.showToast(replace ? `«${nm}» er oppdatert` : `«${nm}» er lagret under Blueprints`);
    close();
  };
  return (
    <div className="modal-bg" onMouseDown={close}>
      <div className="modal small" onMouseDown={(e) => e.stopPropagation()} onKeyDown={(e) => { if (e.key === 'Escape') close(); if (e.key === 'Enter' && bp) save(); }}>
        <div className="mh"><div className="t">Lagre som blueprint</div><button className="x" onClick={close}>×</button></div>
        <div className="mb">
          {!bp ? (
            <p>Velg komponentene du vil ha med først (dra et rektangel rundt dem, eller Ctrl-klikk).</p>
          ) : (
            <div className="grid2">
              <label>Navn</label>
              <input ref={ref} value={name} placeholder="F.eks. Postmix 4 sirup komplett" onChange={(e) => setName(e.target.value)} />
              <label>Kategori</label>
              <div className="inline">
                <select value={cat} onChange={(e) => setCat(e.target.value)}>
                  {cats.map((c) => <option key={c} value={c}>{c}</option>)}
                  <option value="__new">Ny kategori …</option>
                </select>
                {cat === '__new' && <input value={newCat} placeholder="Navn på kategori" onChange={(e) => setNewCat(e.target.value)} />}
              </div>
              <label>Erstatt</label>
              <select value={replace} onChange={(e) => { setReplace(e.target.value); const b = blueprints.find((x) => x.id === e.target.value); if (b) { if (!name) setName(b.name); setCat(b.category); } }}>
                <option value="">Nei – lagre som ny</option>
                {blueprints.map((b) => <option key={b.id} value={b.id}>{b.name} ({b.category})</option>)}
              </select>
              <label>Innhold</label>
              <div className="mut">{counts!.comp} komponenter, {counts!.hose} slanger{counts!.py ? `, ${counts!.py} pytonrør` : ''}</div>
            </div>
          )}
          <p className="mut small">Slanger som går ut av utvalget tas ikke med. Slangelengder nullstilles.</p>
        </div>
        <div className="mf">
          <div className="sp" />
          <button className="btn" onClick={close}>Avbryt</button>
          <button className="btn primary" disabled={!bp} onClick={save}>Lagre</button>
        </div>
      </div>
    </div>
  );
}
