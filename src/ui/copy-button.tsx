'use client';

import { useEffect, useState } from 'react';
import { Button } from './button';

/** "Copy SQL", which reads "Copied" for 1.5 s after a copy (§6). */
export function CopyButton({ text, label = 'Copy SQL' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(timer);
  }, [copied]);

  return (
    <Button
      variant="quiet"
      onClick={() => {
        void navigator.clipboard.writeText(text).then(() => setCopied(true));
      }}
    >
      {copied ? 'Copied' : label}
    </Button>
  );
}
