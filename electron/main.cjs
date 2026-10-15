const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require('electron');
const path = require('path');
const fs = require('fs');

let win = null;
let dirty = false;
let forceClose = false;
let pendingOpen = null;

const LIB_FILE = () => path.join(app.getPath('userData'), 'bibliotek.json');

function fileFromArgs(argv) {
  return argv.find((a) => /\.barflow$/i.test(a) && fs.existsSync(a)) || null;
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', (_e, argv) => {
    const f = fileFromArgs(argv);
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
      if (f) win.webContents.send('app:openPath', f);
    }
  });
}

function createWindow() {
  win = new BrowserWindow({
    width: 1500,
    height: 950,
    minWidth: 1000,
    minHeight: 600,
    title: 'BarFlow',
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    backgroundColor: '#f8fafc',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
    },
  });
  Menu.setApplicationMenu(null);
  win.maximize();

  const devUrl = process.env.BARFLOW_DEV_URL;
  if (devUrl) win.loadURL(devUrl);
  else win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));

  win.webContents.on('did-finish-load', () => {
    if (pendingOpen) {
      win.webContents.send('app:openPath', pendingOpen);
      pendingOpen = null;
    }
  });

  // åpne eksterne lenker i nettleser
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // F12 / Ctrl+Shift+I for utviklerverktøy, F5 for omlasting
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    if (input.key === 'F12' || (input.control && input.shift && input.key.toLowerCase() === 'i')) {
      win.webContents.toggleDevTools();
      event.preventDefault();
    }
  });

  win.on('close', (e) => {
    if (dirty && !forceClose) {
      e.preventDefault();
      const r = dialog.showMessageBoxSync(win, {
        type: 'question',
        buttons: ['Lagre', 'Ikke lagre', 'Avbryt'],
        defaultId: 0,
        cancelId: 2,
        title: 'BarFlow',
        message: 'Vil du lagre endringene i tegningen?',
      });
      if (r === 0) win.webContents.send('app:saveAndClose');
      else if (r === 1) {
        forceClose = true;
        win.close();
      }
    }
  });
  win.on('closed', () => {
    win = null;
  });
}

app.whenReady().then(() => {
  pendingOpen = fileFromArgs(process.argv);
  createWindow();
});

app.on('window-all-closed', () => {
  app.quit();
});

/* ---------- IPC ---------- */

const projectFilters = [{ name: 'BarFlow-tegning', extensions: ['barflow'] }];

ipcMain.handle('file:open', async () => {
  const r = await dialog.showOpenDialog(win, { title: 'Åpne tegning', filters: projectFilters, properties: ['openFile'] });
  if (r.canceled || !r.filePaths[0]) return null;
  const p = r.filePaths[0];
  return { path: p, content: fs.readFileSync(p, 'utf8') };
});

ipcMain.handle('file:read', async (_e, p) => {
  try {
    return { path: p, content: fs.readFileSync(p, 'utf8') };
  } catch {
    return null;
  }
});

ipcMain.handle('file:save', async (_e, { path: p, content, suggestedName }) => {
  let target = p;
  if (!target) {
    const r = await dialog.showSaveDialog(win, {
      title: 'Lagre tegning',
      defaultPath: path.join(app.getPath('documents'), suggestedName || 'Tegning.barflow'),
      filters: projectFilters,
    });
    if (r.canceled || !r.filePath) return null;
    target = r.filePath;
    if (!/\.barflow$/i.test(target)) target += '.barflow';
  }
  fs.writeFileSync(target, content, 'utf8');
  return target;
});

ipcMain.handle('file:saveBinary', async (_e, { defaultName, filterName, ext, data }) => {
  const r = await dialog.showSaveDialog(win, {
    title: 'Lagre',
    defaultPath: path.join(app.getPath('documents'), defaultName),
    filters: [{ name: filterName, extensions: [ext] }],
  });
  if (r.canceled || !r.filePath) return null;
  fs.writeFileSync(r.filePath, Buffer.from(data));
  if (ext === 'xlsx') shell.openPath(r.filePath);
  return r.filePath;
});

ipcMain.handle('lib:load', async () => {
  try {
    return fs.readFileSync(LIB_FILE(), 'utf8');
  } catch {
    return null;
  }
});

ipcMain.handle('lib:save', async (_e, content) => {
  fs.mkdirSync(path.dirname(LIB_FILE()), { recursive: true });
  // behold en sikkerhetskopi
  try {
    if (fs.existsSync(LIB_FILE())) fs.copyFileSync(LIB_FILE(), LIB_FILE() + '.bak');
  } catch { /* ignorer */ }
  fs.writeFileSync(LIB_FILE(), content, 'utf8');
});

ipcMain.handle('pdf:export', async (_e, { defaultName, landscape, pageSize }) => {
  const data = await win.webContents.printToPDF({
    landscape: !!landscape,
    pageSize: pageSize || 'A3',
    printBackground: true,
    margins: { marginType: 'custom', top: 0.315, bottom: 0.315, left: 0.315, right: 0.315 },
  });
  const r = await dialog.showSaveDialog(win, {
    title: 'Lagre PDF',
    defaultPath: path.join(app.getPath('documents'), defaultName),
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
  });
  if (r.canceled || !r.filePath) return null;
  fs.writeFileSync(r.filePath, data);
  shell.openPath(r.filePath);
  return r.filePath;
});

ipcMain.handle('print', async (_e, { landscape, pageSize }) => {
  return new Promise((resolve) => {
    win.webContents.print(
      { silent: false, printBackground: true, landscape: !!landscape, pageSize: pageSize || 'A3', margins: { marginType: 'custom', top: 8, bottom: 8, left: 8, right: 8 } },
      () => resolve(),
    );
  });
});

ipcMain.on('app:setDirty', (_e, d) => {
  dirty = !!d;
  if (win) win.setDocumentEdited?.(dirty);
});
ipcMain.on('app:setTitle', (_e, t) => {
  if (win) win.setTitle(t);
});
ipcMain.on('app:openPath', (_e, p) => {
  shell.openPath(p);
});
ipcMain.on('app:closeNow', () => {
  forceClose = true;
  if (win) win.close();
});
