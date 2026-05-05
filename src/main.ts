// Electron main process: window, tray, global shortcut, settings, and provider API IPC handlers.
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
  screen,
} from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import {
  DEFAULT_ANTHROPIC_AVAILABLE_MODELS,
  DEFAULT_OPENAI_AVAILABLE_MODELS,
  DEFAULT_SYSTEM_PROMPT,
  Provider,
  SettingsSchema,
  getActiveModel,
  getProvider,
  getSettings,
  getShowInDock,
  isProviderConfigured,
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
const SETTINGS_WINDOW_HEIGHT = 620;
const SETTINGS_WINDOW_MIN_WIDTH = 500;
const SETTINGS_WINDOW_MAX_WIDTH = 600;
const SETTINGS_WINDOW_MIN_HEIGHT = 400;

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

// Cursor-based display detection works across multiple monitors and through
// fullscreen Spaces — far more reliable than the focused-window heuristic.
const getActiveDisplay = (): Electron.Display => {
  const cursorPoint = screen.getCursorScreenPoint();
  return screen.getDisplayNearestPoint(cursorPoint);
};

// Position the overlay one-third from the top of the active display's work
// area (Spotlight-style) instead of dead center, so results have room to grow.
const centerOnActiveDisplay = (): void => {
  if (!mainWindow) return;
  const display = getActiveDisplay();
  const { width: screenWidth, height: screenHeight, x: screenX, y: screenY } =
    display.workArea;
  const [windowWidth, windowHeight] = mainWindow.getSize();
  const x = Math.round(screenX + (screenWidth - windowWidth) / 2);
  const y = Math.round(screenY + (screenHeight - windowHeight) / 3);
  mainWindow.setPosition(x, y);
};

const applyOverlayLevel = (): void => {
  if (!mainWindow) return;
  // 'screen-saver' is the highest standard level — required to float above
  // fullscreen Spaces on macOS. macOS sometimes resets these flags between
  // Space switches, so re-apply on every show.
  mainWindow.setAlwaysOnTop(true, 'screen-saver');
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
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
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  applyOverlayLevel();

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
  applyOverlayLevel();
  centerOnActiveDisplay();
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

const isSettingsWindowVisible = (): boolean =>
  !!settingsWindow && !settingsWindow.isDestroyed() && settingsWindow.isVisible();

const hideOverlay = (): void => {
  if (!mainWindow) return;
  stopFade();
  mainWindow.hide();
  mainWindow.setSize(WINDOW_WIDTH, INPUT_WINDOW_HEIGHT);
  if (process.platform === 'darwin' && !isSettingsWindowVisible()) {
    app.hide();
  }
};

// Like hideOverlay but never calls app.hide(), so the upcoming settings
// window stays visible. Use this when transferring focus to settings.
const hideOverlayWindowOnly = (): void => {
  if (!mainWindow) return;
  stopFade();
  if (mainWindow.isVisible()) {
    mainWindow.hide();
    mainWindow.setSize(WINDOW_WIDTH, INPUT_WINDOW_HEIGHT);
  }
};

const toggleWindow = (): void => {
  if (!mainWindow) return;
  if (mainWindow.isVisible()) {
    hideOverlay();
  } else {
    showAndFocus();
  }
};

const openSettings = (): void => {
  hideOverlayWindowOnly();

  if (settingsWindow && !settingsWindow.isDestroyed()) {
    if (settingsWindow.isMinimized()) settingsWindow.restore();
    settingsWindow.show();
    settingsWindow.moveTop();
    settingsWindow.focus();
    if (process.platform === 'darwin') app.focus({ steal: true });
    return;
  }

  settingsWindow = new BrowserWindow({
    width: SETTINGS_WINDOW_WIDTH,
    height: SETTINGS_WINDOW_HEIGHT,
    minWidth: SETTINGS_WINDOW_MIN_WIDTH,
    maxWidth: SETTINGS_WINDOW_MAX_WIDTH,
    minHeight: SETTINGS_WINDOW_MIN_HEIGHT,
    title: 'Quick Prompt Settings',
    frame: true,
    resizable: true,
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
    if (!settingsWindow) return;
    settingsWindow.show();
    settingsWindow.moveTop();
    settingsWindow.focus();
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

interface ApiResult {
  success: boolean;
  text?: string;
  error?: string;
}

interface AnthropicResponse {
  content?: { text?: string }[];
}

interface OpenAIChatResponse {
  choices?: { message?: { content?: string } }[];
}

const REQUEST_TIMEOUT_MS = 30000;

const stripTrailingSlash = (url: string): string => url.replace(/\/+$/, '');

const isConnectionRefused = (err: unknown): boolean => {
  if (!err || typeof err !== 'object') return false;
  const e = err as { code?: unknown; cause?: { code?: unknown } };
  return e.code === 'ECONNREFUSED' || e.cause?.code === 'ECONNREFUSED';
};

const callAnthropic = async (
  text: string,
  settings: SettingsSchema,
): Promise<ApiResult> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': settings.anthropicApiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: settings.anthropicModel,
        max_tokens: 4096,
        system: settings.systemPrompt,
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

const callOpenAI = async (
  text: string,
  settings: SettingsSchema,
): Promise<ApiResult> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${settings.openaiApiKey}`,
      },
      body: JSON.stringify({
        model: settings.openaiModel,
        messages: [
          { role: 'system', content: settings.systemPrompt },
          { role: 'user', content: text },
        ],
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      const detail = body ? `: ${body.slice(0, 300)}` : '';
      return {
        success: false,
        error: `OpenAI API request failed with status ${res.status}${detail}`,
      };
    }

    const json = (await res.json()) as OpenAIChatResponse;
    const result = json.choices?.[0]?.message?.content;
    if (typeof result !== 'string') {
      return {
        success: false,
        error: 'Unexpected response shape from OpenAI API',
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

const callLocal = async (
  text: string,
  settings: SettingsSchema,
): Promise<ApiResult> => {
  const endpoint = stripTrailingSlash(settings.localEndpoint);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${endpoint}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: settings.localModel,
        messages: [
          { role: 'system', content: settings.systemPrompt },
          { role: 'user', content: text },
        ],
        stream: false,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      const detail = body ? `: ${body.slice(0, 300)}` : '';
      return {
        success: false,
        error: `Local server request failed with status ${res.status}${detail}`,
      };
    }

    const json = (await res.json()) as OpenAIChatResponse;
    const result = json.choices?.[0]?.message?.content;
    if (typeof result !== 'string') {
      return {
        success: false,
        error: 'Unexpected response shape from local server',
      };
    }
    return { success: true, text: result };
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      return { success: false, error: 'Request timed out after 30 seconds' };
    }
    if (isConnectionRefused(err)) {
      return {
        success: false,
        error: `Cannot connect to local server at ${endpoint}. Make sure the server is running (e.g. apfel --serve, ollama serve, or LM Studio).`,
      };
    }
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: `Request failed: ${msg}` };
  } finally {
    clearTimeout(timeout);
  }
};

const checkText = async (text: string): Promise<ApiResult> => {
  if (!isProviderConfigured()) {
    return {
      success: false,
      error: 'Provider not configured. Open Settings (tray ▸ Settings… or ⌘,) to set it up.',
    };
  }

  const settings = getSettings();
  switch (settings.provider) {
    case 'anthropic':
      return callAnthropic(text, settings);
    case 'openai':
      return callOpenAI(text, settings);
    case 'local':
      return callLocal(text, settings);
    default:
      return { success: false, error: `Unknown provider: ${String(settings.provider)}` };
  }
};

interface TestConnectionParams {
  provider: Provider;
  apiKey?: string;
  endpoint?: string;
}

interface TestConnectionResult {
  success: boolean;
  message?: string;
  error?: string;
  models?: string[];
}

const TEST_TIMEOUT_MS = 5000;

interface OpenAIModelsResponse {
  data?: { id?: string }[];
}

const extractModelIds = (json: unknown): string[] => {
  if (!json || typeof json !== 'object') return [];
  const data = (json as OpenAIModelsResponse).data;
  if (!Array.isArray(data)) return [];
  return data
    .map((m) => (m && typeof m.id === 'string' ? m.id : null))
    .filter((id): id is string => id !== null);
};

const testAnthropic = async (apiKey: string): Promise<TestConnectionResult> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TEST_TIMEOUT_MS);
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'hi' }],
      }),
      signal: controller.signal,
    });
    if (res.status === 200) {
      return { success: true, message: 'API key valid' };
    }
    if (res.status === 401) {
      return { success: false, error: 'Invalid API key' };
    }
    const body = await res.text().catch(() => '');
    const detail = body ? `: ${body.slice(0, 300)}` : '';
    return { success: false, error: `Anthropic test failed with status ${res.status}${detail}` };
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      return { success: false, error: 'Request timed out after 5 seconds' };
    }
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  } finally {
    clearTimeout(timeout);
  }
};

const testOpenAI = async (apiKey: string): Promise<TestConnectionResult> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TEST_TIMEOUT_MS);
  try {
    const res = await fetch('https://api.openai.com/v1/models', {
      method: 'GET',
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: controller.signal,
    });
    if (res.status === 200) {
      const json = await res.json().catch(() => ({}));
      return { success: true, message: 'API key valid', models: extractModelIds(json) };
    }
    if (res.status === 401) {
      return { success: false, error: 'Invalid API key' };
    }
    const body = await res.text().catch(() => '');
    const detail = body ? `: ${body.slice(0, 300)}` : '';
    return { success: false, error: `OpenAI test failed with status ${res.status}${detail}` };
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      return { success: false, error: 'Request timed out after 5 seconds' };
    }
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  } finally {
    clearTimeout(timeout);
  }
};

const testLocal = async (rawEndpoint: string): Promise<TestConnectionResult> => {
  const endpoint = stripTrailingSlash(rawEndpoint);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${endpoint}/v1/models`, {
      method: 'GET',
      signal: controller.signal,
    });
    if (res.status === 200) {
      const json = await res.json().catch(() => ({}));
      return { success: true, message: 'Connected', models: extractModelIds(json) };
    }
    const body = await res.text().catch(() => '');
    const detail = body ? `: ${body.slice(0, 300)}` : '';
    return { success: false, error: `Local server returned status ${res.status}${detail}` };
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      return { success: false, error: 'Request timed out after 5 seconds' };
    }
    if (isConnectionRefused(err)) {
      return { success: false, error: `Cannot connect to ${endpoint}` };
    }
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  } finally {
    clearTimeout(timeout);
  }
};

const testConnection = async (
  params: TestConnectionParams,
): Promise<TestConnectionResult> => {
  switch (params.provider) {
    case 'anthropic':
      return testAnthropic(params.apiKey ?? '');
    case 'openai':
      return testOpenAI(params.apiKey ?? '');
    case 'local':
      return testLocal(params.endpoint ?? '');
    default:
      return { success: false, error: `Unknown provider: ${String(params.provider)}` };
  }
};

// Overlay IPC
ipcMain.handle('check-text', async (_event, text: string) => checkText(text));
ipcMain.handle('is-provider-configured', () => isProviderConfigured());
ipcMain.handle('clipboard-read', () => clipboard.readText());
ipcMain.handle('get-active-model', () => getActiveModel());
ipcMain.handle('get-provider', () => getProvider());
ipcMain.handle('get-app-version', () => app.getVersion());

ipcMain.on('clipboard-write', (_event, text: string) => {
  clipboard.writeText(text);
});

ipcMain.on('hide-window', () => {
  hideOverlay();
});

ipcMain.on('resize-window', (_event, height: number) => {
  if (!mainWindow) return;
  mainWindow.setSize(WINDOW_WIDTH, Math.max(1, Math.round(height)));
  centerOnActiveDisplay();
});

ipcMain.on('open-settings', () => openSettings());

// Settings window IPC
ipcMain.handle('get-settings', (): SettingsSchema => getSettings());
ipcMain.handle('get-default-system-prompt', (): string => DEFAULT_SYSTEM_PROMPT);
const isProvider = (value: unknown): value is Provider =>
  value === 'anthropic' || value === 'openai' || value === 'local';

const cleanModelList = (value: unknown): string[] | null => {
  if (!Array.isArray(value)) return null;
  const cleaned = value.filter((m): m is string => typeof m === 'string' && m.length > 0);
  return cleaned.length > 0 ? cleaned : null;
};

ipcMain.handle('save-settings', (_event, data: Partial<SettingsSchema>) => {
  const current = getSettings();
  const next: SettingsSchema = {
    provider: isProvider(data.provider) ? data.provider : current.provider,
    anthropicApiKey:
      typeof data.anthropicApiKey === 'string' ? data.anthropicApiKey : current.anthropicApiKey,
    anthropicModel:
      typeof data.anthropicModel === 'string' && data.anthropicModel.trim().length > 0
        ? data.anthropicModel
        : current.anthropicModel,
    anthropicAvailableModels:
      cleanModelList(data.anthropicAvailableModels) ??
      (current.anthropicAvailableModels.length > 0
        ? current.anthropicAvailableModels
        : [...DEFAULT_ANTHROPIC_AVAILABLE_MODELS]),
    openaiApiKey:
      typeof data.openaiApiKey === 'string' ? data.openaiApiKey : current.openaiApiKey,
    openaiModel:
      typeof data.openaiModel === 'string' && data.openaiModel.trim().length > 0
        ? data.openaiModel
        : current.openaiModel,
    openaiAvailableModels:
      cleanModelList(data.openaiAvailableModels) ??
      (current.openaiAvailableModels.length > 0
        ? current.openaiAvailableModels
        : [...DEFAULT_OPENAI_AVAILABLE_MODELS]),
    localEndpoint:
      typeof data.localEndpoint === 'string' && data.localEndpoint.trim().length > 0
        ? data.localEndpoint
        : current.localEndpoint,
    localModel:
      typeof data.localModel === 'string' && data.localModel.trim().length > 0
        ? data.localModel
        : current.localModel,
    systemPrompt:
      typeof data.systemPrompt === 'string' && data.systemPrompt.trim().length > 0
        ? data.systemPrompt
        : current.systemPrompt,
    showInDock:
      typeof data.showInDock === 'boolean' ? data.showInDock : current.showInDock,
  };
  saveSettings(next);
  broadcastSettingsUpdated(next);
  return { success: true };
});
ipcMain.handle('test-connection', async (_event, params: TestConnectionParams) =>
  testConnection(params),
);
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
