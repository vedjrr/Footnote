import Link from 'next/link';
import { buttonClass } from '@/ui/button';
import { OPEN_FILE_HREF } from '@/features/shell/routes';

/**
 * A file workspace this page does not hold, such as after a reload: files
 * stay in memory only until the page closes (T62 keeps them).
 */
export function FileNotOpen() {
  return (
    <div className="flex flex-col items-start gap-4">
      <h1 className="type-h2 text-ink">This file is not open</h1>
      <p className="type-prose text-ink-2">
        Your files stay open only while this page is open, so reloading or closing it closes them.
        Open the file again to carry on.
      </p>
      <Link href={OPEN_FILE_HREF} className={buttonClass('primary', 'no-underline')}>
        Use your own file
      </Link>
    </div>
  );
}
