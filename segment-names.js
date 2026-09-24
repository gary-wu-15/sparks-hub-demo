const displayNames = {
  'Prize Draw Enthusiasts': 'Prize Draw Lovers',
  'Cashback Trackers': 'Value Un-lockers',
  'Charity Champions': 'Charity Champions',
  'Credit Card Maximisers': 'Credit-Card Maximisers',
  'New / Exploring Members': 'New / Exploring members',
  'Young Family Members': 'Parenthood members',
  'Promo-Responsive Browsers': 'Coffee Stamp Collectors',
  'Coffee Stamps Enthusiasts': 'Coffee Stamp Collectors'
};

export function segmentDisplayName(segment, rankingSchema) {
  if (segment === 'Promo-Responsive Browsers' && rankingSchema === 'separate-coffee') return segment;
  return Object.hasOwn(displayNames, segment) ? displayNames[segment] : segment;
}

export function personaDisplayName(name, rankingSchema) {
  for (const source of Object.keys(displayNames)) {
    if (name.startsWith(`${source} / `)) return segmentDisplayName(source, rankingSchema) + name.slice(source.length);
  }
  return name;
}
