// The "Kettle Helpdesk" support generator (analytics-spec §10.3). Pure: the
// same seed gives the same rows. Tickets per day, SLA breaches per team and
// month, and CSAT scores per category and month are allocated, not sampled,
// so the planted effects are not lost in noise.

import { allocate, createRng, weightedPicker, type Rng } from '../rng';
import * as P from './params';

export interface Ticket {
  ticket_id: string;
  created_at: string;
  resolved_at: string | null;
  team: string;
  priority: string;
  category: string;
  channel: string;
  first_response_minutes: number;
  resolution_hours: number | null;
  sla_breached: boolean;
  csat: number | null;
  reopened: boolean;
}

interface Draft {
  created: number;
  date: string;
  team: number;
  category: string;
  priority: number;
  channel: number;
  open: boolean;
  breached: boolean;
  firstResponse: number;
  resolutionMinutes: number | null;
  csat: number | null;
  reopened: boolean;
}

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;
const pad = (n: number, width: number): string => String(n).padStart(width, '0');
/** 'YYYY-MM-DD HH:MM:SS' in UTC. */
const stamp = (ms: number): string => new Date(ms).toISOString().slice(0, 19).replace('T', ' ');

/** Groups indices of `items` by a key, keys in first-seen order. */
function groupBy<T>(items: T[], key: (item: T) => string): Map<string, number[]> {
  const groups = new Map<string, number[]>();
  items.forEach((item, i) => {
    const k = key(item);
    const list = groups.get(k) ?? [];
    list.push(i);
    groups.set(k, list);
  });
  return groups;
}

/** Expected tickets per day of the year, with T3 and T4 applied. */
function dayCounts(rng: Rng): { start: number; date: string; count: number }[] {
  const first = Date.UTC(P.YEAR, 0, 1);
  const days: { start: number; date: string }[] = [];
  for (let t = first; t < Date.UTC(P.YEAR + 1, 0, 1); t += DAY) {
    days.push({ start: t, date: stamp(t).slice(0, 10) });
  }
  const weights = days.map(({ start, date }) => {
    const spike = date === P.T4.date ? P.T4.factor : 1;
    const noise = 1 + P.DAY_NOISE * rng.normal();
    return P.WEEKDAY_FACTOR[new Date(start).getUTCDay()] * spike * noise;
  });
  const counts = allocate(P.TICKETS, weights);
  return days.map((d, i) => ({ ...d, count: counts[i] }));
}

export function generateTickets(seed: number = P.SEED): Ticket[] {
  const rng = createRng(seed);
  const pickTeam = weightedPicker(P.TEAM_WEIGHTS);
  const pickCategory = P.TEAM_CATEGORIES.map((list) => weightedPicker(list.map((c) => c.weight)));
  const pickPriority = weightedPicker(P.PRIORITY_WEIGHTS);
  const pickChannel = weightedPicker(P.CHANNEL_WEIGHTS);
  const pickHour = weightedPicker(P.HOUR_WEIGHTS);

  const drafts: Draft[] = [];
  for (const day of dayCounts(rng)) {
    for (let k = 0; k < day.count; k++) {
      const team = pickTeam(rng);
      const created = day.start + pickHour(rng) * 60 * MINUTE + rng.int(0, 3599) * 1000;
      const late = day.date >= P.OPEN_LATE.from;
      drafts.push({
        created,
        date: day.date,
        team,
        category: P.TEAM_CATEGORIES[team][pickCategory[team](rng)].name,
        priority: pickPriority(rng),
        channel: pickChannel(rng),
        open: rng.next() < (late ? P.OPEN_LATE.share : P.OPEN_SHARE),
        breached: false,
        firstResponse: 0,
        resolutionMinutes: null,
        csat: null,
        reopened: false,
      });
    }
  }
  drafts.sort((a, b) => a.created - b.created);

  markBreaches(rng, drafts);
  for (const d of drafts) {
    const target = P.SLA_MINUTES[d.priority];
    // A breach answers after the target; otherwise somewhere before it.
    d.firstResponse = d.breached
      ? Math.round(target * (1.05 + 0.5 * Math.exp(0.7 * rng.normal())))
      : Math.max(1, Math.round(target * (0.05 + 0.9 * rng.next())));
    if (!d.open) {
      const median = P.RESOLUTION_HOURS[d.priority] * 60;
      const minutes = Math.round(
        median * Math.exp(P.RESOLUTION_SIGMA * rng.normal()) + d.firstResponse,
      );
      d.resolutionMinutes = minutes;
      d.reopened = rng.next() < P.REOPENED_SHARE;
    }
  }
  markCsat(rng, drafts);
  const tickets = drafts.map((d, i): Ticket => ({
    ticket_id: `KH-${pad(i + 1, 6)}`,
    created_at: stamp(d.created),
    resolved_at:
      d.resolutionMinutes === null ? null : stamp(d.created + d.resolutionMinutes * MINUTE),
    team: P.TEAMS[d.team],
    priority: P.PRIORITIES[d.priority],
    category: d.category,
    channel: P.CHANNELS[d.channel],
    first_response_minutes: d.firstResponse,
    resolution_hours:
      d.resolutionMinutes === null ? null : Math.round((d.resolutionMinutes / 60) * 100) / 100,
    sla_breached: d.breached,
    csat: d.csat,
    reopened: d.reopened,
  }));
  plantProblems(rng, tickets, drafts);
  return tickets;
}

/** Exact breach counts per team and period, with T1 applied from its start date. */
function markBreaches(rng: Rng, drafts: Draft[]): void {
  const period = (d: Draft) => (d.date >= P.T1.from ? 'T1' : d.date.slice(0, 7));
  for (const [key, indices] of groupBy(drafts, (d) => `${d.team}|${period(d)}`)) {
    const [team, when] = key.split('|');
    const name = P.TEAMS[Number(team)];
    const rate = when === 'T1' && name === P.T1.team ? P.T1.rate : P.BREACH_RATE[Number(team)];
    const k = Math.round(indices.length * rate);
    for (const i of rng.shuffle(indices).slice(0, k)) drafts[i].breached = true;
  }
}

/** Exact rating counts and score counts per category and month, with T2 applied. */
function markCsat(rng: Rng, drafts: Draft[]): void {
  const resolved = drafts.filter((d) => !d.open);
  for (const [key, indices] of groupBy(resolved, (d) => `${d.category}|${d.date.slice(0, 7)}`)) {
    const [category, month] = key.split('|');
    const shares = category === P.T2.category && month === P.T2.month ? P.T2.shares : P.CSAT_SHARES;
    const rated = rng.shuffle(indices).slice(0, Math.round(indices.length * P.RATED_SHARE));
    const scores = allocate(rated.length, shares).flatMap((n, s) => Array<number>(n).fill(s + 1));
    rng.shuffle(scores);
    rated.forEach((i, j) => (resolved[i].csat = scores[j]));
  }
}

/** T5: tickets resolved before they were created, and repeated ticket ids. */
function plantProblems(rng: Rng, tickets: Ticket[], drafts: Draft[]): void {
  const resolved = tickets.flatMap((t, i) => (t.resolved_at === null ? [] : [i]));
  const early = Math.round(tickets.length * P.T5.resolvedBeforeCreatedShare);
  for (const i of rng.shuffle(resolved).slice(0, early)) {
    const minutes = rng.int(30, 600);
    tickets[i].resolved_at = stamp(drafts[i].created - minutes * MINUTE);
    tickets[i].resolution_hours = -Math.round((minutes / 60) * 100) / 100;
  }
  // A repeated id copies the id of the ticket just before it. In ascending
  // order, two neighbours both chosen give one id on three rows: two repeats.
  const repeats = Math.round(tickets.length * P.T5.repeatedIdShare);
  const candidates = Array.from({ length: tickets.length - 1 }, (_, i) => i + 1);
  const chosen = rng
    .shuffle(candidates)
    .slice(0, repeats)
    .sort((a, b) => a - b);
  for (const i of chosen) {
    tickets[i].ticket_id = tickets[i - 1].ticket_id;
  }
}
