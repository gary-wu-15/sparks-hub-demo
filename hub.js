import { fetchHub, loadSaved, normalizeHub } from './data.js';
import { offerReferences, appLinks } from './reference-content.js';
import { carousel, mountCarousels } from './carousel.js';
import { rankedLayoutComponents, walletPlacements, HERO_COMPONENT_IDS, staticTailComponents, heroWalletVisibility, isFeaturedStampReward, priorityOverrideComponents } from './components.js';
import { BUSINESS_UNITS, COMPONENT_BUSINESS_UNITS } from './business-units.js';
import { DEFAULT_OFFER_FILTERS, EXPIRY_FILTERS, OFFER_SORTS, selectOffers } from './offer-filters.js';

const app = document.getElementById('app');
const dialog = document.getElementById('detail-dialog');
const money = (value) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: value % 1 ? 2 : 0 }).format(value);
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const shapes = {
  arrow: '<path d="M3 12h17m-6-6 6 6-6 6"/>',
  search: '<circle cx="10" cy="10" r="7"/><path d="m15 15 6 6"/>',
  browse: '<path d="M1 4h6M1 11h4M1 18h6m11-1 5 5"/><circle cx="14" cy="10" r="8"/>',
  more: '<circle cx="4" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="20" cy="12" r="2"/>',
  user: '<circle cx="12" cy="6" r="4"/><path d="M3 22c0-13 18-13 18 0Z"/>',
  star: '<path d="m12 2 3 6 7 1-5 5 1 8-6-4-6 4 1-8-5-5 7-1Z"/>',
  heart: '<path d="M12 21C-8 8 4-3 12 6c8-9 20 2 0 15Z"/>',
  bag: '<path d="M5 6h14l1 16H4ZM9 8V5c0-5 6-5 6 0v3"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 10v7m0-11v1"/>',
  card: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 9h20M5 16h5"/>',
  barcode: '<path d="M2 7V2h5m10 0h5v5M2 17v5h5m10 0h5v-5M4 7v10m3-10v10m3-10v10m2-10v10m3-10v10m3-10v10m2-10v10"/>',
  chevron: '<path d="m9 4 8 8-8 8"/>',
  check: '<path d="m3 12 6 6L21 5"/>',
  truck: '<path d="M2 4h12v12H2Zm12 5h5l3 5v2h-8"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="18" r="2"/>',
  shop: '<path d="M3 9h18v13H3Zm0-6h18v6H3ZM8 3v6m8-6v6M9 22v-8h6v8"/>',
  returns: '<path d="M2 7h20v15H2Zm4 4h12M12 1v5m-3-3 3 3 3-3"/>',
  menu: '<path d="M3 5h18M3 12h18M3 19h18"/>'
};
const brandIcons = new Set(['arrow', 'search', 'star', 'heart', 'bag', 'menu', 'close']);
const icon = (name) => brandIcons.has(name)
  ? `<span class="mns-icon" data-icon="${name}" aria-hidden="true"></span>`
  : `<svg viewBox="0 0 24 24" aria-hidden="true">${shapes[name] || shapes.arrow}</svg>`;
const action = (name, label, cls = '', id = '') => `<button class="${cls}" data-action="${name}" data-id="${esc(id)}">${label}</button>`;
const image = (src, alt = '', cls = '') => `<img src="${esc(src)}" alt="${esc(alt)}" class="${cls}" loading="lazy">`;
let data;
let state = { activated: [], entered: [], spent: 0, charity: null, linkedDemoCard: false, cafeStamps: null };
let query = '';
let offerFilters = { ...DEFAULT_OFFER_FILTERS };
let offerFilterChoice = 'all';
let toastTimer;
let dialogOpener;
let disposeCarousels = () => {};
const mobileLayout = matchMedia('(max-width: 540px)');
mobileLayout.addEventListener('change', () => render());
const desktopLayout = matchMedia('(min-width: 1024px)');
desktopLayout.addEventListener('change', () => render());
const stateKey = () => `sparks-public-gallery-interactions-v1:${data?.persona?.id || 'demo'}`;

function notify(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.textContent = ''; }, 3500);
}
function readState() {
  state = { activated: [], entered: [], spent: 0, charity: null, linkedDemoCard: false, cafeStamps: null };
  try {
    const saved = JSON.parse(localStorage.getItem(stateKey()) || 'null');
    if (saved) {
      if (!Array.isArray(saved.activated) || !saved.activated.every((id) => typeof id === 'string') ||
          !Array.isArray(saved.entered) || !saved.entered.every((id) => typeof id === 'string') ||
          !Number.isFinite(saved.spent) || saved.spent < 0 ||
          !(saved.charity === null || typeof saved.charity === 'string') ||
          (saved.linkedDemoCard !== undefined && typeof saved.linkedDemoCard !== 'boolean') ||
          (saved.cafeStamps !== undefined && saved.cafeStamps !== null && (!Number.isSafeInteger(saved.cafeStamps) || saved.cafeStamps < 0 || saved.cafeStamps > 50))) throw new Error('Invalid saved interaction data.');
      state = { ...state, ...saved };
    }
  } catch (error) { notify(`Could not restore activity: ${error.message}`); }
}
function updateState(next) {
  try {
    localStorage.setItem(stateKey(), JSON.stringify(next));
    state = next;
    render();
    return true;
  } catch (error) {
    notify(`Could not save this action: ${error.message}`);
    return false;
  }
}
function offerProgress(offer) {
  return `<div class="progress-track" role="progressbar" aria-label="Spend progress" aria-valuemin="0" aria-valuemax="${offer.target}" aria-valuenow="${offer.target - offer.remaining}"><span class="progress-fill" style="width:${(1 - offer.remaining / offer.target) * 100}%"></span><span class="gold-star">✦</span></div><span class="progress-label">${money(offer.remaining)} left</span>`;
}
const isOfferActivated = (offer) => state.activated.includes(offer.id) || offer.status === 'active';
const belongsInActivatedOffers = (offer) => isOfferActivated(offer) || offer.status === 'shop';
const sparksOffers = () => data.previewOverrides.sparksTuesdays ? [...data.tuesdayOffers, ...data.offers] : data.offers;
const newOfferTag = (offer) => data.previewOverrides.sparksTuesdays && data.tuesdayOffers.some((item) => item.id === offer.id)
  ? '<span class="new-offer-tag">New</span>' : '';
function offerCard(offer, compact = false, variant = 'standard') {
  const active = isOfferActivated(offer);
  const activatedTick = variant === 'baby' && active && offer.remaining === undefined;
  let bottom;
  if (active && offer.remaining !== undefined) {
    bottom = offerProgress(offer);
  } else if (active) {
    bottom = '<span class="activated-label"><span class="gold-star">✓</span> Offer activated</span>';
  } else if (offer.status === 'shop') {
    bottom = '<span class="earn-shop"><span class="gold-star">✦</span> Earn in one shop</span>';
  } else {
    bottom = action('activate', 'Activate offer', 'outline-button', offer.id);
  }
  const content = `<span class="photo-wrap">${image(offer.image)}<span class="badge">${esc(offer.badge)}</span></span><span class="offer-copy">${newOfferTag(offer)}${activatedTick ? `<span class="baby-activated-tick">${icon('check')}<span class="sr-only">Offer activated</span></span>` : ''}<strong>${esc(offer.title)}</strong><span class="offer-description">${esc(offer.description)}</span></span>`;
  return `<article class="offer-card ${esc(offer.theme)}${compact ? ' compact-offer' : ''}" data-business-unit="${esc(offer.businessUnit)}">${action('offer', content + (compact && !activatedTick ? `<div class="offer-bottom">${bottom}</div>` : ''), 'card-main', offer.id)}${compact || activatedTick ? '' : `<div class="offer-bottom">${bottom}</div>`}</article>`;
}
function activatedOfferCard(offer) {
  const progress = !isOfferActivated(offer) && offer.status === 'shop'
    ? '<span class="earn-shop"><span class="gold-star">✦</span> Earn in one shop</span>'
    : offer.remaining !== undefined
    ? `<span class="sr-only">Offer activated.</span>${offerProgress(offer)}`
    : '<span class="activated-label"><span class="gold-star">✓</span> Offer activated</span>';
  const content = `<span class="photo-wrap">${image(offer.image)}</span><div class="offer-copy"><span class="badge">${esc(offer.badge)}</span>${newOfferTag(offer)}<strong>${esc(offer.title)}</strong><span class="offer-description">${esc(offer.description)}</span><div class="offer-bottom">${progress}</div></div><span class="activated-offer-chevron">${icon('chevron')}</span>`;
  return `<article class="offer-card activated-offer ${esc(offer.theme)}" data-business-unit="${esc(offer.businessUnit)}">${action('offer', content, 'card-main', offer.id)}</article>`;
}
function offersLayout(offers) {
  if (!offers.length) return '<div class="offer-grid"><p class="no-offers">No matching offers. Try changing your filters or search.</p></div>';
  const activated = offers.filter(belongsInActivatedOffers);
  const available = offers.filter((offer) => !belongsInActivatedOffers(offer));
  const activatedRow = activated.length ? `<div class="activated-offers"><h3>Activated offers &amp; missions</h3><div class="persona-offer-carousel">${carousel('activated-sparks-offers', 'Activated offers and missions', activated.map(activatedOfferCard))}</div></div>` : '';
  const availableRow = available.length ? `<div class="available-offers">${activated.length || data.previewOverrides.sparksTuesdays ? '<h3>More offers for you</h3>' : ''}<div class="persona-offer-carousel">${carousel('sparks-offers', 'Sparks offers', available.map((offer) => offerCard(offer)))}</div></div>` : '';
  return data.previewOverrides.sparksTuesdays ? availableRow + activatedRow : activatedRow + availableRow;
}
function partnersLayout() {
  const cards = data.partners.map((partner) => `<article class="partner-card">${image(partner.image, partner.brand)}${partner.badge ? `<span class="badge">${esc(partner.badge)}</span>` : ''}<div class="partner-overlay"><strong>${esc(partner.title)}</strong><p>${esc(partner.description)}</p>${action('partner', `${esc(partner.cta || 'Book now')} ${icon('arrow')}`, 'outline-button', partner.id)}</div></article>`);
  return `<div class="persona-offer-carousel partner-carousel">${carousel('partner-rewards', 'partner rewards', cards)}</div>`;
}
function offerFilterOptions() {
  const categories = BUSINESS_UNITS.filter((unit) =>
    sparksOffers().some((offer) => offer.businessUnit === unit.id) || offerFilters.category === unit.id);
  return [
    { value: 'all', label: 'All offers', filters: DEFAULT_OFFER_FILTERS },
    ...[['category', categories], ['expiry', EXPIRY_FILTERS.filter((option) => option.id !== 'all')], ['sort', OFFER_SORTS.filter((option) => option.id !== 'default')]]
      .flatMap(([field, options]) => options.map((option) => ({
        value: `${field}:${option.id}`, label: option.label, filters: { ...DEFAULT_OFFER_FILTERS, [field]: option.id }
      })))
  ];
}
function offerFilterSummary(count) {
  if (offerFilterChoice === 'all') return '';
  const selected = offerFilterOptions().find((option) => option.value === offerFilterChoice);
  return `<p class="offer-filter-summary" role="status">${count} ${count === 1 ? 'offer' : 'offers'} · ${esc(selected.label)} ${action('reset-offer-filters', 'Clear filter', 'text-button')}</p>`;
}
function offerFilterControl() {
  return `<button id="offer-filter" class="offers-filter${offerFilterChoice === 'all' ? '' : ' is-active'}" type="button" popovertarget="offer-filter-menu" aria-haspopup="listbox" aria-expanded="false" aria-controls="offer-filter-menu" aria-describedby="offer-filter-help"><span>Filter</span>${icon('chevron')}</button><div id="offer-filter-menu" popover="auto" role="listbox" aria-label="Filter offers">${offerFilterOptions().map((option) =>
    `<button type="button" role="option" tabindex="-1"${offerFilterChoice === option.value ? ' autofocus' : ''} data-action="choose-offer-filter" data-id="${option.value}" aria-selected="${offerFilterChoice === option.value}"><span class="filter-check" aria-hidden="true">${offerFilterChoice === option.value ? '✓' : ''}</span><span>${esc(option.label)}</span></button>`).join('')}</div>`;
}
function positionOfferFilterMenu() {
  const menu = app.querySelector('#offer-filter-menu');
  if (!menu) return;
  const anchor = app.querySelector('#offer-filter').getBoundingClientRect();
  const root = document.documentElement;
  const top = Number.parseFloat(root.style.getPropertyValue('--preview-top')) || 0;
  const height = Number.parseFloat(root.style.getPropertyValue('--preview-height')) || innerHeight;
  const bottom = Math.min(innerHeight, top + height);
  const width = Math.min(268, innerWidth - 16);
  const menuHeight = Math.min(320, bottom - top - 16);
  const below = bottom - anchor.bottom - 8;
  const above = anchor.top - top - 8;
  const preferredTop = below < menuHeight && above > below ? anchor.top - menuHeight - 4 : anchor.bottom + 4;
  menu.style.width = `${width}px`;
  menu.style.maxHeight = `${menuHeight}px`;
  menu.style.left = `${Math.max(8, Math.min(anchor.right - width, innerWidth - width - 8))}px`;
  menu.style.top = `${Math.max(top + 8, Math.min(preferredTop, bottom - menuHeight - 8))}px`;
}
function mountOfferFilterMenu() {
  const trigger = app.querySelector('#offer-filter');
  const menu = app.querySelector('#offer-filter-menu');
  if (!menu) return;
  const options = [...menu.querySelectorAll('[role="option"]')];
  const focusOption = (option) => {
    option.focus({ preventScroll: true });
    const offset = option.offsetTop;
    if (offset < menu.scrollTop) menu.scrollTop = offset;
    else if (offset + option.offsetHeight > menu.scrollTop + menu.clientHeight) menu.scrollTop = offset + option.offsetHeight - menu.clientHeight;
  };
  menu.addEventListener('beforetoggle', (event) => {
    trigger.setAttribute('aria-expanded', String(event.newState === 'open'));
    if (event.newState === 'open') positionOfferFilterMenu();
  });
  menu.addEventListener('toggle', () => {
    if (menu.matches(':popover-open') && !menu.contains(document.activeElement)) focusOption(menu.querySelector('[aria-selected="true"]'));
  });
  trigger.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      menu.showPopover();
    }
  });
  let search = '';
  let lastKeyTime = 0;
  menu.addEventListener('keydown', (event) => {
    const index = options.indexOf(document.activeElement);
    let next;
    if (event.key === 'ArrowDown') next = options[(index + 1) % options.length];
    else if (event.key === 'ArrowUp') next = options[(index - 1 + options.length) % options.length];
    else if (event.key === 'Home') next = options[0];
    else if (event.key === 'End') next = options.at(-1);
    else if (event.key === 'Tab') { menu.hidePopover(); return; }
    else if (event.key.length === 1 && event.key !== ' ' && !event.ctrlKey && !event.metaKey && !event.altKey) {
      search = event.timeStamp - lastKeyTime > 700 ? event.key : search + event.key;
      lastKeyTime = event.timeStamp;
      next = options.find((option) => option.lastElementChild.textContent.toLowerCase().startsWith(search.toLowerCase()));
    }
    if (next) { event.preventDefault(); focusOption(next); }
  });
}
function applyOfferFilter(value) {
  const selected = offerFilterOptions().find((option) => option.value === value);
  if (!selected) { notify('This filter is unavailable. Choose an option from the Filter menu.'); return; }
  offerFilterChoice = value;
  offerFilters = { ...selected.filters };
  render();
  app.querySelector('#offer-filter').focus({ preventScroll: true });
}
function bannerDisclosure(banner, collapsible = false) {
  const rate = banner.apr || banner.aprLabel
    ? `<p class="banner-apr">${banner.apr ? `<strong>${esc(banner.apr)}</strong>` : ''}${banner.aprLabel ? `<span>${esc(banner.aprLabel)}</span>` : ''}</p>` : '';
  const disclosure = banner.legal
    ? collapsible
      ? `<details class="banner-info"><summary aria-label="Information about ${esc(banner.title)}">${icon('info')}</summary><p class="banner-legal">${esc(banner.legal)}</p></details>`
      : `<p class="banner-legal">${esc(banner.legal)}</p>`
    : banner.businessUnit === 'credit_card' ? '<p class="small-print">Illustrative rewards information. Full credit offer terms and eligibility are not supplied in this prototype.</p>' : '';
  return collapsible && banner.legal
    ? `<div class="banner-disclosure">${rate}${disclosure}</div>`
    : rate + disclosure;
}
const prizeEntered = (prize) => prize.entered === true || state.entered.includes(prize.id);
function prizesLayout() {
  const cards = data.prizes.map((prize) => {
    const entered = prizeEntered(prize);
    return action('prize', `<span class="prize-copy"><small${entered ? ' class="prize-entered"' : ''}>${entered ? 'Entered' : esc(prize.badge)}</small><strong>${esc(prize.title)}</strong>${entered ? '<span class="sr-only">Entry confirmed</span>' : ''}<span class="prize-cta">${entered ? 'Read T&Cs' : 'Enter to win'} ${icon('arrow')}</span></span>${image(prize.image)}`, 'prize-card', prize.id);
  });
  return `<div class="prize-grid">${cards.join('')}</div>`;
}
const findOffer = (id) => [...sparksOffers(), ...data.creditOffers, ...data.babyOffers].find((offer) => offer.id === id);
const featuredStampReward = () => data.previewOverrides.coffeeCompletion || isFeaturedStampReward(data.recommendations, data.rankingSchema);
const cafeStamps = () => featuredStampReward()
  ? data.cafeStampCard.target
  : Math.min(state.cafeStamps ?? data.cafeStampCard.stamps, data.cafeStampCard.target);
function stampCardMarkup(interactive = true, reward = false) {
  const stamps = cafeStamps();
  const target = data.cafeStampCard.target;
  const complete = stamps === target;
  const remaining = target - stamps;
  const step = 2 * Math.PI * 46 / target;
  const gap = Math.min(3, step / 5);
  const segments = Array.from({ length: target }, (_, index) => `<circle class="stamp-segment${index < stamps ? ' earned' : ''}" cx="50" cy="50" r="46" stroke-dasharray="${step - gap} ${2 * Math.PI * 46 - step + gap}" stroke-dashoffset="${-index * step - gap / 2}"/>`).join('');
  const copy = reward && complete
    ? `<small>STAMP CARD COMPLETE</small><span class="stamp-reward-copy">You’ve earned a free<br>hot drink!</span><span class="stamp-expiry">${data.cafeStampCard.daysToUse} ${data.cafeStampCard.daysToUse === 1 ? 'day' : 'days'} to use</span>`
    : `<strong>${complete ? 'Stamp card complete' : `${remaining} more to go`}</strong><span>${complete ? 'Your free hot drink is ready' : `${remaining} ${remaining === 1 ? 'stamp' : 'stamps'} away from a free hot drink`}</span><span class="stamp-count"><span class="stamp-star"><svg viewBox="0 0 24 24" aria-hidden="true">${shapes.star}</svg></span> ${stamps}/${target} stamps</span>`;
  const body = `<span class="stamp-copy">${copy}</span><span class="stamp-ring" role="progressbar" aria-label="Cafe stamps" aria-valuemin="0" aria-valuemax="${target}" aria-valuenow="${stamps}">${image('./assets/stamp-coffee.png', '', 'stamp-coffee')}<svg viewBox="0 0 100 100" aria-hidden="true">${segments}</svg></span>`;
  return interactive ? action('stamp-card', body, `stamp-card${complete ? ' complete' : ''}`) : `<div class="stamp-card${complete ? ' complete' : ''}">${body}</div>`;
}
function stampSection() {
  const featured = featuredStampReward();
  return `<section class="section stamp-section${featured ? ' stamp-featured' : ''}" data-component="cafe_stamp_card" data-business-unit="food"><h2>${featured ? 'Your morning coffee,<br>is on us!' : 'Stamp card'}</h2>${featured ? '' : '<p class="section-intro">Scan your Sparks card to collect a stamp every time you buy a M&S hot drink in-store</p>'}${stampCardMarkup(true, featured)}</section>`;
}
function stampDrawer() {
  const complete = cafeStamps() === data.cafeStampCard.target;
  const featured = featuredStampReward();
  openDrawer(complete ? 'Your morning coffee, is on us!' : 'Your cafe stamp card',
    `${stampCardMarkup(false, complete)}<p>${complete ? 'Your example stamp card is complete. This prototype does not issue a redeemable voucher.' : 'Scan your Sparks card to collect a stamp every time you buy a M&S hot drink in-store. Use the demo button to preview progress.'}</p>`,
    { footer: featured ? action('close', 'Done') : action(complete ? 'reset-stamps' : 'add-stamp', complete ? 'Reset demo stamp card' : 'Add a demo stamp'), note: `${data.previewOverrides.coffeeCompletion ? 'Coffee Completion previews a completed reward without changing saved stamps. ' : featured ? 'Rank-one cards always preview a completed reward. ' : ''}Simulated stamps only. No purchase is recorded and no real free drink is earned. Days to use is editable design-example copy, not a live expiry countdown. Full reward terms have not been supplied.` });
}
function walletTile(credit = false) {
  const value = credit ? data.customer.creditRewards : Math.max(0, data.customer.sparksRewards - state.spent);
  return `<button class="wallet-tile${credit ? '' : ' gold'}" data-action="${credit ? 'credit' : 'wallet'}" data-component="${credit ? 'credit_card_wallet' : 'sparks_wallet'}"><strong class="wallet-value">${money(value)}</strong><span class="wallet-label">${credit ? 'Credit Card rewards' : 'Sparks rewards'}${icon('chevron')}</span></button>`;
}
function standaloneWallet(component) {
  const credit = component === 'credit_card_wallet';
  const value = credit ? data.customer.creditRewards : Math.max(0, data.customer.sparksRewards - state.spent);
  return `<section class="section standalone-wallet" data-component="${component}"><h2>Your wallet</h2><button class="wallet-tile${credit ? '' : ' gold'}" data-action="${credit ? 'credit' : 'wallet'}"><span class="standalone-wallet-copy"><span class="wallet-label">${credit ? 'Credit Card rewards' : 'Sparks rewards'}${icon('arrow')}</span><strong class="wallet-value">${money(value)}</strong></span>${credit ? '' : '<span class="spend">Spend</span>'}</button></section>`;
}
function sparksHero() {
  const wallets = heroWalletVisibility(data.recommendations, data.rankingSchema);
  return `<section class="sparks-hero" data-component="sparks_hero" aria-label="Sparks hero">
    <div class="hero-header"><div class="member-copy"><h1>Good morning, ${esc(data.customer.name)}</h1></div><button class="sparks-card" data-action="card" aria-label="Sparks card">${icon('barcode')}<span>Sparks card</span></button></div>
    <div class="hero-wallet-heading">${wallets.sparks || wallets.credit ? '<h2>Your wallet</h2>' : ''}${action('how', `${icon('info')}<span>How it works</span>`, 'text-button how-it-works')}</div>
    ${wallets.sparks || wallets.credit ? `<div class="wallet-grid">${wallets.sparks ? walletTile() : ''}${wallets.credit ? walletTile(true) : ''}</div>` : ''}
  </section>`;
}
function footerGroup(title, links) {
  return `<details class="footer-group${mobileLayout.matches ? ' mobile-footer' : ''}"${mobileLayout.matches ? '' : ' open'}><summary${mobileLayout.matches ? '' : ' tabindex="-1"'}>${esc(title)}</summary><div class="footer-group-links">${links.map((label) => action('info', esc(label), '', label)).join('')}</div></details>`;
}
function footer() {
  const groups = {
    'Here to Help': ['Help & contact us', 'Find a store', 'Accessibility in our stores', 'Product recalls'],
    'Delivery & Returns': ["Where's my order?", 'Delivery & collection', 'Guest order tracking', 'Guest order return', 'Returns & refunds'],
    'Shopping with Us': ['Sparks', 'Sparks FAQs', 'Gift card balance', 'Size guides', 'Sustainability'],
    'More from M&S': ['Ocado', 'Corporate site', 'M&S Corporate Gifts', 'M&S Money', 'M&S Opticians', 'Careers']
  };
  return `<footer class="site-footer"><div class="service-strip"><span>${icon('truck')} Free delivery when you spend over £75*</span><span>${icon('shop')} Next-day Click & Collect</span><span>${icon('returns')} Free returns for online orders</span></div><div class="footer-links">${Object.entries(groups).map(([title, links]) => footerGroup(title, links)).join('')}</div><div class="payment-strip"><div class="payments"><span>M&S</span><span class="visa">VISA</span><span class="mastercard">●●</span><span class="amex">AMEX</span><span>Pay</span><span>PayPal</span></div><div class="payment-options"><span>M&S CREDIT CARD</span><span>clearpay ↗</span><span>Pay in 3</span></div></div><div class="legal-footer"><p class="country">🇬🇧 United Kingdom (£)</p><div class="legal-links">${['Terms & Conditions', 'Privacy', 'Cookies', 'Manage cookies', 'Accessibility', 'Modern Slavery Act'].map((label) => action('info', label, '', label)).join('')}</div><p class="copyright">© 2026 Marks and Spencer plc (UK)</p><div class="social-row"><div class="social-icons">${['f', '𝕏', 'p', '▶', '◎'].map((label) => action('info', label, '', 'Social channels')).join('')}</div><div class="app-stores">${action('info', ' Download on the App Store', '', 'M&S app')}${action('info', '▷ Get it on Google Play', '', 'M&S app')}</div></div></div></footer>`;
}
function appNavigation() {
  return `<footer class="app-footer" aria-label="App footer"><nav class="app-navigation" aria-label="App navigation">
    ${action('info', '<span class="app-nav-icon app-home-mark" aria-hidden="true">M&S</span><span>Home</span>', 'app-nav-item', 'M&S Home')}
    ${action('menu', `<span class="app-nav-icon">${icon('browse')}</span><span>Shop</span>`, 'app-nav-item')}
    <button class="app-nav-item" data-action="app-sparks" aria-current="page" aria-label="Sparks, 4 notifications (illustrative)"><span class="app-nav-icon">${icon('star')}<span class="app-nav-badge" aria-hidden="true">4</span></span><span>Sparks</span></button>
    ${action('info', `<span class="app-nav-icon">${icon('bag')}</span><span>Bag</span>`, 'app-nav-item', 'Shopping bag')}
    ${action('app-more', `<span class="app-nav-icon">${icon('more')}</span><span>More</span>`, 'app-nav-item')}
    </nav><div class="app-home-indicator" aria-hidden="true"><span></span></div></footer>`;
}
function charitySection() {
  if (mobileLayout.matches) {
    return `<section class="section charity-section" data-component="charity"><div class="charity-copy"><h2>Charity donations</h2><p class="section-intro">${esc(data.charityIntro)}</p>${action('charity', `Find out more ${icon('arrow')}`, 'text-button')}</div>${image(data.charityImage, 'Supporting Sparks charities', 'charity-hero')}</section>`;
  }
  return `<section class="section charity-section charity-summary" data-component="charity">
    <div class="charity-title"><h2>Your Charity</h2>${action('charity', 'Update', 'text-button')}</div>
    <div class="charity-content">
      <div class="charity-donation">${image(data.charityImage, 'Supporting Sparks charities', 'charity-thumbnail')}<strong class="charity-amount">${money(data.charity.raised)}</strong><small>Raised since ${esc(data.charity.since)}</small></div>
      <p class="charity-total">In total, you've helped us raise <strong>${money(data.charity.total)}</strong> across all charities</p>
    </div>
  </section>`;
}
function render() {
  if (!data) return;
  disposeCarousels();
  const offers = selectOffers(sparksOffers(), offerFilters, query);
  app.innerHTML = `<header class="site-header">
    <div class="announcement">${action('info', '‹', '', 'Latest at M&S')}<span>${esc(data.announcement)}</span>${action('info', '›', 'next', 'Latest at M&S')}${action('info', 'Help', 'help', 'Help')}</div>
    <div class="header-main container"><button data-action="menu" class="mobile-menu" aria-label="Open navigation menu">${icon('menu')}</button><a href="#" class="brand" aria-label="M&S home" data-action="home"><img src="./assets/mands-logo.svg" alt="" width="100" height="40"></a><form class="header-search" role="search"><input aria-label="Search offers" placeholder="Search product, code or brand" value="${esc(query)}"><button aria-label="Search offers">${icon('search')}</button></form><button data-action="search" class="mobile-search-toggle" aria-label="Open search">${icon('search')}</button><div class="header-actions"><button data-action="account" aria-label="Your account">${icon('user')}</button><button data-action="card" class="star-action" aria-label="Your Sparks card">${icon('star')}</button><button data-action="info" data-id="Your favourites" aria-label="Your favourites">${icon('heart')}</button><button data-action="info" data-id="Shopping bag" aria-label="Shopping bag, 1 item">${icon('bag')}<span class="bag-count">1</span></button></div></div>
    <nav class="department-nav container" aria-label="Departments">${['Sale', 'Women', 'Lingerie', 'Men', 'Kids', 'Beauty', 'Home', 'Flowers', 'Gifts', 'Christmas', 'Sports', 'Brands', 'Food', 'Offers', 'Money'].map((item) => action('info', item, '', item)).join('')}</nav>
    </header>
    <main class="container"><nav class="breadcrumbs" aria-label="Breadcrumb">${action('home', 'Home')} / ${action('account', 'Account')} / <span>Offers & Rewards</span></nav>
    ${sparksHero()}
    ${walletPlacements(data.recommendations, data.rankingSchema).filter((item) => item.rank > 2 || item.sourceComponent === 'credit_card_offers').map((item) => standaloneWallet(item.component)).join('')}
    <section class="section credit-section" data-component="credit_card_offers"><h2>Credit Card offers</h2><p class="section-intro">Use your M&S Credit Card to earn points and rewards</p><div class="persona-offer-carousel">${carousel('credit-offers', 'Credit Card offers', data.creditOffers.map((offer) => offerCard(offer)))}</div>${action('credit-points', `${icon('star')}<span><strong>${money(data.customer.creditRewards)} Credit Card points reward</strong><small>${data.customer.points} points · View rewards</small></span>${icon('arrow')}`, 'points-reward')}</section>
    <section class="section offers-section" data-component="sparks_offers"><div class="section-heading"><h2>Sparks offers</h2>${offerFilterControl()}</div><p class="section-intro">Get exclusive rewards when you activate and complete Sparks offers. Tap an offer for details and exclusions</p><p id="offer-filter-help" class="sr-only">Choose one category, expiry or sort option. A new choice replaces the previous one and applies to both offer rows immediately. Expiry uses illustrative displayed dates in UK time; unspecified dates sort last.</p>${query ? `<p class="section-intro">Showing results for “${esc(query)}” · ${action('clear-search', 'Clear search', 'text-button')}</p>` : ''}${offerFilterSummary(offers.length)}${offersLayout(offers)}</section>
    <section class="section baby-section" data-component="baby_club"><h2>The parent hood</h2><p class="section-intro">Exclusive offers, perks and expert tips from the Sparks baby club</p>${action('baby-benefits', `View articles and benefits ${icon('arrow')}`, 'text-button')}<div class="persona-offer-carousel">${carousel('baby-offers', 'baby club offers', data.babyOffers.map((offer) => offerCard(offer, false, 'baby')))}</div></section>
    ${stampSection()}
    <section class="section partner-section" data-component="partnership_offers"><h2>Partner rewards</h2><p class="section-intro">Earn big rewards into your wallet when you book with Virgin through Sparks</p>${action('partners', `More about Virgin Rewards ${icon('arrow')}`, 'text-button')}${partnersLayout()}</section>
    <section class="section" data-component="prize_draws"><h2>Prize draws</h2><p class="section-intro">Enter our latest draw for your chance to win exclusive experiences and prizes</p>${prizesLayout()}</section>
    <section class="section banner-section" data-component="banners" aria-label="Marketing banners"><h2 class="sr-only">Marketing banners</h2><div class="banner-grid">${data.banners.map((banner) => `<article class="feature-card promo-${esc(banner.theme)}" data-business-unit="${esc(banner.businessUnit)}"><div class="feature-copy"><h3>${esc(banner.title)}</h3><p>${esc(banner.description)}</p>${bannerDisclosure(banner, true)}${action('feature', `${esc(banner.cta)} ${icon('arrow')}`, 'text-button', banner.id)}</div>${image(banner.image, banner.title)}</article>`).join('')}</div></section>
    ${charitySection()}</main>
    ${footer()}${appNavigation()}${action('feedback', 'Feedback', 'feedback-tab')}`;
  const staticIds = staticTailComponents(data.recommendations, data.rankingSchema, data.previewOverrides);
  const staticSections = staticIds.map((id) => app.querySelector(`[data-component="${id}"]`));
  const stamp = app.querySelector('[data-component="cafe_stamp_card"]');
  const prioritySections = priorityOverrideComponents(data.previewOverrides).map((id) => app.querySelector(`[data-component="${id}"]`));
  if (data.recommendations) applyRankedLayout(staticIds);
  for (const section of prioritySections) {
    section.dataset.priorityOverride = section.dataset.component === 'sparks_offers' ? 'sparksTuesdays' : 'coffeeCompletion';
  }
  const rankedLayout = app.querySelector('.ranked-components');
  if (rankedLayout) rankedLayout.prepend(...prioritySections);
  else app.querySelector('.sparks-hero').after(...prioritySections);
  // Desktop exclusion takes precedence over source ranks and Coffee Completion.
  if (desktopLayout.matches) stamp.remove();
  const staticLayout = document.createElement('div');
  staticLayout.className = 'static-components';
  staticLayout.append(...staticSections);
  app.querySelector('main').append(staticLayout);
  if (!desktopLayout.matches && !stamp.dataset.rank && !stamp.dataset.priorityOverride) {
    staticLayout.before(stamp);
  }
  for (const [component, businessUnit] of Object.entries(COMPONENT_BUSINESS_UNITS)) {
    app.querySelectorAll(`[data-component="${component}"]`).forEach((section) => { section.dataset.businessUnit = businessUnit; });
  }
  const creditWallet = app.querySelector('.wallet-tile[data-action="credit"]');
  if (creditWallet) creditWallet.dataset.businessUnit = COMPONENT_BUSINESS_UNITS.credit_card_wallet;
  disposeCarousels = mountCarousels(app);
  mountOfferFilterMenu();
}

function applyRankedLayout(staticIds) {
  const main = app.querySelector('main');
  const sections = [...main.querySelectorAll(':scope > .section')];
  const components = Object.fromEntries(sections.map((section) => [section.dataset.component, section]));
  const hero = app.querySelector('.sparks-hero');
  const heroControls = {
    sparks_wallet: hero.querySelector('[data-action="wallet"]'),
    credit_card_wallet: hero.querySelector('[data-action="credit"]'),
    sparks_card: hero.querySelector('[data-action="card"]'),
    how_it_works: hero.querySelector('[data-action="how"]')
  };
  sections.forEach((section) => section.remove());
  components.charity.remove();
  const layout = document.createElement('div');
  layout.className = 'ranked-components';
  const ranked = rankedLayoutComponents(data.recommendations, data.rankingSchema);
  for (const item of ranked) {
    if (staticIds.includes(item.component)) continue;
    if (HERO_COMPONENT_IDS.includes(item.component) && heroControls[item.component]) {
      const control = heroControls[item.component];
      control.dataset.component = item.component;
      control.dataset.rank = item.rank;
      if (item.sourceComponent) control.dataset.sourceComponent = item.sourceComponent;
      continue;
    }
    const section = components[item.component];
    section.dataset.component = item.component;
    section.dataset.rank = item.rank;
    if (item.sourceComponent) section.dataset.sourceComponent = item.sourceComponent;
    layout.append(section);
  }
  main.append(layout);
}
function openDialog(title, body, button = '', eyebrow = 'YOUR SPARKS') {
  dialog.className = '';
  document.getElementById('dialog-content').innerHTML = `<p class="dialog-eyebrow">${esc(eyebrow)}</p><h2 id="dialog-title">${esc(title)}</h2>${body}${button}<p class="dialog-note">Interactive prototype only. No real transactions, activations or entries are made. Offer terms and dates are illustrative, taken from the supplied design.</p>`;
  window.parent.postMessage({ type: 'hub-dialog' }, location.origin);
  showModal();
}
function showModal() {
  if (dialog.open) return;
  dialogOpener = document.activeElement;
  dialog.showModal();
}
const externalLink = (url, label, cls = '') => `<a href="${esc(url)}" class="${cls}" target="_blank" rel="noopener noreferrer" title="Opens in a new tab">${label}</a>`;
const accordion = (title, content, open = false) => `<details class="drawer-accordion"${open ? ' open' : ''}><summary>${esc(title)}</summary><div class="accordion-copy">${content}</div></details>`;
const unavailableTerms = '<p>The screenshot shows this section collapsed. Full terms have not been supplied, so no additional offer conditions are invented here.</p>';
const unspecifiedTerms = '<p>Full terms and exclusions for this offer have not been supplied. This prototype does not invent eligibility rules or additional conditions.</p>';

function openDrawer(title, body, { hero, tags = '', subtitle = '', footer = '', note = '' } = {}) {
  dialog.className = 'reference-drawer';
  document.getElementById('dialog-content').innerHTML = `<div class="drawer-scroll">${hero ? image(hero, '', 'drawer-hero') : ''}<div class="drawer-content${hero ? ' with-hero' : ''}">${tags}<h2 id="dialog-title">${esc(title)}</h2>${subtitle ? `<p class="offer-subtitle">${esc(subtitle)}</p>` : ''}${body}${note ? `<p class="drawer-disclaimer">${esc(note)}</p>` : ''}</div></div>${footer ? `<div class="drawer-footer">${footer}</div>` : ''}`;
  parent.postMessage({ type: 'hub-dialog' }, location.origin);
  showModal();
  dialog.querySelector('.drawer-scroll').scrollTop = 0;
}

function creditVouchers() {
  const balance = data.customer.creditRewards;
  openDrawer(`${money(balance)} in Rewards vouchers to spend`,
    `<p>Redeem your Rewards vouchers in store with the app or when you pay online.</p>${balance > 0 ? `<div class="voucher-row"><strong class="voucher-value">${money(balance)}</strong><div class="voucher-meta"><strong>More than 60 days to use</strong><span>Expires: 31 August 2027</span><span>In-store & online</span></div></div>` : '<p>No Rewards vouchers available in this demo persona.</p>'}<div class="voucher-terms">${accordion('Terms & Conditions', unavailableTerms)}</div><p class="app-prompt">To redeem your Rewards in store, you'll need the<br>${externalLink(appLinks.overview, 'M&S app')}</p>${externalLink(appLinks.ios, image('./assets/app-store.svg', 'Download on the App Store'), 'app-store-link')}`,
    { note: 'Demo balance and example expiry date. No real voucher is displayed or redeemed. App links open the official M&S download destination.' });
}
function sparksCard() {
  openDrawer('Your Sparks card',
    `<div class="sparks-wordmark" aria-label="Sparks">SP${icon('star')}ARKS</div><p class="demo-card-number">DEMO 0000 0000 0000</p><div class="demo-barcode" role="img" aria-label="Decorative demo barcode, not valid for scanning"></div><p class="card-loaded">${money(data.customer.cardLoaded ?? 0)} loaded</p><p class="card-instructions">Scan your Sparks card in store to use your balance. It will automatically be applied online. Your basket must be equal to or over this amount</p>`,
    { footer: state.linkedDemoCard ? '<button disabled>Demo physical card linked</button>' : action('link-card', 'Link physical card'), note: 'Prototype card only. This is not your real card number or a usable barcode. Loaded card balance is separate from available Sparks rewards.' });
}
function details(offer) {
  const detail = { ...offerReferences[offer.id], ...offer.details };
  const activated = isOfferActivated(offer);
  const singleShop = offer.status === 'shop';
  const needsActivation = offer.status === 'available' && !activated;
  const progress = activated && offer.remaining !== undefined
    ? `<div class="drawer-progress">${offerProgress(offer)}<p>${money(offer.target - offer.remaining)} of ${money(offer.target)} qualifying spend recorded.</p></div>` : '';
  const guidance = needsActivation
    ? 'Activate this offer to start this demo journey. Activation is saved for this persona only.'
    : singleShop
      ? 'This offer needs to be completed in a single shop'
      : 'This offer is activated. Your current progress is shown below.';
  const howToUse = detail.howToUse || (singleShop
    ? 'Complete the spending or purchase requirement shown above in a single qualifying shop. Further redemption instructions have not been supplied.'
    : 'Use this prototype to activate the offer and review its progress. No purchases are tracked or rewards earned in this demo. Further redemption instructions have not been supplied.');
  const shop = detail.shopUrl
    ? externalLink(detail.shopUrl, `${esc(detail.shopLabel || 'Shop the offer')} ${icon('arrow')}`, 'drawer-link')
    : action('card', `View Sparks card ${icon('arrow')}`, 'drawer-link');
  const cta = needsActivation ? action('activate', 'Activate offer', 'drawer-primary', offer.id) : shop;
  openDrawer(offer.title,
    `${detail.body ? `<p>${esc(detail.body)}</p>` : ''}<p class="single-shop-note">${esc(guidance)}</p><div class="drawer-earning"><span class="gold-star">${activated ? '✓' : '★'}</span>${activated ? 'Offer activated' : singleShop ? 'Earn in one shop' : 'Ready to activate'}</div>${progress}${cta}<div class="drawer-accordions">${accordion('What’s included', `<p><strong>Includes</strong><br>${esc(detail.includes || offer.description)}</p><p><strong>Excludes</strong><br>${esc(detail.excludes || 'Full exclusions have not been supplied.')}</p>`, true)}${accordion('How to use', `<p>${esc(howToUse)}</p>`)}${accordion('Terms & Conditions', detail.terms ? `<p>${esc(detail.terms)}</p>` : unspecifiedTerms)}</div>`,
    {
      hero: detail.heroImage || offer.image,
      tags: `<div class="drawer-tags">${newOfferTag(offer)}<span>${esc(offer.badge)}</span>${detail.channel ? `<span>${esc(detail.channel)}</span>` : ''}</div>`,
      subtitle: offer.description,
      note: detail.shopUrl
        ? 'Prototype offer. Shopping links open a relevant public M&S category in a new tab, not a verified promotional deep link. No real activation or reward is created.'
        : 'Prototype offer. A shopping destination has not been supplied; use View Sparks card to continue exploring the demo. No real activation or reward is created.'
    });
}
function sparksWallet() {
  const balance = Math.max(0, data.customer.sparksRewards - state.spent);
  openDrawer('Your Sparks rewards',
    `<p class="wallet-drawer-balance">${money(balance)}</p><p>${balance > 0 ? 'Available in your demo Sparks rewards wallet. These rewards are separate from your Credit Card vouchers and any balance loaded on your Sparks card.' : 'Your demo Sparks rewards have been used. Reset this persona in Content & data to try again.'}</p><div class="drawer-accordions">${accordion('How to use', '<p>Use the demo rewards button to simulate spending this balance. This changes only the selected persona in this browser; it does not make a purchase or load your Sparks card.</p>')}${accordion('Terms & Conditions', unspecifiedTerms)}</div>${action('card', `View Sparks card ${icon('arrow')}`, 'drawer-link')}`,
    { footer: balance > 0 ? action('spend', `Use ${money(balance)} demo rewards`, 'drawer-primary') : action('close', 'Done'), note: 'The flyout pattern follows the supplied references. This Sparks spending journey is illustrative, not a verified live redemption flow.' });
}
document.addEventListener('click', (event) => {
  const target = event.target.closest('[data-action]');
  if (!target || !data) return;
  event.preventDefault();
  const { action: name, id } = target.dataset;
  if (name === 'close') return dialog.close();
  if (name === 'choose-offer-filter') return applyOfferFilter(id);
  if (name === 'reset-offer-filters') return applyOfferFilter('all');
  if (name === 'offer') return details(findOffer(id));
  if (name === 'activate') {
    const sparksOffer = sparksOffers().some((offer) => offer.id === id);
    if (!state.activated.includes(id) && updateState({ ...state, activated: [...state.activated, id] })) {
      if (dialog.open) details(findOffer(id));
      else document.querySelector(`[data-action="offer"][data-id="${CSS.escape(id)}"]`)?.focus({ preventScroll: !sparksOffer });
      notify(sparksOffer
        ? 'Offer moved to Activated offers & missions — saved to this persona'
        : 'Offer activated — saved to this persona');
    }
    return;
  }
  if (name === 'home' || name === 'clear-search') { query = ''; render(); return; }
  if (name === 'app-sparks') {
    query = '';
    render();
    app.querySelector('.sparks-hero').scrollIntoView({ block: 'start' });
    app.querySelector('[data-action="app-sparks"]').focus({ preventScroll: true });
    return;
  }
  if (name === 'app-more') return openDialog('More from M&S', '<p>Explore your demo account and Sparks card.</p>', action('account', 'Your account', 'dialog-button') + action('card', 'Your Sparks card', 'dialog-button') + action('info', 'Help & contact us', 'dialog-button', 'Help & contact us'));
  if (name === 'search') {
    openDialog('Search Sparks offers', `<form class="dialog-search" role="search"><input aria-label="Search offers" placeholder="Search your offers" value="${esc(query)}"><button class="dialog-button" type="submit">Search offers</button></form>`);
    document.querySelector('.dialog-search input').focus();
    return;
  }
  if (name === 'card') return sparksCard();
  if (name === 'stamp-card') return stampDrawer();
  if (name === 'add-stamp' || name === 'reset-stamps') {
    const stamps = name === 'reset-stamps' ? 0 : Math.min(cafeStamps() + 1, data.cafeStampCard.target);
    if (updateState({ ...state, cafeStamps: stamps })) stampDrawer();
    return;
  }
  if (name === 'baby-benefits') return openDrawer('The parent hood', '<p>Exclusive offers, perks and expert tips from the Sparks baby club.</p><p>This is a preview of the benefits entry point. Article destinations, membership requirements and full terms have not been supplied.</p>', { footer: action('close', 'Back to baby club'), note: 'Illustrative prototype only. No customer is enrolled in the baby club.' });
  if (name === 'link-card') return openDrawer('Link a physical Sparks card', '<p>This next step was not shown in the supplied screenshots. Try a simulated link using a fictional card; do not enter a real card number.</p>', { footer: action('confirm-link-card', 'Link demo card') });
  if (name === 'confirm-link-card') {
    if (updateState({ ...state, linkedDemoCard: true })) sparksCard();
    return;
  }
  if (name === 'account') return openDialog(`Hello, ${data.customer.name}`, '<p>Welcome to your personalised Sparks hub. Your rewards, offers and favourite moments, all in one place.</p>', action('card', 'View Sparks card', 'dialog-button'));
  if (name === 'how') return openDrawer('A little more rewarding', '<p><strong>1. Activate your offers.</strong><br>Choose the Sparks offers you love.</p><p><strong>2. Shop and scan.</strong><br>Scan your Sparks card when you shop.</p><p><strong>3. Enjoy your rewards.</strong><br>Qualifying rewards appear in your Sparks wallet.</p>', { footer: action('close', 'Got it'), note: 'Prototype guidance. No real rewards are earned or spent.' });
  if (name === 'credit') return creditVouchers();
  if (name === 'credit-points') return openDrawer('Credit Card rewards', `<p class="wallet-drawer-balance">${money(data.customer.creditRewards)}</p><p>You have <strong>${data.customer.points} points</strong>.</p><p>Your M&S Credit Card rewards and Sparks rewards are shown separately in your wallet.</p>`, { footer: action('credit', 'View Rewards vouchers'), note: 'Demo account details; the points conversion and earning rules have not been supplied.' });
  if (name === 'wallet') return sparksWallet();
  if (name === 'spend') {
    if (updateState({ ...state, spent: data.customer.sparksRewards })) {
      openDrawer('Rewards used', '<p>Your demo Sparks rewards have been used. No payment or purchase was made.</p>', { footer: action('close', 'Back to your hub') });
    }
    return;
  }
  if (name === 'partner') {
    const partner = data.partners.find((item) => item.id === id);
    return openDrawer(partner.brand, `<p><strong>${esc(partner.title)}</strong></p><p>${esc(partner.description)}</p><p>In a live journey, this would take you to the partner booking experience. This demo keeps you in the hub.</p><div class="drawer-accordions">${accordion('Terms & Conditions', unspecifiedTerms)}</div>`, { hero: partner.image, tags: partner.badge ? `<div class="drawer-tags"><span>${esc(partner.badge)}</span></div>` : '', footer: action('partner-continue', 'Preview partner hand-off', '', id), note: 'Illustrative partner journey. Rewards and deadlines are design examples, not live eligibility. No information is shared with the partner.' });
  }
  if (name === 'partner-continue') return openDrawer('Partner hand-off', '<p>This is the end of the simulated journey. No information has been sent to a partner.</p>', { footer: action('close', 'Back to Sparks') });
  if (name === 'partners') return openDrawer('More from Virgin Rewards', '<p>Discover rewards from Virgin partners. Select a partner card to explore its example offer and preview the hand-off.</p>', { footer: action('close', 'Explore rewards') });
  if (name === 'prize') {
    const prize = data.prizes.find((item) => item.id === id);
    const entered = prizeEntered(prize);
    return openDrawer(prize.title, `<p>${entered ? 'Your demo entry is confirmed for this persona.' : 'Try entering this prize draw. This is a simulated entry; no personal information is submitted.'}</p><div class="drawer-accordions">${accordion('Terms & Conditions', unspecifiedTerms, entered)}</div>`, { hero: prize.image, tags: `<div class="drawer-tags"><span>${entered ? 'Entered' : esc(prize.badge)}</span></div>`, footer: entered ? action('close', 'Done') : action('enter-prize', 'Confirm demo entry', '', id), note: 'Demo prize draw only. Entry states and countdown copy are illustrative, not live eligibility or deadlines. No real entry is submitted.' });
  }
  if (name === 'enter-prize') {
    if (!state.entered.includes(id) && updateState({ ...state, entered: [...state.entered, id] })) {
      openDrawer("You're in!", '<p>Your demo entry has been saved for this persona. Good luck!</p>', { footer: action('close', 'Back to your hub') });
    }
    return;
  }
  if (name === 'feature') {
    const feature = data.banners.find((banner) => banner.id === id) || data.feature;
    return openDrawer(feature.title, `<p>${esc(feature.description)}</p>${bannerDisclosure(feature)}<p>This prototype stops before the provider journey. No application or order is submitted and no personal data is shared. Full offer terms have not been supplied.</p>`, { hero: feature.image, footer: action('close', 'Back to Sparks'), note: 'Illustrative provider hand-off, not a live application or quote journey. Any rates and disclosures reproduce the supplied design and are not verified current product terms.' });
  }
  if (name === 'charity') return openDialog('Choose your charity', `<p>Try changing the charity linked to this demo persona.</p><label class="dialog-label">Your charity<select id="charity-choice">${[...new Set([data.charity.name, state.charity, 'YOUNGMINDS', 'SHELTER', 'MACMILLAN CANCER SUPPORT'].filter(Boolean))].map((charity) => `<option ${charity === (state.charity || data.charity.name) ? 'selected' : ''}>${esc(charity)}</option>`).join('')}</select></label>`, action('save-charity', 'Save charity', 'dialog-button'));
  if (name === 'save-charity') {
    if (updateState({ ...state, charity: document.getElementById('charity-choice').value })) {
      dialog.close();
      notify('Your demo charity has been updated');
    }
    return;
  }
  if (name === 'menu') return openDialog('Explore M&S', '<p>Choose a department. Department journeys are placeholders in this Sparks prototype.</p>', ['Women', 'Men', 'Food', 'Home', 'Money'].map((label) => action('info', label, 'dialog-button', label)).join(''));
  if (name === 'feedback') return openDialog('Let’s shape the next version', '<p>Share your feedback with Jarvis in the chat alongside this preview. We can change the design, content and persona journeys together.</p>', action('close', 'Back to preview', 'dialog-button'), 'PROTOTYPE FEEDBACK');
  openDialog(id || 'Explore M&S', '<p>This link is a placeholder outside the Sparks hub prototype. You can keep exploring your wallet, activate offers, view partner rewards and enter demo prize draws.</p>', action('close', 'Back to Sparks', 'dialog-button'));
});
window.addEventListener('resize', () => {
  if (app.querySelector('#offer-filter-menu:popover-open')) positionOfferFilterMenu();
});
document.addEventListener('submit', (event) => {
  if (!event.target.matches('.header-search, .dialog-search')) return;
  event.preventDefault();
  query = event.target.querySelector('input').value.trim();
  if (dialog.open) dialog.close();
  render();
  const offersSection = document.querySelector('.offers-section');
  if (offersSection) offersSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  else notify('Sparks offers are not included in this ranked prototype.');
});
document.addEventListener('error', (event) => {
  if (event.target instanceof HTMLImageElement && !event.target.classList.contains('missing-image')) {
    event.target.classList.add('missing-image');
    event.target.alt = 'Image unavailable';
    notify('An image could not be loaded. Check its URL in Content & data.');
  }
}, true);
dialog.addEventListener('click', (event) => {
  if (event.target !== dialog) return;
  const box = dialog.getBoundingClientRect();
  if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close();
});
dialog.addEventListener('close', () => {
  parent.postMessage({ type: 'hub-dialog-closed' }, location.origin);
  if (dialogOpener && !dialogOpener.isConnected && dialogOpener.dataset.action) {
    const selector = `[data-action="${CSS.escape(dialogOpener.dataset.action)}"]${dialogOpener.dataset.id ? `[data-id="${CSS.escape(dialogOpener.dataset.id)}"]` : ''}`;
    document.querySelector(selector)?.focus({ preventScroll: true });
  }
});
function setData(next, reset = false) {
  next = normalizeHub(next);
  const personaChanged = data?.persona?.id !== next.persona?.id;
  data = next;
  if (reset) localStorage.removeItem(stateKey());
  if (reset || personaChanged) { query = ''; offerFilters = { ...DEFAULT_OFFER_FILTERS }; offerFilterChoice = 'all'; readState(); }
  if (dialog.open) dialog.close();
  render();
}
window.addEventListener('message', (event) => {
  if (event.origin !== location.origin || event.source !== parent) return;
  if (event.data?.type === 'hub-viewport') {
    const { top, height } = event.data;
    if (Number.isFinite(top) && Number.isFinite(height)) {
      document.documentElement.style.setProperty('--preview-top', `${Math.max(0, top)}px`);
      document.documentElement.style.setProperty('--preview-height', `${Math.max(200, height)}px`);
      if (app.querySelector('#offer-filter-menu:popover-open')) positionOfferFilterMenu();
    }
  }
  if (['hub-data', 'hub-reset'].includes(event.data?.type)) {
    try { setData(event.data.data, event.data.type === 'hub-reset'); } catch (error) { notify(`Data rejected: ${error.message}`); }
  }
});
let previousHeight = 0;
new ResizeObserver(() => {
  const height = Math.ceil(document.body.getBoundingClientRect().height);
  if (height !== previousHeight) {
    previousHeight = height;
    parent.postMessage({ type: 'hub-height', height }, location.origin);
  }
}).observe(document.body);
try {
  let initial;
  try { initial = loadSaved(); } catch (error) { notify(`Saved content could not be restored: ${error.message}`); }
  // The parent owns the active persona; standalone hub views use the saved snapshot.
  initial ??= await fetchHub();
  if (!data) { data = initial; readState(); render(); }
  parent.postMessage({ type: 'hub-ready' }, location.origin);
} catch (error) {
  app.innerHTML = `<p class="error-banner">Could not load the hub: ${esc(error.message)}</p>`;
}
