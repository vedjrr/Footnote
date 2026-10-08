import { DataFacts } from '@/features/briefing/data-facts';
import { DEFAULT_SAMPLE } from '@/features/workspace/samples';

export default function Home() {
  return <DataFacts workspaceId={DEFAULT_SAMPLE} />;
}
