// Persistent settings: API key, system prompt, model, available-model list, and dock visibility.
import Store from 'electron-store';

export const DEFAULT_SYSTEM_PROMPT =
  'You are a writing assistant. Check and correct the following text for grammar, spelling, punctuation, and clarity. Return ONLY the corrected text. No explanations, no preamble, no quotes around the text.';

export const DEFAULT_MODEL = 'claude-sonnet-4-20250514';

export const DEFAULT_AVAILABLE_MODELS: string[] = [
  'claude-sonnet-4-20250514',
  'claude-opus-4-20250514',
  'claude-haiku-4-5-20251001',
  'claude-sonnet-4-5-20250514',
];

export interface SettingsSchema {
  apiKey: string;
  systemPrompt: string;
  model: string;
  availableModels: string[];
  showInDock: boolean;
}

const store = new Store<SettingsSchema>({
  name: 'config',
  defaults: {
    apiKey: '',
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
    model: DEFAULT_MODEL,
    availableModels: [...DEFAULT_AVAILABLE_MODELS],
    showInDock: false,
  },
});

export const getSettings = (): SettingsSchema => ({
  apiKey: store.get('apiKey'),
  systemPrompt: store.get('systemPrompt'),
  model: store.get('model'),
  availableModels: store.get('availableModels'),
  showInDock: store.get('showInDock'),
});

export const saveSettings = (data: SettingsSchema): void => {
  store.set('apiKey', data.apiKey);
  store.set('systemPrompt', data.systemPrompt);
  store.set('model', data.model);
  store.set('availableModels', data.availableModels);
  store.set('showInDock', data.showInDock);
};

export const isApiKeyMissing = (): boolean => store.get('apiKey') === '';

export const getApiKey = (): string => store.get('apiKey');

export const getSystemPrompt = (): string => store.get('systemPrompt');

export const getModel = (): string => store.get('model');

export const getShowInDock = (): boolean => store.get('showInDock');

export const setShowInDock = (value: boolean): void => store.set('showInDock', value);
