import { AskView } from '@/features/ask/ask-view';

export default async function Page({ params }: PageProps<'/w/[workspace]/ask'>) {
  const { workspace } = await params;
  return <AskView workspaceId={workspace} />;
}
