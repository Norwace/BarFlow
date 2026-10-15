const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('barflow', {
  isElectron: true,
  openProject: () => ipcRenderer.invoke('file:open'),
  readFile: (p) => ipcRenderer.invoke('file:read', p),
  saveProject: (path, content, suggestedName) => ipcRenderer.invoke('file:save', { path, content, suggestedName }),
  saveBinary: (defaultName, filterName, ext, data) => ipcRenderer.invoke('file:saveBinary', { defaultName, filterName, ext, data }),
  loadLibrary: () => ipcRenderer.invoke('lib:load'),
  saveLibrary: (content) => ipcRenderer.invoke('lib:save', content),
  exportPdf: (defaultName, landscape, pageSize) => ipcRenderer.invoke('pdf:export', { defaultName, landscape, pageSize }),
  print: (landscape, pageSize) => ipcRenderer.invoke('print', { landscape, pageSize }),
  setDirty: (d) => ipcRenderer.send('app:setDirty', d),
  setTitle: (t) => ipcRenderer.send('app:setTitle', t),
  openPath: (p) => ipcRenderer.send('app:openPath', p),
  closeNow: () => ipcRenderer.send('app:closeNow'),
  onSaveAndClose: (cb) => ipcRenderer.on('app:saveAndClose', () => cb()),
  onOpenPath: (cb) => ipcRenderer.on('app:openPath', (_e, p) => cb(p)),
});
