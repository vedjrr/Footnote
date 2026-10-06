// Every knob of the "Harbour & Pine" retail generator (analytics-spec §10.1).
// Tune these, never the ranges in truth.ts, when an effect does not come out.

export const SEED = 20261005;
export const FIRST_MONTH = { year: 2023, month: 1 };
export const MONTHS = 27; // 2023-01 to 2025-03

/** Order lines before duplicates are added. */
export const BASE_ROWS = 59_300;
export const CUSTOMERS = 6_800;

export const REGIONS = ['North', 'South', 'East', 'West'] as const;
export const CHANNELS = ['Online', 'Store', 'Marketplace'] as const;
export const SEGMENTS = ['Consumer', 'Small business', 'Corporate'] as const;

export const SEGMENT_SHARE = [0.7, 0.2, 0.1];
/** Ordering weight of a customer = lognormal(sigma) times the segment boost. R5. */
export const CUSTOMER_SIGMA = 1.0;
export const SEGMENT_BOOST = [1, 1.5, 2.5];

/** R4: growth per year and the Nov and Dec multiplier on line counts. */
export const GROWTH_PER_YEAR = 0.05;
export const PEAK_MONTHS = [11, 12];
export const PEAK_FACTOR = 1.4;
/** Month-to-month noise on line counts (standard deviation, as a fraction). */
export const MONTH_NOISE = 0.003;

/** Lines per order: 1, 2 or 3. */
export const LINES_PER_ORDER = [0.6, 0.3, 0.1];

export const REGION_WEIGHTS = [0.27, 0.23, 0.28, 0.22];
export const CHANNEL_WEIGHTS = [0.45, 0.4, 0.15];

export interface SubCategory {
  name: string;
  weight: number;
  price: number;
  /** Gross margin before discount: cost = price * (1 - margin). */
  margin: number;
  returnRate: number;
}

export interface Category {
  name: string;
  weight: number;
  /** Mean discount in percentage points, before the segment add-on. */
  discount: number;
  /** Weights for quantity 1, 2, 3, 4. */
  quantity: number[];
  subs: SubCategory[];
  /** Overrides REGION_WEIGHTS. */
  regions?: number[];
  /** Channel weights per region, overriding CHANNEL_WEIGHTS. */
  channels?: number[][];
}

const BIG_ITEM_QTY = [0.96, 0.04, 0, 0];
const SMALL_ITEM_QTY = [0.45, 0.3, 0.15, 0.1];

export const CATEGORIES: Category[] = [
  {
    name: 'Electronics',
    weight: 0.2,
    discount: 5,
    quantity: [0.98, 0.02, 0, 0],
    // R1 needs a large Online West block: about 40% of Electronics.
    regions: [0.18, 0.16, 0.18, 0.48],
    channels: [
      [0.5, 0.35, 0.15],
      [0.5, 0.35, 0.15],
      [0.5, 0.35, 0.15],
      [0.83, 0.1, 0.07],
    ],
    subs: [
      { name: 'Headphones', weight: 0.15, price: 90, margin: 0.35, returnRate: 0.07 },
      { name: 'Laptops', weight: 0.2, price: 850, margin: 0.18, returnRate: 0.15 },
      { name: 'Tablets', weight: 0.2, price: 450, margin: 0.2, returnRate: 0.14 },
      { name: 'Smart home', weight: 0.45, price: 140, margin: 0.3, returnRate: 0.12 },
    ],
  },
  {
    name: 'Furniture',
    weight: 0.15,
    discount: 8,
    quantity: BIG_ITEM_QTY,
    subs: [
      { name: 'Sofas', weight: 0.2, price: 700, margin: 0.4, returnRate: 0.04 },
      { name: 'Tables', weight: 0.3, price: 350, margin: 0.4, returnRate: 0.035 },
      { name: 'Chairs', weight: 0.35, price: 150, margin: 0.42, returnRate: 0.04 },
      { name: 'Shelving', weight: 0.15, price: 180, margin: 0.4, returnRate: 0.03 },
    ],
  },
  {
    name: 'Kitchen',
    weight: 0.23,
    discount: 6,
    quantity: SMALL_ITEM_QTY,
    subs: [
      { name: 'Cookware', weight: 0.35, price: 80, margin: 0.45, returnRate: 0.03 },
      { name: 'Small appliances', weight: 0.3, price: 120, margin: 0.35, returnRate: 0.04 },
      { name: 'Tableware', weight: 0.35, price: 35, margin: 0.5, returnRate: 0.02 },
    ],
  },
  {
    name: 'Outdoor',
    weight: 0.18,
    discount: 6,
    quantity: SMALL_ITEM_QTY,
    subs: [
      { name: 'Garden tools', weight: 0.35, price: 45, margin: 0.45, returnRate: 0.03 },
      { name: 'Grills', weight: 0.25, price: 300, margin: 0.3, returnRate: 0.04 },
      { name: 'Camping', weight: 0.4, price: 90, margin: 0.4, returnRate: 0.035 },
    ],
  },
  {
    name: 'Decor',
    weight: 0.24,
    discount: 6,
    quantity: SMALL_ITEM_QTY,
    subs: [
      { name: 'Lighting', weight: 0.3, price: 85, margin: 0.5, returnRate: 0.03 },
      { name: 'Rugs', weight: 0.3, price: 160, margin: 0.45, returnRate: 0.025 },
      { name: 'Wall art', weight: 0.4, price: 55, margin: 0.55, returnRate: 0.02 },
    ],
  },
];

/** Spread of unit price around the sub-category mean (lognormal sigma). */
export const PRICE_SIGMA = 0.15;
/** Spread of the discount around its mean, in percentage points. */
export const DISCOUNT_SD = 3;
export const DISCOUNT_MAX = 40;
/** Discount add-on per segment, in percentage points. */
export const SEGMENT_DISCOUNT = [0, 1, 3];
/** Noise on unit cost (standard deviation, as a fraction). */
export const COST_NOISE = 0.03;

/** R1: in March 2025, Online West Electronics keeps this share of its lines. */
export const R1 = {
  month: '2025-03',
  category: 'Electronics',
  region: 'West',
  channel: 'Online',
  keep: 0.22,
};
/** R2: from October 2024, Furniture discounts rise by this many points in every segment. */
export const R2 = { from: '2024-10', category: 'Furniture', discountRise: 5.5 };
/** R3: in December 2024, the Headphones return rate is multiplied by this. */
export const R3 = { month: '2024-12', subCategory: 'Headphones', factor: 3 };
/** R6: in Q4 2024 Electronics lines are multiplied by this; other categories shrink so the month total holds. */
export const R6 = {
  months: ['2024-10', '2024-11', '2024-12'],
  category: 'Electronics',
  factor: 1.28,
};
/** R7: data problems. */
export const R7 = {
  duplicateShare: 0.012,
  duplicateWeek: { from: '2024-06-10', to: '2024-06-16' },
  duplicateShareInWeek: 0.7,
  lowercaseRegionShare: 0.008,
  emptySegmentShare: 0.005,
  negativeQuantityRows: 12,
};
