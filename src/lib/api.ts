/** Plattform-API: Electron når tilgjengelig, ellers nettleser (HTML-versjonen). */

export interface FileResult { path: string; content: string }

interface BarflowBridge {
  openProject(): Promise<FileResult | null>;
  readFile(path: string): Promise<FileResult | null>;
  saveProject(path: string | null, content: string, suggestedName: string): Promise<string | null>;
  saveBinary(defaultName: string, filterName: string, ext: string, data: Uint8Array): Promise<string | null>;
  loadLibrary(): Promise<string | null>;
  saveLibrary(content: string): Promise<void>;
  exportPdf(defaultName: string, landscape: boolean, pageSize: string): Promise<string | null>;
  print(landscape: boolean, pageSize: string): Promise<void>;
  setDirty(dirty: boolean): void;
  setTitle(title: string): void;
  openPath(path: string): void;
  closeNow(): void;
  onSaveAndClose(cb: () => void): void;
  onOpenPath(cb: (p: string) => void): void;
  isElectron: true;
}

declare global {
  interface Window { barflow?: BarflowBridge }
}

const bridge = typeof window !== 'undefined' ? window.barflow : undefined;

export const isElectron = !!bridge;

function download(name: string, data: BlobPart, type: string) {
  const blob = new Blob([data], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

function pickFile(accept: string): Promise<FileResult | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = async () => {
      const f = input.files?.[0];
      if (!f) return resolve(null);
      resolve({ path: f.name, content: await f.text() });
    };
    input.click();
  });
}

const LIB_KEY = 'barflow.library.v1';

/* ---------- nettleser: File System Access API (Edge/Chrome) ---------- */
const w = (typeof window !== 'undefined' ? window : {}) as any;
const hasFsa = typeof w.showSaveFilePicker === 'function' && typeof w.showOpenFilePicker === 'function';
let projHandle: any = null;
let browserDirty = false;
const PROJECT_TYPES = [{ description: 'BarFlow-tegning', accept: { 'application/json': ['.barflow'] } }];

async function writeHandle(h: any, data: BlobPart) {
  const ws = await h.createWritable();
  await ws.write(data);
  await ws.close();
}
const isAbort = (e: any) => e && (e.name === 'AbortError' || e.name === 'NotAllowedError');

if (!bridge && typeof window !== 'undefined') {
  window.addEventListener('beforeunload', (e) => {
    if (browserDirty) { e.preventDefault(); e.returnValue = ''; }
  });
}

export const api = {
  /** true når man kan lagre rett til fil uten nedlasting */
  canSaveInPlace: !!bridge || hasFsa,
  openProject: async (): Promise<FileResult | null> => {
    if (bridge) return bridge.openProject();
    if (hasFsa) {
      try {
        const [h] = await w.showOpenFilePicker({ types: PROJECT_TYPES, multiple: false });
        const f = await h.getFile();
        projHandle = h;
        return { path: h.name, content: await f.text() };
      } catch (e) {
        if (isAbort(e)) return null;
      }
    }
    return pickFile('.barflow,.json');
  },
  readFile: (p: string) => (bridge ? bridge.readFile(p) : Promise.resolve(null)),
  forgetFile: () => { projHandle = null; },
  saveProject: async (path: string | null, content: string, suggestedName: string): Promise<string | null> => {
    if (bridge) return bridge.saveProject(path, content, suggestedName);
    const name = suggestedName.endsWith('.barflow') ? suggestedName : suggestedName + '.barflow';
    if (hasFsa) {
      try {
        if (path && projHandle && projHandle.name === path) {
          await writeHandle(projHandle, content);
          return projHandle.name;
        }
        const h = await w.showSaveFilePicker({ suggestedName: name, types: PROJECT_TYPES });
        await writeHandle(h, content);
        projHandle = h;
        return h.name;
      } catch (e) {
        if (isAbort(e)) return null;
      }
    }
    download(name, content, 'application/json');
    return name;
  },
  saveBinary: async (defaultName: string, filterName: string, ext: string, data: Uint8Array): Promise<string | null> => {
    if (bridge) return bridge.saveBinary(defaultName, filterName, ext, data);
    const mime = ext === 'xlsx' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : ext === 'json' ? 'application/json' : 'application/octet-stream';
    if (hasFsa) {
      try {
        const h = await w.showSaveFilePicker({ suggestedName: defaultName, types: [{ description: filterName, accept: { [mime]: ['.' + ext] } }] });
        await writeHandle(h, data as unknown as BlobPart);
        return h.name;
      } catch (e) {
        if (isAbort(e)) return null;
      }
    }
    download(defaultName, data as unknown as BlobPart, mime);
    return defaultName;
  },
  pickTextFile: (accept: string) => pickFile(accept),
  loadLibrary: async (): Promise<string | null> => {
    if (bridge) return bridge.loadLibrary();
    try { return localStorage.getItem(LIB_KEY); } catch { return null; }
  },
  saveLibrary: async (content: string) => {
    if (bridge) return bridge.saveLibrary(content);
    try { localStorage.setItem(LIB_KEY, content); } catch { /* ignorer */ }
  },
  exportPdf: async (defaultName: string, landscape: boolean, pageSize: string): Promise<string | null> => {
    if (bridge) return bridge.exportPdf(defaultName, landscape, pageSize);
    window.print();
    return null;
  },
  print: async (landscape: boolean, pageSize: string) => {
    if (bridge) return bridge.print(landscape, pageSize);
    window.print();
  },
  setDirty: (d: boolean) => { if (bridge) bridge.setDirty(d); else browserDirty = d; },
  setTitle: (t: string) => { if (bridge) bridge.setTitle(t); else document.title = t; },
  openPath: (p: string) => bridge?.openPath(p),
  closeNow: () => bridge?.closeNow(),
  onSaveAndClose: (cb: () => void) => bridge?.onSaveAndClose(cb),
  onOpenPath: (cb: (p: string) => void) => bridge?.onOpenPath(cb),
};
