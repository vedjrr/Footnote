import { MetricsView } from '@/features/metrics/metrics-view';

export default async function Page({ params }: PageProps<'/w/[workspace]/metrics'>) {
  const { workspace } = await params;
  return <MetricsView workspaceId={workspace} />;
}
