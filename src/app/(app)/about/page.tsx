import type { Metadata } from 'next';
import { product } from '@/config/product';

export const metadata: Metadata = { title: 'About' };

export default function AboutPage() {
  return (
    <div className="flex flex-col gap-4 px-4 pt-12 pb-24 md:px-8 wide:pl-[clamp(24px,8vw,128px)]">
      <h1 className="type-h2 text-ink">About {product.name}</h1>
      <p className="type-prose text-ink-2">
        {product.name} reads a data file in your browser, writes a short briefing on it, and shows
        the query behind every number. How it works and what it cannot do will be written up here.
      </p>
    </div>
  );
}
