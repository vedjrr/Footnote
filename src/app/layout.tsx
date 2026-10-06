import type { Metadata } from 'next';
import { product } from '@/config/product';
import './globals.css';

export const metadata: Metadata = {
  title: product.name,
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
