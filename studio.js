import { fetchHub, normalizeHub, loadSaved, loadWorkspace, saveHub, STORAGE_KEY } from './data.js';
import { rankedComponents, PROVISIONAL_COMPONENTS, HERO_COMPONENT_IDS, staticTailComponents } from './components.js';
import { loadPersonaSamples, makePersona, sampleProfileId, getDataset, DEFAULT_DATASET } from './persona-data.js';
import { BUSINESS_UNITS, businessUnitLabel } from './business-units.js';
import { segmentDisplayName } from './segment-names.js';

const $ = (id) => document.getElementById(id);
const frame = $('preview');
const widths = { desktop: 1280, tablet: 768, mobile: 390 };
let device = 'desktop';
let frameHeight = 3500;
let hub;
let toastTimer;
let referenceUrl;
let previewScale = 1;
let dialogOpen = false;
let previousOverflow = '';
let samples;
let activeSample;
const route = new URL(location.href);
const datasetVersion = route.searchParams.get('dataset') || DEFAULT_DATASET;

function fillRanking() {
  const panel = $('ranking-context');
  panel.hidden = !hub.recommendations;
  document.querySelector('.version').textContent = hub.recommendations ? (activeSample ? `${datasetVersion.toUpperCase()} RANKED` : 'CSV RANKED') : 'BASE 01';
  panel.replaceChildren();
  if (!hub.recommendations) return;
  const title = document.createElement('h1');
  title.textContent = activeSample ? segmentDisplayName(activeSample.segment, hub.rankingSchema) : hub.persona.name;
  const link = document.createElement('a');
  link.href = `./personas.html?dataset=${encodeURIComponent(datasetVersion)}`;
  link.textContent = samples ? `All ${samples.length} customer prototypes / ${new Set(samples.map((sample) => sample.segment)).size} segments` : 'Persona prototypes';
  // This gallery's CSV stays local; do not advertise it from a public deployment.
  if (samples) panel.append(link);
  panel.append(title);
  if (activeSample) {
    const example = document.createElement('p');
    const peers = samples.filter((sample) => sample.segment === activeSample.segment);
    example.textContent = `Customer ${peers.indexOf(activeSample) + 1} of ${peers.length} / ${activeSample.id} / ${getDataset(datasetVersion).label}`;
    panel.append(example);
  }
  const note = document.createElement('p');
  note.textContent = 'Sparks hero, then enabled priority overrides, remaining ranked sections, then Partner rewards. Marketing banners follows its ranking when mapped separately; otherwise it appears below Partner rewards. On Tablet and App, an unranked stamp card appears once immediately above Partner rewards. Stamp cards are excluded on desktop, including Coffee Completion. Example content and balances; not live eligibility. Edits and activity stay in this browser.';
  panel.append(note);
  const details = document.createElement('details');
  const summary = document.createElement('summary');
  const items = rankedComponents(hub.recommendations, hub.rankingSchema);
  const staticIds = staticTailComponents(hub.recommendations, hub.rankingSchema, hub.previewOverrides);
  summary.textContent = `${items.length} components in CSV rank order - inspect ranking`;
  details.append(summary);
  const list = document.createElement('ol');
  for (const item of items) {
    const li = document.createElement('li');
    li.value = item.rank;
    const wallet = ['sparks_wallet', 'credit_card_wallet'].includes(item.component);
    li.textContent = `${item.component} (${item.source})${HERO_COMPONENT_IDS.includes(item.component) && (!wallet || item.rank <= 2 || hub.previewOverrides.walletsInHero) ? ' - in Sparks hero' : ''}${wallet && item.rank > 2 && !hub.previewOverrides.walletsInHero ? ' - separate Your wallet section' : ''}${staticIds.includes(item.component) ? ' - fixed below rankings' : ''}${item.sourceComponent ? ` - replaces ${item.sourceComponent}` : ''}${PROVISIONAL_COMPONENTS.includes(item.component) ? ' - provisional mapping' : ''}`;
    list.append(li);
  }
  details.append(list);
  const heroNote = document.createElement('p');
  heroNote.textContent = 'Wallets ranked 1 or 2 stay in the Sparks hero. Lower-ranked wallets appear separately at their own ranks, never duplicated. Sparks rewards requires sparks_wallet. If credit_card_wallet is absent, its wallet appears immediately after Credit Card offers and the points-reward bar, regardless of the offers rank, not in the hero. Card access and How it works stay in the hero. Partner rewards follows ranked sections, then unranked Marketing banners. Source ranks are unchanged. ' + (hub.rankingSchema === 'separate-coffee'
    ? 'coffee_stamps maps to cafe_stamp_card; banners maps to Marketing banners at its numeric rank, without a second copy below.'
    : 'Legacy banners-to-stamp-card mapping is preserved.');
  details.append(heroNote);
  if (hub.previewOverrides.walletsInHero) {
    const walletNote = document.createElement('p');
    walletNote.textContent = 'All wallets in hero is enabled: both wallet tiles appear once in the hero, including wallets absent from the rankings. Standalone wallets are removed; source ranks and balances are unchanged.';
    details.append(walletNote);
  }
  const duplicates = hub.recommendations.filter((item) => !items.some((kept) => kept.rank === item.rank));
  if (duplicates.length) {
    const warning = document.createElement('p');
    warning.textContent = `Repeated components omitted: ${duplicates.map((item) => `${item.component} at rank ${item.rank}`).join(', ')}. Highest-ranked occurrence retained.`;
    details.append(warning);
  }
  panel.append(details);
}

function feedback(message, error = false) {
  $('editor-feedback').textContent = message;
  $('editor-feedback').classList.toggle('error', error);
}
function toast(message) {
  $('studio-toast').textContent = message;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { $('studio-toast').textContent = ''; }, 4000);
}
function resize() {
  const width = widths[device];
  const padding = parseFloat(getComputedStyle($('preview-area')).paddingLeft) * 2;
  const available = Math.max(1, $('preview-area').clientWidth - padding - 14);
  const scale = Math.min(1, available / width);
  previewScale = scale;
  frame.style.width = `${width}px`;
  frame.style.height = `${frameHeight}px`;
  frame.style.transform = `scale(${scale})`;
  $('frame-wrapper').style.width = `${width * scale}px`;
  $('frame-wrapper').style.height = `${frameHeight * scale}px`;
  $('frame-wrapper').className = device;
  $('dimensions').textContent = `${width} × auto · ${Math.round(scale * 100)}%`;
  updateViewport();
}
function updateViewport() {
  const bounds = frame.getBoundingClientRect();
  const toolbarBottom = document.querySelector('.studio-toolbar').getBoundingClientRect().bottom;
  const visibleTop = Math.max(0, bounds.top, toolbarBottom);
  const visibleBottom = Math.min(window.innerHeight, bounds.bottom);
  frame.contentWindow.postMessage({
    type: 'hub-viewport',
    top: Math.max(0, (visibleTop - bounds.top) / previewScale),
    height: Math.max(200, (visibleBottom - visibleTop) / previewScale)
  }, location.origin);
}
window.addEventListener('scroll', updateViewport, { passive: true });
window.addEventListener('resize', updateViewport);
new ResizeObserver(resize).observe($('preview-area'));
document.querySelectorAll('[data-device]').forEach((button) => {
  button.addEventListener('click', () => {
    device = button.dataset.device;
    document.querySelectorAll('[data-device]').forEach((item) => item.setAttribute('aria-pressed', String(item === button)));
    if (hub) fillOverrides();
    resize();
  });
});

const editableOffers = (profile) => [...profile.offers, ...profile.creditOffers, ...profile.babyOffers, ...profile.tuesdayOffers];
function fillOffer() {
  const offer = editableOffers(hub).find((item) => item.id === $('offer-select').value);
  $('offer-fields').disabled = !offer;
  for (const key of ['title', 'description', 'image', 'badge', 'status', 'businessUnit']) $('offer-' + key).value = offer?.[key] ?? '';
}
function fillEditor() {
  fillOverrides();
  const workspace = loadWorkspace();
  const profiles = activeSample
    ? samples.filter((sample) => sample.segment === activeSample.segment).map((sample, index) => new Option(`Customer ${index + 1} / ${sample.id}`, sampleProfileId(sample, datasetVersion)))
    : workspace.profiles.map((profile) => new Option(profile.persona.name, profile.persona.id));
  $('persona-select').replaceChildren(...profiles);
  $('persona-select').value = hub.persona.id;
  $('persona-select').setAttribute('aria-label', activeSample ? 'Customer example for this persona' : 'Active customer persona');
  fillRanking();
  $('persona-description').textContent = hub.persona.description || 'A separate customer scenario. Content and demo activity belong to this persona.';
  const selected = $('offer-select').value;
  $('member-name').value = hub.customer.name;
  $('credit-rewards').value = hub.customer.creditRewards;
  $('sparks-rewards').value = hub.customer.sparksRewards;
  $('announcement').value = hub.announcement;
  $('offer-select').replaceChildren(...[['Sparks offers', hub.offers], ['Sparks Tuesdays demo offers', hub.tuesdayOffers], ['Credit Card offers', hub.creditOffers], ['Baby club offers', hub.babyOffers]].map(([label, offers]) => {
    const group = document.createElement('optgroup');
    group.label = label;
    group.append(...offers.map((offer) => new Option(`${businessUnitLabel(offer.businessUnit)} · ${offer.description}`, offer.id)));
    return group;
  }));
  $('offer-businessUnit').replaceChildren(...BUSINESS_UNITS.map((unit) => new Option(unit.label, unit.id)));
  $('business-unit-summary').textContent = 'Sparks offer assignments: ' + BUSINESS_UNITS.map((unit) =>
    `${unit.label}: ${hub.offers.filter((offer) => offer.businessUnit === unit.id).length}`).join(' / ');
  if (editableOffers(hub).some((item) => item.id === selected)) $('offer-select').value = selected;
  fillOffer();
  $('json-editor').value = JSON.stringify(hub, null, 2);
}
function fillOverrides() {
  $('preview-overrides').disabled = false;
  for (const input of document.querySelectorAll('[data-preview-override]')) {
    input.checked = hub.previewOverrides[input.dataset.previewOverride];
  }
  const { sparksTuesdays, coffeeCompletion, bannersAtBottom, walletsInHero } = hub.previewOverrides;
  const bannerSummary = bannersAtBottom ? ' Marketing banners is forced to the bottom, below Partner rewards, on every device.' : '';
  const walletSummary = walletsInHero ? ' Both wallets appear once in the Sparks hero. Standalone wallets are removed regardless of rank; balances are unchanged.' : '';
  if (device === 'desktop') {
    $('override-summary').textContent = `${sparksTuesdays ? 'Sparks offers takes first place below the hero.' : 'Original priority order.'} Stamp cards are excluded from all desktop prototypes, even with Coffee Completion enabled. Saved coffee settings and progress still apply on Tablet and App.${bannerSummary}${walletSummary}`;
    return;
  }
  $('override-summary').textContent = (sparksTuesdays && coffeeCompletion
    ? 'Below the hero: Sparks offers first, completed coffee reward second. Saved stamp progress is unchanged.'
    : sparksTuesdays
      ? 'Sparks offers takes first place below the hero. New demo offers lead; activated offers & missions follow.'
      : coffeeCompletion
        ? 'Completed coffee reward takes first place below the hero. Demo completion only; saved stamp progress is unchanged.'
        : 'Original priority order. Unranked stamp cards appear above Partner rewards. Overrides are saved for this prototype.') + bannerSummary + walletSummary;
}
document.querySelectorAll('[data-preview-override]').forEach((input) => {
  input.addEventListener('change', () => {
    const next = structuredClone(hub);
    next.previewOverrides[input.dataset.previewOverride] = input.checked;
    try { apply(next, 'priority overrides'); }
    catch (error) {
      fillOverrides();
      feedback(`Could not save override: ${error.message}`, true);
      toast(`Could not save override: ${error.message}`);
    }
  });
});
function apply(data, source) {
  data = normalizeHub(data);
  saveHub(data);
  hub = structuredClone(data);
  if (activeSample && hub.persona.id !== sampleProfileId(activeSample, datasetVersion)) {
    activeSample = null;
    route.searchParams.delete('sample');
    history.replaceState(null, '', route);
  }
  fillEditor();
  frame.contentWindow.postMessage({ type: 'hub-data', data: hub }, location.origin);
  $('data-source').textContent = `Source: ${source}`;
  feedback('Applied and saved in this browser.');
  toast('Preview updated');
}
window.addEventListener('message', (event) => {
  if (event.origin !== location.origin || event.source !== frame.contentWindow) return;
  if (event.data?.type === 'hub-height' && Number.isFinite(event.data.height)) {
    frameHeight = Math.max(500, Math.min(100000, event.data.height));
    resize();
  }
  if (event.data?.type === 'hub-ready' && hub) frame.contentWindow.postMessage({ type: 'hub-data', data: hub }, location.origin);
  if (event.data?.type === 'hub-dialog' || event.data?.type === 'hub-ready') updateViewport();
  if (event.data?.type === 'hub-dialog' && !dialogOpen) {
    dialogOpen = true;
    previousOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
  }
  if (event.data?.type === 'hub-dialog-closed' && dialogOpen) {
    dialogOpen = false;
    document.documentElement.style.overflow = previousOverflow;
  }
});
frame.addEventListener('load', () => {
  if (dialogOpen) {
    dialogOpen = false;
    document.documentElement.style.overflow = previousOverflow;
  }
});
$('persona-select').addEventListener('change', () => {
  if (activeSample) {
    const sample = samples.find((item) => sampleProfileId(item, datasetVersion) === $('persona-select').value);
    if (!sample) { feedback('Unknown customer selection. Reload the persona gallery.', true); editorOpen(true); return; }
    route.searchParams.set('sample', sample.id);
    route.searchParams.set('dataset', datasetVersion);
    location.assign(route);
    return;
  }
  try {
    const selected = loadWorkspace().profiles.find((profile) => profile.persona.id === $('persona-select').value);
    apply(selected, 'saved persona');
    toast(`Switched to ${hub.persona.name}`);
  } catch (error) { feedback(error.message, true); editorOpen(true); }
});
$('duplicate-persona').addEventListener('click', () => {
  $('new-persona-form').hidden = false;
  $('new-persona-name').focus();
});
$('cancel-persona').addEventListener('click', () => { $('new-persona-form').hidden = true; });
$('new-persona-form').addEventListener('submit', (event) => {
  event.preventDefault();
  if (!hub) return feedback('Load a baseline before creating a persona.', true);
  const name = $('new-persona-name').value.trim();
  if (!name) return feedback('Enter a persona name.', true);
  const next = structuredClone(hub);
  next.persona = { id: crypto.randomUUID(), name, description: `Based on ${hub.persona.name}. Edit content or import data to personalise this customer.` };
  next.customer.name = name;
  try {
    apply(next, 'new persona');
    $('new-persona-form').hidden = true;
    $('new-persona-name').value = '';
    toast(`Created ${name} — baseline preserved`);
  } catch (error) { feedback(error.message, true); }
});
function editorOpen(open) {
  $('editor').hidden = !open;
  $('edit-content').setAttribute('aria-expanded', String(open));
  if (open) $('close-editor').focus();
  else $('edit-content').focus();
  resize();
}
$('edit-content').addEventListener('click', () => editorOpen($('editor').hidden));
$('close-editor').addEventListener('click', () => editorOpen(false));
document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && !$('editor').hidden) editorOpen(false); });
const tabs = [...document.querySelectorAll('[data-tab]')];
tabs.forEach((button, index) => {
  button.addEventListener('click', () => {
    tabs.forEach((tab) => {
      tab.setAttribute('aria-selected', String(button === tab));
      tab.tabIndex = button === tab ? 0 : -1;
      $(tab.dataset.tab + '-tab').hidden = tab !== button;
    });
    feedback('');
  });
  button.addEventListener('keydown', (event) => {
    if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    tabs[next].click();
    tabs[next].focus();
  });
});
$('offer-select').addEventListener('change', fillOffer);
$('content-form').addEventListener('submit', (event) => {
  event.preventDefault();
  if (!hub) return feedback('Baseline data is not loaded yet.', true);
  const next = structuredClone(hub);
  Object.assign(next.customer, { name: $('member-name').value, creditRewards: Number($('credit-rewards').value), sparksRewards: Number($('sparks-rewards').value) });
  next.announcement = $('announcement').value;
  const offer = editableOffers(next).find((item) => item.id === $('offer-select').value);
  if (offer) for (const key of ['title', 'description', 'image', 'badge', 'status', 'businessUnit']) offer[key] = $('offer-' + key).value;
  try { apply(next, 'content editor'); } catch (error) { feedback(error.message, true); }
});
$('apply-json').addEventListener('click', () => {
  try { apply(JSON.parse($('json-editor').value), 'JSON editor'); } catch (error) { feedback(error.message, true); }
});
$('load-endpoint').addEventListener('click', async () => {
  $('load-endpoint').disabled = true;
  feedback('Loading endpoint…');
  try { apply(await fetchHub($('endpoint').value), 'endpoint snapshot'); }
  catch (error) { feedback(`Could not load endpoint: ${error.message}\nFor remote APIs, check CORS is enabled for this preview's origin. Existing data is unchanged.`, true); }
  finally { $('load-endpoint').disabled = false; }
});
$('export-json').addEventListener('click', () => {
  if (!hub) return feedback('No data to export.', true);
  const url = URL.createObjectURL(new Blob([JSON.stringify(hub, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'sparks-hub.json';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
$('import-json').addEventListener('change', async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) return feedback('Please use a JSON file smaller than 2 MB.', true);
  try { apply(JSON.parse(await file.text()), 'imported JSON'); } catch (error) { feedback(error.message, true); }
  event.target.value = '';
});
$('reference-file').addEventListener('change', (event) => {
  const file = event.target.files[0];
  if (!file) return;
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 15 * 1024 * 1024) {
    return feedback('Choose a PNG, JPG or WebP image under 15 MB.', true);
  }
  if (referenceUrl) URL.revokeObjectURL(referenceUrl);
  referenceUrl = URL.createObjectURL(file);
  $('reference-image').src = referenceUrl;
  $('reference-link').href = referenceUrl;
  feedback('Reference updated. The prototype content is unchanged.');
});
$('reset').addEventListener('click', async () => {
  if (!confirm('Restore the screenshot content for this persona and clear its priority overrides and simulated activity? Other personas are kept.')) return;
  try {
    let baseline = await fetchHub();
    if (activeSample) baseline = makePersona(baseline, activeSample, datasetVersion);
    if (hub) {
      baseline.persona = hub.persona;
      baseline.customer.name = hub.persona.id === 'demo' ? baseline.customer.name : hub.customer.name;
      if (hub.recommendations) baseline.recommendations = structuredClone(hub.recommendations);
    }
    saveHub(baseline);
    localStorage.removeItem(`sparks-public-gallery-interactions-v1:${baseline.persona.id}`);
    hub = baseline;
    fillEditor();
    frame.contentWindow.postMessage({ type: 'hub-reset', data: hub }, location.origin);
    $('data-source').textContent = 'Source: screenshot baseline';
    feedback('Baseline restored.');
    toast('Baseline restored');
  } catch (error) { feedback(`Reset failed: ${error.message}`, true); }
});
try {
  if (route.searchParams.has('sample')) {
    samples = await loadPersonaSamples(datasetVersion);
    activeSample = samples.find((sample) => sample.id === route.searchParams.get('sample'));
    if (!activeSample) throw new Error('Unknown customer example. Open the persona gallery to choose a valid prototype.');
    const baseline = await fetchHub();
    hub = loadWorkspace().profiles.find((profile) => profile.persona.id === sampleProfileId(activeSample, datasetVersion)) || makePersona(baseline, activeSample, datasetVersion);
    document.title = `${segmentDisplayName(activeSample.segment, hub.rankingSchema)} / ${activeSample.id} (${datasetVersion}) | Sparks prototype`;
  } else if (route.searchParams.has('baseline')) {
    const baseline = await fetchHub();
    hub = loadWorkspace().profiles.find((profile) => profile.persona.id === baseline.persona.id) || baseline;
  } else {
    try { hub = loadSaved(); } catch (error) { feedback(`Saved data could not be restored: ${error.message}. Loading baseline instead.`, true); }
    hub ??= await fetchHub();
  }
  saveHub(hub);
  fillEditor();
  frame.contentWindow.postMessage({ type: 'hub-data', data: hub }, location.origin);
  if (activeSample) $('data-source').textContent = `Source: ${getDataset(datasetVersion).label} / ${activeSample.id}`;
} catch (error) {
  feedback(`Unable to load hub: ${error.message}`, true);
  frame.hidden = true;
  editorOpen(true);
}
window.addEventListener('storage', (event) => {
  if (event.key === STORAGE_KEY) {
    toast('Data changed in another tab. Reload to use that version.');
  }
});
