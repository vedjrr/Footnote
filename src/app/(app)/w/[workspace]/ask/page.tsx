import { PlannedView } from '@/features/workspace/planned-view';

export default async function Page({ params }: PageProps<'/w/[workspace]/ask'>) {
  const { workspace } = await params;
  return (
    <PlannedView sampleId={workspace} title="Ask">
      Ask about this data in your own words, and each answer will show the query that produced it.
    </PlannedView>
  );
}
