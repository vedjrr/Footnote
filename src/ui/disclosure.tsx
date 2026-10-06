import type { ReactNode } from 'react';
import { cx } from './cx';
import { Icon } from './icon';

/**
 * A collapsed section, such as "Rows behind it" or "SQL" in the working
 * paper. Native details and summary, so it works without script.
 */
export function Disclosure({
  summary,
  children,
  defaultOpen,
  className,
}: {
  summary: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
}) {
  return (
    <details className={cx('group', className)} open={defaultOpen}>
      <summary className="flex min-h-8 cursor-pointer list-none items-center gap-2 type-small font-medium text-ink [&::-webkit-details-marker]:hidden">
        <span className="flex-1">{summary}</span>
        <Icon
          name="chevron-right"
          className="text-ink-3 transition-transform duration-(--duration-quick) group-open:rotate-90"
        />
      </summary>
      <div className="pt-2">{children}</div>
    </details>
  );
}
