const fs = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const {
  app,
  BrowserWindow,
  Menu,
  Tray,
  globalShortcut,
  ipcMain,
  nativeImage,
  shell,
} = require('electron');

const appRoot = path.resolve(__dirname, '..');
const rendererUrl = process.env.ELECTRON_RENDERER_URL;
const settingsFile = path.join(app.getPath('userData'), 'desktop-settings.json');
const defaultSettings = {
  toggleHotkey: process.env.Cove_HOTKEY || 'CommandOrControl+Alt+N',
  newNoteHotkey: process.env.Cove_NEW_NOTE_HOTKEY || 'CommandOrControl+Shift+N',
  newMeetingHotkey: process.env.Cove_NEW_MEETING_HOTKEY || 'CommandOrControl+Shift+M',
};

let mainWindow = null;
let quickCaptureWindow = null;
let tray = null;
let isQuitting = false;
let desktopSettings = { ...defaultSettings };

function createTrayIcon() {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
      <rect x="4" y="4" width="24" height="24" rx="7" fill="#111827"/>
      <path d="M11 9.5h10v2H11zm0 5h10v2H11zm0 5h6v2h-6z" fill="#f8fafc"/>
      <circle cx="22.5" cy="20.5" r="2.5" fill="#f97316"/>
    </svg>
  `.trim();

  return nativeImage.createFromDataURL(`data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`);
}

async function loadDesktopSettings() {
  try {
    const raw = await fs.readFile(settingsFile, 'utf8');
    const parsed = JSON.parse(raw);
    desktopSettings = {
      toggleHotkey: parsed.toggleHotkey || defaultSettings.toggleHotkey,
      newNoteHotkey: parsed.newNoteHotkey || defaultSettings.newNoteHotkey,
      newMeetingHotkey: parsed.newMeetingHotkey || defaultSettings.newMeetingHotkey,
    };
  } catch {
    desktopSettings = { ...defaultSettings };
  }
}

async function saveDesktopSettings() {
  await fs.mkdir(path.dirname(settingsFile), { recursive: true });
  await fs.writeFile(settingsFile, JSON.stringify(desktopSettings, null, 2), 'utf8');
}

function sendDesktopAction(action) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('desktop:action', action);
  }
}

function getAppUrl(search = '') {
  if (rendererUrl) {
    return `${rendererUrl}/${search}`;
  }

  return `${pathToFileURL(path.join(appRoot, 'dist', 'index.html')).toString()}${search}`;
}

function createMainWindow() {
  const window = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 960,
    minHeight: 640,
    autoHideMenuBar: true,
    backgroundColor: '#09090b',
    title: 'Cove',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  window.once('ready-to-show', () => {
    window.show();
  });

  window.on('close', (event) => {
    if (isQuitting) return;
    event.preventDefault();
    window.hide();
  });

  window.on('closed', () => {
    if (mainWindow === window) mainWindow = null;
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  if (rendererUrl) {
    window.loadURL(getAppUrl());
    window.webContents.openDevTools({ mode: 'detach' });
  } else {
    window.loadFile(path.join(appRoot, 'dist', 'index.html'));
  }

  return window;
}

function createQuickCaptureWindow(type = 'note') {
  const isMeeting = type === 'meeting';
  const window = new BrowserWindow({
    width: 520,
    height: isMeeting ? 690 : 620,
    minWidth: 500,
    minHeight: isMeeting ? 660 : 590,
    maxWidth: 620,
    autoHideMenuBar: true,
    maximizable: false,
    minimizable: false,
    resizable: false,
    show: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    frame: false,
    backgroundColor: '#0b0c0f',
    title: type === 'meeting' ? 'New Meeting - Cove' : 'New Note - Cove',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  window.once('ready-to-show', () => {
    window.show();
    window.focus();
  });

  window.on('closed', () => {
    if (quickCaptureWindow === window) quickCaptureWindow = null;
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  window.loadURL(getAppUrl(`?quickCapture=${type}`));
  return window;
}

function showMainWindow() {
  if (!mainWindow) {
    mainWindow = createMainWindow();
    return;
  }

  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function hideMainWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.hide();
  }
}

function toggleMainWindow() {
  if (!mainWindow || !mainWindow.isVisible()) {
    showMainWindow();
    return;
  }

  if (mainWindow.isFocused()) {
    hideMainWindow();
    return;
  }

  showMainWindow();
}

function openQuickCaptureWindow(type = 'note') {
  if (quickCaptureWindow && !quickCaptureWindow.isDestroyed()) {
    quickCaptureWindow.setTitle(type === 'meeting' ? 'New Meeting - Cove' : 'New Note - Cove');
    quickCaptureWindow.setSize(520, type === 'meeting' ? 690 : 620);
    quickCaptureWindow.loadURL(getAppUrl(`?quickCapture=${type}`));
    if (quickCaptureWindow.isMinimized()) quickCaptureWindow.restore();
    quickCaptureWindow.show();
    quickCaptureWindow.focus();
    return;
  }

  quickCaptureWindow = createQuickCaptureWindow(type);
}

function registerHotkeys() {
  globalShortcut.unregisterAll();

  const registrations = [
    { accelerator: desktopSettings.toggleHotkey, handler: toggleMainWindow },
    {
      accelerator: desktopSettings.newNoteHotkey,
      handler: () => openQuickCaptureWindow('note'),
    },
    {
      accelerator: desktopSettings.newMeetingHotkey,
      handler: () => openQuickCaptureWindow('meeting'),
    },
  ];

  for (const registration of registrations) {
    if (!registration.accelerator) continue;
    const success = globalShortcut.register(registration.accelerator, registration.handler);
    if (!success) {
      throw new Error(`Unable to register hotkey: ${registration.accelerator}`);
    }
  }
}

function createTray() {
  tray = new Tray(createTrayIcon());
  tray.setToolTip('Cove');
  tray.on('click', toggleMainWindow);
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Show Cove', click: showMainWindow },
      { label: 'New Note', click: () => openQuickCaptureWindow('note') },
      { label: 'New Meeting', click: () => openQuickCaptureWindow('meeting') },
      { type: 'separator' },
      { label: 'Hide Cove', click: hideMainWindow },
      {
        label: 'Quit',
        click: () => {
          isQuitting = true;
          app.quit();
        },
      },
    ])
  );
}

function installDesktopIpc() {
  ipcMain.handle('desktop:get-settings', async () => ({ ...desktopSettings }));

  ipcMain.handle('desktop:update-settings', async (_event, nextSettings) => {
    const merged = {
      toggleHotkey: String(nextSettings?.toggleHotkey || '').trim(),
      newNoteHotkey: String(nextSettings?.newNoteHotkey || '').trim(),
      newMeetingHotkey: String(nextSettings?.newMeetingHotkey || '').trim(),
    };

    if (!merged.toggleHotkey || !merged.newNoteHotkey || !merged.newMeetingHotkey) {
      throw new Error('All hotkeys are required');
    }

    desktopSettings = merged;
    registerHotkeys();
    await saveDesktopSettings();
    return { ...desktopSettings };
  });
}

const singleInstanceLock = app.requestSingleInstanceLock();

if (!singleInstanceLock) {
  app.quit();
} else {
  app.setAppUserModelId('com.cove.app');

  app.on('second-instance', () => {
    showMainWindow();
  });

  app.whenReady().then(async () => {
    await loadDesktopSettings();
    registerHotkeys();
    installDesktopIpc();
    mainWindow = createMainWindow();
    createTray();

    app.on('activate', () => {
      showMainWindow();
    });
  });

  app.on('before-quit', () => {
    isQuitting = true;
  });

  app.on('will-quit', () => {
    globalShortcut.unregisterAll();
  });

  app.on('window-all-closed', () => {
    // Hide-to-tray keeps the app resident until the user explicitly quits.
  });
}
