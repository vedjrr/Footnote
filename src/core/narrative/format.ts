// Number and date formatting (analytics-spec §9.2). The one formatter; T23
// adds compact values, percentages, points and durations here.

const integer = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 });
const day = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

/** A full value with thousands separators and a real minus sign: −1,234. */
export function formatInteger(value: number): string {
  return integer.format(value).replace('-', '−');
}

/** An ISO date as "18 July 2024". Read as a calendar day, not a moment. */
export function formatDay(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return day.format(new Date(Date.UTC(y, m - 1, d)));
}
