// Preload for the settings window: exposes window.settingsApi via contextBridge.
import { contextBridge, ipcRenderer } from 'electron';

type Provider = 'anthropic' | 'openai' | 'local';

interface Settings {
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

interface SaveSettingsResult {
  success: boolean;
}

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

const settingsApi = {
  getSettings: (): Promise<Settings> => ipcRenderer.invoke('get-settings'),
  saveSettings: (data: Partial<Settings>): Promise<SaveSettingsResult> =>
    ipcRenderer.invoke('save-settings', data),
  getDefaultSystemPrompt: (): Promise<string> =>
    ipcRenderer.invoke('get-default-system-prompt'),
  testConnection: (params: TestConnectionParams): Promise<TestConnectionResult> =>
    ipcRenderer.invoke('test-connection', params),
  closeSettings: (): void => {
    ipcRenderer.send('close-settings');
  },
};

contextBridge.exposeInMainWorld('settingsApi', settingsApi);
