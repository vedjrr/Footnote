import { SampleFacts } from '@/features/briefing/sample-facts';

export default async function BriefingPage({ params }: PageProps<'/w/[workspace]/briefing'>) {
  const { workspace } = await params;
  return <SampleFacts sampleId={workspace} />;
}
