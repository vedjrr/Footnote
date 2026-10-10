'use client';

import { useEffect, useState } from 'react';
import { formatFixed } from '@/core/narrative/format';
import { contrast } from '@/ui/contrast';

export interface SwatchSpec {
  token: string;
  use: string;
  /** Surface token to measure text contrast against. */
  on?: string;
}

// Reads each token's value in the current theme, so the page never repeats
// a hex value that lives in tokens.css, and works out contrast from it.
export function Swatches({ items, caption }: { items: SwatchSpec[]; caption: string }) {
  const [values, setValues] = useState<Record<string, string>>({});

  useEffect(() => {
    const read = () => {
      const style = getComputedStyle(document.documentElement);
      const names = new Set(items.flatMap((i) => (i.on ? [i.token, i.on] : [i.token])));
      setValues(Object.fromEntries([...names].map((n) => [n, style.getPropertyValue(n).trim()])));
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
    <div className="fn-table-wrap">
      <table className="fn-table">
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Token</th>
            <th scope="col">Value</th>
            <th scope="col" className="num">
              Contrast
            </th>
            <th scope="col">Use</th>
          </tr>
        </thead>
        <tbody>
          {items.map((i) => {
            const fg = values[i.token];
            const bg = i.on ? values[i.on] : undefined;
            const ratio = fg && bg ? contrast(fg, bg) : null;
            return (
              <tr key={i.token}>
                <th scope="row">
                  <span className="flex items-center gap-3">
                    <span
                      className="h-5 w-5 shrink-0 rounded-sm border border-rule"
                      style={{ background: `var(${i.token})` }}
                    />
                    {i.token}
                  </span>
                </th>
                <td className="text-ink-2">{fg ?? ''}</td>
                <td className="num">
                  {ratio === null ? '' : `${formatFixed(ratio, 1)} on ${i.on?.replace('--', '')}`}
                </td>
                <td className="text-ink-2">{i.use}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
