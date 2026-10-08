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

const megabytes = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 });

/** A file size in megabytes of 1,000,000 bytes, as the operating system shows it. */
export function formatMegabytes(bytes: number): string {
  const mb = bytes / 1_000_000;
  return mb < 1 ? 'under 1 MB' : `${megabytes.format(mb)} MB`;
}

const share = new Intl.NumberFormat('en-GB', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/** A share of 0..1 as a percentage with one decimal: 0.012 -> "1.2%". Tiny shares say so. */
export function formatShare(value: number): string {
  if (value > 0 && value < 0.0005) return 'under 0.1%';
  return `${share.format(value * 100)}%`;
}

const monthYear = new Intl.DateTimeFormat('en-GB', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

/** An ISO date's month as "March 2025". */
export function formatMonth(iso: string): string {
  const [y, m] = iso.slice(0, 7).split('-').map(Number);
  return monthYear.format(new Date(Date.UTC(y, m - 1, 1)));
}
