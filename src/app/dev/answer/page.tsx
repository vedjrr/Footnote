import { notFound } from 'next/navigation';
import { AskView } from '@/features/ask/ask-view';

// A test page for answers the starters do not reach: a filter value that is
// not in the data, so a check fails. Playwright drives it. It does not exist
// in production builds.
const QUESTIONS = [
  {
    label: 'Revenue in the Nrth region',
    spec: {
      metrics: ['revenue'],
      filters: [{ dimension: 'region', op: 'in', values: ['Nrth'] }],
    },
  },
  {
    label: 'Revenue by region and channel',
    spec: { metrics: ['revenue'], by: ['region', 'channel'] },
  },
];

export default function AnswerHarnessPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <AskView workspaceId="retail" questions={QUESTIONS} />;
}
