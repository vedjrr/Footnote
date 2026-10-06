import { redirect } from 'next/navigation';

export default async function WorkspaceHome({ params }: PageProps<'/w/[workspace]'>) {
  const { workspace } = await params;
  redirect(`/w/${workspace}/briefing`);
}
