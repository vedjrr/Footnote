import { notFound } from 'next/navigation';
import { EngineHarness } from './harness';

// A test page for the browser engine: Playwright drives it for the parity and
// offline tests. It does not exist in production builds.
export default function EngineHarnessPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <EngineHarness />;
}
