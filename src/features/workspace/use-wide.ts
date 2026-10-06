'use client';

import { useSyncExternalStore } from 'react';

// Layout widths (ui-ux-rules §5). From 1200 px the working paper is a column
// beside the reading column; from 768 px it slides in from the right;
// narrower, it is a sheet from the bottom.

function useMedia(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    () => window.matchMedia(query).matches,
    () => true,
  );
}

export const useWide = () => useMedia('(min-width: 1200px)');
export const useTabletUp = () => useMedia('(min-width: 768px)');
