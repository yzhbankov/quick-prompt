// Settings window renderer: provider tabs + per-provider config + system prompt.
import './settings.css';

type Provider = 'anthropic' | 'openai' | 'local';

interface ProviderControls {
  apiKeyInput: HTMLInputElement;
  revealBtn: HTMLButtonElement;
  modelSelect: HTMLSelectElement;
  customModelInput: HTMLInputElement;
  addModelBtn: HTMLButtonElement;
  testBtn: HTMLButtonElement;
  testResult: HTMLSpanElement;
}

interface LocalControls {
  endpointInput: HTMLInputElement;
  modelInput: HTMLInputElement;
  testBtn: HTMLButtonElement;
  testResult: HTMLSpanElement;
}

const $ = <T extends HTMLElement>(id: string): T =>
  document.getElementById(id) as T;

const tabs = Array.from(
  document.querySelectorAll<HTMLButtonElement>('.provider-tab'),
);
const sections = Array.from(
  document.querySelectorAll<HTMLElement>('.provider-section'),
);

const anthropic: ProviderControls = {
  apiKeyInput: $('anthropic-api-key'),
  revealBtn: $('anthropic-reveal-btn'),
  modelSelect: $('anthropic-model-select'),
  customModelInput: $('anthropic-custom-model'),
  addModelBtn: $('anthropic-add-model-btn'),
  testBtn: $('anthropic-test-btn'),
  testResult: $('anthropic-test-result'),
};

const openai: ProviderControls = {
  apiKeyInput: $('openai-api-key'),
  revealBtn: $('openai-reveal-btn'),
  modelSelect: $('openai-model-select'),
  customModelInput: $('openai-custom-model'),
  addModelBtn: $('openai-add-model-btn'),
  testBtn: $('openai-test-btn'),
  testResult: $('openai-test-result'),
};

const local: LocalControls = {
  endpointInput: $('local-endpoint'),
  modelInput: $('local-model'),
  testBtn: $('local-test-btn'),
  testResult: $('local-test-result'),
};

const promptTextarea = $<HTMLTextAreaElement>('system-prompt');
const saveBtn = $<HTMLButtonElement>('save-btn');
const cancelBtn = $<HTMLButtonElement>('cancel-btn');
const resetBtn = $<HTMLButtonElement>('reset-btn');
const statusEl = $<HTMLSpanElement>('status');

let activeProvider: Provider = 'anthropic';
let anthropicAvailableModels: string[] = [];
let openaiAvailableModels: string[] = [];
let statusTimer: number | null = null;

const showStatus = (msg: string, kind: 'success' | 'error' | '' = ''): void => {
  if (statusTimer !== null) {
    clearTimeout(statusTimer);
    statusTimer = null;
  }
  statusEl.textContent = msg;
  statusEl.className = kind;
};

const setTestResult = (
  el: HTMLSpanElement,
  msg: string,
  kind: 'success' | 'error' | '' = '',
): void => {
  el.textContent = msg;
  el.className = kind ? `test-result ${kind}` : 'test-result';
};

const populateModelDropdown = (
  select: HTMLSelectElement,
  models: string[],
  selected: string,
): void => {
  select.innerHTML = '';
  for (const model of models) {
    const opt = document.createElement('option');
    opt.value = model;
    opt.textContent = model;
    if (model === selected) opt.selected = true;
    select.appendChild(opt);
  }
};

const setActiveProvider = (provider: Provider): void => {
  activeProvider = provider;
  for (const tab of tabs) {
    const isActive = tab.dataset.provider === provider;
    tab.classList.toggle('active', isActive);
    tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
  }
  for (const section of sections) {
    section.classList.toggle('hidden', section.dataset.provider !== provider);
  }
};

const load = async (): Promise<void> => {
  try {
    const settings = await window.settingsApi.getSettings();

    anthropic.apiKeyInput.value = settings.anthropicApiKey;
    anthropicAvailableModels = [...settings.anthropicAvailableModels];
    if (
      settings.anthropicModel &&
      !anthropicAvailableModels.includes(settings.anthropicModel)
    ) {
      anthropicAvailableModels.push(settings.anthropicModel);
    }
    populateModelDropdown(
      anthropic.modelSelect,
      anthropicAvailableModels,
      settings.anthropicModel,
    );

    openai.apiKeyInput.value = settings.openaiApiKey;
    openaiAvailableModels = [...settings.openaiAvailableModels];
    if (
      settings.openaiModel &&
      !openaiAvailableModels.includes(settings.openaiModel)
    ) {
      openaiAvailableModels.push(settings.openaiModel);
    }
    populateModelDropdown(
      openai.modelSelect,
      openaiAvailableModels,
      settings.openaiModel,
    );

    local.endpointInput.value = settings.localEndpoint;
    local.modelInput.value = settings.localModel;

    promptTextarea.value = settings.systemPrompt;

    setActiveProvider(settings.provider);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    showStatus(`Failed to load: ${msg}`, 'error');
  }
};

const addCustomModel = (
  controls: ProviderControls,
  registry: 'anthropic' | 'openai',
): void => {
  const value = controls.customModelInput.value.trim();
  if (value === '') return;
  const list =
    registry === 'anthropic' ? anthropicAvailableModels : openaiAvailableModels;
  if (list.includes(value)) {
    showStatus(`"${value}" is already in the list.`, 'error');
    return;
  }
  const next = [...list, value];
  if (registry === 'anthropic') {
    anthropicAvailableModels = next;
  } else {
    openaiAvailableModels = next;
  }
  populateModelDropdown(controls.modelSelect, next, value);
  controls.customModelInput.value = '';
  showStatus('');
};

const mergeOpenAIModelsFromTest = (models: string[] | undefined): void => {
  if (!Array.isArray(models) || models.length === 0) return;
  const set = new Set(openaiAvailableModels);
  let changed = false;
  for (const id of models) {
    if (!set.has(id)) {
      set.add(id);
      changed = true;
    }
  }
  if (!changed) return;
  openaiAvailableModels = [...set];
  populateModelDropdown(
    openai.modelSelect,
    openaiAvailableModels,
    openai.modelSelect.value,
  );
};

const setTestPending = (
  controls: { testBtn: HTMLButtonElement; testResult: HTMLSpanElement },
): void => {
  controls.testBtn.disabled = true;
  setTestResult(controls.testResult, 'Testing…', '');
};

const clearTestPending = (controls: { testBtn: HTMLButtonElement }): void => {
  controls.testBtn.disabled = false;
};

const testAnthropic = async (): Promise<void> => {
  const apiKey = anthropic.apiKeyInput.value.trim();
  if (apiKey === '') {
    setTestResult(anthropic.testResult, '✗ Enter an API key first', 'error');
    return;
  }
  setTestPending(anthropic);
  try {
    const result = await window.settingsApi.testConnection({
      provider: 'anthropic',
      apiKey,
    });
    if (result.success) {
      setTestResult(
        anthropic.testResult,
        `✓ ${result.message ?? 'API key valid'}`,
        'success',
      );
    } else {
      setTestResult(anthropic.testResult, `✗ ${result.error ?? 'Failed'}`, 'error');
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    setTestResult(anthropic.testResult, `✗ ${msg}`, 'error');
  } finally {
    clearTestPending(anthropic);
  }
};

const testOpenAI = async (): Promise<void> => {
  const apiKey = openai.apiKeyInput.value.trim();
  if (apiKey === '') {
    setTestResult(openai.testResult, '✗ Enter an API key first', 'error');
    return;
  }
  setTestPending(openai);
  try {
    const result = await window.settingsApi.testConnection({
      provider: 'openai',
      apiKey,
    });
    if (result.success) {
      mergeOpenAIModelsFromTest(result.models);
      setTestResult(
        openai.testResult,
        `✓ ${result.message ?? 'API key valid'}`,
        'success',
      );
    } else {
      setTestResult(openai.testResult, `✗ ${result.error ?? 'Failed'}`, 'error');
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    setTestResult(openai.testResult, `✗ ${msg}`, 'error');
  } finally {
    clearTestPending(openai);
  }
};

const testLocal = async (): Promise<void> => {
  const endpoint = local.endpointInput.value.trim();
  if (endpoint === '') {
    setTestResult(local.testResult, '✗ Enter a server URL first', 'error');
    return;
  }
  setTestPending(local);
  try {
    const result = await window.settingsApi.testConnection({
      provider: 'local',
      endpoint,
    });
    if (result.success) {
      const base = `✓ ${result.message ?? 'Connected'}`;
      const list =
        result.models && result.models.length > 0
          ? ` — Available: ${result.models.join(', ')}`
          : '';
      setTestResult(local.testResult, `${base}${list}`, 'success');
    } else {
      const msg = result.error ?? 'Cannot connect — is the server running?';
      setTestResult(local.testResult, `✗ ${msg}`, 'error');
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    setTestResult(local.testResult, `✗ ${msg}`, 'error');
  } finally {
    clearTestPending(local);
  }
};

const validateForSave = (): string | null => {
  if (activeProvider === 'anthropic' && anthropic.apiKeyInput.value.trim() === '') {
    anthropic.apiKeyInput.focus();
    return 'Anthropic API key is required.';
  }
  if (activeProvider === 'openai' && openai.apiKeyInput.value.trim() === '') {
    openai.apiKeyInput.focus();
    return 'OpenAI API key is required.';
  }
  if (activeProvider === 'local' && local.endpointInput.value.trim() === '') {
    local.endpointInput.focus();
    return 'Server URL is required.';
  }
  return null;
};

const save = async (): Promise<void> => {
  const error = validateForSave();
  if (error) {
    showStatus(error, 'error');
    return;
  }

  saveBtn.disabled = true;
  cancelBtn.disabled = true;

  try {
    const result = await window.settingsApi.saveSettings({
      provider: activeProvider,
      anthropicApiKey: anthropic.apiKeyInput.value.trim(),
      anthropicModel: anthropic.modelSelect.value,
      anthropicAvailableModels,
      openaiApiKey: openai.apiKeyInput.value.trim(),
      openaiModel: openai.modelSelect.value,
      openaiAvailableModels,
      localEndpoint: local.endpointInput.value.trim(),
      localModel: local.modelInput.value.trim(),
      systemPrompt: promptTextarea.value,
    });
    if (result.success) {
      showStatus('Saved ✓', 'success');
      window.setTimeout(() => window.settingsApi.closeSettings(), 500);
    } else {
      showStatus('Save failed', 'error');
      saveBtn.disabled = false;
      cancelBtn.disabled = false;
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    showStatus(`Save failed: ${msg}`, 'error');
    saveBtn.disabled = false;
    cancelBtn.disabled = false;
  }
};

const restoreDefaultPrompt = async (): Promise<void> => {
  try {
    promptTextarea.value = await window.settingsApi.getDefaultSystemPrompt();
    showStatus('Default loaded — press Save.');
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    showStatus(`Failed: ${msg}`, 'error');
  }
};

const cancel = (): void => {
  window.settingsApi.closeSettings();
};

const wireRevealButton = (input: HTMLInputElement, btn: HTMLButtonElement): void => {
  btn.addEventListener('click', () => {
    const showing = input.type === 'text';
    input.type = showing ? 'password' : 'text';
    btn.textContent = showing ? 'Show' : 'Hide';
  });
};

for (const tab of tabs) {
  tab.addEventListener('click', () => {
    const provider = tab.dataset.provider as Provider | undefined;
    if (provider) setActiveProvider(provider);
  });
}

saveBtn.addEventListener('click', () => void save());
cancelBtn.addEventListener('click', cancel);
resetBtn.addEventListener('click', () => void restoreDefaultPrompt());

anthropic.addModelBtn.addEventListener('click', () =>
  addCustomModel(anthropic, 'anthropic'),
);
openai.addModelBtn.addEventListener('click', () =>
  addCustomModel(openai, 'openai'),
);

anthropic.customModelInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    addCustomModel(anthropic, 'anthropic');
  }
});
openai.customModelInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    addCustomModel(openai, 'openai');
  }
});

wireRevealButton(anthropic.apiKeyInput, anthropic.revealBtn);
wireRevealButton(openai.apiKeyInput, openai.revealBtn);

anthropic.testBtn.addEventListener('click', () => void testAnthropic());
openai.testBtn.addEventListener('click', () => void testOpenAI());
local.testBtn.addEventListener('click', () => void testLocal());

// Clear stale test results when the relevant input changes.
anthropic.apiKeyInput.addEventListener('input', () =>
  setTestResult(anthropic.testResult, ''),
);
openai.apiKeyInput.addEventListener('input', () =>
  setTestResult(openai.testResult, ''),
);
local.endpointInput.addEventListener('input', () =>
  setTestResult(local.testResult, ''),
);

// Clear status when the user edits any field (but keep success messages).
const statusInputs: (HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement)[] = [
  anthropic.apiKeyInput,
  anthropic.modelSelect,
  anthropic.customModelInput,
  openai.apiKeyInput,
  openai.modelSelect,
  openai.customModelInput,
  local.endpointInput,
  local.modelInput,
  promptTextarea,
];
for (const el of statusInputs) {
  el.addEventListener('input', () => {
    if (statusEl.classList.contains('success')) return;
    showStatus('');
  });
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    e.preventDefault();
    cancel();
    return;
  }
  if ((e.metaKey || e.ctrlKey) && e.key === 's') {
    e.preventDefault();
    void save();
  }
});

void load();
