// Preload for the overlay window: exposes window.api via contextBridge.
import { contextBridge, ipcRenderer } from 'electron';

interface CheckTextResponse {
  success: boolean;
  text?: string;
  error?: string;
}

type Provider = 'anthropic' | 'openai' | 'local';

interface SettingsPayload {
  provider: Provider;
  anthropicApiKey: string;
  anthropicModel: string;
  anthropicAvailableModels: string[];
  openaiApiKey: string;
  openaiModel: string;
  openaiAvailableModels: string[];
  localEndpoint: string;
  localModel: string;
  systemPrompt: string;
  showInDock: boolean;
}

const api = {
  checkText: (text: string): Promise<CheckTextResponse> =>
    ipcRenderer.invoke('check-text', text),
  isProviderConfigured: (): Promise<boolean> =>
    ipcRenderer.invoke('is-provider-configured'),
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
  getActiveModel: (): Promise<string> => ipcRenderer.invoke('get-active-model'),
  getProvider: (): Promise<Provider> => ipcRenderer.invoke('get-provider'),
  getAppVersion: (): Promise<string> => ipcRenderer.invoke('get-app-version'),
  onSettingsUpdated: (callback: (settings: SettingsPayload) => void): void => {
    ipcRenderer.on('settings-updated', (_event, settings: SettingsPayload) => callback(settings));
  },
};

contextBridge.exposeInMainWorld('api', api);
