import { PlannedView } from '@/features/workspace/planned-view';

export default async function Page({ params }: PageProps<'/w/[workspace]/health'>) {
  const { workspace } = await params;
  return (
    <PlannedView sampleId={workspace} title="Data health">
      Checks on this data will be listed here: duplicate rows, empty values, odd values and gaps in
      time, each with the rows behind it.
    </PlannedView>
  );
}
