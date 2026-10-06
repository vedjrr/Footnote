// The "Harbour & Pine" retail generator (analytics-spec §10.1). Pure: the same
// seed gives the same rows. Line counts are allocated per month, sub-category,
// region and channel, and returns per month and sub-category, so the planted
// effects are not lost in sampling noise.

import { allocate, createRng, weightedPicker, type Rng } from '../rng';
import * as P from './params';

export interface OrderLine {
  order_id: string;
  order_date: string;
  region: string;
  channel: string;
  category: string;
  sub_category: string;
  customer_id: string;
  customer_segment: string | null;
  quantity: number;
  unit_price: number;
  discount_pct: number;
  revenue: number;
  cost: number;
  returned: boolean;
}

interface Customer {
  id: string;
  segment: number;
}

interface Slot {
  category: number;
  sub: number;
  region: number;
  channel: number;
}

const round2 = (x: number): number => Math.round(x * 100) / 100;
const pad = (n: number, width: number): string => String(n).padStart(width, '0');

function monthKey(t: number): { year: number; month: number; key: string } {
  const index = P.FIRST_MONTH.month - 1 + t;
  const year = P.FIRST_MONTH.year + Math.floor(index / 12);
  const month = (index % 12) + 1;
  return { year, month, key: `${year}-${pad(month, 2)}` };
}

function daysIn(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function makeCustomers(rng: Rng): { customers: Customer[]; pickers: ((r: Rng) => Customer)[] } {
  const byRegion: Customer[][] = P.REGIONS.map(() => []);
  const weights: number[][] = P.REGIONS.map(() => []);
  const customers: Customer[] = [];
  for (let i = 0; i < P.CUSTOMERS; i++) {
    const segment = rng.weighted(P.SEGMENT_SHARE);
    const region = rng.weighted(P.REGION_WEIGHTS);
    const weight = Math.exp(P.CUSTOMER_SIGMA * rng.normal()) * P.SEGMENT_BOOST[segment];
    const customer = { id: `C${pad(i + 1, 5)}`, segment };
    customers.push(customer);
    byRegion[region].push(customer);
    weights[region].push(weight);
  }
  const pickers = byRegion.map((list, r) => {
    const pick = weightedPicker(weights[r]);
    return (rng: Rng) => list[pick(rng)];
  });
  return { customers, pickers };
}

/** Expected lines per month before the planted effects. */
function monthTotals(rng: Rng): number[] {
  const raw = Array.from({ length: P.MONTHS }, (_, t) => {
    const { month } = monthKey(t);
    const season = P.PEAK_MONTHS.includes(month) ? P.PEAK_FACTOR : 1;
    const noise = 1 + P.MONTH_NOISE * rng.normal();
    return (1 + P.GROWTH_PER_YEAR) ** (t / 12) * season * noise;
  });
  const sum = raw.reduce((a, x) => a + x, 0);
  return raw.map((x) => (P.BASE_ROWS * x) / sum);
}

/** Expected-count weights for every slot in month `t`, with R1 and R6 applied. */
function slotWeights(key: string): { slots: Slot[]; weights: number[] } {
  const r6 = P.R6.months.includes(key);
  const eIndex = P.CATEGORIES.findIndex((c) => c.name === P.R6.category);
  const eWeight = P.CATEGORIES[eIndex].weight;
  const others = r6 ? (1 - eWeight * P.R6.factor) / (1 - eWeight) : 1;

  const slots: Slot[] = [];
  const weights: number[] = [];
  P.CATEGORIES.forEach((cat, c) => {
    const catWeight = cat.weight * (r6 ? (c === eIndex ? P.R6.factor : others) : 1);
    const regions = cat.regions ?? P.REGION_WEIGHTS;
    cat.subs.forEach((sub, s) => {
      regions.forEach((rw, r) => {
        const channels = cat.channels?.[r] ?? P.CHANNEL_WEIGHTS;
        channels.forEach((cw, ch) => {
          let w = catWeight * sub.weight * rw * cw;
          if (
            key === P.R1.month &&
            cat.name === P.R1.category &&
            P.REGIONS[r] === P.R1.region &&
            P.CHANNELS[ch] === P.R1.channel
          ) {
            w *= P.R1.keep;
          }
          slots.push({ category: c, sub: s, region: r, channel: ch });
          weights.push(w);
        });
      });
    });
  });
  return { slots, weights };
}

export function generateRetail(seed: number = P.SEED): OrderLine[] {
  const rng = createRng(seed);
  const { pickers } = makeCustomers(rng);
  const totals = monthTotals(rng);
  const quantityPickers = P.CATEGORIES.map((c) => weightedPicker(c.quantity));
  const orderSize = weightedPicker(P.LINES_PER_ORDER);

  interface Draft extends Omit<OrderLine, 'order_id'> {
    order: number;
  }
  const drafts: Draft[] = [];
  const orderDates: string[] = [];

  for (let t = 0; t < P.MONTHS; t++) {
    const { year, month, key } = monthKey(t);
    const { slots, weights } = slotWeights(key);
    const scale = weights.reduce((a, w) => a + w, 0);
    const counts = allocate(Math.round(totals[t] * scale), weights);

    // Lines that share a region and channel can share an order.
    const cells = new Map<number, Slot[]>();
    slots.forEach((slot, i) => {
      const cell = slot.region * P.CHANNELS.length + slot.channel;
      const list = cells.get(cell) ?? [];
      for (let k = 0; k < counts[i]; k++) list.push(slot);
      cells.set(cell, list);
    });

    for (const [, lines] of [...cells.entries()].sort((a, b) => a[0] - b[0])) {
      rng.shuffle(lines);
      let i = 0;
      while (i < lines.length) {
        const size = Math.min(orderSize(rng) + 1, lines.length - i);
        const day = rng.int(1, daysIn(year, month));
        const date = `${key}-${pad(day, 2)}`;
        const customer = pickers[lines[i].region](rng);
        const order = orderDates.length;
        orderDates.push(date);
        for (let k = 0; k < size; k++, i++) {
          const slot = lines[i];
          const cat = P.CATEGORIES[slot.category];
          const sub = cat.subs[slot.sub];
          const quantity = quantityPickers[slot.category](rng) + 1;
          const unitPrice = Math.max(
            1,
            round2(sub.price * Math.exp(P.PRICE_SIGMA * rng.normal() - P.PRICE_SIGMA ** 2 / 2)),
          );
          const rise = cat.name === P.R2.category && key >= P.R2.from ? P.R2.discountRise : 0;
          const meanDiscount = cat.discount + P.SEGMENT_DISCOUNT[customer.segment] + rise;
          const discount = Math.min(
            P.DISCOUNT_MAX,
            Math.max(0, Math.round(meanDiscount + P.DISCOUNT_SD * rng.normal())),
          );
          const unitCost = unitPrice * (1 - sub.margin) * (1 + P.COST_NOISE * rng.normal());
          drafts.push({
            order,
            order_date: date,
            region: P.REGIONS[slot.region],
            channel: P.CHANNELS[slot.channel],
            category: cat.name,
            sub_category: sub.name,
            customer_id: customer.id,
            customer_segment: P.SEGMENTS[customer.segment],
            quantity,
            unit_price: unitPrice,
            discount_pct: discount,
            revenue: round2(quantity * unitPrice * (1 - discount / 100)),
            cost: round2(quantity * unitCost),
            returned: false,
          });
        }
      }
    }
  }

  markReturns(rng, drafts);

  // Order ids follow the date, then the order in which orders were made.
  const orderRank = orderDates
    .map((date, i) => ({ date, i }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.i - b.i));
  const orderId: string[] = [];
  orderRank.forEach(({ i }, rank) => (orderId[i] = `HP-${pad(rank + 1, 6)}`));

  const lines: OrderLine[] = drafts
    .map((d, seq) => ({ d, seq }))
    .sort((a, b) => a.d.order - b.d.order || a.seq - b.seq)
    .map(({ d }) => {
      const { order, ...rest } = d;
      return { order_id: orderId[order], ...rest };
    })
    .sort((a, b) =>
      a.order_date < b.order_date
        ? -1
        : a.order_date > b.order_date
          ? 1
          : a.order_id < b.order_id
            ? -1
            : a.order_id > b.order_id
              ? 1
              : 0,
    );

  plantProblems(rng, lines);
  return addDuplicates(rng, lines);
}

/** Exact return counts per month and sub-category, with R3 applied. */
function markReturns(
  rng: Rng,
  drafts: { order_date: string; sub_category: string; returned: boolean }[],
): void {
  const groups = new Map<string, number[]>();
  drafts.forEach((d, i) => {
    const key = `${d.order_date.slice(0, 7)}|${d.sub_category}`;
    const list = groups.get(key) ?? [];
    list.push(i);
    groups.set(key, list);
  });
  const rates = new Map(
    P.CATEGORIES.flatMap((c) => c.subs.map((s) => [s.name, s.returnRate] as const)),
  );
  for (const [key, indices] of groups) {
    const [month, sub] = key.split('|');
    let rate = rates.get(sub) ?? 0;
    if (sub === P.R3.subCategory && month === P.R3.month) rate *= P.R3.factor;
    const k = Math.round(indices.length * rate);
    for (const i of rng.shuffle(indices).slice(0, k)) drafts[i].returned = true;
  }
}

/** R7: lower-case regions, empty segments and negative quantities. */
function plantProblems(rng: Rng, lines: OrderLine[]): void {
  const pickRows = (n: number): number[] =>
    rng.shuffle(Array.from({ length: lines.length }, (_, i) => i)).slice(0, n);

  for (const i of pickRows(Math.round(lines.length * P.R7.lowercaseRegionShare))) {
    lines[i].region = lines[i].region.toLowerCase();
  }
  for (const i of pickRows(Math.round(lines.length * P.R7.emptySegmentShare))) {
    lines[i].customer_segment = null;
  }
  for (const i of pickRows(P.R7.negativeQuantityRows)) {
    const line = lines[i];
    line.quantity = -line.quantity;
    line.revenue = -line.revenue;
    line.cost = -line.cost;
  }
}

/** R7: exact duplicate rows, most of them in one week, each next to its original. */
function addDuplicates(rng: Rng, lines: OrderLine[]): OrderLine[] {
  const total = Math.round((lines.length * P.R7.duplicateShare) / (1 - P.R7.duplicateShare));
  const { from, to } = P.R7.duplicateWeek;
  const inWeek: number[] = [];
  const outside: number[] = [];
  lines.forEach((l, i) => {
    // Copying a negative row would change the planted count of 12.
    if (l.quantity < 0) return;
    (l.order_date >= from && l.order_date <= to ? inWeek : outside).push(i);
  });
  const weekCount = Math.min(inWeek.length, Math.round(total * P.R7.duplicateShareInWeek));
  const chosen = new Set([
    ...rng.shuffle(inWeek).slice(0, weekCount),
    ...rng.shuffle(outside).slice(0, total - weekCount),
  ]);
  const out: OrderLine[] = [];
  lines.forEach((line, i) => {
    out.push(line);
    if (chosen.has(i)) out.push({ ...line });
  });
  return out;
}
