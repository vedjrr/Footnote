/**
 * Layout arithmetic shared by the charts. Pure functions, no DOM, so the
 * same layout comes out on the server and in the browser.
 */
import { scaleLinear } from 'd3-scale';
import { textWidth } from './text';

/** Type sizes used inside charts, in px (ui-ux-rules §3, caption). */
export const AXIS_SIZE = 12;
export const LABEL_SIZE = 12;
export const LINE_HEIGHT = 16;

/** The width a chart is laid out at before the browser has measured it. */
export const SERVER_WIDTH = 640;

/** Marks (ui-ux-rules §7). */
export const BAR_MAX = 24;
export const BAR_RADIUS = 4;
export const GAP = 2;
export const DOT_R = 4;
export const RING = 2;
export const HIT_MIN = 24;

/**
 * A value scale's domain and round ticks. The domain always includes zero
 * when `zero` is set (bars), and is widened to the nice tick bounds.
 */
export function valueTicks(
  values: number[],
  { zero, count = 5 }: { zero: boolean; count?: number },
): { domain: [number, number]; ticks: number[] } {
  const finite = values.filter((v) => Number.isFinite(v));
  let lo = finite.length ? Math.min(...finite) : 0;
  let hi = finite.length ? Math.max(...finite) : 1;
  if (zero) {
    lo = Math.min(lo, 0);
    hi = Math.max(hi, 0);
  }
  if (lo === hi) {
    const pad = lo === 0 ? 1 : Math.abs(lo) * 0.1;
    if (!zero || lo !== 0) lo -= pad;
    hi += pad;
    if (zero) lo = Math.min(lo, 0);
  }
  const scale = scaleLinear().domain([lo, hi]).nice(count);
  const [d0, d1] = scale.domain() as [number, number];
  return { domain: [d0, d1], ticks: scale.ticks(count) };
}

/**
 * Which category labels to show along an axis so none overlap: every
 * label when they fit, otherwise every k-th, always keeping the last.
 * Returns the indices to show.
 */
export function thinLabels(labels: string[], step: number, size = AXIS_SIZE, pad = 8): number[] {
  if (labels.length === 0) return [];
  const widest = Math.max(...labels.map((l) => textWidth(l, size)));
  const every = Math.max(1, Math.ceil((widest + pad) / Math.max(step, 1)));
  const shown: number[] = [];
  const last = labels.length - 1;
  for (let i = last; i >= 0; i -= every) shown.unshift(i);
  return shown;
}

/**
 * Spreads end labels vertically so none overlap. Each label keeps its
 * target y if it can; otherwise labels are pushed apart by the least
 * distance, within [top, bottom]. Returns the new y for each input, in
 * input order. When labels cannot all fit, returns null: the caller drops
 * them and leaves identity to the legend.
 */
export function spreadLabels(
  targets: number[],
  { top, bottom, height = LINE_HEIGHT }: { top: number; bottom: number; height?: number },
): number[] | null {
  const n = targets.length;
  if (n === 0) return [];
  if (n * height > bottom - top) return null;
  const order = targets.map((y, i) => ({ y, i })).sort((a, b) => a.y - b.y);
  const ys = order.map((o) => Math.min(Math.max(o.y, top + height / 2), bottom - height / 2));
  // Push down, then pull back up from the bottom edge.
  for (let k = 1; k < n; k++) ys[k] = Math.max(ys[k], ys[k - 1] + height);
  ys[n - 1] = Math.min(ys[n - 1], bottom - height / 2);
  for (let k = n - 2; k >= 0; k--) ys[k] = Math.min(ys[k], ys[k + 1] - height);
  const out = new Array<number>(n);
  order.forEach((o, k) => (out[o.i] = ys[k]));
  return out;
}

/** The SVG path of a bar with a rounded data end and a square baseline. */
export function barPath(
  x: number,
  y: number,
  w: number,
  h: number,
  end: 'top' | 'bottom' | 'left' | 'right',
  radius = BAR_RADIUS,
): string {
  if (w <= 0 || h <= 0) return '';
  const r = Math.min(
    radius,
    end === 'top' || end === 'bottom' ? w / 2 : h / 2,
    end === 'top' || end === 'bottom' ? h : w,
  );
  const x1 = x + w;
  const y1 = y + h;
  switch (end) {
    case 'top':
      return `M${x},${y1}V${y + r}Q${x},${y} ${x + r},${y}H${x1 - r}Q${x1},${y} ${x1},${y + r}V${y1}Z`;
    case 'bottom':
      return `M${x},${y}V${y1 - r}Q${x},${y1} ${x + r},${y1}H${x1 - r}Q${x1},${y1} ${x1},${y1 - r}V${y}Z`;
    case 'right':
      return `M${x},${y}H${x1 - r}Q${x1},${y} ${x1},${y + r}V${y1 - r}Q${x1},${y1} ${x1 - r},${y1}H${x}Z`;
    case 'left':
      return `M${x1},${y}H${x + r}Q${x},${y} ${x},${y + r}V${y1 - r}Q${x},${y1} ${x + r},${y1}H${x1}Z`;
  }
}

/** Rounds to a half pixel so 1 px lines are crisp. */
export function crisp(v: number): number {
  return Math.round(v) + 0.5;
}

export type Box = { x: number; y: number; w: number; h: number };
export type Segment = [number, number, number, number];

function cross(ax: number, ay: number, bx: number, by: number, cx: number, cy: number): number {
  return (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
}

function segmentsCross(a: Segment, b: Segment): boolean {
  const d1 = cross(b[0], b[1], b[2], b[3], a[0], a[1]);
  const d2 = cross(b[0], b[1], b[2], b[3], a[2], a[3]);
  const d3 = cross(a[0], a[1], a[2], a[3], b[0], b[1]);
  const d4 = cross(a[0], a[1], a[2], a[3], b[2], b[3]);
  return d1 * d2 < 0 && d3 * d4 < 0;
}

/** Whether a line segment passes through a box. */
export function segmentHitsBox(s: Segment, b: Box): boolean {
  const inside = (x: number, y: number) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
  if (inside(s[0], s[1]) || inside(s[2], s[3])) return true;
  const x1 = b.x + b.w;
  const y1 = b.y + b.h;
  const edges: Segment[] = [
    [b.x, b.y, x1, b.y],
    [x1, b.y, x1, y1],
    [x1, y1, b.x, y1],
    [b.x, y1, b.x, b.y],
  ];
  return edges.some((e) => segmentsCross(s, e));
}

function boxesOverlap(a: Box, b: Box): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

/**
 * Places a label of `w` by `h` next to a point so that it stays inside
 * `bounds` and touches no line and no other label. Tries above, below,
 * then the sides and corners. Returns the box, or null when nothing fits:
 * the value is then left to the tooltip and the table.
 */
export function placeLabel(
  point: { x: number; y: number },
  w: number,
  h: number,
  { bounds, lines, avoid }: { bounds: Box; lines: Segment[]; avoid: Box[] },
): Box | null {
  const g = 8;
  const { x, y } = point;
  const candidates: Box[] = [
    { x: x - w / 2, y: y - g - h, w, h },
    { x: x - w / 2, y: y + g, w, h },
    { x: x - g - w, y: y - h / 2, w, h },
    { x: x + g, y: y - h / 2, w, h },
    { x: x - g / 2 - w, y: y - g / 2 - h, w, h },
    { x: x + g / 2, y: y - g / 2 - h, w, h },
    { x: x - g / 2 - w, y: y + g / 2, w, h },
    { x: x + g / 2, y: y + g / 2, w, h },
  ];
  for (const raw of candidates) {
    // Slide along x to stay inside the bounds, as long as it still sits by the point.
    const cx = Math.max(bounds.x, Math.min(bounds.x + bounds.w - raw.w, raw.x));
    const c = Math.abs(cx - raw.x) <= w / 2 ? { ...raw, x: cx } : raw;
    if (c.x < bounds.x || c.y < bounds.y) continue;
    if (c.x + c.w > bounds.x + bounds.w || c.y + c.h > bounds.y + bounds.h) continue;
    if (avoid.some((a) => boxesOverlap(a, c))) continue;
    if (lines.some((s) => segmentHitsBox(s, c))) continue;
    return c;
  }
  return null;
}
