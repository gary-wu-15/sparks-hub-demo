import { fetchHub, loadSaved, validateHub } from './data.js';
import { flowerReference, appLinks } from './reference-content.js';

const app = document.getElementById('app');
const dialog = document.getElementById('detail-dialog');
const money = (value) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: value % 1 ? 2 : 0 }).format(value);
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const shapes = {
  arrow: '<path d="M3 12h17m-6-6 6 6-6 6"/>',
  search: '<circle cx="10" cy="10" r="7"/><path d="m15 15 6 6"/>',
  user: '<circle cx="12" cy="6" r="4"/><path d="M3 22c0-13 18-13 18 0Z"/>',
  star: '<path d="m12 2 3 6 7 1-5 5 1 8-6-4-6 4 1-8-5-5 7-1Z"/>',
  heart: '<path d="M12 21C-8 8 4-3 12 6c8-9 20 2 0 15Z"/>',
  bag: '<path d="M5 6h14l1 16H4ZM9 8V5c0-5 6-5 6 0v3"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 10v7m0-11v1"/>',
  card: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 9h20M5 16h5"/>',
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
let state = { activated: [], entered: [], spent: 0, charity: null, linkedDemoCard: false };
let query = '';
let toastTimer;
let dialogOpener;
const stateKey = () => `sparks-public-interactions-v1:${data?.persona?.id || 'demo'}`;

function notify(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.textContent = ''; }, 3500);
}
function readState() {
  state = { activated: [], entered: [], spent: 0, charity: null, linkedDemoCard: false };
  try {
    const saved = JSON.parse(localStorage.getItem(stateKey()) || 'null');
    if (saved) {
      if (!Array.isArray(saved.activated) || !saved.activated.every((id) => typeof id === 'string') ||
          !Array.isArray(saved.entered) || !saved.entered.every((id) => typeof id === 'string') ||
          !Number.isFinite(saved.spent) || saved.spent < 0 ||
          !(saved.charity === null || typeof saved.charity === 'string') ||
          (saved.linkedDemoCard !== undefined && typeof saved.linkedDemoCard !== 'boolean')) throw new Error('Invalid saved interaction data.');
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
function offerCard(offer) {
  const active = state.activated.includes(offer.id) || offer.status === 'active';
  let bottom;
  if (active && offer.remaining !== undefined) {
    bottom = `<div class="progress-track" role="progressbar" aria-label="Spend progress" aria-valuemin="0" aria-valuemax="${offer.target}" aria-valuenow="${offer.target - offer.remaining}"><span class="progress-fill" style="width:${(1 - offer.remaining / offer.target) * 100}%"></span><span class="gold-star">✦</span></div><span class="progress-label">${money(offer.remaining)} left</span>`;
  } else if (active) {
    bottom = '<span class="activated-label"><span class="gold-star">✓</span> Offer activated</span>';
  } else if (offer.status === 'shop') {
    bottom = '<span class="earn-shop"><span class="gold-star">✦</span> Earn in one shop</span>';
  } else {
    bottom = action('activate', 'Activate offer', 'outline-button', offer.id);
  }
  return `<article class="offer-card ${esc(offer.theme)}">${action('offer', `<span class="photo-wrap">${image(offer.image)}<span class="badge">${esc(offer.badge)}</span></span><span class="offer-copy"><strong>${esc(offer.title)}</strong><span class="offer-description">${esc(offer.description)}</span></span>`, 'card-main', offer.id)}<div class="offer-bottom">${bottom}</div></article>`;
}
function footer() {
  const groups = {
    'Here to Help': ['Help & contact us', 'Find a store', 'Accessibility in our stores', 'Product recalls'],
    'Delivery & Returns': ["Where's my order?", 'Delivery & collection', 'Guest order tracking', 'Guest order return', 'Returns & refunds'],
    'Shopping with Us': ['Sparks', 'Sparks FAQs', 'Gift card balance', 'Size guides', 'Sustainability'],
    'More from M&S': ['Ocado', 'Corporate site', 'M&S Corporate Gifts', 'M&S Money', 'M&S Opticians', 'Careers']
  };
  return `<footer class="site-footer"><div class="service-strip"><span>${icon('truck')} Free delivery when you spend over £75*</span><span>${icon('shop')} Next-day Click & Collect</span><span>${icon('returns')} Free returns for online orders</span></div><div class="footer-links">${Object.entries(groups).map(([title, links]) => `<div><h3>${title}</h3>${links.map((label) => action('info', esc(label), '', label)).join('')}</div>`).join('')}</div><div class="payment-strip"><div class="payments"><span>M&S</span><span class="visa">VISA</span><span class="mastercard">●●</span><span class="amex">AMEX</span><span>Pay</span><span>PayPal</span></div><div class="payment-options"><span>M&S CREDIT CARD</span><span>clearpay ↗</span><span>Pay in 3</span></div></div><div class="legal-footer"><p class="country">🇬🇧 United Kingdom (£)</p><div class="legal-links">${['Terms & Conditions', 'Privacy', 'Cookies', 'Manage cookies', 'Accessibility', 'Modern Slavery Act'].map((label) => action('info', label, '', label)).join('')}</div><p class="copyright">© 2026 Marks and Spencer plc (UK)</p><div class="social-row"><div class="social-icons">${['f', '𝕏', 'p', '▶', '◎'].map((label) => action('info', label, '', 'Social channels')).join('')}</div><div class="app-stores">${action('info', ' Download on the App Store', '', 'M&S app')}${action('info', '▷ Get it on Google Play', '', 'M&S app')}</div></div></div></footer>`;
}
function render() {
  if (!data) return;
  const offers = data.offers.filter((offer) => `${offer.title} ${offer.description}`.toLowerCase().includes(query.toLowerCase()));
  const balance = Math.max(0, data.customer.sparksRewards - state.spent);
  app.innerHTML = `<header class="site-header">
    <div class="announcement">${action('info', '‹', '', 'Latest at M&S')}<span>${esc(data.announcement)}</span>${action('info', '›', 'next', 'Latest at M&S')}${action('info', 'Help', 'help', 'Help')}</div>
    <div class="header-main container"><button data-action="menu" class="mobile-menu" aria-label="Open navigation menu">${icon('menu')}</button><a href="#" class="brand" aria-label="M&S home" data-action="home"><img src="./assets/mands-logo.svg" alt="" width="100" height="40"></a><form class="header-search" role="search"><input aria-label="Search offers" placeholder="Search product, code or brand" value="${esc(query)}"><button aria-label="Search offers">${icon('search')}</button></form><button data-action="search" class="mobile-search-toggle" aria-label="Open search">${icon('search')}</button><div class="header-actions"><button data-action="account" aria-label="Your account">${icon('user')}</button><button data-action="card" class="star-action" aria-label="Your Sparks card">${icon('star')}</button><button data-action="info" data-id="Your favourites" aria-label="Your favourites">${icon('heart')}</button><button data-action="info" data-id="Shopping bag" aria-label="Shopping bag, 1 item">${icon('bag')}<span class="bag-count">1</span></button></div></div>
    <nav class="department-nav container" aria-label="Departments">${['Sale', 'Women', 'Lingerie', 'Men', 'Kids', 'Beauty', 'Home', 'Flowers', 'Gifts', 'Christmas', 'Sports', 'Brands', 'Food', 'Offers', 'Money'].map((item) => action('info', item, '', item)).join('')}</nav>
    </header>
    <main class="container"><nav class="breadcrumbs" aria-label="Breadcrumb">${action('home', 'Home')} / ${action('account', 'Account')} / <span>Offers & Rewards</span></nav>
    <div class="member-banner"><div class="member-copy">Your Sparks<p>${esc(data.customer.name)}</p></div>${action('card', `${icon('card')}<span>Sparks card</span>`, 'sparks-card')}</div>
    <section class="section wallet-section" aria-labelledby="wallet-heading"><div class="section-heading"><h1 id="wallet-heading">Your wallet</h1>${action('how', `${icon('info')} How it works`, 'text-button how-it-works')}</div><div class="wallet-grid">${action('credit', `<span><span class="wallet-label">Credit Card rewards ${icon('arrow')}</span><strong class="wallet-value">${money(data.customer.creditRewards)}</strong></span>`, 'wallet-tile')}${action('wallet', `<span><span class="wallet-label">Sparks rewards ${icon('arrow')}</span><strong class="wallet-value">${money(balance)}</strong></span><span class="spend">Spend</span>`, 'wallet-tile gold')}</div></section>
    <section class="section credit-section"><h2>Credit Card rewards</h2><p class="section-intro">Enjoy special rewards with your M&S Credit Card. Tap an offer for terms and exclusions</p>${action('credit-points', `${data.customer.points} points ${icon('arrow')}`, 'text-button')}</section>
    <section class="section offers-section"><h2>Sparks offers</h2><p class="section-intro">Get exclusive rewards when you activate and complete Sparks offers. Tap an offer for details and exclusions</p>${query ? `<p class="section-intro">Showing results for “${esc(query)}” · ${action('clear-search', 'Clear search', 'text-button')}</p>` : ''}<div class="offer-grid">${offers.length ? offers.map(offerCard).join('') : '<p class="no-offers">No matching offers. Try another search.</p>'}</div></section>
    <section class="section"><h2>Partner rewards</h2><p class="section-intro">Earn big rewards into your wallet when you book with Virgin through Sparks</p>${action('partners', `More about Virgin Rewards ${icon('arrow')}`, 'text-button')}<div class="partner-grid">${data.partners.map((partner) => `<article class="partner-card">${image(partner.image, partner.brand)}<div class="partner-overlay"><strong>${esc(partner.title)}</strong><p>${esc(partner.description)}</p>${action('partner', `View details ${icon('arrow')}`, 'outline-button', partner.id)}</div></article>`).join('')}</div></section>
    <section class="section"><h2>Prize draws</h2><p class="section-intro">Enter our latest draw for your chance to win exclusive experiences and prizes</p><div class="prize-grid">${data.prizes.map((prize) => action('prize', `<span class="prize-copy"><small>${esc(prize.badge)}</small><strong>${esc(prize.title)}</strong><span>${state.entered.includes(prize.id) ? 'Entry confirmed ✓' : `Enter to win ${icon('arrow')}`}</span></span>${image(prize.image)}`, 'prize-card', prize.id)).join('')}</div></section>
    <section class="section"><h2>Explore more from M&S</h2><div class="feature-card"><div class="feature-copy"><h3>${esc(data.feature.title)}</h3><p>${esc(data.feature.description)}</p>${action('feature', `${esc(data.feature.cta)} ${icon('arrow')}`, 'text-button')}</div>${image(data.feature.image, data.feature.title)}</div></section></main>
    <section class="charity-section"><div class="charity-title"><h2>Your Charity</h2>${action('charity', 'Update', 'text-button')}</div><div class="charity-content"><div class="charity-donation"><span class="charity-name">${esc(state.charity || data.charity.name)}</span><strong class="charity-amount">${state.charity && state.charity !== data.charity.name ? '£0' : money(data.charity.raised)}</strong><small>${state.charity && state.charity !== data.charity.name ? 'New selection · demo total' : `Raised since ${esc(data.charity.since)}`}</small></div><p class="charity-total">In total, you've helped us raise <strong>${money(data.charity.total)}</strong> across all charities</p></div></section>
    ${footer()}${action('feedback', 'Feedback', 'feedback-tab')}`;
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

function openDrawer(title, body, { hero, tags = '', subtitle = '', footer = '', note = '' } = {}) {
  dialog.className = 'reference-drawer';
  document.getElementById('dialog-content').innerHTML = `<div class="drawer-scroll">${hero ? image(hero, '', 'drawer-hero') : ''}<div class="drawer-content${hero ? ' with-hero' : ''}">${tags}<h2 id="dialog-title">${esc(title)}</h2>${subtitle ? `<p class="offer-subtitle">${esc(subtitle)}</p>` : ''}${body}${note ? `<p class="drawer-disclaimer">${esc(note)}</p>` : ''}</div></div>${footer ? `<div class="drawer-footer">${footer}</div>` : ''}`;
  parent.postMessage({ type: 'hub-dialog' }, location.origin);
  showModal();
  dialog.querySelector('.drawer-scroll').scrollTop = 0;
}

function flowerDetails(offer) {
  const detail = { ...flowerReference, ...offer.details };
  openDrawer(offer.title,
    `<p>${esc(detail.body)}</p><p class="single-shop-note">This offer needs to be completed in a single shop</p><div class="drawer-earning"><span class="gold-star">★</span> Earn in one shop</div>${externalLink(detail.shopUrl, `Shop the offer ${icon('arrow')}`, 'drawer-link')}<div class="drawer-accordions">${accordion('What’s included', `<p><strong>Includes</strong><br>${esc(detail.includes)}</p><p><strong>Excludes</strong><br>${esc(detail.excludes)}</p>`, true)}${accordion('How to use', '<p>This section was collapsed in the reference. The confirmed requirement is to complete the offer in a single online shop; further instructions have not been supplied.</p>')}${accordion('Terms & Conditions', unavailableTerms)}</div>`,
    { hero: detail.heroImage, tags: `<div class="drawer-tags"><span>${esc(offer.badge)}</span><span>${esc(detail.channel)}</span></div>`, subtitle: offer.description, note: 'Prototype offer. Shop the offer opens the public M&S flowers category in a new tab; the exact promotional destination was not visible in the screenshot.' });
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
  if (offer.id === 'flowers') return flowerDetails(offer);
  const activated = state.activated.includes(offer.id) || offer.status === 'active';
  openDialog(offer.title, `${image(offer.image, '', 'dialog-image')}<p>${esc(offer.description)}</p><p>${esc(offer.badge)}</p><p>${activated ? 'This offer is activated. Scan your Sparks card when you shop to collect progress towards your reward.' : offer.status === 'shop' ? 'Earn this reward in one qualifying shop. Scan your Sparks card at checkout.' : 'Activate this offer, then scan your Sparks card when you shop.'}</p>${offer.remaining !== undefined ? `<p><strong>${money(offer.remaining)}</strong> left to spend towards this reward.</p>` : ''}`, offer.status === 'available' && !activated ? action('activate', 'Activate offer', 'dialog-button', offer.id) : action('close', 'Got it', 'dialog-button'));
}
document.addEventListener('click', (event) => {
  const target = event.target.closest('[data-action]');
  if (!target || !data) return;
  event.preventDefault();
  const { action: name, id } = target.dataset;
  if (name === 'close') return dialog.close();
  if (name === 'offer') return details(data.offers.find((offer) => offer.id === id));
  if (name === 'activate') {
    if (!state.activated.includes(id) && updateState({ ...state, activated: [...state.activated, id] })) {
      if (dialog.open) details(data.offers.find((offer) => offer.id === id));
      notify('Offer activated — saved to this persona');
    }
    return;
  }
  if (name === 'home' || name === 'clear-search') { query = ''; render(); return; }
  if (name === 'search') {
    openDialog('Search Sparks offers', `<form class="dialog-search" role="search"><input aria-label="Search offers" placeholder="Search your offers" value="${esc(query)}"><button class="dialog-button" type="submit">Search offers</button></form>`);
    document.querySelector('.dialog-search input').focus();
    return;
  }
  if (name === 'card') return sparksCard();
  if (name === 'link-card') return openDrawer('Link a physical Sparks card', '<p>This next step was not shown in the supplied screenshots. Try a simulated link using a fictional card; do not enter a real card number.</p>', { footer: action('confirm-link-card', 'Link demo card') });
  if (name === 'confirm-link-card') {
    if (updateState({ ...state, linkedDemoCard: true })) sparksCard();
    return;
  }
  if (name === 'account') return openDialog(`Hello, ${data.customer.name}`, '<p>Welcome to your personalised Sparks hub. Your rewards, offers and favourite moments, all in one place.</p>', action('card', 'View Sparks card', 'dialog-button'));
  if (name === 'how') return openDialog('A little more rewarding', '<p><strong>1. Activate your offers.</strong><br>Choose the Sparks offers you love.</p><p><strong>2. Shop and scan.</strong><br>Scan your Sparks card when you shop.</p><p><strong>3. Enjoy your rewards.</strong><br>Qualifying rewards appear in your Sparks wallet.</p>', action('close', 'Got it', 'dialog-button'));
  if (name === 'credit') return creditVouchers();
  if (name === 'credit-points') return openDialog('Credit Card rewards', `<p class="balance">${money(data.customer.creditRewards)}</p><p>You have <strong>${data.customer.points} points</strong>.</p><p>Your M&S Credit Card rewards and Sparks rewards are shown separately in your wallet.</p>`, action('close', 'Back to your hub', 'dialog-button'));
  if (name === 'wallet') {
    const balance = Math.max(0, data.customer.sparksRewards - state.spent);
    return openDialog('Your Sparks rewards', `<p class="balance">${money(balance)}</p><p>${balance > 0 ? 'Try the spending journey with your demo reward balance. This only changes this persona in the prototype.' : 'Your demo rewards have been used. Reset the baseline in Content & data to try again.'}</p>`, balance > 0 ? action('spend', `Use ${money(balance)} demo rewards`, 'dialog-button') : action('close', 'Done', 'dialog-button'));
  }
  if (name === 'spend') {
    if (updateState({ ...state, spent: data.customer.sparksRewards })) {
      openDialog('Rewards used', '<p>Your demo Sparks rewards have been used. No payment or purchase was made.</p>', action('close', 'Back to your hub', 'dialog-button'));
    }
    return;
  }
  if (name === 'partner') {
    const partner = data.partners.find((item) => item.id === id);
    return openDialog(partner.brand, `${image(partner.image, '', 'dialog-image')}<p><strong>${esc(partner.title)}</strong></p><p>${esc(partner.description)}</p><p>In a live journey, this would take you to the partner booking experience. This demo keeps you in the hub.</p>`, action('partner-continue', 'Preview partner hand-off', 'dialog-button', id), 'PARTNER REWARDS');
  }
  if (name === 'partner-continue') return openDialog('Partner hand-off', '<p>This is the end of the simulated journey. No information has been sent to a partner.</p>', action('close', 'Back to Sparks', 'dialog-button'));
  if (name === 'partners') return openDialog('More from Virgin Rewards', '<p>Discover rewards from Virgin partners. Select a partner card to explore its example offer and preview the hand-off.</p>', action('close', 'Explore rewards', 'dialog-button'));
  if (name === 'prize') {
    const prize = data.prizes.find((item) => item.id === id);
    const entered = state.entered.includes(id);
    return openDialog(prize.title, `${image(prize.image, '', 'dialog-image')}<p>${entered ? 'Your demo entry is confirmed for this persona.' : 'Try entering this prize draw. This is a simulated entry; no personal information is submitted.'}</p><p>${esc(prize.badge)}</p>`, entered ? action('close', 'Done', 'dialog-button') : action('enter-prize', 'Confirm demo entry', 'dialog-button', id), 'PRIZE DRAWS');
  }
  if (name === 'enter-prize') {
    if (!state.entered.includes(id) && updateState({ ...state, entered: [...state.entered, id] })) {
      openDialog("You're in!", '<p>Your demo entry has been saved for this persona. Good luck!</p>', action('close', 'Back to your hub', 'dialog-button'));
    }
    return;
  }
  if (name === 'feature') return openDialog(data.feature.title, `<p>${esc(data.feature.description)}</p><p>This prototype stops before the provider journey. No quote is requested and no personal data is shared.</p>`, action('close', 'Back to Sparks', 'dialog-button'), 'EXPLORE MORE FROM M&S');
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
document.addEventListener('submit', (event) => {
  if (!event.target.matches('.header-search, .dialog-search')) return;
  event.preventDefault();
  query = event.target.querySelector('input').value.trim();
  if (dialog.open) dialog.close();
  render();
  document.querySelector('.offers-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
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
  validateHub(next);
  const personaChanged = data?.persona?.id !== next.persona?.id;
  data = next;
  if (reset) localStorage.removeItem(stateKey());
  if (reset || personaChanged) { query = ''; readState(); }
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
