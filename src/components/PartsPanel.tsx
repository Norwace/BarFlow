import React, { useMemo } from 'react';
import { useStore } from '../store';
import { computeParts, formatQty, type PartRow } from '../lib/parts';
import { exportExcel, exportPdf, copyParts, printDrawing } from '../actions';
import { warnKey, type Analysis } from '../lib/compat';
import type { HoseData, Warning } from '../lib/types';
import { tokenName, type SimResult } from '../lib/sim';

export function PartsTable({ rows, compact }: { rows: PartRow[]; compact?: boolean }) {
  const sections: PartRow['section'][] = ['Utstyr', 'Koblinger', 'Slanger', 'Pytonrør'];
  return (
    <table className={`parts ${compact ? 'compact' : ''}`}>
      <thead>
        <tr><th className="q">Antall</th><th>Art.nr</th><th>Beskrivelse</th>{!compact && <th>Merknad</th>}</tr>
      </thead>
      {sections.map((sec) => {
        const rs = rows.filter((r) => r.section === sec);
        if (!rs.length) return null;
        return (
          <tbody key={sec}>
            <tr className="sec"><td colSpan={compact ? 3 : 4}>{sec}</td></tr>
            {rs.map((r, i) => (
              <tr key={i}>
                <td className="q">{formatQty(r)}</td>
                <td className="a">{r.artnr}</td>
                <td>{r.name}{compact && r.note ? <div className="mut small">{r.note}</div> : null}</td>
                {!compact && <td className="mut">{r.note}</td>}
              </tr>
            ))}
          </tbody>
        );
      })}
    </table>
  );
}

export default function PartsPanel({ analysis }: { analysis: Analysis }) {
  const nodes = useStore((s) => s.nodes);
  const edges = useStore((s) => s.edges);
  const pythons = useStore((s) => s.pythons);
  const pageSize = useStore((s) => s.settings.pageSize);
  const setSettings = useStore((s) => s.setSettings);
  const rows = useMemo(() => computeParts(nodes, edges, pythons, analysis.fits), [nodes, edges, pythons, analysis]);
  const totalM = rows.filter((r) => r.section === 'Slanger').reduce((a, r) => a + r.qty, 0);
  return (
    <div className="partspanel">
      <div className="btnrow pad">
        <button className="btn primary" onClick={exportExcel}>Excel</button>
        <button className="btn" onClick={exportPdf}>PDF</button>
        <button className="btn" onClick={printDrawing}>Skriv ut</button>
        <button className="btn" onClick={copyParts}>Kopier</button>
        <select value={pageSize} onChange={(e) => setSettings({ pageSize: e.target.value as any })} title="Arkstørrelse for PDF/utskrift">
          <option value="A4">A4</option>
          <option value="A3">A3</option>
        </select>
      </div>
      {rows.length === 0 ? (
        <div className="mut pad">Ingen deler ennå. Dra inn utstyr og legg slanger.</div>
      ) : (
        <>
          <PartsTable rows={rows} compact />
          <div className="mut small pad">Totalt {totalM.toLocaleString('nb-NO', { maximumFractionDigits: 2 })} m slange.</div>
        </>
      )}
    </div>
  );
}

function WarnRow({ w, cls, icon, ignored, onFocus }: { w: Warning; cls: string; icon: string; ignored?: boolean; onFocus: () => void }) {
  const toggle = useStore((s) => s.toggleIgnore);
  return (
    <div className={`wrow ${cls} ${ignored ? 'ign' : ''}`}>
      <button className="wtxt" onClick={onFocus} title="Vis i tegningen">{icon} {w.text}</button>
      <label className="wign" title={ignored ? 'Ta med varselet igjen' : 'Ignorer dette varselet – det vises ikke mer'}>
        <input type="checkbox" checked={!!ignored} onChange={() => toggle(warnKey(w))} /> Ignorer
      </label>
    </div>
  );
}

export function WarningsPanel({ analysis, sim }: { analysis: Analysis; sim?: SimResult | null }) {
  const selectOnly = useStore((s) => s.selectOnly);
  const focus = (t: { type: 'edge' | 'node'; id: string }) => {
    if (t.type === 'edge') selectOnly({ edges: [t.id] });
    else selectOnly({ nodes: [t.id] });
    useStore.getState().setRightTab('props');
    (window as any).__bfFocus?.(t);
  };
  const { warnings, info } = analysis;
  const edges = useStore((s) => s.edges);
  const nodes = useStore((s) => s.nodes);
  const mixed = sim ? [...sim.mixed] : [];
  const nameOf = (id: string) => {
    const n = nodes.find((x) => x.id === id);
    const d = n?.data as any;
    return !n ? '?' : n.type === 'hoseEnd' ? 'åpen ende' : n.type === 'pyEnd' ? `pytonrør ${d.end}` : d?.label || d?.flavor || d?.def?.name || '?';
  };
  return (
    <div className="warnpanel">
      {mixed.length > 0 && <div className="sub-h pad">I drift ({mixed.length})</div>}
      {mixed.map(([id, ms]) => {
        const e = edges.find((x) => x.id === id);
        const h = e?.data as HoseData | undefined;
        return (
          <div key={id} className="wrow err">
            <button className="wtxt" onClick={() => focus({ type: 'edge', id })} title="Vis i tegningen">
              ⚠ To medier i slangen{h?.size ? ` ${h.size}` : ''}{e ? ` (${nameOf(e.source)} → ${nameOf(e.target)})` : ''}: {ms.map(tokenName).join(' og ')}
            </button>
          </div>
        );
      })}
      {warnings.length === 0 && info.length === 0 && !mixed.length && <div className="ok pad">✓ Ingen varsler</div>}
      {warnings.length > 0 && <div className="sub-h pad">Feil ({warnings.filter((w) => !w.ignored).length}{warnings.some((w) => w.ignored) ? ` + ${warnings.filter((w) => w.ignored).length} ignorert` : ''})</div>}
      {warnings.map((w) => <WarnRow key={w.id} w={w} cls="err" icon="⚠" ignored={w.ignored} onFocus={() => focus(w.target)} />)}
      {info.length > 0 && <div className="sub-h pad">Mangler ({info.filter((w) => !w.ignored).length}{info.some((w) => w.ignored) ? ` + ${info.filter((w) => w.ignored).length} ignorert` : ''})</div>}
      {info.map((w) => <WarnRow key={w.id} w={w} cls="info" icon="•" ignored={w.ignored} onFocus={() => focus(w.target)} />)}
      {(warnings.some((w) => w.ignored) || info.some((w) => w.ignored)) && <div className="mut small pad">Ignorerte varsler er grå og vises ikke i tegningen. Fjern krysset for å vise dem igjen.</div>}
    </div>
  );
}
