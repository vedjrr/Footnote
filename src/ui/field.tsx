import { useId, type InputHTMLAttributes, type Ref } from 'react';
import { cx } from './cx';
import { Icon } from './icon';

export interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  /** Always visible (ui-ux-rules §6). */
  label: string;
  hint?: string;
  /** A sentence saying what is wrong and what to do. */
  error?: string;
  id?: string;
  inputClassName?: string;
  ref?: Ref<HTMLInputElement>;
}

export function Field({ label, hint, error, id, className, inputClassName, ...rest }: FieldProps) {
  const auto = useId();
  const inputId = id ?? auto;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;
  return (
    <div className={cx('flex flex-col gap-2', className)}>
      <label htmlFor={inputId} className="type-small font-medium text-ink">
        {label}
      </label>
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={cx(hintId, errorId) || undefined}
        className={cx(
          'min-h-10 rounded-sm border bg-wash px-3 type-body text-ink placeholder:text-ink-3',
          'disabled:cursor-not-allowed disabled:border-dashed disabled:bg-paper disabled:text-ink-3',
          error ? 'border-critical' : 'border-rule hover:not-disabled:border-ink-3',
          inputClassName,
        )}
        {...rest}
      />
      {hint && (
        <p id={hintId} className="type-small text-ink-3">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="flex items-start gap-2 type-small text-critical">
          <span className="flex h-5 items-center">
            <Icon name="caution" />
          </span>
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}
