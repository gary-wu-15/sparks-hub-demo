import { businessUnitLabel } from './business-units.js';

export const DEFAULT_OFFER_FILTERS = Object.freeze({ category: 'all', expiry: 'all', sort: 'default' });
export const EXPIRY_FILTERS = [
  { id: 'all', label: 'Any expiry' },
  { id: '7', label: 'Within 7 days' },
  { id: '14', label: 'Within 14 days' },
  { id: '30', label: 'Within 30 days' },
  { id: 'expired', label: 'Already expired' },
  { id: 'unknown', label: 'Expiry not specified' }
];
export const OFFER_SORTS = [
  { id: 'default', label: 'Default order' },
  { id: 'category', label: 'Category (A-Z)' },
  { id: 'soonest', label: 'Expiry (soonest first)' },
  { id: 'latest', label: 'Expiry (latest first)' }
];
const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const ukDate = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', year: 'numeric', month: 'numeric', day: 'numeric' });

export function offerExpiryDays(offer, now = new Date()) {
  const badge = offer.badge.trim();
  const countdown = /^(\d+) days? (?:to earn|to use|left|remaining)$/i.exec(badge);
  if (countdown) {
    const days = Number(countdown[1]);
    return Number.isSafeInteger(days) ? days : null;
  }
  const date = /^Ends (\d{1,2}) ([A-Za-z]{3}) (\d{4})$/i.exec(badge);
  if (!date) return null;
  const [, day, month, year] = date;
  const monthIndex = months.indexOf(month.toLowerCase());
  if (monthIndex < 0 || Number(year) < 1000) return null;
  const end = new Date(Date.UTC(Number(year), monthIndex, Number(day)));
  if (end.getUTCDate() !== Number(day) || end.getUTCMonth() !== monthIndex) return null;
  // Compare calendar days in the UK, not elapsed hours across DST changes.
  const today = Object.fromEntries(ukDate.formatToParts(now).map((part) => [part.type, part.value]));
  return (end.getTime() - Date.UTC(Number(today.year), Number(today.month) - 1, Number(today.day))) / 86400000;
}

export function selectOffers(offers, filters = DEFAULT_OFFER_FILTERS, query = '', now = new Date()) {
  const selected = offers.map((offer) => ({ offer, days: offerExpiryDays(offer, now) })).filter(({ offer, days }) => {
    if (!`${offer.title} ${offer.description}`.toLowerCase().includes(query.toLowerCase())) return false;
    if (filters.category !== 'all' && offer.businessUnit !== filters.category) return false;
    if (filters.expiry === 'unknown') return days === null;
    if (filters.expiry === 'expired') return days !== null && days < 0;
    return filters.expiry === 'all' || (days !== null && days >= 0 && days <= Number(filters.expiry));
  });
  selected.sort((a, b) => {
    if (filters.sort === 'category') return businessUnitLabel(a.offer.businessUnit).localeCompare(businessUnitLabel(b.offer.businessUnit), 'en-GB');
    if (filters.sort === 'default') return 0;
    if (a.days === null || b.days === null) return a.days === b.days ? 0 : a.days === null ? 1 : -1;
    return filters.sort === 'latest' ? b.days - a.days : a.days - b.days;
  });
  return selected.map(({ offer }) => offer);
}
