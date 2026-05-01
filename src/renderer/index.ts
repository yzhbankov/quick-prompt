// Renderer entry: state machine for the input/loading/result overlay UI.
import './styles.css';

type UiState = 'input' | 'loading' | 'result';

interface SettingsPayload {
  apiKey: string;
  systemPrompt: string;
  model: string;
  availableModels: string[];
}

const DEFAULT_PLACEHOLDER = 'Type or paste text...';
const MISSING_KEY_PLACEHOLDER = '⚠ API key not set. Press ⌘, for Settings';
const HINT_INPUT = '↵ Check · esc Dismiss';
const HINT_LOADING = 'Waiting for response...';
const HINT_RESULT = '↵ New · esc Dismiss';
const INPUT_WINDOW_HEIGHT = 100;
const MIN_WINDOW_HEIGHT = 100;
const MAX_WINDOW_HEIGHT = 500;
const RESIZE_PAD = 40;
const STATUS_CLEAR_DELAY_MS = 2000;

let uiState: UiState = 'input';
let originalText = '';
let statusClearTimer: number | null = null;
let apiKeyMissing = false;

let input: HTMLInputElement;
let resultEl: HTMLDivElement;
let statusEl: HTMLDivElement;
let hintEl: HTMLDivElement;
let modelLabel: HTMLDivElement;
let wrapper: HTMLElement;

const formatModelName = (model: string): string => {
  const match = /^claude-([a-z]+)-(\d+(?:-\d+)*)-\d{8}$/.exec(model);
  if (!match) return model;
  const [, family, version] = match;
  return `${family} ${version.replace(/-/g, '.')}`;
};

const setModelLabel = (model: string): void => {
  modelLabel.textContent = formatModelName(model);
};

const clearStatusTimer = (): void => {
  if (statusClearTimer !== null) {
    clearTimeout(statusClearTimer);
    statusClearTimer = null;
  }
};

const applyKeyState = (): void => {
  if (uiState !== 'input') return;
  if (apiKeyMissing) {
    input.disabled = true;
    input.placeholder = MISSING_KEY_PLACEHOLDER;
  } else if (input.disabled) {
    input.disabled = false;
    input.placeholder = DEFAULT_PLACEHOLDER;
  }
};

const resetDom = (): void => {
  uiState = 'input';
  clearStatusTimer();
  originalText = '';
  input.value = '';
  input.disabled = apiKeyMissing;
  input.placeholder = apiKeyMissing ? MISSING_KEY_PLACEHOLDER : DEFAULT_PLACEHOLDER;
  resultEl.hidden = true;
  resultEl.textContent = '';
  resultEl.classList.remove('error');
  statusEl.hidden = true;
  statusEl.textContent = '';
  hintEl.textContent = HINT_INPUT;
};

const goInput = (): void => {
  resetDom();
  window.api.resizeWindow(INPUT_WINDOW_HEIGHT);
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
  if (apiKeyMissing) return;
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
  if (uiState === 'result') resetDom();
  window.api.hideWindow();
};

const handleFocusInput = async (): Promise<void> => {
  input.focus();

  apiKeyMissing = await window.api.isApiKeyMissing();
  applyKeyState();
  if (apiKeyMissing) {
    input.value = '';
    return;
  }

  if (uiState === 'input' && input.value === '') {
    try {
      const clip = await window.api.getClipboardText();
      if (clip.trim().length > 0) {
        input.value = clip;
      }
    } catch (err: unknown) {
      console.error('[quick-prompt] Failed to read clipboard:', err);
    }
  }
  input.select();
};

window.addEventListener('DOMContentLoaded', async () => {
  input = document.getElementById('prompt-input') as HTMLInputElement;
  resultEl = document.getElementById('result') as HTMLDivElement;
  statusEl = document.getElementById('status') as HTMLDivElement;
  hintEl = document.getElementById('hint') as HTMLDivElement;
  modelLabel = document.getElementById('model-label') as HTMLDivElement;
  wrapper = document.querySelector('.container') as HTMLElement;

  input.focus();

  window.api.onFocusInput(() => {
    void handleFocusInput();
  });

  window.api.onSettingsUpdated((settings: SettingsPayload) => {
    apiKeyMissing = !settings || settings.apiKey === '';
    applyKeyState();
    if (settings && typeof settings.model === 'string') {
      setModelLabel(settings.model);
    }
  });

  apiKeyMissing = await window.api.isApiKeyMissing();
  applyKeyState();

  try {
    const initialModel = await window.api.getModel();
    setModelLabel(initialModel);
  } catch (err: unknown) {
    console.error('[quick-prompt] Failed to read initial model:', err);
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
    if (apiKeyMissing) {
      window.api.hideWindow();
    } else {
      onEscape();
    }
    return;
  }
  if (e.key === 'Enter') {
    e.preventDefault();
    void onEnter();
  }
});
