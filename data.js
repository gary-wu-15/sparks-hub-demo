export const STORAGE_KEY = 'sparks-public-studio-v1';
const text = (value) => typeof value === 'string' && value.trim().length > 0;
const amount = (value) => Number.isFinite(value) && value >= 0;

export function safeImage(value) {
  if (!text(value)) return false;
  if (/^\.\/assets\/[a-zA-Z0-9._/-]+$/.test(value)) return true;
  if (/^\/(?!\/)/.test(value)) return true;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || (url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname));
  } catch {
    return false;
  }
}

export function validateHub(data) {
  const errors = [];
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Expected a hub JSON object.');
  if (!text(data.persona?.id) || !/^[a-zA-Z0-9_-]+$/.test(data.persona.id)) errors.push('persona.id must contain only letters, numbers, underscores or hyphens');
  if (!text(data.persona?.name)) errors.push('persona.name must be non-empty text');
  if (!text(data.customer?.name)) errors.push('customer.name must be non-empty text');
  for (const key of ['creditRewards', 'sparksRewards', 'points']) {
    if (!amount(data.customer?.[key])) errors.push(`customer.${key} must be a non-negative number`);
  }
  if (!text(data.announcement)) errors.push('announcement must be non-empty text');
  for (const key of ['offers', 'partners', 'prizes']) {
    const items = data[key];
    if (!Array.isArray(items)) { errors.push(`${key} must be an array`); continue; }
    if (items.length > 100) errors.push(`${key} cannot exceed 100 items`);
    const ids = new Set();
    items.forEach((item, index) => {
      const prefix = `${key}[${index}]`;
      if (!item || typeof item !== 'object') { errors.push(`${prefix} must be an object`); return; }
      if (!text(item.id) || ids.has(item.id)) errors.push(`${prefix}.id must be unique, non-empty text`);
      ids.add(item.id);
      if (!text(item.title)) errors.push(`${prefix}.title must be non-empty text`);
      if (!safeImage(item.image)) errors.push(`${prefix}.image must be a local path or HTTPS image URL`);
      if (key !== 'prizes' && !text(item.description)) errors.push(`${prefix}.description is required`);
      if (key === 'partners' && !text(item.brand)) errors.push(`${prefix}.brand is required`);
      if (key !== 'partners' && !text(item.badge)) errors.push(`${prefix}.badge is required`);
      if (key === 'offers') {
        if (!['active', 'available', 'shop'].includes(item.status)) errors.push(`${prefix}.status must be active, available or shop`);
        if (!['light', 'dark'].includes(item.theme)) errors.push(`${prefix}.theme must be light or dark`);
        if (item.remaining !== undefined || item.target !== undefined) {
          if (!amount(item.remaining) || !amount(item.target) || item.target === 0 || item.remaining > item.target) {
            errors.push(`${prefix}: remaining must be between 0 and a positive target`);
          }
        }
      }
    });
  }
  for (const key of ['title', 'description', 'cta']) {
    if (!text(data.feature?.[key])) errors.push(`feature.${key} is required`);
  }
  if (!safeImage(data.feature?.image)) errors.push('feature.image must be a local path or HTTPS image URL');
  for (const key of ['name', 'since']) if (!text(data.charity?.[key])) errors.push(`charity.${key} is required`);
  for (const key of ['raised', 'total']) if (!amount(data.charity?.[key])) errors.push(`charity.${key} must be a non-negative number`);
  if (errors.length) throw new Error(errors.join('\n'));
  return data;
}

export async function fetchHub(endpoint = './hub.json') {
  const url = new URL(endpoint, window.location.href);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Use an HTTP or HTTPS endpoint.');
  const response = await fetch(url, { credentials: 'omit', signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`Endpoint returned HTTP ${response.status}.`);
  return validateHub(await response.json());
}

export function loadSaved() {
  const workspace = loadWorkspace();
  return workspace.profiles.find((profile) => profile.persona.id === workspace.selectedId) || null;
}

export function loadWorkspace() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return { profiles: [], selectedId: null };
  const workspace = JSON.parse(raw);
  if (!workspace || !Array.isArray(workspace.profiles)) throw new Error('Invalid saved persona workspace.');
  workspace.profiles.forEach(validateHub);
  const ids = workspace.profiles.map((profile) => profile.persona.id);
  if (new Set(ids).size !== ids.length || !ids.includes(workspace.selectedId)) throw new Error('Invalid saved persona selection.');
  return workspace;
}

export function saveHub(data) {
  validateHub(data);
  const workspace = loadWorkspace();
  const index = workspace.profiles.findIndex((profile) => profile.persona.id === data.persona.id);
  if (index >= 0) workspace.profiles[index] = data;
  else workspace.profiles.push(data);
  workspace.selectedId = data.persona.id;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(workspace));
}
