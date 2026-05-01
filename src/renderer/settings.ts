// Settings window renderer: edit + save api key, model, system prompt; manage custom models.
import './settings.css';

const apiKeyInput = document.getElementById('api-key') as HTMLInputElement;
const modelSelect = document.getElementById('model-select') as HTMLSelectElement;
const customModelInput = document.getElementById('custom-model') as HTMLInputElement;
const addModelBtn = document.getElementById('add-model-btn') as HTMLButtonElement;
const promptTextarea = document.getElementById('system-prompt') as HTMLTextAreaElement;
const saveBtn = document.getElementById('save-btn') as HTMLButtonElement;
const cancelBtn = document.getElementById('cancel-btn') as HTMLButtonElement;
const resetBtn = document.getElementById('reset-btn') as HTMLButtonElement;
const revealBtn = document.getElementById('reveal-btn') as HTMLButtonElement;
const statusEl = document.getElementById('status') as HTMLSpanElement;

let availableModels: string[] = [];
let statusTimer: number | null = null;

const showStatus = (msg: string, kind: 'success' | 'error' | '' = ''): void => {
  if (statusTimer !== null) {
    clearTimeout(statusTimer);
    statusTimer = null;
  }
  statusEl.textContent = msg;
  statusEl.className = kind;
};

const populateModelDropdown = (models: string[], selected: string): void => {
  modelSelect.innerHTML = '';
  for (const model of models) {
    const opt = document.createElement('option');
    opt.value = model;
    opt.textContent = model;
    if (model === selected) opt.selected = true;
    modelSelect.appendChild(opt);
  }
};

const load = async (): Promise<void> => {
  try {
    const settings = await window.settingsApi.getSettings();
    apiKeyInput.value = settings.apiKey;
    promptTextarea.value = settings.systemPrompt;
    availableModels = [...settings.availableModels];
    if (settings.model && !availableModels.includes(settings.model)) {
      availableModels.push(settings.model);
    }
    populateModelDropdown(availableModels, settings.model);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    showStatus(`Failed to load: ${msg}`, 'error');
  }
};

const addCustomModel = (): void => {
  const value = customModelInput.value.trim();
  if (value === '') return;
  if (availableModels.includes(value)) {
    showStatus(`"${value}" is already in the list.`, 'error');
    return;
  }
  availableModels = [...availableModels, value];
  populateModelDropdown(availableModels, value);
  customModelInput.value = '';
  showStatus('');
};

const save = async (): Promise<void> => {
  const apiKey = apiKeyInput.value.trim();
  const systemPrompt = promptTextarea.value;
  const model = modelSelect.value;

  if (apiKey === '') {
    showStatus('API key is required.', 'error');
    apiKeyInput.focus();
    return;
  }
  if (model === '') {
    showStatus('Select a model.', 'error');
    modelSelect.focus();
    return;
  }

  saveBtn.disabled = true;
  cancelBtn.disabled = true;

  try {
    const result = await window.settingsApi.saveSettings({
      apiKey,
      systemPrompt,
      model,
      availableModels,
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

saveBtn.addEventListener('click', () => void save());
cancelBtn.addEventListener('click', cancel);
resetBtn.addEventListener('click', () => void restoreDefaultPrompt());
addModelBtn.addEventListener('click', addCustomModel);

customModelInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    addCustomModel();
  }
});

revealBtn.addEventListener('click', () => {
  const showing = apiKeyInput.type === 'text';
  apiKeyInput.type = showing ? 'password' : 'text';
  revealBtn.textContent = showing ? 'Show' : 'Hide';
});

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

[apiKeyInput, promptTextarea, modelSelect, customModelInput].forEach((el) => {
  el.addEventListener('input', () => {
    if (statusEl.classList.contains('success')) return;
    showStatus('');
  });
});

void load();
