'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { product } from '@/config/product';
import { ensureSample } from '@/features/workspace/sample-store';
import { DEFAULT_SAMPLE, SAMPLES, findSample } from '@/features/workspace/samples';
import { cx } from '@/ui/cx';
import { Icon } from '@/ui/icon';
import {
  Menu,
  MenuContent,
  MenuLabel,
  MenuRadioGroup,
  MenuRadioItem,
  MenuTrigger,
} from '@/ui/menu';
import { Sheet } from '@/ui/panel';
import { ThemeToggle } from '@/ui/theme-toggle';
import { VIEWS, locate, viewHref, type ViewSlug } from './routes';

const quietControl =
  'flex h-8 items-center gap-1 rounded-sm px-2 hover:bg-wash data-[state=open]:bg-wash';

function navClass(current: boolean) {
  return cx(
    'flex h-8 items-center whitespace-nowrap text-ink-2 no-underline hover:text-ink',
    current && 'text-ink underline decoration-ink decoration-1 underline-offset-[6px]',
  );
}

export function TopBar() {
  const pathname = usePathname();
  const here = locate(pathname);
  // Accuracy and About sit outside a workspace; the switcher and links keep
  // pointing at the workspace the reader came from.
  const [last, setLast] = useState<string>(here?.workspace ?? DEFAULT_SAMPLE);
  const workspace = here?.workspace ?? last;
  const sample = findSample(workspace) ?? findSample(DEFAULT_SAMPLE)!;
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (here) setLast(here.workspace);
  }, [here]);

  // The engine starts after first paint, on whichever page comes first.
  useEffect(() => ensureSample(sample), [sample]);

  const view = here?.view;
  const links = VIEWS.map((v) => ({
    ...v,
    href: viewHref(sample.id, v.slug),
    current: view === v.slug,
  }));

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-rule bg-paper px-4 type-small md:gap-6 md:px-8">
      <Link href="/" className="flex shrink-0 items-start text-ink no-underline">
        <span className="font-serif text-[18px] leading-6 font-medium">{product.name}</span>
        <sup
          aria-hidden
          className="ml-px mt-0.5 font-sans text-[11px] leading-none font-semibold text-mark"
        >
          1
        </sup>
      </Link>

      <WorkspaceSwitcher current={sample.id} view={view ?? 'briefing'} />

      <nav aria-label="Views" className="hidden min-w-0 items-center gap-5 lg:flex">
        {links.map((l) => (
          <Link
            key={l.slug}
            href={l.href}
            aria-current={l.current ? 'page' : undefined}
            className={navClass(l.current)}
          >
            {l.label}
          </Link>
        ))}
      </nav>

      <div className="ml-auto flex shrink-0 items-center gap-1 md:gap-4">
        <Link
          href="/accuracy"
          aria-current={pathname === '/accuracy' ? 'page' : undefined}
          className={cx('hidden lg:flex', navClass(pathname === '/accuracy'))}
        >
          Accuracy
        </Link>
        <AiAssist className="hidden md:flex" />
        <Link
          href={viewHref(sample.id, 'ask')}
          aria-current={view === 'ask' ? 'page' : undefined}
          className={cx('px-2 md:hidden', navClass(view === 'ask'))}
        >
          Ask
        </Link>
        <button
          type="button"
          className={cx(quietControl, 'text-ink-2 lg:hidden')}
          aria-haspopup="dialog"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(true)}
        >
          Menu
        </button>
        <ThemeToggle />
      </div>

      <Sheet open={menuOpen} onOpenChange={setMenuOpen} title="Menu" surface="paper">
        <nav aria-label="Views" className="flex flex-col">
          {[
            ...links,
            {
              slug: 'accuracy',
              label: 'Accuracy',
              href: '/accuracy',
              current: pathname === '/accuracy',
            },
            { slug: 'about', label: 'About', href: '/about', current: pathname === '/about' },
          ].map((l) => (
            <Link
              key={l.slug}
              href={l.href}
              aria-current={l.current ? 'page' : undefined}
              onClick={() => setMenuOpen(false)}
              className={cx(
                'flex min-h-11 items-center border-b border-rule type-body',
                navClass(l.current),
              )}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <AiAssist className="-ml-2 flex self-start md:hidden" />
      </Sheet>
    </header>
  );
}

function WorkspaceSwitcher({ current, view }: { current: string; view: ViewSlug }) {
  const router = useRouter();
  const sample = findSample(current)!;
  return (
    <Menu>
      <MenuTrigger
        aria-label={`Workspace: ${sample.name}, sample data`}
        className={cx(quietControl, '-ml-2 min-w-0 shrink text-ink md:ml-0')}
      >
        <span className="truncate">
          {sample.name} <span className="hidden text-ink-3 sm:inline">(sample)</span>
        </span>
        <Icon name="chevron-down" className="shrink-0 text-ink-3" />
      </MenuTrigger>
      <MenuContent>
        <MenuLabel>Sample data</MenuLabel>
        <MenuRadioGroup value={current} onValueChange={(id) => router.push(viewHref(id, view))}>
          {SAMPLES.map((s) => (
            <MenuRadioItem key={s.id} value={s.id}>
              <span className="flex-1">{s.name}</span>
              <span className="pl-4 text-ink-3">{s.rowNoun}</span>
            </MenuRadioItem>
          ))}
        </MenuRadioGroup>
      </MenuContent>
    </Menu>
  );
}

/** AI assist with its state in words (§6). The switch itself comes later. */
function AiAssist({ className }: { className?: string }) {
  return (
    <Menu>
      <MenuTrigger className={cx(quietControl, 'whitespace-nowrap text-ink', className)}>
        AI assist <span className="text-ink-3">Off</span>
      </MenuTrigger>
      <MenuContent align="end" className="max-w-80 p-3">
        <p className="text-ink">
          AI assist is off and nothing is sent anywhere. Every number here comes from a query that
          runs in your browser. The switch to turn AI assist on is not built yet.
        </p>
      </MenuContent>
    </Menu>
  );
}
