const STORAGE_KEY = 'solidcam-cheatsheet-state';

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (error) {
    console.error('Unable to parse saved state', error);
    return null;
  }
}

export function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error('Unable to persist state', error);
  }
}

export function clearState() {
  localStorage.removeItem(STORAGE_KEY);
}

