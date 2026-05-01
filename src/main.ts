// Electron main process: window, tray, global shortcut, settings, and Anthropic API IPC handlers.
import {
  app,
  BrowserWindow,
  Tray,
  Menu,
  ipcMain,
  nativeImage,
  globalShortcut,
  clipboard,
  shell,
  dialog,
} from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import {
  DEFAULT_AVAILABLE_MODELS,
  DEFAULT_MODEL,
  DEFAULT_SYSTEM_PROMPT,
  SettingsSchema,
  getApiKey,
  getModel,
  getSettings,
  getShowInDock,
  getSystemPrompt,
  isApiKeyMissing,
  saveSettings,
  setShowInDock,
} from './settings';

if (started) {
  app.quit();
}

const WINDOW_WIDTH = 620;
const INPUT_WINDOW_HEIGHT = 100;
const FADE_STEP = 0.1;
const FADE_INTERVAL_MS = 15;
const SETTINGS_WINDOW_WIDTH = 500;
const SETTINGS_WINDOW_HEIGHT = 420;

let mainWindow: BrowserWindow | null = null;
let settingsWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let activeShortcut: string | null = null;
let fadeInterval: ReturnType<typeof setInterval> | null = null;

const stopFade = (): void => {
  if (fadeInterval !== null) {
    clearInterval(fadeInterval);
    fadeInterval = null;
  }
};

const createWindow = (): void => {
  mainWindow = new BrowserWindow({
    width: WINDOW_WIDTH,
    height: INPUT_WINDOW_HEIGHT,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    transparent: true,
    backgroundColor: '#00000000',
    show: false,
    center: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.setAlwaysOnTop(true, 'screen-saver');
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools({ mode: 'undocked' });
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }
};

const showAndFocus = (): void => {
  if (!mainWindow) return;
  const win = mainWindow;
  win.center();
  stopFade();

  if (process.platform === 'darwin') {
    app.focus({ steal: true });
  }

  try {
    win.setOpacity(0);
    win.show();
    win.focus();
    let opacity = 0;
    fadeInterval = setInterval(() => {
      opacity = Math.min(1, opacity + FADE_STEP);
      try {
        win.setOpacity(opacity);
      } catch (err) {
        console.error('[quick-prompt] setOpacity failed during fade:', err);
        stopFade();
        try {
          win.setOpacity(1);
        } catch {
          // ignore
        }
        return;
      }
      if (opacity >= 1) {
        stopFade();
      }
    }, FADE_INTERVAL_MS);
  } catch (err) {
    console.error('[quick-prompt] Show animation failed, falling back to direct show:', err);
    try {
      win.setOpacity(1);
    } catch {
      // ignore
    }
    if (!win.isVisible()) win.show();
    win.focus();
  }

  win.webContents.send('focus-input');
};

const toggleWindow = (): void => {
  if (!mainWindow) return;
  if (mainWindow.isVisible()) {
    stopFade();
    mainWindow.hide();
  } else {
    showAndFocus();
  }
};

const openSettings = (): void => {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    if (settingsWindow.isMinimized()) settingsWindow.restore();
    settingsWindow.focus();
    if (process.platform === 'darwin') app.focus({ steal: true });
    return;
  }

  settingsWindow = new BrowserWindow({
    width: SETTINGS_WINDOW_WIDTH,
    height: SETTINGS_WINDOW_HEIGHT,
    title: 'Quick Prompt Settings',
    frame: true,
    resizable: false,
    alwaysOnTop: true,
    modal: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    backgroundColor: '#1a1a1a',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload-settings.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  settingsWindow.setMenuBarVisibility(false);

  settingsWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  settingsWindow.once('ready-to-show', () => {
    settingsWindow?.show();
    if (process.platform === 'darwin') app.focus({ steal: true });
  });

  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });

  if (SETTINGS_WINDOW_VITE_DEV_SERVER_URL) {
    settingsWindow.loadURL(SETTINGS_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    settingsWindow.loadFile(
      path.join(__dirname, `../renderer/${SETTINGS_WINDOW_VITE_NAME}/settings.html`),
    );
  }
};

const closeSettings = (): void => {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.close();
  }
};

const broadcastSettingsUpdated = (next: SettingsSchema): void => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('settings-updated', next);
  }
};

const formatAccelerator = (accelerator: string): string => {
  if (process.platform !== 'darwin') return accelerator;
  return accelerator
    .replace(/CmdOrCtrl\+|Cmd\+|Command\+/g, '⌘')
    .replace(/Shift\+/g, '⇧')
    .replace(/Alt\+|Option\+/g, '⌥')
    .replace(/Ctrl\+|Control\+/g, '⌃');
};

const registerShortcuts = (): void => {
  const candidates = ['CmdOrCtrl+Shift+G', 'CmdOrCtrl+Shift+Space'];
  for (const acc of candidates) {
    if (globalShortcut.register(acc, toggleWindow)) {
      activeShortcut = acc;
      return;
    }
  }
  console.warn(
    '[quick-prompt] Failed to register a global shortcut. Toggle via the tray menu.',
  );
};

const applyDockVisibility = (visible: boolean): void => {
  if (process.platform !== 'darwin') return;
  if (visible) {
    void app.dock?.show();
  } else {
    app.dock?.hide();
  }
};

const toggleDockVisibility = (): void => {
  const next = !getShowInDock();
  setShowInDock(next);
  applyDockVisibility(next);
  refreshTrayMenu();
};

const getDialogParent = (): BrowserWindow | undefined => {
  if (settingsWindow && !settingsWindow.isDestroyed()) return settingsWindow;
  if (mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible()) return mainWindow;
  return undefined;
};

const getAppBundlePath = (): string =>
  path.resolve(app.getPath('exe'), '..', '..', '..');

const performUninstall = async (alsoRemoveSettings: boolean): Promise<void> => {
  const errors: string[] = [];

  if (alsoRemoveSettings) {
    try {
      await shell.trashItem(app.getPath('userData'));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`Settings: ${msg}`);
    }
  }

  if (app.isPackaged) {
    try {
      await shell.trashItem(getAppBundlePath());
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`App bundle: ${msg}`);
    }
  }

  if (errors.length > 0) {
    const parent = getDialogParent();
    const opts = {
      type: 'error' as const,
      title: 'Uninstall errors',
      message: 'The uninstall finished with errors:',
      detail: errors.join('\n\n'),
    };
    if (parent) {
      await dialog.showMessageBox(parent, opts);
    } else {
      await dialog.showMessageBox(opts);
    }
  }

  app.quit();
};

const confirmUninstall = async (): Promise<void> => {
  if (!app.isPackaged) {
    const parent = getDialogParent();
    const opts = {
      type: 'info' as const,
      title: 'Uninstall not available',
      message: 'Uninstall is only available in the packaged app.',
      detail: 'You are running from a development build (pnpm run start). Stop the dev process to clean up.',
    };
    if (parent) {
      await dialog.showMessageBox(parent, opts);
    } else {
      await dialog.showMessageBox(opts);
    }
    return;
  }

  const parent = getDialogParent();
  const opts = {
    type: 'warning' as const,
    buttons: ['Move to Bin & Quit', 'Cancel'],
    defaultId: 1,
    cancelId: 1,
    title: 'Uninstall Quick Prompt',
    message: 'Move "Quick Prompt.app" to the Bin and quit?',
    detail:
      'The app will be moved to the Bin. You can reinstall later from the DMG.',
    checkboxLabel:
      'Also remove saved settings (API key, system prompt, custom models)',
    checkboxChecked: false,
  };
  const result = parent
    ? await dialog.showMessageBox(parent, opts)
    : await dialog.showMessageBox(opts);
  if (result.response !== 0) return;
  await performUninstall(result.checkboxChecked);
};

const buildTrayMenuTemplate = (): Electron.MenuItemConstructorOptions[] => {
  const showHideLabel = activeShortcut
    ? `Show/Hide (${formatAccelerator(activeShortcut)})`
    : 'Show/Hide';
  const items: Electron.MenuItemConstructorOptions[] = [
    { label: showHideLabel, click: toggleWindow },
    { label: 'Settings…', accelerator: 'CmdOrCtrl+,', click: openSettings },
    { type: 'separator' },
  ];
  if (process.platform === 'darwin') {
    items.push({
      label: 'Show in Dock',
      type: 'checkbox',
      checked: getShowInDock(),
      click: toggleDockVisibility,
    });
  }
  if (app.isPackaged) {
    items.push({ label: 'Uninstall…', click: () => void confirmUninstall() });
  }
  items.push(
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  );
  return items;
};

const refreshTrayMenu = (): void => {
  if (!tray) return;
  tray.setContextMenu(Menu.buildFromTemplate(buildTrayMenuTemplate()));
};

const createTray = (): void => {
  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, 'assets', 'trayIconTemplate.png')
    : path.join(app.getAppPath(), 'assets', 'trayIconTemplate.png');
  tray = new Tray(nativeImage.createFromPath(iconPath));
  tray.setToolTip('quick-prompt');
  refreshTrayMenu();
};

interface CheckTextResponse {
  success: boolean;
  text?: string;
  error?: string;
}

interface AnthropicResponse {
  content?: { text?: string }[];
}

const checkText = async (text: string): Promise<CheckTextResponse> => {
  const apiKey = getApiKey();
  if (apiKey === '') {
    return {
      success: false,
      error: 'API key not configured. Open Settings (tray ▸ Settings… or ⌘,) to add it.',
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: getModel(),
        max_tokens: 4096,
        system: getSystemPrompt(),
        messages: [{ role: 'user', content: text }],
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      const detail = body ? `: ${body.slice(0, 300)}` : '';
      return {
        success: false,
        error: `Anthropic API request failed with status ${res.status}${detail}`,
      };
    }

    const json = (await res.json()) as AnthropicResponse;
    const result = json.content?.[0]?.text;
    if (typeof result !== 'string') {
      return {
        success: false,
        error: 'Unexpected response shape from Anthropic API',
      };
    }
    return { success: true, text: result };
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      return { success: false, error: 'Request timed out after 30 seconds' };
    }
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: `Request failed: ${msg}` };
  } finally {
    clearTimeout(timeout);
  }
};

// Overlay IPC
ipcMain.handle('check-text', async (_event, text: string) => checkText(text));
ipcMain.handle('is-api-key-missing', () => isApiKeyMissing());
ipcMain.handle('clipboard-read', () => clipboard.readText());
ipcMain.handle('get-model', () => getModel());

ipcMain.on('clipboard-write', (_event, text: string) => {
  clipboard.writeText(text);
});

ipcMain.on('hide-window', () => {
  if (!mainWindow) return;
  stopFade();
  mainWindow.hide();
  mainWindow.setSize(WINDOW_WIDTH, INPUT_WINDOW_HEIGHT);
});

ipcMain.on('resize-window', (_event, height: number) => {
  if (!mainWindow) return;
  mainWindow.setSize(WINDOW_WIDTH, Math.max(1, Math.round(height)));
  mainWindow.center();
});

ipcMain.on('open-settings', () => openSettings());

// Settings window IPC
ipcMain.handle('get-settings', (): SettingsSchema => getSettings());
ipcMain.handle('get-default-system-prompt', (): string => DEFAULT_SYSTEM_PROMPT);
ipcMain.handle('save-settings', (_event, data: Partial<SettingsSchema>) => {
  const current = getSettings();
  const next: SettingsSchema = {
    apiKey: typeof data.apiKey === 'string' ? data.apiKey : current.apiKey,
    systemPrompt:
      typeof data.systemPrompt === 'string' && data.systemPrompt.trim().length > 0
        ? data.systemPrompt
        : current.systemPrompt,
    model:
      typeof data.model === 'string' && data.model.trim().length > 0
        ? data.model
        : current.model,
    availableModels:
      Array.isArray(data.availableModels) && data.availableModels.length > 0
        ? data.availableModels.filter((m): m is string => typeof m === 'string' && m.length > 0)
        : current.availableModels.length > 0
          ? current.availableModels
          : [...DEFAULT_AVAILABLE_MODELS],
    showInDock:
      typeof data.showInDock === 'boolean' ? data.showInDock : current.showInDock,
  };
  saveSettings(next);
  broadcastSettingsUpdated(next);
  return { success: true };
});
ipcMain.on('close-settings', () => closeSettings());

app.on('ready', () => {
  applyDockVisibility(getShowInDock());
  createWindow();
  registerShortcuts();
  createTray();
});

app.on('activate', () => {
  if (mainWindow && !mainWindow.isVisible()) {
    showAndFocus();
  }
});

app.on('will-quit', () => {
  stopFade();
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
