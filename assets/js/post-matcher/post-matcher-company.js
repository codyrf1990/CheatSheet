const STORAGE_KEY = 'post-matcher.companies.v1';
const defaultState = { companies: [], currentCompanyId: null };
let memoryState = clone(defaultState);

function clone(value) {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
}

function getStorage() {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage ?? null;
  } catch (error) {
    console.warn('LocalStorage unavailable for post matcher', error);
    return null;
  }
}

function readState() {
  const storage = getStorage();
  if (!storage) return memoryState;
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return { ...defaultState };
    const parsed = JSON.parse(raw);
    return {
      companies: Array.isArray(parsed.companies) ? parsed.companies : [],
      currentCompanyId: parsed.currentCompanyId ?? null
    };
  } catch (error) {
    console.warn('Unable to parse post matcher state', error);
    return { ...defaultState };
  }
}

function writeState(nextState) {
  const storage = getStorage();
  memoryState = clone(nextState);
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(nextState));
  } catch (error) {
    console.warn('Unable to persist post matcher state', error);
  }
}

function touchCompany(company) {
  const timestamp = new Date().toISOString();
  company.modified = timestamp;
  if (!company.created) {
    company.created = timestamp;
  }
}

function generateId(prefix = 'pm') {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${prefix}-${Math.random().toString(36).slice(2)}-${Date.now()}`;
}

export function getAllCompanies() {
  const state = readState();
  return state.companies.slice();
}

export function getCurrentCompany() {
  const state = readState();
  return state.companies.find(company => company.id === state.currentCompanyId) ?? null;
}

export function getCurrentCompanyId() {
  const state = readState();
  return state.currentCompanyId;
}

export function setCurrentCompany(companyId) {
  const state = readState();
  state.currentCompanyId = companyId;
  writeState(state);
}

export function createCompany(name = 'New Company') {
  const state = readState();
  const company = {
    id: generateId('company'),
    name: name.trim() || 'New Company',
    machines: [],
    created: new Date().toISOString(),
    modified: new Date().toISOString()
  };
  state.companies.push(company);
  state.currentCompanyId = company.id;
  writeState(state);
  return company;
}

export function loadCompany(companyId) {
  const state = readState();
  return state.companies.find(company => company.id === companyId) ?? null;
}

export function saveCompany(company) {
  const state = readState();
  const index = state.companies.findIndex(item => item.id === company.id);
  if (index === -1) {
    state.companies.push(company);
  } else {
    state.companies[index] = company;
  }
  touchCompany(company);
  writeState(state);
  return company;
}

export function deleteCompany(companyId) {
  const state = readState();
  state.companies = state.companies.filter(company => company.id !== companyId);
  if (state.currentCompanyId === companyId) {
    state.currentCompanyId = state.companies[0]?.id ?? null;
  }
  writeState(state);
}

export function addMachineToCompany(companyId, machine) {
  const state = readState();
  const company = state.companies.find(item => item.id === companyId);
  if (!company) return null;

  const exists = company.machines.find(entry => entry.id === machine.id);
  const timestamp = new Date().toISOString();
  const payload = {
    id: machine.id,
    manufacturer: machine.manufacturer,
    model: machine.model,
    fullName: machine.fullName,
    sku: machine.sku,
    skuName: machine.skuName,
    price: machine.price,
    tier: machine.tier,
    confidence: machine.confidence ?? 90,
    reasoning: machine.reasoning ?? [],
    addedDate: timestamp,
    notes: machine.notes ?? ''
  };

  if (exists) {
    Object.assign(exists, payload);
    exists.addedDate = timestamp;
  } else {
    company.machines.push(payload);
  }

  touchCompany(company);
  writeState(state);
  return payload;
}

export function removeMachineFromCompany(companyId, machineId) {
  const state = readState();
  const company = state.companies.find(item => item.id === companyId);
  if (!company) return;
  company.machines = company.machines.filter(machine => machine.id !== machineId);
  touchCompany(company);
  writeState(state);
}

export function updateMachineNotes(companyId, machineId, notes) {
  const state = readState();
  const company = state.companies.find(item => item.id === companyId);
  if (!company) return false;
  const machine = company.machines.find(item => item.id === machineId);
  if (!machine) return false;
  machine.notes = notes;
  machine.modifiedDate = new Date().toISOString();
  touchCompany(company);
  writeState(state);
  return true;
}

export function exportCompanyToCSV(companyId) {
  const company = loadCompany(companyId);
  if (!company || typeof document === 'undefined') return;
  const headers = ['Machine', 'Manufacturer', 'Model', 'SKU', 'Product', 'Price', 'Tier', 'Notes'];
  const rows = company.machines.map(machine => [
    machine.fullName,
    machine.manufacturer ?? '',
    machine.model ?? '',
    machine.sku,
    machine.skuName,
    machine.price,
    machine.tier,
    machine.notes ?? ''
  ]);
  const csv = [headers, ...rows]
    .map(row => row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${company.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-machines-${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function getStateSnapshot() {
  return readState();
}
