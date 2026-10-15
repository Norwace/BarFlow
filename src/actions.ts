import { getNodesBounds, getViewportForBounds, type Node } from '@xyflow/react';
import { toPng } from 'html-to-image';
import { useStore } from './store';
import { api, isElectron } from './lib/api';
import { computeParts, formatQty } from './lib/parts';
import { buildExcel, hoseDetailRows } from './lib/exportExcel';
import { analyze, findPort, nodeDef } from './lib/compat';

function baseName() {
  const { filePath, info } = useStore.getState();
  if (filePath) return filePath.split(/[\\/]/).pop()!.replace(/\.barflow$/i, '');
  return (info.prosjekt || info.kunde || 'BarFlow-tegning').replace(/[\\/:*?"<>|]/g, '-');
}

async function confirmDiscard(): Promise<boolean> {
  if (!useStore.getState().dirty) return true;
  return window.confirm('Du har endringer som ikke er lagret. Vil du forkaste dem?');
}

export async function newFile() {
  if (!(await confirmDiscard())) return;
  api.forgetFile();
  useStore.getState().newProject();
}

export async function openFile() {
  if (!(await confirmDiscard())) return;
  const r = await api.openProject();
  if (!r) return;
  if (!useStore.getState().loadProject(r.content, r.path)) alert('Kunne ikke åpne filen. Er det en BarFlow-fil?');
  else setTimeout(() => (window as any).__bfFitView?.(), 50);
}

export async function openPath(p: string) {
  const r = await api.readFile(p);
  if (!r) return;
  if (!useStore.getState().loadProject(r.content, r.path)) alert('Kunne ikke åpne filen.');
  else setTimeout(() => (window as any).__bfFitView?.(), 50);
}

export async function save(saveAs = false): Promise<boolean> {
  const st = useStore.getState();
  const content = st.serialize();
  const path = await api.saveProject(saveAs ? null : st.filePath, content, baseName() + '.barflow');
  if (!path) return false;
  st.setFilePath(path);
  st.showToast('Lagret');
  return true;
}

function nameOfPort(n: Node | undefined, handle?: string | null) {
  const st = useStore.getState();
  if (!n) return '?';
  const def = nodeDef(n, st.pythons);
  const port = findPort(n, handle, st.pythons);
  let nm = (n.data as any).label || (n.data as any).flavor || def?.name || '';
  if (n.type === 'hoseEnd') return 'Åpen ende';
  if (n.type === 'pyEnd') {
    const py = st.pythons.find((p) => p.id === (n.data as any).pythonId);
    nm = `${py?.name ?? 'Pytonrør'} ende ${(n.data as any).end}`;
  } else if (def && def.group !== 'Utstyr' && def.artnr) nm = def.artnr;
  return port ? `${nm} (${port.name})` : nm;
}

export async function exportExcel() {
  const st = useStore.getState();
  const an = analyze(st.nodes, st.edges, st.pythons, st.library, st.settings.autoFittings, new Set(st.ignored));
  const rows = computeParts(st.nodes, st.edges, st.pythons, an.fits);
  if (!rows.length) { alert('Tegningen er tom.'); return; }
  const details = hoseDetailRows(st.nodes, st.edges, nameOfPort, (id) => an.hoseMedium.get(id), (id) => an.fits.get(id), (id) => an.hoseFlavor.get(id));
  // tomt innhold i pytonslange: bruk smaken fra BIB
  const pys = st.pythons.map((p) => ({ ...p, productNames: Array.from({ length: p.products }, (_, i) => p.productNames?.[i] || an.tubeFlavor.get(`${p.id}:p${i + 1}`) || '') }));
  const data = await buildExcel(rows, st.info, details, pys);
  const p = await api.saveBinary(baseName() + ' - deleliste.xlsx', 'Excel', 'xlsx', data);
  if (p) st.showToast('Excel lagret');
}

export function partsAsText(): string {
  const st = useStore.getState();
  const an = analyze(st.nodes, st.edges, st.pythons, st.library, st.settings.autoFittings, new Set(st.ignored));
  const rows = computeParts(st.nodes, st.edges, st.pythons, an.fits);
  const lines: string[] = [];
  if (st.info.prosjekt || st.info.kunde) lines.push(`Deleliste – ${[st.info.prosjekt, st.info.kunde].filter(Boolean).join(', ')}`, '');
  let sec = '';
  for (const r of rows) {
    if (r.section !== sec) { if (sec) lines.push(''); sec = r.section; lines.push(sec.toUpperCase()); }
    lines.push(`${formatQty(r).padStart(9)}  ${r.artnr ? r.artnr + '  ' : ''}${r.name}`);
  }
  return lines.join('\n');
}

export async function copyParts() {
  const txt = partsAsText();
  try {
    await navigator.clipboard.writeText(txt);
    useStore.getState().showToast('Delelisten er kopiert');
  } catch {
    alert(txt);
  }
}

/** Lager PNG av hele tegningen */
export async function drawingImage(maxW = 3000, maxH = 2000): Promise<{ url: string; w: number; h: number } | null> {
  const st = useStore.getState();
  if (!st.nodes.length) return null;
  const el = document.querySelector('.react-flow__viewport') as HTMLElement | null;
  if (!el) return null;
  const bounds = getNodesBounds(st.nodes);
  const pad = 60;
  const bw = bounds.width + pad * 2, bh = bounds.height + pad * 2;
  const scale = Math.min(maxW / bw, maxH / bh, 2.5);
  const w = Math.round(bw * scale), h = Math.round(bh * scale);
  const vp = getViewportForBounds(bounds, w, h, 0.05, 4, 0.06);
  // skjul utvalg og opplysing under bildetaking
  const selN = st.nodes.filter((n) => n.selected).map((n) => n.id), selE = st.edges.filter((e) => e.selected).map((e) => e.id);
  if (selN.length || selE.length) {
    st.openPopup(null);
    st.selectOnly({});
    await new Promise((r) => setTimeout(r, 120));
  }
  document.body.classList.add('bf-capturing');
  try {
    const url = await toPng(el, {
      backgroundColor: '#ffffff',
      width: w,
      height: h,
      pixelRatio: 1,
      style: { width: `${w}px`, height: `${h}px`, transform: `translate(${vp.x}px, ${vp.y}px) scale(${vp.zoom})` },
      filter: (node) => !(node instanceof HTMLElement && node.classList?.contains('react-flow__handle') && node.classList.contains('free')),
    });
    return { url, w, h };
  } finally {
    document.body.classList.remove('bf-capturing');
    if (selN.length || selE.length) useStore.getState().selectOnly({ nodes: selN, edges: selE });
  }
}

export async function preparePrint(): Promise<boolean> {
  const img = await drawingImage(3200, 2200);
  if (!img) { alert('Tegningen er tom.'); return false; }
  (window as any).__bfSetPrint?.(img);
  await new Promise((r) => setTimeout(r, 300));
  return true;
}

export async function exportPdf() {
  const st = useStore.getState();
  if (!isElectron) st.showToast('Velg «Lagre som PDF» som skriver i utskriftsvinduet');
  if (!(await preparePrint())) return;
  try {
    const p = await api.exportPdf(baseName() + '.pdf', true, st.settings.pageSize);
    if (p) st.showToast('PDF lagret');
  } finally {
    (window as any).__bfSetPrint?.(null);
  }
}

export async function printDrawing() {
  const st = useStore.getState();
  if (!(await preparePrint())) return;
  try {
    await api.print(true, st.settings.pageSize);
  } finally {
    (window as any).__bfSetPrint?.(null);
  }
}

/* ---------- bibliotek: eksport/import ---------- */
export async function exportLibrary() {
  const st = useStore.getState();
  const data = new TextEncoder().encode(JSON.stringify(st.userLib, null, 1));
  const p = await api.saveBinary('BarFlow-bibliotek.json', 'BarFlow-bibliotek', 'json', data);
  if (p) st.showToast('Biblioteket er eksportert');
}

export async function importLibrary() {
  const r = await api.pickTextFile('.json');
  if (!r) return;
  try {
    const lib = JSON.parse(r.content);
    if (!lib || !Array.isArray(lib.items)) throw new Error('feil format');
    if (!window.confirm(`Importere biblioteket fra ${r.path}? Egne komponenter og endringer du har nå blir erstattet.`)) return;
    await useStore.getState().importUserLib(lib);
    useStore.getState().showToast(`Importerte ${lib.items.length} egne komponenter`);
  } catch {
    alert('Kunne ikke lese filen. Er det et BarFlow-bibliotek?');
  }
}
