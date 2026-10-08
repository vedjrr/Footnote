import { DataFacts } from '@/features/briefing/data-facts';

export default async function BriefingPage({ params }: PageProps<'/w/[workspace]/briefing'>) {
  const { workspace } = await params;
  return <DataFacts workspaceId={workspace} />;
}
