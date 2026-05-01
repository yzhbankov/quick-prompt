// Type declarations for window.api (overlay) and window.settingsApi (settings window).
export {};

interface CheckTextResponse {
  success: boolean;
  text?: string;
  error?: string;
}

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

interface QuickPromptApi {
  checkText: (text: string) => Promise<CheckTextResponse>;
  isApiKeyMissing: () => Promise<boolean>;
  hideWindow: () => void;
  copyToClipboard: (text: string) => void;
  getClipboardText: () => Promise<string>;
  onFocusInput: (callback: () => void) => void;
  resizeWindow: (height: number) => void;
  openSettings: () => void;
  getModel: () => Promise<string>;
  onSettingsUpdated: (callback: (settings: Settings) => void) => void;
}

interface QuickPromptSettingsApi {
  getSettings: () => Promise<Settings>;
  saveSettings: (data: Partial<Settings>) => Promise<SaveSettingsResult>;
  getDefaultSystemPrompt: () => Promise<string>;
  closeSettings: () => void;
}

declare global {
  interface Window {
    api: QuickPromptApi;
    settingsApi: QuickPromptSettingsApi;
  }

  // Forge Vite plugin globals (one set per renderer entry name in forge.config.ts).
  const SETTINGS_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
  const SETTINGS_WINDOW_VITE_NAME: string;
}
