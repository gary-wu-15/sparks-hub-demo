import { loadPersonaSamples, groupPersonaSamples, getDataset, DEFAULT_DATASET, DATASETS } from './persona-data.js';
import { segmentDisplayName } from './segment-names.js';

const status = document.getElementById('gallery-status');
const version = new URL(location.href).searchParams.get('dataset') || DEFAULT_DATASET;
try {
  const dataset = getDataset(version);
  const samples = await loadPersonaSamples(version);
  const groups = groupPersonaSamples(samples, version);
  document.title = `Sparks | ${groups.length} segments / ${samples.length} prototypes (${version})`;
  document.getElementById('dataset-description').textContent = `${version.toUpperCase()} / ${groups.length} segments / ${samples.length} prototypes`;
  document.getElementById('dataset-source').textContent = `Source: ${dataset.label}`;
  document.getElementById('dataset-change').textContent = version === DEFAULT_DATASET
    ? 'V3 adds a separate Coffee Stamp Collectors segment alongside Promo-Responsive Browsers. Previous datasets and their edits remain available in the archives.'
    : `Archived ${version} dataset. Existing edits and activity are preserved; use ${DEFAULT_DATASET} for the latest rankings.`;
  document.getElementById('mapping-note').textContent = dataset.rankingSchema === 'separate-coffee'
    ? 'coffee_stamps maps to cafe_stamp_card at its source rank. banners maps to Marketing banners at its numeric rank, not another stamp card. When unranked, Marketing banners appears below Partner rewards; it is never duplicated.'
    : 'Legacy mapping: source banners recommendations map to cafe_stamp_card at the same rank. Marketing banners remains a separate fixed-tail component.';
  const switcher = document.getElementById('dataset-switch');
  for (const target of Object.keys(DATASETS).reverse().filter((target) => target !== version)) {
    const link = document.createElement('a');
    link.href = `./personas.html?dataset=${target}`;
    link.textContent = `View ${target === DEFAULT_DATASET ? 'latest' : 'archived'} ${target} prototypes`;
    if (switcher.childNodes.length) switcher.append(document.createTextNode(' / '));
    switcher.append(link);
  }
  switcher.hidden = false;
  const repeated = samples.filter((sample) => new Set(sample.recommendations.map((item) => item.component)).size < sample.recommendations.length).length;
  document.getElementById('duplicate-summary').textContent = `${repeated} customer examples contain repeated components. Only the highest-ranked occurrence is shown; original rank numbers are retained.`;
  const sections = new Map();
  const filters = new Map();
  function selectSegment(id, updateHistory = false) {
    const unknown = id !== 'all' && !sections.has(id);
    if (unknown) id = sections.keys().next().value;
    for (const [key, section] of sections) section.hidden = id !== 'all' && key !== id;
    for (const [key, button] of filters) button.setAttribute('aria-pressed', String(key === id));
    const selected = sections.get(id);
    status.textContent = (unknown ? 'Unknown segment link. ' : '') + (selected
      ? `Showing ${selected.querySelector('h2').textContent} / ${selected.querySelectorAll('.persona-card').length} customer prototypes`
      : `Showing all ${groups.length} segments / ${samples.length} customer prototypes`);
    if (updateHistory && location.hash !== `#${id}`) {
      const url = new URL(location.href);
      url.hash = id;
      history.pushState(null, '', url);
    }
  }
  function addFilter(id, label, count) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'segment-pill';
    button.setAttribute('aria-label', label);
    button.setAttribute('aria-controls', id === 'all' ? 'persona-gallery' : id);
    button.setAttribute('aria-pressed', 'false');
    button.append(document.createTextNode(label));
    const badge = document.createElement('span');
    badge.className = 'segment-count';
    badge.setAttribute('aria-hidden', 'true');
    badge.textContent = count;
    button.append(badge);
    button.addEventListener('click', () => selectSegment(id, true));
    filters.set(id, button);
    document.getElementById('segment-navigation').append(button);
  }

  for (const [groupIndex, group] of groups.entries()) {
    const segmentLabel = segmentDisplayName(group.segment, dataset.rankingSchema);
    const section = document.createElement('section');
    section.className = 'persona-group';
    section.id = `segment-${groupIndex + 1}`;
    const heading = document.createElement('h2');
    heading.id = `${section.id}-heading`;
    heading.textContent = segmentLabel;
    section.setAttribute('aria-labelledby', heading.id);
    const intro = document.createElement('p');
    intro.textContent = `${group.examples.length} customer prototypes / ${group.orderCount} distinct recommendation ${group.orderCount === 1 ? 'order' : 'orders'}`;
    addFilter(section.id, segmentLabel, group.examples.length);
    const grid = document.createElement('div');
    grid.className = 'customer-grid';

    for (const example of group.examples) {
      const { sample, number, items, order } = example;
      const card = document.createElement('article');
      card.className = 'persona-card';
      card.dataset.customerId = sample.id;
      const label = document.createElement('span');
      label.className = 'eyebrow';
      label.textContent = `CUSTOMER ${number} / ORDER ${order}`;
      const title = document.createElement('h3');
      title.textContent = sample.id;
      const shared = document.createElement('p');
      const matches = group.examples.filter((peer) => peer.order === order && peer !== example);
      shared.textContent = matches.length
        ? `Same recommendation order as customer${matches.length > 1 ? 's' : ''} ${matches.map((peer) => peer.number).join(', ')}.`
        : 'Distinct order within this segment.';
      const list = document.createElement('ol');
      for (const item of items) {
        const entry = document.createElement('li');
        entry.value = item.rank;
        entry.textContent = item.component;
        list.append(entry);
      }
      const duplicate = document.createElement('p');
      duplicate.className = 'small-note';
      const omitted = sample.recommendations.filter((item) => !items.some((kept) => kept.rank === item.rank));
      duplicate.textContent = omitted.length
        ? `Duplicate omitted: ${omitted.map((item) => `${item.component} (rank ${item.rank})`).join(', ')}.`
        : 'All five recommendations retained.';
      duplicate.textContent += ' Wallets ranked 1-2 stay in the hero; lower-ranked wallets have separate sections. An absent Credit Card wallet appears after Credit Card offers and its points-reward bar, regardless of the offers rank. Partner rewards follows ranked sections, then unranked Marketing banners. Tablet/App adds an unranked stamp card above Partner rewards; desktop excludes stamp cards. Source ranks are preserved.';
      const link = document.createElement('a');
      link.className = 'primary-button';
      link.href = `./prototype.html?dataset=${version}&sample=${encodeURIComponent(sample.id)}`;
      link.textContent = 'Open prototype';
      link.setAttribute('aria-label', `Open ${segmentLabel} customer ${number} prototype`);
      const separate = link.cloneNode(true);
      separate.className = 'secondary-button';
      separate.target = '_blank';
      separate.rel = 'noopener';
      separate.textContent = 'Open in separate tab';
      separate.setAttribute('aria-label', `Open ${segmentLabel} customer ${number} in separate tab`);
      card.append(label, title, shared, list, duplicate, link, separate);
      grid.append(card);
    }
    section.append(heading, intro, grid);
    sections.set(section.id, section);
    document.getElementById('persona-gallery').append(section);
  }
  addFilter('all', 'All segments', samples.length);
  const restoreFilter = () => selectSegment(location.hash.slice(1) || sections.keys().next().value);
  restoreFilter();
  window.scrollTo({ top: 0, behavior: 'instant' });
  window.addEventListener('popstate', restoreFilter);
  window.addEventListener('hashchange', restoreFilter);
} catch (error) {
  status.className = 'gallery-error';
  status.textContent = `Unable to build persona gallery: ${error.message}`;
}
