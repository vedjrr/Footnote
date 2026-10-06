import type { ButtonHTMLAttributes } from 'react';
import { cx } from './cx';

// A part of the interpretation row: a label and a value (ui-ux-rules §6).
interface TagProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  value: string;
  /** Footnote assumed this part; the question did not state it. */
  assumed?: boolean;
}

const tagClass =
  'inline-flex min-h-8 items-baseline gap-1 rounded-sm border border-rule bg-paper px-2 py-1 type-small text-ink';

export function Tag({ label, value, assumed, className, type = 'button', ...rest }: TagProps) {
  return (
    <button
      type={type}
      className={cx(
        tagClass,
        'hover:border-ink-3 data-[state=open]:border-ink transition-colors duration-(--duration-quick)',
        className,
      )}
      {...rest}
    >
      <span className="text-ink-3">{label}</span>
      <span className="font-medium">{value}</span>
      {assumed && <span className="text-ink-3 italic">assumed</span>}
    </button>
  );
}

/** The same look, for a tag that cannot be changed. */
export function StaticTag({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <span className={cx(tagClass, className)}>
      <span className="text-ink-3">{label}</span>
      <span className="font-medium">{value}</span>
    </span>
  );
}
