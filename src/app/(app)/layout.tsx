import { TopBar } from '@/features/shell/top-bar';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <TopBar />
      <main>{children}</main>
    </>
  );
}
