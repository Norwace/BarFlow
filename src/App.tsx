import React, { useEffect, useMemo, useState } from 'react';
import { ReactFlowProvider, useReactFlow } from '@xyflow/react';
import { useStore } from './store';
import Canvas from './components/Canvas';
import LibraryPanel from './components/LibraryPanel';
import PropertiesPanel from './components/PropertiesPanel';
import PartsPanel, { WarningsPanel } from './components/PartsPanel';
import Toolbar from './components/Toolbar';
import FittingPicker from './components/FittingPicker';
import ComponentEditor from './components/ComponentEditor';
import ProjectInfoDialog from './components/ProjectInfoDialog';
import PrintView from './components/PrintView';
import BlueprintDialog from './components/BlueprintDialog';
import { analyze } from './lib/compat';
import { simulate } from './lib/sim';
import { api } from './lib/api';
import { newFile, openFile, save, openPath } from './actions';

function isTyping(e: KeyboardEvent) {
  const t = e.target as HTMLElement;
  return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
}

function Shell() {
  const nodes = useStore((s) => s.nodes);
  const edges = useStore((s) => s.edges);
  const pythons = useStore((s) => s.pythons);
  const rightTab = useStore((s) => s.rightTab);
  const setRightTab = useStore((s) => s.setRightTab);
  const toast = useStore((s) => s.toast);
  const filePath = useStore((s) => s.filePath);
  const dirty = useStore((s) => s.dirty);
  const rf = useReactFlow();
  const library = useStore((s) => s.library);
  const autoFit = useStore((s) => s.settings.autoFittings);
  const ignored = useStore((s) => s.ignored);
  const ignoredSet = useMemo(() => new Set(ignored), [ignored]);
  const analysis = useMemo(() => analyze(nodes, edges, pythons, library, autoFit, ignoredSet), [nodes, edges, pythons, library, autoFit, ignoredSet]);
  const simOn = useStore((s) => s.simOn);
  const sim = useMemo(() => (simOn ? simulate(nodes, edges, pythons, analysis.portMedium) : null), [simOn, nodes, edges, pythons, analysis]);
  const [libW, setLibW] = useState(300);

  useEffect(() => {
    (window as any).__bfFitView = () => rf.fitView({ padding: 0.15, duration: 300 });
    (window as any).__bfRF = rf;
    (window as any).__bfFocus = (t: { type: 'edge' | 'node'; id: string }) => {
      const st = useStore.getState();
      if (t.type === 'node') {
        const n = st.nodes.find((x) => x.id === t.id);
        if (n) rf.fitView({ nodes: [n], padding: 1.5, duration: 300, maxZoom: 1.5 });
      } else {
        const e = st.edges.find((x) => x.id === t.id);
        if (e) {
          const ns = st.nodes.filter((n) => n.id === e.source || n.id === e.target);
          rf.fitView({ nodes: ns, padding: 0.6, duration: 300, maxZoom: 1.5 });
        }
      }
    };
  }, [rf]);

  useEffect(() => {
    const name = filePath ? filePath.split(/[\\/]/).pop() : 'Uten navn';
    api.setTitle(`${name}${dirty ? ' •' : ''} – BarFlow`);
  }, [filePath, dirty]);

  useEffect(() => {
    api.onSaveAndClose(async () => {
      if (await save(false)) api.closeNow();
    });
    api.onOpenPath((p) => openPath(p));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const st = useStore.getState();
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && e.key.toLowerCase() === 's') { e.preventDefault(); save(e.shiftKey); return; }
      if (ctrl && e.key.toLowerCase() === 'o') { e.preventDefault(); openFile(); return; }
      if (ctrl && e.key.toLowerCase() === 'n') { e.preventDefault(); newFile(); return; }
      if (isTyping(e)) return;
      if (ctrl && e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); st.undo(); return; }
      if (ctrl && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) { e.preventDefault(); st.redo(); return; }
      if (ctrl && e.key.toLowerCase() === 'c') { st.copySelected(); return; }
      if (ctrl && e.key.toLowerCase() === 'v') { st.paste(); return; }
      if (ctrl && e.key.toLowerCase() === 'd') { e.preventDefault(); st.copySelected(); st.paste(); return; }
      if (ctrl && e.key.toLowerCase() === 'b') { e.preventDefault(); st.openBpSave(true); return; }
      if (ctrl && e.key.toLowerCase() === 'a') { e.preventDefault(); useStore.setState({ nodes: st.nodes.map((n) => ({ ...n, selected: true })), edges: st.edges.map((x) => ({ ...x, selected: true })) }); return; }
      if (!ctrl && e.key.toLowerCase() === 'r') { st.rotateSelected(e.shiftKey ? -1 : 1); return; }
      if (!ctrl && e.key.toLowerCase() === 'f') { st.flipSelected(); return; }
      if (e.key === 'Escape') { st.openPicker(null); st.openPopup(null); st.setDrawTool(null); st.selectOnly({}); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const nWarn = analysis.warnings.filter((w) => !w.ignored).length + (sim?.mixed.size ?? 0);
  const nInfo = analysis.info.filter((w) => !w.ignored).length;

  return (
    <div className="app">
      <Toolbar />
      <div className="main">
        <aside className="left" style={{ width: libW }}>
          <LibraryPanel />
          <div className="resizer" onMouseDown={(e) => {
            const sx = e.clientX, sw = libW;
            const mv = (ev: MouseEvent) => setLibW(Math.max(220, Math.min(560, sw + ev.clientX - sx)));
            const up = () => { window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', up); };
            window.addEventListener('mousemove', mv); window.addEventListener('mouseup', up);
          }} />
        </aside>
        <main className="center">
          <Canvas analysis={analysis} sim={sim} />
          <FittingPicker />
        </main>
        <aside className="right">
          <div className="tabs">
            <button className={rightTab === 'props' ? 'on' : ''} onClick={() => setRightTab('props')}>Egenskaper</button>
            <button className={rightTab === 'parts' ? 'on' : ''} onClick={() => setRightTab('parts')}>Deleliste</button>
            <button className={rightTab === 'warnings' ? 'on' : ''} onClick={() => setRightTab('warnings')}>
              Varsler {nWarn > 0 ? <span className="badge err">{nWarn}</span> : nInfo > 0 ? <span className="badge">{nInfo}</span> : null}
            </button>
          </div>
          <div className="tabbody">
            {rightTab === 'props' && <PropertiesPanel analysis={analysis} />}
            {rightTab === 'parts' && <PartsPanel analysis={analysis} />}
            {rightTab === 'warnings' && <WarningsPanel analysis={analysis} sim={sim} />}
          </div>
        </aside>
      </div>
      <ComponentEditor />
      <ProjectInfoDialog />
      <BlueprintDialog />
      <PrintView />
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

export default function App() {
  const init = useStore((s) => s.init);
  const [ready, setReady] = useState(false);
  useEffect(() => { init().then(() => setReady(true)); }, [init]);
  if (!ready) return <div className="loading">Laster BarFlow …</div>;
  return (
    <ReactFlowProvider>
      <Shell />
    </ReactFlowProvider>
  );
}
