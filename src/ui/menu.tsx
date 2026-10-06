'use client';

import { DropdownMenu } from 'radix-ui';
import type { ComponentProps, ReactNode } from 'react';
import { cx } from './cx';
import { Icon } from './icon';

// A menu that floats above the page: 6 px radius, the one shadow (§4).
export const Menu = DropdownMenu.Root;
export const MenuTrigger = DropdownMenu.Trigger;

export function MenuContent({
  className,
  children,
  align = 'start',
  sideOffset = 4,
  ...rest
}: ComponentProps<typeof DropdownMenu.Content>) {
  return (
    <DropdownMenu.Portal>
      <DropdownMenu.Content
        align={align}
        sideOffset={sideOffset}
        collisionPadding={16}
        className={cx(
          'z-50 min-w-48 rounded-md border border-rule bg-paper p-1 shadow-float type-small text-ink',
          'max-h-(--radix-dropdown-menu-content-available-height) overflow-y-auto',
          className,
        )}
        {...rest}
      >
        {children}
      </DropdownMenu.Content>
    </DropdownMenu.Portal>
  );
}

const itemClass =
  'flex min-h-8 cursor-default select-none items-center gap-2 rounded-sm px-2 outline-none ' +
  'data-highlighted:bg-wash data-disabled:opacity-50';

export function MenuItem({
  className,
  hint,
  children,
  ...rest
}: ComponentProps<typeof DropdownMenu.Item> & { hint?: ReactNode }) {
  return (
    <DropdownMenu.Item className={cx(itemClass, className)} {...rest}>
      <span className="flex-1">{children}</span>
      {hint && <span className="text-ink-3">{hint}</span>}
    </DropdownMenu.Item>
  );
}

export const MenuRadioGroup = DropdownMenu.RadioGroup;

export function MenuRadioItem({
  className,
  children,
  ...rest
}: ComponentProps<typeof DropdownMenu.RadioItem>) {
  return (
    <DropdownMenu.RadioItem className={cx(itemClass, 'pl-8 relative', className)} {...rest}>
      <span className="absolute left-2 flex h-4 w-4 items-center justify-center">
        <DropdownMenu.ItemIndicator>
          <Icon name="check" />
        </DropdownMenu.ItemIndicator>
      </span>
      {children}
    </DropdownMenu.RadioItem>
  );
}

export function MenuLabel({ className, ...rest }: ComponentProps<typeof DropdownMenu.Label>) {
  return (
    <DropdownMenu.Label className={cx('px-2 py-1 type-caption text-ink-3', className)} {...rest} />
  );
}

export function MenuSeparator({
  className,
  ...rest
}: ComponentProps<typeof DropdownMenu.Separator>) {
  return <DropdownMenu.Separator className={cx('my-1 h-px bg-rule', className)} {...rest} />;
}
