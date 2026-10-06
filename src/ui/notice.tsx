import type { ReactNode } from 'react';
import { cx } from './cx';
import { Icon, type IconName } from './icon';

export type Tone = 'good' | 'caution' | 'critical';

const tones: Record<Tone, { icon: IconName; word: string; color: string }> = {
  good: { icon: 'check', word: 'Passed', color: 'text-good' },
  caution: { icon: 'caution', word: 'Caution', color: 'text-caution' },
  critical: { icon: 'caution', word: 'Problem', color: 'text-critical' },
};

/** A status: icon, word and sentence. Never colour alone (ui-ux-rules §11). */
export function Status({
  tone,
  children,
  className,
}: {
  tone: Tone;
  children: ReactNode;
  className?: string;
}) {
  const t = tones[tone];
  return (
    <p className={cx('flex items-start gap-2 type-small text-ink', className)}>
      <span className={cx('flex h-5 items-center', t.color)}>
        <Icon name={t.icon} label={t.word} />
      </span>
      <span>{children}</span>
    </p>
  );
}

/**
 * The notice row: one sentence on ledger, for something the reader should
 * know about the whole page, such as AI assist being unavailable.
 */
export function Notice({
  tone,
  children,
  action,
  className,
}: {
  tone?: Tone;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      role="status"
      className={cx(
        'flex flex-wrap items-center gap-x-4 gap-y-2 border-y border-ledger-rule bg-ledger px-4 py-3 type-small text-ink',
        className,
      )}
    >
      {tone ? (
        <Status tone={tone} className="flex-1">
          {children}
        </Status>
      ) : (
        <p className="flex-1">{children}</p>
      )}
      {action}
    </div>
  );
}
