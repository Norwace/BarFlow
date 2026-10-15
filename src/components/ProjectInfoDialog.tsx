import React from 'react';
import { useStore } from '../store';

export default function ProjectInfoDialog() {
  const open = useStore((s) => s.infoOpen);
  const info = useStore((s) => s.info);
  const setInfo = useStore((s) => s.setInfo);
  const setOpen = useStore((s) => s.setInfoOpen);
  if (!open) return null;
  const f = (k: keyof typeof info, label: string, ph?: string) => (
    <>
      <label>{label}</label>
      <input value={info[k]} placeholder={ph} onChange={(e) => setInfo({ [k]: e.target.value })} />
    </>
  );
  return (
    <div className="modal-bg" onMouseDown={() => setOpen(false)}>
      <div className="modal small" onMouseDown={(e) => e.stopPropagation()}>
        <div className="mh"><div className="t">Prosjektinfo</div><button className="x" onClick={() => setOpen(false)}>×</button></div>
        <div className="mb">
          <div className="grid2">
            {f('kunde', 'Kunde', 'F.eks. Bryggeriet AS')}
            {f('prosjekt', 'Prosjekt', 'F.eks. Ny bar 2. etg')}
            {f('adresse', 'Adresse')}
            {f('dato', 'Dato')}
            {f('tegnetAv', 'Tegnet av')}
            <label>Notat</label>
            <textarea rows={3} value={info.notat} onChange={(e) => setInfo({ notat: e.target.value })} placeholder="Vises på tegningen" />
          </div>
          <p className="mut small">Vises i tittelfeltet på PDF og utskrift.</p>
        </div>
        <div className="mf"><div className="sp" /><button className="btn primary" onClick={() => setOpen(false)}>Ferdig</button></div>
      </div>
    </div>
  );
}
