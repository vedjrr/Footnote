'use client';

import { useEffect, useState } from 'react';

export interface SwatchSpec {
  token: string;
  use: string;
}

// Reads each token's value in the current theme, so the page never repeats
// a hex value that lives in tokens.css.
export function Swatches({ items }: { items: SwatchSpec[] }) {
  const [values, setValues] = useState<Record<string, string>>({});

  useEffect(() => {
    const read = () => {
      const style = getComputedStyle(document.documentElement);
      setValues(
        Object.fromEntries(items.map((i) => [i.token, style.getPropertyValue(i.token).trim()])),
      );
    };
    read();
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    const media = matchMedia('(prefers-color-scheme: dark)');
    media.addEventListener('change', read);
    return () => {
      observer.disconnect();
      media.removeEventListener('change', read);
    };
  }, [items]);

  return (
    <ul className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((i) => (
        <li key={i.token} className="flex items-start gap-3">
          <span
            className="h-12 w-12 shrink-0 rounded-sm border border-rule"
            style={{ background: `var(${i.token})` }}
          />
          <span className="flex flex-col">
            <span className="type-small font-medium text-ink">{i.token}</span>
            <span className="type-caption text-ink-3 tabular-nums">{values[i.token] ?? ''}</span>
            <span className="type-small text-ink-2">{i.use}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
