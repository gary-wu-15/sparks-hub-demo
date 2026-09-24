export const prizeDesignDefaults = [
  { id: 'hunger-games', title: 'WIN Hunger Games screening tickets', badge: '17 days to enter', image: './assets/prize-hunger-games.png', entered: false },
  { id: 'dream-holiday', title: 'WIN £5000 towards your dream holiday', badge: 'Entered', image: './assets/prize-dream-holiday.png', entered: true }
];

const legacyPrizes = [
  { id: 'hunger-games', title: 'WIN Hunger Games screening tickets', badge: '11 days to enter', image: './assets/hunger-games.png' },
  { id: 'robbie', title: 'WIN Robbie Williams at Silverstone', badge: '6 days to enter', image: './assets/robbie.png' }
];

const matchesSample = (item, sample) => Object.keys(item).length === Object.keys(sample).length &&
  Object.entries(sample).every(([key, value]) => item[key] === value);

export function refreshPrizeDesign(prizes) {
  return prizes.map((prize) => {
    // Upgrade untouched sample content without replacing custom prizes or edits.
    const index = legacyPrizes.findIndex((legacy) => matchesSample(prize, legacy));
    if (index < 0 || prizes.some((other) => other !== prize && other.id === prizeDesignDefaults[index].id)) return prize;
    return structuredClone(prizeDesignDefaults[index]);
  });
}

const legacyHoliday = {
  id: 'holidays', brand: 'Virgin Atlantic Holidays', title: 'Earn £3 reward',
  description: 'For every £100 you spend with Virgin Atlantic Holidays', image: './assets/holidays.png'
};
export const holidayDesign = {
  id: 'holidays', brand: 'Virgin Atlantic Holidays', title: 'Up to £300 reward',
  description: 'Book your holiday to Orlando with Virgin Atlantic Holidays',
  image: './assets/partner-orlando.png', badge: '90 days to earn', cta: 'Book now'
};
const legacyCreditBanner = {
  id: 'credit-card', title: 'M&S Rewards Credit Card',
  description: 'Enjoy special rewards with your M&S Credit Card.',
  image: './assets/master-credit.png', cta: 'Find out more', theme: 'credit', businessUnit: 'credit_card'
};
const creditBannerDesign = {
  ...legacyCreditBanner,
  description: 'Earn £5 back in M&S wallet for every £100 you spend at M&S in the first six months',
  apr: '23.9% APR', aprLabel: 'Representative variable',
  legal: 'M&S plc acts as a credit broker and not a lender. Credit is subject to status. T&Cs apply.'
};

export function refreshPartnerDesign(partners) {
  const upgraded = partners.some((partner) => matchesSample(partner, legacyHoliday));
  const result = partners.map((partner) => matchesSample(partner, legacyHoliday) ? structuredClone(holidayDesign) : partner);
  if (upgraded && partners.map((partner) => partner.id).join(',') === 'voyages,active,holidays,hotels,trains,media') {
    result.unshift(result.splice(2, 1)[0]);
  }
  return result;
}

export function refreshBannerDesign(banners) {
  return banners.map((banner) => matchesSample(banner, legacyCreditBanner) ? structuredClone(creditBannerDesign) : banner);
}

const additionalCreditOffers = [
  {
    id: 'credit-menswear', title: 'Earn 750 points',
    description: 'Spend £60 on menswear on your M&S Credit Card',
    image: './assets/shirts.png', badge: '14 days to earn'
  },
  {
    id: 'credit-food', title: 'Earn 500 points',
    description: 'Spend £40 on M&S food on your M&S Credit Card',
    image: './assets/italian.png', badge: '7 days to earn'
  },
  {
    id: 'credit-flowers', title: 'Earn 500 points',
    description: 'Spend £30 on flowers and plants on your M&S Credit Card',
    image: './assets/flowers.png', badge: '21 days to earn'
  },
  {
    id: 'credit-cafe', title: 'Earn 250 points',
    description: 'Spend £15 in the M&S Café on your M&S Credit Card',
    image: './assets/cafe.png', badge: '14 days to earn'
  },
  {
    id: 'credit-cheese', title: 'Earn 300 points',
    description: 'Spend £20 on cheese and deli treats on your M&S Credit Card',
    image: './assets/cheese.png', badge: '7 days to earn'
  }
].map((offer) => ({
  ...offer, status: 'available', theme: 'light', businessUnit: 'credit_card',
  details: { body: 'An invented Credit Card offer for this prototype, not a live M&S promotion. Points and spending requirements are illustrative; no real points are earned.' }
}));

const additionalParenthoodOffers = [
  { id: 'baby-bodysuits', title: '15% off', description: 'Baby bodysuit multipacks', image: './assets/parent-bodysuits.png', badge: '30 days to use' },
  { id: 'baby-dungarees', title: '20% off', description: 'Baby dungarees & rompers', image: './assets/parent-dungarees.png', badge: '21 days to use' },
  { id: 'baby-outfits', title: '15% off', description: 'Baby outfit sets', image: './assets/parent-outfits.png', badge: '30 days to use' },
  { id: 'baby-knitwear', title: '10% off', description: 'Baby jumpers & cardigans', image: './assets/parent-knitwear.png', badge: '14 days to use' }
].map((offer) => ({
  ...offer, status: 'available', theme: 'light', businessUnit: 'clothing',
  details: { body: 'An invented parent hood offer for this prototype, not a live M&S promotion. Discounts and dates are illustrative; activation does not enrol you in the club or create a real discount.' }
}));

function expandSampleOffers(offers, originalId, additions) {
  // Expand the old one-card sample while retaining edits to that original card.
  return offers.length === 1 && offers[0].id === originalId
    ? [...offers, ...structuredClone(additions)]
    : offers;
}

export const refreshCreditOffers = (offers) => expandSampleOffers(offers, 'credit-womenswear', additionalCreditOffers);
export const refreshParenthoodOffers = (offers) => expandSampleOffers(offers, 'baby-onesies', additionalParenthoodOffers);

export const masterDefaults = {
  tuesdayOffers: [
    {
      id: 'tuesday-pasta', title: 'Earn £2 reward', description: 'Spend £10 on fresh pasta and sauces',
      image: './assets/italian.png', badge: '7 days to earn', status: 'available', theme: 'dark', businessUnit: 'food',
      details: { body: 'An invented Sparks Tuesdays offer for this prototype, not a live M&S promotion.' }
    },
    {
      id: 'tuesday-flowers', title: 'Earn £5 reward', description: 'Spend £30 on flowers and plants',
      image: './assets/flowers.png', badge: '7 days to earn', status: 'available', theme: 'dark', businessUnit: 'flowers',
      details: { body: 'An invented Sparks Tuesdays offer for this prototype, not a live M&S promotion.' }
    },
    {
      id: 'tuesday-style', title: 'Earn £5 reward', description: 'Spend £35 on T-shirts and polo shirts',
      image: './assets/shirts.png', badge: '7 days to earn', status: 'available', theme: 'dark', businessUnit: 'clothing',
      details: { body: 'An invented Sparks Tuesdays offer for this prototype, not a live M&S promotion.' }
    },
    {
      id: 'tuesday-cafe', title: 'Earn £2 reward', description: 'Spend £10 in the M&S Café',
      image: './assets/cafe.png', badge: '7 days to earn', status: 'available', theme: 'dark', businessUnit: 'food',
      details: { body: 'An invented Sparks Tuesdays offer for this prototype, not a live M&S promotion.' }
    }
  ],
  creditOffers: [
    {
      id: 'credit-womenswear', title: 'Earn 1000 points',
      description: 'Spend £80 on womenswear on your M&S Credit Card',
      image: './assets/master-womenswear.png', badge: '14 days to earn',
      status: 'available', theme: 'light', businessUnit: 'credit_card',
      details: { includes: 'Womenswear purchases using your M&S Credit Card', body: 'Illustrative mission from the supplied master design. Full eligibility, exclusions and earning terms have not been supplied.' }
    },
    ...additionalCreditOffers
  ],
  babyOffers: [
    {
      id: 'baby-onesies', title: '10% off', description: 'Baby grows & onesies',
      image: './assets/master-baby.png', badge: '360 days to use',
      status: 'active', theme: 'light', businessUnit: 'clothing',
      details: { includes: 'Baby grows and onesies', body: 'Example baby club offer from the master design. The activated state is illustrative, not confirmation of membership or eligibility.' }
    },
    ...additionalParenthoodOffers
  ],
  banners: [
    {
      id: 'ocado', title: 'Exclusive with Ocado',
      description: 'Enjoy M&S food delivered to your door by Ocado with exclusive Sparks member offers',
      image: './assets/master-ocado.png', cta: 'Learn more', theme: 'ocado', businessUnit: 'food'
    },
    creditBannerDesign
  ],
  cafeStampCard: { stamps: 0, target: 6, daysToUse: 28 },
  charityImage: './assets/master-charity.png',
  charityIntro: 'Together, we’ve raised over £20 million for Sparks charities. Select or update your chosen charity today'
};
