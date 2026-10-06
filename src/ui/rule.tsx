import { cx } from './cx';

/**
 * `section`: the 32 px rule where a briefing section starts.
 * `hairline`: a full-width 1 px line, on paper or on ledger.
 */
export function Rule({
  kind = 'hairline',
  surface = 'paper',
  className,
}: {
  kind?: 'section' | 'hairline';
  surface?: 'paper' | 'ledger';
  className?: string;
}) {
  return (
    <hr
      className={cx(
        'border-0 border-t',
        kind === 'section' ? 'w-8 border-ink' : 'w-full',
        kind === 'hairline' && (surface === 'ledger' ? 'border-ledger-rule' : 'border-rule'),
        className,
      )}
    />
  );
}
