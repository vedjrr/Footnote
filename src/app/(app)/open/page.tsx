import type { Metadata } from 'next';
import { OpenFile } from '@/features/open-file/open-file';

export const metadata: Metadata = { title: 'Use your own file' };

export default function OpenFilePage() {
  return (
    <div className="px-4 pt-12 pb-24 md:px-8 wide:max-w-[calc(680px+clamp(24px,8vw,128px))] wide:pl-[clamp(24px,8vw,128px)]">
      <OpenFile />
    </div>
  );
}
