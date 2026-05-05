// Persistent settings: provider, per-provider API keys/models, system prompt, and dock visibility.
import Store from 'electron-store';

export type Provider = 'anthropic' | 'openai' | 'local';

export const DEFAULT_SYSTEM_PROMPT =
  'You are a writing assistant. Check and correct the following text for grammar, spelling, punctuation, and clarity. Return ONLY the corrected text. No explanations, no preamble, no quotes around the text.';

export const DEFAULT_PROVIDER: Provider = 'anthropic';

export const DEFAULT_ANTHROPIC_MODEL = 'claude-sonnet-4-20250514';
export const DEFAULT_ANTHROPIC_AVAILABLE_MODELS: string[] = [
  'claude-sonnet-4-20250514',
  'claude-opus-4-20250514',
  'claude-haiku-4-5-20251001',
  'claude-sonnet-4-5-20250514',
];

export const DEFAULT_OPENAI_MODEL = 'gpt-4o';
export const DEFAULT_OPENAI_AVAILABLE_MODELS: string[] = [
  'gpt-4o',
  'gpt-4o-mini',
  'gpt-4.1',
  'gpt-4.1-mini',
  'gpt-4.1-nano',
  'o3-mini',
];

export const DEFAULT_LOCAL_ENDPOINT = 'http://127.0.0.1:11434';
export const DEFAULT_LOCAL_MODEL = 'apple-foundationmodel';

export interface SettingsSchema {
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

const store = new Store<SettingsSchema>({
  name: 'config',
  defaults: {
    provider: DEFAULT_PROVIDER,
    anthropicApiKey: '',
    anthropicModel: DEFAULT_ANTHROPIC_MODEL,
    anthropicAvailableModels: [...DEFAULT_ANTHROPIC_AVAILABLE_MODELS],
    openaiApiKey: '',
    openaiModel: DEFAULT_OPENAI_MODEL,
    openaiAvailableModels: [...DEFAULT_OPENAI_AVAILABLE_MODELS],
    localEndpoint: DEFAULT_LOCAL_ENDPOINT,
    localModel: DEFAULT_LOCAL_MODEL,
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
    showInDock: false,
  },
});

// One-shot migration: legacy flat keys (apiKey/model/availableModels) → anthropic-prefixed keys.
// Subsequent loads see only the new keys and skip this block.
{
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const legacy = store as unknown as Store<any>;
  const hasLegacy =
    legacy.has('apiKey') || legacy.has('model') || legacy.has('availableModels');
  if (hasLegacy) {
    const oldApiKey = legacy.get('apiKey');
    const oldModel = legacy.get('model');
    const oldAvailable = legacy.get('availableModels');

    if (typeof oldApiKey === 'string') {
      store.set('anthropicApiKey', oldApiKey);
    }
    if (typeof oldModel === 'string' && oldModel.trim().length > 0) {
      store.set('anthropicModel', oldModel);
    }
    if (Array.isArray(oldAvailable) && oldAvailable.length > 0) {
      const cleaned = oldAvailable.filter(
        (m): m is string => typeof m === 'string' && m.length > 0,
      );
      if (cleaned.length > 0) {
        store.set('anthropicAvailableModels', cleaned);
      }
    }
    store.set('provider', 'anthropic');

    legacy.delete('apiKey');
    legacy.delete('model');
    legacy.delete('availableModels');
  }
}

export const getSettings = (): SettingsSchema => ({
  provider: store.get('provider'),
  anthropicApiKey: store.get('anthropicApiKey'),
  anthropicModel: store.get('anthropicModel'),
  anthropicAvailableModels: store.get('anthropicAvailableModels'),
  openaiApiKey: store.get('openaiApiKey'),
  openaiModel: store.get('openaiModel'),
  openaiAvailableModels: store.get('openaiAvailableModels'),
  localEndpoint: store.get('localEndpoint'),
  localModel: store.get('localModel'),
  systemPrompt: store.get('systemPrompt'),
  showInDock: store.get('showInDock'),
});

export const saveSettings = (data: SettingsSchema): void => {
  store.set('provider', data.provider);
  store.set('anthropicApiKey', data.anthropicApiKey);
  store.set('anthropicModel', data.anthropicModel);
  store.set('anthropicAvailableModels', data.anthropicAvailableModels);
  store.set('openaiApiKey', data.openaiApiKey);
  store.set('openaiModel', data.openaiModel);
  store.set('openaiAvailableModels', data.openaiAvailableModels);
  store.set('localEndpoint', data.localEndpoint);
  store.set('localModel', data.localModel);
  store.set('systemPrompt', data.systemPrompt);
  store.set('showInDock', data.showInDock);
};

export const getProvider = (): Provider => store.get('provider');

export const getSystemPrompt = (): string => store.get('systemPrompt');

export const getActiveModel = (): string => {
  const provider = store.get('provider');
  if (provider === 'openai') return store.get('openaiModel');
  if (provider === 'local') return store.get('localModel');
  return store.get('anthropicModel');
};

export const getActiveApiKey = (): string => {
  const provider = store.get('provider');
  if (provider === 'openai') return store.get('openaiApiKey');
  if (provider === 'local') return '';
  return store.get('anthropicApiKey');
};

export const isProviderConfigured = (): boolean => {
  const provider = store.get('provider');
  if (provider === 'local') return store.get('localEndpoint').trim().length > 0;
  if (provider === 'openai') return store.get('openaiApiKey').length > 0;
  return store.get('anthropicApiKey').length > 0;
};

export const getShowInDock = (): boolean => store.get('showInDock');

export const setShowInDock = (value: boolean): void => store.set('showInDock', value);
