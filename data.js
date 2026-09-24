import { validateRecommendations, PREVIEW_OVERRIDE_DEFAULTS, DEFAULT_RANKING_SCHEMA, RANKING_SCHEMAS } from './components.js';
import { BUSINESS_UNITS, offerBusinessUnit } from './business-units.js';
import { masterDefaults, refreshPrizeDesign, refreshPartnerDesign, refreshBannerDesign, refreshCreditOffers, refreshParenthoodOffers } from './master-content.js';
import { personaDisplayName } from './segment-names.js';

export const STORAGE_KEY = 'sparks-public-gallery-v1';
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

export function safeLink(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch {
    return false;
  }
}

export function validateHub(data) {
  const errors = [];
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Expected a hub JSON object.');
  if (!text(data.persona?.id) || !/^[a-zA-Z0-9_-]+$/.test(data.persona.id)) errors.push('persona.id must contain only letters, numbers, underscores or hyphens');
  if (!text(data.persona?.name)) errors.push('persona.name must be non-empty text');
  if (data.recommendations !== undefined) validateRecommendations(data.recommendations);
  if (data.rankingSchema !== undefined && !RANKING_SCHEMAS.includes(data.rankingSchema)) {
    errors.push('rankingSchema must be legacy-banners or separate-coffee');
  }
  if (data.previewOverrides !== undefined) {
    if (!data.previewOverrides || typeof data.previewOverrides !== 'object' || Array.isArray(data.previewOverrides)) {
      errors.push('previewOverrides must be an object');
    } else {
      for (const key of Object.keys(PREVIEW_OVERRIDE_DEFAULTS)) {
        if (data.previewOverrides[key] !== undefined && typeof data.previewOverrides[key] !== 'boolean') {
          errors.push(`previewOverrides.${key} must be a boolean`);
        }
      }
    }
  }
  if (!text(data.customer?.name)) errors.push('customer.name must be non-empty text');
  for (const key of ['creditRewards', 'sparksRewards', 'points']) {
    if (!amount(data.customer?.[key])) errors.push(`customer.${key} must be a non-negative number`);
  }
  if (data.customer?.cardLoaded !== undefined && !amount(data.customer.cardLoaded)) errors.push('customer.cardLoaded must be a non-negative number');
  if (!text(data.announcement)) errors.push('announcement must be non-empty text');
  const offerIds = new Set();
  for (const key of ['offers', 'partners', 'prizes', 'creditOffers', 'babyOffers', 'tuesdayOffers', 'banners']) {
    const items = data[key];
    if (['creditOffers', 'babyOffers', 'tuesdayOffers', 'banners'].includes(key) && items === undefined) continue;
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
      if (key === 'partners') {
        for (const field of ['badge', 'cta']) {
          if (item[field] !== undefined && !text(item[field])) errors.push(`${prefix}.${field} must be non-empty text`);
        }
      }
      if (key === 'prizes' && item.entered !== undefined && typeof item.entered !== 'boolean') errors.push(`${prefix}.entered must be a boolean`);
      if (!['partners', 'banners'].includes(key) && !text(item.badge)) errors.push(`${prefix}.badge is required`);
      if (key === 'banners') {
        if (!text(item.cta) || !['ocado', 'credit'].includes(item.theme)) errors.push(`${prefix} needs cta text and an ocado or credit theme`);
        if (!BUSINESS_UNITS.some((unit) => unit.id === item.businessUnit)) errors.push(`${prefix}.businessUnit is invalid`);
        for (const field of ['apr', 'aprLabel', 'legal']) {
          if (item[field] !== undefined && !text(item[field])) errors.push(`${prefix}.${field} must be non-empty text`);
        }
      }
      if (['offers', 'creditOffers', 'babyOffers', 'tuesdayOffers'].includes(key)) {
        if (offerIds.has(item.id)) errors.push(`${prefix}.id must be unique across offer collections`);
        offerIds.add(item.id);
        if (item.businessUnit !== undefined && !BUSINESS_UNITS.some((unit) => unit.id === item.businessUnit)) {
          errors.push(`${prefix}.businessUnit must be food, clothing, home, credit_card, flowers or unassigned`);
        }
        if (item.details !== undefined) {
          if (!item.details || typeof item.details !== 'object' || Array.isArray(item.details)) errors.push(`${prefix}.details must be an object`);
          else {
            for (const field of ['channel', 'body', 'includes', 'excludes', 'shopLabel', 'howToUse', 'terms']) {
              if (item.details[field] !== undefined && !text(item.details[field])) errors.push(`${prefix}.details.${field} must be non-empty text`);
            }
            if (item.details.heroImage !== undefined && !safeImage(item.details.heroImage)) errors.push(`${prefix}.details.heroImage must be a safe image URL`);
            if (item.details.shopUrl !== undefined && !safeLink(item.details.shopUrl)) errors.push(`${prefix}.details.shopUrl must be an HTTPS URL without credentials`);
          }
        }
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
  if (data.charityImage !== undefined && !safeImage(data.charityImage)) errors.push('charityImage must be a safe image URL');
  if (data.charityIntro !== undefined && !text(data.charityIntro)) errors.push('charityIntro must be non-empty text');
  if (data.cafeStampCard !== undefined) {
    const card = data.cafeStampCard;
    if (!card || !Number.isSafeInteger(card.target) || card.target < 1 || card.target > 50 ||
        !Number.isSafeInteger(card.stamps) || card.stamps < 0 || card.stamps > card.target) {
      errors.push('cafeStampCard needs integer stamps between 0 and target, and a target between 1 and 50');
    }
    if (card?.daysToUse !== undefined && (!Number.isSafeInteger(card.daysToUse) || card.daysToUse < 0)) {
      errors.push('cafeStampCard.daysToUse must be a non-negative integer');
    }
  }
  if (errors.length) throw new Error(errors.join('\n'));
  return data;
}

export function normalizeHub(data) {
  validateHub(data);
  const normalized = structuredClone(data);
  normalized.rankingSchema ??= DEFAULT_RANKING_SCHEMA;
  normalized.previewOverrides = { ...PREVIEW_OVERRIDE_DEFAULTS, ...normalized.previewOverrides };
  normalized.prizes = refreshPrizeDesign(normalized.prizes);
  normalized.partners = refreshPartnerDesign(normalized.partners);
  if (/^engine-(?:v\d+-)?CUST-/.test(normalized.persona.id)) normalized.persona.name = personaDisplayName(normalized.persona.name, normalized.rankingSchema);
  for (const [key, value] of Object.entries(masterDefaults)) {
    if (normalized[key] === undefined) normalized[key] = structuredClone(value);
  }
  normalized.banners = refreshBannerDesign(normalized.banners);
  normalized.creditOffers = refreshCreditOffers(normalized.creditOffers);
  normalized.babyOffers = refreshParenthoodOffers(normalized.babyOffers);
  if (normalized.cafeStampCard.daysToUse === undefined) normalized.cafeStampCard.daysToUse = masterDefaults.cafeStampCard.daysToUse;
  for (const offer of [...normalized.offers, ...normalized.creditOffers, ...normalized.babyOffers, ...normalized.tuesdayOffers]) offer.businessUnit = offerBusinessUnit(offer);
  return validateHub(normalized);
}

export async function fetchHub(endpoint = './hub.json') {
  const url = new URL(endpoint, window.location.href);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Use an HTTP or HTTPS endpoint.');
  const response = await fetch(url, { credentials: 'omit', signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`Endpoint returned HTTP ${response.status}.`);
  return normalizeHub(await response.json());
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
  workspace.profiles = workspace.profiles.map(normalizeHub);
  const ids = workspace.profiles.map((profile) => profile.persona.id);
  if (new Set(ids).size !== ids.length || !ids.includes(workspace.selectedId)) throw new Error('Invalid saved persona selection.');
  return workspace;
}

export function saveHub(data) {
  data = normalizeHub(data);
  const workspace = loadWorkspace();
  const index = workspace.profiles.findIndex((profile) => profile.persona.id === data.persona.id);
  if (index >= 0) workspace.profiles[index] = data;
  else workspace.profiles.push(data);
  workspace.selectedId = data.persona.id;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(workspace));
}
