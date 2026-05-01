// Preload for the settings window: exposes window.settingsApi via contextBridge.
import { contextBridge, ipcRenderer } from 'electron';

interface Settings {
  apiKey: string;
  systemPrompt: string;
  model: string;
  availableModels: string[];
  showInDock: boolean;
}

interface SaveSettingsResult {
  success: boolean;
}

const settingsApi = {
  getSettings: (): Promise<Settings> => ipcRenderer.invoke('get-settings'),
  saveSettings: (data: Partial<Settings>): Promise<SaveSettingsResult> =>
    ipcRenderer.invoke('save-settings', data),
  getDefaultSystemPrompt: (): Promise<string> =>
    ipcRenderer.invoke('get-default-system-prompt'),
  closeSettings: (): void => {
    ipcRenderer.send('close-settings');
  },
};

contextBridge.exposeInMainWorld('settingsApi', settingsApi);
