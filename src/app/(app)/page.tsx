import { SampleFacts } from '@/features/briefing/sample-facts';
import { DEFAULT_SAMPLE } from '@/features/workspace/samples';

export default function Home() {
  return <SampleFacts sampleId={DEFAULT_SAMPLE} />;
}
