'use client';

import { Dialog } from 'radix-ui';
import { useRef, type ReactNode } from 'react';
import { cx } from './cx';
import { Icon } from './icon';

interface OverlayProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  /** Read out with the title; hidden visually when not given. */
  description?: ReactNode;
  children: ReactNode;
  /** `ledger` for the working paper, `paper` for anything else. */
  surface?: 'ledger' | 'paper';
}

/**
 * These dialogs are opened from state, not from a Dialog.Trigger, so Radix
 * has no trigger to give focus back to. Remember what had focus on open and
 * return to it on close.
 */
function useReturnFocus() {
  const returnTo = useRef<HTMLElement | null>(null);
  return {
    onOpenAutoFocus: () => {
      returnTo.current = document.activeElement as HTMLElement | null;
    },
    onCloseAutoFocus: (event: Event) => {
      event.preventDefault();
      returnTo.current?.focus();
    },
  };
}

function Header({ title, description }: { title: ReactNode; description?: ReactNode }) {
  return (
    <div className="flex items-start gap-4">
      <div className="flex-1">
        <Dialog.Title className="type-body font-medium text-ink">{title}</Dialog.Title>
        {description ? (
          <Dialog.Description className="type-small text-ink-2">{description}</Dialog.Description>
        ) : (
          <Dialog.Description className="sr-only">{title}</Dialog.Description>
        )}
      </div>
      <Dialog.Close
        aria-label="Close"
        className="-mr-2 -mt-1 flex h-8 w-8 items-center justify-center rounded-sm text-ink-2 hover:bg-wash"
      >
        <Icon name="close" size={20} />
      </Dialog.Close>
    </div>
  );
}

/**
 * Slides in from the right over the page, 400 px wide. Used for the working
 * paper on tablets. Focus moves in on open and returns to the trigger on
 * close; Esc closes it.
 */
export function Panel({
  open,
  onOpenChange,
  title,
  description,
  children,
  surface = 'ledger',
}: OverlayProps) {
  const focus = useReturnFocus();
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40" />
        <Dialog.Content
          {...focus}
          className={cx(
            'fixed inset-y-0 right-0 z-50 flex w-full max-w-100 flex-col gap-6 overflow-y-auto border-l p-6 shadow-float panel-slide',
            surface === 'ledger' ? 'bg-ledger border-ledger-rule' : 'bg-paper border-rule',
          )}
        >
          <Header title={title} description={description} />
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/**
 * A sheet from the bottom, up to 80% of the height. Used for the working
 * paper and menus on phones.
 */
export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  surface = 'ledger',
}: OverlayProps) {
  const focus = useReturnFocus();
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40" />
        <Dialog.Content
          {...focus}
          className={cx(
            'fixed inset-x-0 bottom-0 z-50 flex max-h-[80dvh] flex-col gap-6 overflow-y-auto rounded-t-md border-t p-4 pb-8 shadow-float sheet-rise',
            surface === 'ledger' ? 'bg-ledger border-ledger-rule' : 'bg-paper border-rule',
          )}
        >
          <Header title={title} description={description} />
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
