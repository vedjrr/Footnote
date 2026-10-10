import type { Metadata } from 'next';
import { AccuracyView, type Summary } from '@/features/accuracy/accuracy-view';
import results from '../../../../eval/results/summary.json';

export const metadata: Metadata = { title: 'Accuracy' };

// Static: the page is rendered at build time from the results file.
export default function AccuracyPage() {
  return <AccuracyView summary={results as Summary} />;
}
