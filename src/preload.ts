// Preload for the overlay window: exposes window.api via contextBridge.
import { contextBridge, ipcRenderer } from 'electron';

interface CheckTextResponse {
  success: boolean;
  text?: string;
  error?: string;
}

interface SettingsPayload {
  apiKey: string;
  systemPrompt: string;
  model: string;
  availableModels: string[];
  showInDock: boolean;
}

const api = {
  checkText: (text: string): Promise<CheckTextResponse> =>
    ipcRenderer.invoke('check-text', text),
  isApiKeyMissing: (): Promise<boolean> =>
    ipcRenderer.invoke('is-api-key-missing'),
  hideWindow: (): void => {
    ipcRenderer.send('hide-window');
  },
  copyToClipboard: (text: string): void => {
    ipcRenderer.send('clipboard-write', text);
  },
  getClipboardText: (): Promise<string> =>
    ipcRenderer.invoke('clipboard-read'),
  onFocusInput: (callback: () => void): void => {
    ipcRenderer.on('focus-input', () => callback());
  },
  resizeWindow: (height: number): void => {
    ipcRenderer.send('resize-window', height);
  },
  openSettings: (): void => {
    ipcRenderer.send('open-settings');
  },
  getModel: (): Promise<string> => ipcRenderer.invoke('get-model'),
  onSettingsUpdated: (callback: (settings: SettingsPayload) => void): void => {
    ipcRenderer.on('settings-updated', (_event, settings: SettingsPayload) => callback(settings));
  },
};

contextBridge.exposeInMainWorld('api', api);
