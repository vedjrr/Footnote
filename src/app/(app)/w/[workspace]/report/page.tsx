import { PlannedView } from '@/features/workspace/planned-view';

export default async function Page({ params }: PageProps<'/w/[workspace]/report'>) {
  const { workspace } = await params;
  return (
    <PlannedView sampleId={workspace} title="Report">
      Answers you add to the report will collect here, ready to export with their footnotes.
    </PlannedView>
  );
}
