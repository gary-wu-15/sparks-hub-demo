import { normalizeHub } from './data.js';
import { rankedComponents, validateRecommendations } from './components.js';
import { segmentDisplayName } from './segment-names.js';

export const DEFAULT_DATASET = 'v3';
export const DATASETS = {
  v1: { file: 'engine.csv', label: 'Illustrative prototype dataset (v1)', profilePrefix: 'engine-', rankingSchema: 'legacy-banners' },
  v2: { file: 'engine-v2.csv', label: 'Illustrative prototype dataset (v2)', profilePrefix: 'engine-v2-', rankingSchema: 'legacy-banners' },
  v3: { file: 'engine-v3.csv', label: 'Illustrative prototype dataset (v3)', profilePrefix: 'engine-v3-', rankingSchema: 'separate-coffee' }
};

export function getDataset(version = DEFAULT_DATASET) {
  if (!Object.hasOwn(DATASETS, version)) throw new Error(`Unknown dataset: ${version}. Choose ${Object.keys(DATASETS).join(', ')} from the persona gallery.`);
  return DATASETS[version];
}

export function sampleProfileId(sample, version = DEFAULT_DATASET) {
  return getDataset(version).profilePrefix + sample.id;
}

export function groupPersonaSamples(samples, version = DEFAULT_DATASET) {
  const { rankingSchema } = getDataset(version);
  return [...Map.groupBy(samples, (sample) => sample.segment)].map(([segment, customers]) => {
    const orders = [];
    const examples = customers.map((sample, index) => {
      const items = rankedComponents(sample.recommendations, rankingSchema);
      const signature = JSON.stringify(items.map((item) => item.component));
      if (!orders.includes(signature)) orders.push(signature);
      return { sample, number: index + 1, items, order: orders.indexOf(signature) + 1 };
    });
    return { segment, examples, orderCount: orders.length };
  });
}

const numeric = (value) => typeof value === 'number' || (typeof value === 'string' && value.trim()) ? Number(value) : NaN;

// Parse quoted JSON cells, escaped quotes and both CSV newline conventions.
export function parseCsv(text) {
  const rows = [];
  let row = [], cell = '', quoted = false, closed = false;
  text = text.replace(/^\uFEFF/, '');
  const finishCell = () => { row.push(cell); cell = ''; closed = false; };
  const finishRow = () => {
    finishCell();
    if (row.some((value) => value.trim())) rows.push(row);
    row = [];
  };
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (char === '"') { quoted = false; closed = true; }
      else cell += char;
    } else if (char === ',') finishCell();
    else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i++;
      finishRow();
    } else if (char === '"' && cell === '' && !closed) quoted = true;
    else {
      if (closed || char === '"') throw new Error('Malformed CSV quoting.');
      cell += char;
    }
  }
  if (quoted) throw new Error('Unterminated quoted CSV cell.');
  if (cell || row.length || closed) finishRow();
  return rows;
}

export function parsePersonas(text) {
  const [header, ...rows] = parseCsv(text);
  const fields = ['customer_id_mock', 'customer_segment', 'top_5_components'];
  if (!header || fields.some((field) => !header.includes(field)) || new Set(header).size !== header.length) {
    throw new Error(`CSV must have unique headers including ${fields.join(', ')}.`);
  }
  if (!rows.length) throw new Error('The CSV has no customer examples.');
  const ids = new Set();
  return rows.map((row, index) => {
    if (row.length !== header.length) throw new Error(`CSV row ${index + 2} has the wrong number of cells.`);
    const [id, segment, json] = fields.map((field) => row[header.indexOf(field)].trim());
    if (!/^[a-zA-Z0-9_-]+$/.test(id) || ids.has(id) || !segment) {
      throw new Error(`CSV row ${index + 2} needs a unique customer ID and a segment.`);
    }
    ids.add(id);
    const raw = JSON.parse(json);
    if (!Array.isArray(raw) || raw.length !== 5) throw new Error(`Customer ${id} must have five ranked entries.`);
    const recommendations = raw.map((item) => ({
      component: item.hub_component,
      rank: numeric(item?.rank),
      score: numeric(item?.score),
      source: item.source
    }));
    validateRecommendations(recommendations);
    if (recommendations.some((item) => item.rank > 5)) throw new Error(`Customer ${id} must have ranks 1 to 5.`);
    return { id, segment, recommendations };
  });
}

export async function loadPersonaSamples(version = DEFAULT_DATASET) {
  const response = await fetch(`./samples/${getDataset(version).file}`, { credentials: 'omit', signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`Could not load demo persona CSV (HTTP ${response.status}).`);
  return parsePersonas(await response.text());
}

export function makePersona(baseline, sample, version = DEFAULT_DATASET) {
  const hub = structuredClone(baseline);
  const dataset = getDataset(version);
  hub.rankingSchema = dataset.rankingSchema;
  hub.persona = {
    id: sampleProfileId(sample, version),
    name: `${segmentDisplayName(sample.segment, hub.rankingSchema)} / ${sample.id} (${version})`,
    description: `${dataset.label}. Numeric rankings apply below the hero, subject to device exclusions, priority overrides and the standard stamp/partner/marketing placements. Duplicate components keep their highest rank. Content and balances are illustrative, not supplied by the ranking engine.`
  };
  hub.customer = { name: 'Alex', creditRewards: 5, sparksRewards: 15, points: 120 };
  hub.charity.raised = 125000;
  hub.charity.total = 2000000;
  hub.recommendations = structuredClone(sample.recommendations);
  return normalizeHub(hub);
}
