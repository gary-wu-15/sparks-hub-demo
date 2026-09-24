import { fetchHub, validateHub, loadSaved, loadWorkspace, saveHub, STORAGE_KEY } from './data.js';

const $ = (id) => document.getElementById(id);
const frame = $('preview');
const widths = { desktop: 1280, tablet: 768, mobile: 390 };
let device = 'desktop';
let frameHeight = 3500;
let hub;
let toastTimer;
let referenceUrl;
let previewScale = 1;

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
  frame.contentWindow.postMessage({
    type: 'hub-viewport',
    top: Math.max(0, (visibleTop - bounds.top) / previewScale),
    height: Math.max(200, (window.innerHeight - visibleTop) / previewScale)
  }, location.origin);
}
window.addEventListener('scroll', updateViewport, { passive: true });
window.addEventListener('resize', updateViewport);
new ResizeObserver(resize).observe($('preview-area'));
document.querySelectorAll('[data-device]').forEach((button) => {
  button.addEventListener('click', () => {
    device = button.dataset.device;
    document.querySelectorAll('[data-device]').forEach((item) => item.setAttribute('aria-pressed', String(item === button)));
    resize();
  });
});

function fillOffer() {
  const offer = hub.offers.find((item) => item.id === $('offer-select').value);
  $('offer-fields').disabled = !offer;
  for (const key of ['title', 'description', 'image', 'badge', 'status']) $('offer-' + key).value = offer?.[key] ?? '';
}
function fillEditor() {
  const workspace = loadWorkspace();
  $('persona-select').replaceChildren(...workspace.profiles.map((profile) => new Option(profile.persona.name, profile.persona.id)));
  $('persona-select').value = hub.persona.id;
  $('persona-description').textContent = hub.persona.description || 'A separate customer scenario. Content and demo activity belong to this persona.';
  const selected = $('offer-select').value;
  $('member-name').value = hub.customer.name;
  $('credit-rewards').value = hub.customer.creditRewards;
  $('sparks-rewards').value = hub.customer.sparksRewards;
  $('announcement').value = hub.announcement;
  $('offer-select').replaceChildren(...hub.offers.map((offer) => new Option(`${offer.title} · ${offer.id}`, offer.id)));
  if (hub.offers.some((item) => item.id === selected)) $('offer-select').value = selected;
  fillOffer();
  $('json-editor').value = JSON.stringify(hub, null, 2);
}
function apply(data, source) {
  validateHub(data);
  saveHub(data);
  hub = structuredClone(data);
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
});
$('persona-select').addEventListener('change', () => {
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
  const offer = next.offers.find((item) => item.id === $('offer-select').value);
  if (offer) for (const key of ['title', 'description', 'image', 'badge', 'status']) offer[key] = $('offer-' + key).value;
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
  if (!confirm('Restore the screenshot content for this persona and clear its simulated activity? Other personas are kept.')) return;
  try {
    const baseline = await fetchHub();
    if (hub) {
      baseline.persona = hub.persona;
      baseline.customer.name = hub.persona.id === 'demo' ? baseline.customer.name : hub.customer.name;
    }
    saveHub(baseline);
    localStorage.removeItem(`sparks-public-interactions-v1:${baseline.persona.id}`);
    hub = baseline;
    fillEditor();
    frame.contentWindow.postMessage({ type: 'hub-reset', data: hub }, location.origin);
    $('data-source').textContent = 'Source: screenshot baseline';
    feedback('Baseline restored.');
    toast('Baseline restored');
  } catch (error) { feedback(`Reset failed: ${error.message}`, true); }
});
try {
  try { hub = loadSaved(); } catch (error) { feedback(`Saved data could not be restored: ${error.message}. Loading baseline instead.`, true); }
  hub ??= await fetchHub();
  saveHub(hub);
  fillEditor();
  frame.contentWindow.postMessage({ type: 'hub-data', data: hub }, location.origin);
} catch (error) {
  feedback(`Unable to load hub: ${error.message}`, true);
  editorOpen(true);
}
window.addEventListener('storage', (event) => {
  if (event.key === STORAGE_KEY) {
    toast('Data changed in another tab. Reload to use that version.');
  }
});
