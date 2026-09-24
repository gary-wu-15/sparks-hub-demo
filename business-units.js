export const BUSINESS_UNITS = [
  { id: 'food', label: 'Food' },
  { id: 'clothing', label: 'Clothing' },
  { id: 'home', label: 'Home' },
  { id: 'credit_card', label: 'Credit Card' },
  { id: 'flowers', label: 'Flowers' },
  { id: 'unassigned', label: 'Unassigned' }
];

const referenceAssignments = {
  cafe: 'food',
  flowers: 'flowers',
  shirts: 'clothing',
  italian: 'food',
  suits: 'clothing',
  sandwich: 'food',
  coffee: 'food',
  cheese: 'food',
  champagne: 'food',
  grill: 'food',
  cocktails: 'food'
};

export const COMPONENT_BUSINESS_UNITS = {
  credit_card_wallet: 'credit_card',
  credit_card_offers: 'credit_card'
};

export function offerBusinessUnit(offer) {
  return offer.businessUnit ?? (Object.hasOwn(referenceAssignments, offer.id) ? referenceAssignments[offer.id] : 'unassigned');
}

export function businessUnitLabel(id) {
  return BUSINESS_UNITS.find((unit) => unit.id === id)?.label || 'Unassigned';
}
