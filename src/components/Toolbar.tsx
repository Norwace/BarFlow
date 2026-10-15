import React from 'react';
import { useReactFlow } from '@xyflow/react';
import { useStore } from '../store';
import { newFile, openFile, save, exportExcel, exportPdf, printDrawing } from '../actions';
import { APP_VERSION, VERSION_LABEL } from '../version';

function B({ onClick, title, children, disabled, className }: { onClick: () => void; title: string; children: React.ReactNode; disabled?: boolean; className?: string }) {
  return <button className={`tb ${className ?? ''}`} onClick={onClick} title={title} disabled={disabled}>{children}</button>;
}

export default function Toolbar() {
  const st = useStore();
  const rf = useReactFlow();
  const hasSel = st.nodes.some((n) => n.selected) || st.edges.some((e) => e.selected);
  const center = () => {
    const el = document.querySelector('.bf-canvas') as HTMLElement;
    const r = el.getBoundingClientRect();
    return rf.screenToFlowPosition({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
  };
  const fname = st.filePath ? st.filePath.split(/[\\/]/).pop() : 'Uten navn';
  return (
    <div className="toolbar">
      <div className="brand" title={`BarFlow ${APP_VERSION}`}><span className="logo">◆</span> BarFlow{VERSION_LABEL && <><span className="vsep">|</span><span className="ver">{VERSION_LABEL}</span></>}</div>
      <div className="grp">
        <B onClick={newFile} title="Ny tegning (Ctrl+N)">Ny</B>
        <B onClick={openFile} title="Åpne (Ctrl+O)">Åpne</B>
        <B onClick={() => save(false)} title="Lagre (Ctrl+S)">Lagre</B>
        <B onClick={() => save(true)} title="Lagre som (Ctrl+Shift+S)">Lagre som</B>
      </div>
      <div className="grp">
        <B onClick={st.undo} title="Angre (Ctrl+Z)" disabled={!st.past.length}>↶</B>
        <B onClick={st.redo} title="Gjør om (Ctrl+Y)" disabled={!st.future.length}>↷</B>
      </div>
      <div className="grp">
        <B onClick={() => st.rotateSelected(1)} title="Roter valgte (R)" disabled={!hasSel}>⟳ Roter</B>
        <B onClick={() => st.flipSelected()} title="Speil valgte (F)" disabled={!hasSel}>⇋ Speil</B>
        <B onClick={() => st.deleteSelected()} title="Slett valgte (Delete)" disabled={!hasSel}>Slett</B>
      </div>
      <div className="grp">
        <B onClick={() => st.addPython(center())} title="Legg til pytonrør">+ Pytonrør</B>
        <B onClick={() => st.addText(center())} title="Legg til tekst">+ Tekst</B>
        <B onClick={() => st.setDrawTool(st.drawTool === 'line' ? null : 'line')} title="Tegn strek (vegg, benk …)" className={st.drawTool === 'line' ? 'on' : ''}>╱ Strek</B>
        <B onClick={() => st.setDrawTool(st.drawTool === 'rect' ? null : 'rect')} title="Tegn boks (hylle, rom …)" className={st.drawTool === 'rect' ? 'on' : ''}>▭ Boks</B>
      </div>
      <div className="grp">
        <B onClick={() => st.setSimOn(!st.simOn)} title="Kjør anlegget: se hvor det strømmer, åpne kraner og ventiler" className={st.simOn ? 'on drift' : 'drift'}>{st.simOn ? '■ Stopp drift' : '▶ Drift'}</B>
      </div>
      <div className="grp">
        <B onClick={() => st.setInfoOpen(true)} title="Kunde, prosjekt, adresse …">Prosjektinfo</B>
      </div>
      <div className="grp">
        <B onClick={exportExcel} title="Lagre delelisten som Excel">Excel</B>
        <B onClick={exportPdf} title="Lagre tegning og deleliste som PDF">PDF</B>
        <B onClick={printDrawing} title="Skriv ut tegning og deleliste">Skriv ut</B>
      </div>
      <div className="grp view">
        <label className="chk" title="Vis størrelse på alle koblinger i tegningen (ellers når du holder musa over)"><input type="checkbox" checked={st.settings.showFittingLabels} onChange={(e) => st.setSettings({ showFittingLabels: e.target.checked })} /> Koblingsstørrelser</label>
        <label className="chk" title="Legg automatisk på riktig overgang der slangen går inn i en port"><input type="checkbox" checked={st.settings.autoFittings} onChange={(e) => st.setSettings({ autoFittings: e.target.checked })} /> Auto-koblinger</label>
        <label className="chk" title="Vis dimensjon og lengde på slanger"><input type="checkbox" checked={st.settings.showHoseLabels} onChange={(e) => st.setSettings({ showHoseLabels: e.target.checked })} /> Slangetekst</label>
        <select value={st.settings.edgeStyle} onChange={(e) => st.setSettings({ edgeStyle: e.target.value as any })} title="Hvordan slanger tegnes">
          <option value="smoothstep">Vinklede slanger</option>
          <option value="straight">Rette slanger</option>
          <option value="bezier">Buede slanger</option>
        </select>
      </div>
      <div className="file" title={st.filePath ?? ''}>{fname}{st.dirty ? ' •' : ''}</div>
    </div>
  );
}
