// Type declarations for window.api (overlay) and window.settingsApi (settings window).
export {};

interface CheckTextResponse {
  success: boolean;
  text?: string;
  error?: string;
}

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

interface QuickPromptApi {
  checkText: (text: string) => Promise<CheckTextResponse>;
  isProviderConfigured: () => Promise<boolean>;
  hideWindow: () => void;
  copyToClipboard: (text: string) => void;
  getClipboardText: () => Promise<string>;
  onFocusInput: (callback: () => void) => void;
  resizeWindow: (height: number) => void;
  openSettings: () => void;
  getActiveModel: () => Promise<string>;
  getProvider: () => Promise<Provider>;
  getAppVersion: () => Promise<string>;
  onSettingsUpdated: (callback: (settings: Settings) => void) => void;
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

interface QuickPromptSettingsApi {
  getSettings: () => Promise<Settings>;
  saveSettings: (data: Partial<Settings>) => Promise<SaveSettingsResult>;
  getDefaultSystemPrompt: () => Promise<string>;
  testConnection: (params: TestConnectionParams) => Promise<TestConnectionResult>;
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
