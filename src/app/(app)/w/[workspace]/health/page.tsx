import { HealthView } from '@/features/health/health-view';

export default async function Page({ params }: PageProps<'/w/[workspace]/health'>) {
  const { workspace } = await params;
  return <HealthView workspaceId={workspace} />;
}
