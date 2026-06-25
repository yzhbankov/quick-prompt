// Renderer entry: state machine for the input/loading/result overlay UI.
import './styles.css';

type UiState = 'input' | 'loading' | 'result';
type Provider = 'anthropic' | 'openai' | 'local';

interface SettingsPayload {
  provider: Provider;
  anthropicApiKey: string;
  anthropicModel: string;
  openaiApiKey: string;
  openaiModel: string;
  localEndpoint: string;
  localModel: string;
  systemPrompt: string;
  showInDock: boolean;
}

const DEFAULT_PLACEHOLDER = 'Type or paste text...';
const HINT_INPUT = '↵ Check · esc Dismiss · ⌘, Settings';
const HINT_LOADING = 'Waiting for response...';
const HINT_RESULT = '↵ New · esc Dismiss · ⌘, Settings';
const INPUT_WINDOW_HEIGHT = 100;
const MIN_WINDOW_HEIGHT = 100;
const MAX_WINDOW_HEIGHT = 500;
const RESIZE_PAD = 40;
const STATUS_CLEAR_DELAY_MS = 2000;

let uiState: UiState = 'input';
let originalText = '';
let statusClearTimer: number | null = null;
let providerConfigured = false;
let currentProvider: Provider = 'anthropic';

let input: HTMLInputElement;
let resultEl: HTMLDivElement;
let statusEl: HTMLDivElement;
let hintEl: HTMLDivElement;
let modelLabel: HTMLDivElement;
let versionLabel: HTMLDivElement;
let wrapper: HTMLElement;

const missingPlaceholderFor = (provider: Provider): string => {
  if (provider === 'openai') return '⚠ OpenAI API key not set. Press ⌘, for Settings';
  return '⚠ Anthropic API key not set. Press ⌘, for Settings';
};

const formatModelName = (model: string, provider: Provider): string => {
  if (provider === 'local') return `${model} · local`;
  if (provider === 'openai') return model;
  const match = /^claude-([a-z]+)-(\d+(?:-\d+)*)-\d{8}$/.exec(model);
  if (!match) return model;
  const [, family, version] = match;
  return `${family} ${version.replace(/-/g, '.')}`;
};

const setModelLabel = (model: string, provider: Provider): void => {
  modelLabel.textContent = formatModelName(model, provider);
};

const clearStatusTimer = (): void => {
  if (statusClearTimer !== null) {
    clearTimeout(statusClearTimer);
    statusClearTimer = null;
  }
};

// Local provider is always considered enabled in the overlay.
const isInputDisabled = (): boolean =>
  currentProvider !== 'local' && !providerConfigured;

const placeholderForCurrentState = (): string =>
  isInputDisabled() ? missingPlaceholderFor(currentProvider) : DEFAULT_PLACEHOLDER;

const applyKeyState = (): void => {
  if (uiState !== 'input') return;
  const disabled = isInputDisabled();
  input.disabled = disabled;
  input.placeholder = disabled ? missingPlaceholderFor(currentProvider) : DEFAULT_PLACEHOLDER;
};

const resetToInputState = (): void => {
  uiState = 'input';
  clearStatusTimer();
  originalText = '';
  input.value = '';
  input.disabled = isInputDisabled();
  input.placeholder = placeholderForCurrentState();
  resultEl.hidden = true;
  resultEl.textContent = '';
  resultEl.classList.remove('error');
  statusEl.hidden = true;
  statusEl.textContent = '';
  hintEl.textContent = HINT_INPUT;
  window.api.resizeWindow(INPUT_WINDOW_HEIGHT);
};

const goInput = (): void => {
  resetToInputState();
  input.focus();
};

const goLoading = (): void => {
  uiState = 'loading';
  originalText = input.value;
  input.disabled = true;
  input.placeholder = 'Thinking...';
  hintEl.textContent = HINT_LOADING;
};

const resizeToContent = (): void => {
  const desired = Math.max(
    MIN_WINDOW_HEIGHT,
    Math.min(MAX_WINDOW_HEIGHT, wrapper.scrollHeight + RESIZE_PAD),
  );
  window.api.resizeWindow(desired);
};

const goResult = (response: {
  success: boolean;
  text?: string;
  error?: string;
}): void => {
  uiState = 'result';
  input.value = originalText;
  input.disabled = true;
  input.placeholder = DEFAULT_PLACEHOLDER;
  hintEl.textContent = HINT_RESULT;

  if (response.success && typeof response.text === 'string') {
    resultEl.textContent = response.text;
    resultEl.classList.remove('error');
    resultEl.hidden = false;
    window.api.copyToClipboard(response.text);
    statusEl.textContent = '✓ Copied to clipboard';
    statusEl.hidden = false;
    clearStatusTimer();
    statusClearTimer = window.setTimeout(() => {
      statusEl.textContent = '';
      statusClearTimer = null;
    }, STATUS_CLEAR_DELAY_MS);
  } else {
    resultEl.textContent = response.error ?? 'Unknown error';
    resultEl.classList.add('error');
    resultEl.hidden = false;
    statusEl.hidden = true;
    statusEl.textContent = '';
  }

  requestAnimationFrame(() => resizeToContent());
};

const onEnter = async (): Promise<void> => {
  if (uiState === 'loading') return;
  if (uiState === 'result') {
    goInput();
    return;
  }
  if (isInputDisabled()) return;
  const value = input.value.trim();
  if (!value) return;
  goLoading();
  try {
    const result = await window.api.checkText(value);
    goResult(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    goResult({ success: false, error: msg });
  }
};

const onEscape = (): void => {
  if (uiState === 'loading') return;
  resetToInputState();
  window.api.hideWindow();
};

const refreshConfiguredState = async (): Promise<void> => {
  providerConfigured = await window.api.isProviderConfigured();
  applyKeyState();
};

const handleFocusInput = async (): Promise<void> => {
  resetToInputState();

  await refreshConfiguredState();
  if (isInputDisabled()) {
    input.focus();
    return;
  }

  try {
    const clip = await window.api.getClipboardText();
    if (clip.trim().length > 0) {
      input.value = clip;
    }
  } catch (err: unknown) {
    console.error('[quick-prompt] Failed to read clipboard:', err);
  }
  input.focus();
  input.select();
};

const activeModelFromSettings = (settings: SettingsPayload): string => {
  if (settings.provider === 'openai') return settings.openaiModel;
  if (settings.provider === 'local') return settings.localModel;
  return settings.anthropicModel;
};

const isProviderConfiguredFromSettings = (settings: SettingsPayload): boolean => {
  if (settings.provider === 'local') return settings.localEndpoint.trim().length > 0;
  if (settings.provider === 'openai') return settings.openaiApiKey.length > 0;
  return settings.anthropicApiKey.length > 0;
};

window.addEventListener('DOMContentLoaded', async () => {
  input = document.getElementById('prompt-input') as HTMLInputElement;
  resultEl = document.getElementById('result') as HTMLDivElement;
  statusEl = document.getElementById('status') as HTMLDivElement;
  hintEl = document.getElementById('hint') as HTMLDivElement;
  modelLabel = document.getElementById('model-label') as HTMLDivElement;
  versionLabel = document.getElementById('version-label') as HTMLDivElement;
  wrapper = document.querySelector('.container') as HTMLElement;

  input.focus();

  window.api.onFocusInput(() => {
    void handleFocusInput();
  });

  window.api.onSettingsUpdated((settings: SettingsPayload) => {
    if (!settings) return;
    currentProvider = settings.provider;
    providerConfigured = isProviderConfiguredFromSettings(settings);
    applyKeyState();
    setModelLabel(activeModelFromSettings(settings), settings.provider);
  });

  try {
    currentProvider = await window.api.getProvider();
  } catch (err: unknown) {
    console.error('[quick-prompt] Failed to read initial provider:', err);
  }
  await refreshConfiguredState();

  try {
    const initialModel = await window.api.getActiveModel();
    setModelLabel(initialModel, currentProvider);
  } catch (err: unknown) {
    console.error('[quick-prompt] Failed to read initial model:', err);
  }

  try {
    const version = await window.api.getAppVersion();
    versionLabel.textContent = `v${version}`;
  } catch (err: unknown) {
    console.error('[quick-prompt] Failed to read app version:', err);
  }
});

document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === ',') {
    e.preventDefault();
    window.api.openSettings();
    return;
  }
  if (e.key === 'Escape') {
    e.preventDefault();
    onEscape();
    return;
  }
  if (e.key === 'Enter') {
    e.preventDefault();
    void onEnter();
  }
});
