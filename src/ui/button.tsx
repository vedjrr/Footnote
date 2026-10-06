import type { ButtonHTMLAttributes, Ref } from 'react';
import { cx } from './cx';

export type ButtonVariant = 'primary' | 'secondary' | 'quiet';

const base =
  'inline-flex items-center justify-center gap-2 type-small font-medium select-none ' +
  'disabled:cursor-not-allowed disabled:opacity-50';

const variants: Record<ButtonVariant, string> = {
  // One per view at most. 44 px tall on phones, 40 px from tablet up.
  primary:
    'min-h-11 md:min-h-10 px-4 rounded-sm bg-ink text-paper ' +
    'hover:not-disabled:bg-ink-2 transition-colors duration-(--duration-quick)',
  secondary:
    'min-h-10 px-4 rounded-sm border border-ink text-ink bg-transparent ' +
    'hover:not-disabled:bg-wash transition-colors duration-(--duration-quick)',
  quiet:
    'min-h-6 px-1 -mx-1 rounded-sm text-mark bg-transparent underline-offset-3 ' +
    'decoration-1 hover:not-disabled:underline',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  ref?: Ref<HTMLButtonElement>;
}

export function Button({
  variant = 'secondary',
  className,
  type = 'button',
  ...rest
}: ButtonProps) {
  return <button type={type} className={cx(base, variants[variant], className)} {...rest} />;
}

export function buttonClass(variant: ButtonVariant, className?: string): string {
  return cx(base, variants[variant], className);
}
