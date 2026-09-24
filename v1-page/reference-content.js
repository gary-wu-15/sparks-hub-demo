export const flowerReference = {
  heroImage: './assets/flowers-detail.png',
  channel: 'Online only',
  body: 'Celebrate the season with our online Christmas flowers and plants. Perfect for gifting loved ones or adding a touch of festive magic to your home. Exclusions apply',
  includes: 'Online flowers and plants',
  excludes: 'In-store flowers and plants',
  shopUrl: 'https://www.marksandspencer.com/l/gifts/flowers'
};

const foodDestination = {
  shopUrl: 'https://www.marksandspencer.com/c/food-and-wine',
  shopLabel: 'Explore M&S Food'
};

export const offerReferences = {
  flowers: flowerReference,
  cafe: {
    includes: 'Purchases in the M&S Café',
    shopUrl: 'https://www.marksandspencer.com/food/content/category/cafe',
    shopLabel: 'Explore the M&S Café'
  },
  shirts: {
    includes: "Men's T-shirts and polo shirts",
    shopUrl: 'https://www.marksandspencer.com/l/men/mens-tops'
  },
  suits: {
    includes: "Men's suits, ties and waistcoats",
    shopUrl: 'https://www.marksandspencer.com/l/men/mens-suits'
  },
  italian: { ...foodDestination, includes: 'Fresh Italian meals' },
  sandwich: { ...foodDestination, includes: 'Sandwiches, sushi and salads' },
  coffee: { ...foodDestination, includes: 'Tea, coffee and hot chocolate' },
  cheese: { ...foodDestination, includes: 'Baking cheese' },
  champagne: { ...foodDestination, includes: 'Delacourt Champagne' },
  grill: { ...foodDestination, includes: 'The Grill range' },
  cocktails: { ...foodDestination, includes: 'Cocktail cans and mixers' }
};

export const appLinks = {
  overview: 'https://mandsapp.onelink.me/256943915/6c4104a9',
  ios: 'https://mandsapp.onelink.me/256943915/getiosmns'
};
