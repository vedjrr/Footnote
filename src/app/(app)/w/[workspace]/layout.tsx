import { notFound } from 'next/navigation';
import { SAMPLES, findSample } from '@/features/workspace/samples';

export function generateStaticParams() {
  return SAMPLES.map((s) => ({ workspace: s.id }));
}

export default async function WorkspaceLayout({ children, params }: LayoutProps<'/w/[workspace]'>) {
  const { workspace } = await params;
  if (!findSample(workspace)) notFound();
  return children;
}
