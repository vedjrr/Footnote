import { PlannedView } from '@/features/workspace/planned-view';

export default async function Page({ params }: PageProps<'/w/[workspace]/metrics'>) {
  const { workspace } = await params;
  return (
    <PlannedView sampleId={workspace} title="Metrics">
      The metrics and dimensions Footnote reads from this data will be listed here, and you will be
      able to rename and correct them.
    </PlannedView>
  );
}
