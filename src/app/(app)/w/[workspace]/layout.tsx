import { notFound } from 'next/navigation';
import { SAMPLES, findSample } from '@/features/workspace/samples';
import { isFileId } from '@/features/workspace/file-id';

export function generateStaticParams() {
  return SAMPLES.map((s) => ({ workspace: s.id }));
}

// A sample, or one of the user's files (`file-1`, ...), which only the
// browser holds; the page says so if it is not open there.
export default async function WorkspaceLayout({ children, params }: LayoutProps<'/w/[workspace]'>) {
  const { workspace } = await params;
  if (!findSample(workspace) && !isFileId(workspace)) notFound();
  return children;
}
