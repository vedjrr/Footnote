/**
 * Chart fixtures for the styleguide, taken from the retail sample
 * (`data/demo/retail/orders.parquet`, Harbour & Pine). Regions are the four
 * well-formed spellings; the lower-case variants that health check H3
 * reports are left out here.
 */
import type { ValueFormat } from '@/ui/charts';

export const gbp: ValueFormat = { style: 'unit', unit: 'GBP' };

const monthNames = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

function months(fromYear: number, fromMonth: number, count: number): string[] {
  return Array.from({ length: count }, (_, i) => {
    const m = fromMonth - 1 + i;
    return `${monthNames[m % 12]} ${fromYear + Math.floor(m / 12)}`;
  });
}

/** Revenue by month, January 2023 to March 2025. */
export const monthly = {
  categories: months(2023, 1, 27),
  values: [
    446158, 437930, 452087, 435296, 445692, 452241, 453253, 444765, 451110, 451369, 646388, 646045,
    458284, 469318, 454554, 467888, 460980, 597096, 472176, 470023, 483920, 489527, 690245, 692242,
    480970, 476320, 438441,
  ],
};

/** Change on the month before, February 2023 to March 2025. */
export const monthlyChange = {
  categories: monthly.categories.slice(1),
  values: monthly.values.slice(1).map((v, i) => v - monthly.values[i]),
};

/** Revenue by region and month, April 2024 to March 2025. */
export const byRegion = {
  categories: months(2024, 4, 12),
  series: [
    {
      name: 'West',
      values: [
        134395, 137771, 174776, 136728, 138773, 139853, 154618, 210743, 217523, 143229, 139179,
        101378,
      ],
    },
    {
      name: 'East',
      values: [
        115908, 114037, 151427, 118735, 117162, 118644, 115563, 171755, 166846, 117041, 117741,
        121136,
      ],
    },
    {
      name: 'North',
      values: [
        116699, 110220, 146051, 111773, 115327, 118067, 113951, 163370, 159251, 117978, 112668,
        114710,
      ],
    },
    {
      name: 'South',
      values: [
        97277, 96862, 122327, 102459, 95853, 103248, 102020, 137668, 143335, 101699, 100841, 97426,
      ],
    },
  ],
};

/** Revenue by category, February and March 2025. */
export const byCategory = {
  categories: ['Decor', 'Electronics', 'Furniture', 'Kitchen', 'Outdoor'],
  february: [89262, 139833, 95521, 66524, 85180],
  march: [90486, 98982, 99145, 65215, 84613],
};

export const categoryChange = byCategory.categories.map((label, i) => ({
  label,
  value: byCategory.march[i] - byCategory.february[i],
}));

/** Electronics revenue in March 2025 by channel and region. */
export const electronicsMarch = [
  { label: 'Marketplace orders in the East', value: 3576 },
  { label: 'Marketplace orders in the North', value: 3298 },
  { label: 'Marketplace orders in the South', value: 3220 },
  { label: 'Marketplace orders in the West', value: 4948 },
  { label: 'Online orders in the East', value: 12251 },
  { label: 'Online orders in the North', value: 13034 },
  { label: 'Online orders in the South', value: 10719 },
  { label: 'Online orders in the West', value: 13480 },
  { label: 'Store orders in the East', value: 9415 },
  { label: 'Store orders in the North', value: 9229 },
  { label: 'Store orders in the South', value: 8669 },
  { label: 'Store orders in the West', value: 6705 },
];

/** Electronics revenue online, February to March 2025, by region. */
export const electronicsOnline = {
  start: { label: 'February 2025', value: 93738 },
  steps: [
    { label: 'East', value: -1365 },
    { label: 'North', value: 1173 },
    { label: 'South', value: -700 },
    { label: 'West', value: -43362 },
  ],
  end: { label: 'March 2025', value: 49484 },
};

/** Total revenue, February to March 2025, by category. */
export const revenueWalk = {
  start: { label: 'February 2025', value: 476320 },
  steps: categoryChange,
  end: { label: 'March 2025', value: 438441 },
};

/** Electronics revenue in March 2025: channels within each region. */
export const electronicsPanels = {
  categories: ['Marketplace', 'Online', 'Store'],
  panels: [
    { name: 'East', values: [3576, 12251, 9415] },
    { name: 'North', values: [3298, 13034, 9229] },
    { name: 'South', values: [3220, 10719, 8669] },
    { name: 'West', values: [4948, 13480, 6705] },
  ],
};
