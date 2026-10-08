import { useId, type Ref, type SelectHTMLAttributes } from 'react';
import { cx } from './cx';
import { Icon } from './icon';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id'> {
  /** Always visible (ui-ux-rules §6). */
  label: string;
  options: SelectOption[];
  hint?: string;
  id?: string;
  ref?: Ref<HTMLSelectElement>;
}

/** A native select with the field's look, so it works by keyboard everywhere. */
export function Select({ label, options, hint, id, className, ...rest }: SelectProps) {
  const auto = useId();
  const selectId = id ?? auto;
  const hintId = hint ? `${selectId}-hint` : undefined;
  return (
    <div className={cx('flex flex-col gap-2', className)}>
      <label htmlFor={selectId} className="type-small font-medium text-ink">
        {label}
      </label>
      <div className="relative">
        <select
          id={selectId}
          aria-describedby={hintId}
          className={cx(
            'min-h-10 w-full appearance-none rounded-sm border border-rule bg-wash py-2 pr-9 pl-3 type-body text-ink',
            'hover:not-disabled:border-ink-3 disabled:cursor-not-allowed disabled:border-dashed disabled:bg-paper disabled:text-ink-3',
          )}
          {...rest}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <Icon
          name="chevron-down"
          className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-ink-3"
        />
      </div>
      {hint && (
        <p id={hintId} className="type-small text-ink-3">
          {hint}
        </p>
      )}
    </div>
  );
}
