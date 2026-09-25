export const COMPONENT_IDS = [
  'sparks_wallet', 'credit_card_wallet', 'sparks_offers', 'prize_draws',
  'banners', 'charity', 'sparks_card', 'how_it_works', 'credit_card_offers',
  'partnership_offers', 'baby_club', 'cafe_stamp_card'
];

export const PROVISIONAL_COMPONENTS = [
  'sparks_card', 'how_it_works', 'credit_card_offers', 'partnership_offers'
];

export const HERO_COMPONENT_IDS = ['sparks_wallet', 'credit_card_wallet', 'sparks_card', 'how_it_works'];
export const STATIC_COMPONENT_IDS = ['partnership_offers', 'banners'];
export const PREVIEW_OVERRIDE_DEFAULTS = Object.freeze({ sparksTuesdays: false, coffeeCompletion: false, bannersAtBottom: false, walletsInHero: false });
export const DEFAULT_RANKING_SCHEMA = 'legacy-banners';
export const RANKING_SCHEMAS = [DEFAULT_RANKING_SCHEMA, 'separate-coffee'];

export function staticTailComponents(recommendations, rankingSchema, overrides = PREVIEW_OVERRIDE_DEFAULTS) {
  const rankedBanners = !overrides.bannersAtBottom && recommendations && rankedComponents(recommendations, rankingSchema).some((item) => item.component === 'banners');
  return STATIC_COMPONENT_IDS.filter((id) => id !== 'banners' || !rankedBanners);
}

export function priorityOverrideComponents(overrides = PREVIEW_OVERRIDE_DEFAULTS) {
  return [
    ...(overrides.sparksTuesdays ? ['sparks_offers'] : []),
    ...(overrides.coffeeCompletion ? ['cafe_stamp_card'] : [])
  ];
}

export function isFeaturedStampReward(recommendations, rankingSchema) {
  return Boolean(recommendations &&
    rankedComponents(recommendations, rankingSchema).some((item) => item.component === 'cafe_stamp_card' && item.rank === 1));
}

export function heroWalletVisibility(recommendations, rankingSchema, overrides = PREVIEW_OVERRIDE_DEFAULTS) {
  if (overrides.walletsInHero || !recommendations) return { sparks: true, credit: true };
  const components = rankedComponents(recommendations, rankingSchema).filter((item) => item.rank <= 2).map((item) => item.component);
  return {
    sparks: components.includes('sparks_wallet'),
    credit: components.includes('credit_card_wallet')
  };
}

export function walletPlacements(recommendations, rankingSchema) {
  if (!recommendations) return [];
  const ranked = rankedComponents(recommendations, rankingSchema);
  const wallets = ranked.filter((item) => ['sparks_wallet', 'credit_card_wallet'].includes(item.component));
  const offers = ranked.find((item) => item.component === 'credit_card_offers');
  if (offers && !wallets.some((item) => item.component === 'credit_card_wallet')) {
    wallets.push({ ...offers, component: 'credit_card_wallet', sourceComponent: 'credit_card_offers' });
  }
  return wallets.sort((a, b) => a.rank - b.rank);
}

export function rankedLayoutComponents(recommendations, rankingSchema) {
  const ranked = rankedComponents(recommendations, rankingSchema);
  const implied = walletPlacements(recommendations, rankingSchema).find((item) => item.sourceComponent === 'credit_card_offers');
  return implied ? ranked.flatMap((item) => item.component === 'credit_card_offers' ? [item, implied] : [item]) : ranked;
}

export function validateRecommendations(items) {
  if (!Array.isArray(items) || items.length < 1 || items.length > 100) {
    throw new Error('Recommendations must contain between 1 and 100 entries.');
  }
  const ranks = new Set();
  for (const item of items) {
    if (!item || (!COMPONENT_IDS.includes(item.component) && item.component !== 'coffee_stamps')) throw new Error(`Unknown component: ${item?.component}`);
    if (!Number.isSafeInteger(item.rank) || item.rank < 1 || ranks.has(item.rank)) {
      throw new Error('Recommendation ranks must be unique positive integers.');
    }
    ranks.add(item.rank);
    if (!Number.isFinite(item.score) || typeof item.source !== 'string' || !item.source.trim()) {
      throw new Error('Each recommendation needs a finite score and a source.');
    }
  }
  return items;
}

export function rankedComponents(items, rankingSchema = DEFAULT_RANKING_SCHEMA) {
  validateRecommendations(items);
  if (!RANKING_SCHEMAS.includes(rankingSchema)) throw new Error(`Unknown rankingSchema: ${rankingSchema}`);
  const seen = new Set();
  return [...items].sort((a, b) => a.rank - b.rank).filter((item) => {
    const component = rankedComponentId(item.component, rankingSchema);
    if (seen.has(component)) return false;
    seen.add(component);
    return true;
  }).map((item) => {
    const component = rankedComponentId(item.component, rankingSchema);
    return component === item.component ? item : { ...item, component, sourceComponent: item.component };
  });
}

export const rankedComponentId = (component, rankingSchema = DEFAULT_RANKING_SCHEMA) =>
  component === 'coffee_stamps' || (component === 'banners' && rankingSchema === 'legacy-banners')
    ? 'cafe_stamp_card' : component;
