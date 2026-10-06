import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Accuracy' };

export default function AccuracyPage() {
  return (
    <div className="flex flex-col gap-4 px-4 pt-12 pb-24 md:px-8 wide:pl-[clamp(24px,8vw,128px)]">
      <h1 className="type-h2 text-ink">Accuracy</h1>
      <p className="type-prose text-ink-2">
        How often Footnote gets questions right will be published here, measured against questions
        with known answers. Nothing has been measured yet, so there are no figures.
      </p>
    </div>
  );
}
