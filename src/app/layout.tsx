import type { Metadata } from 'next';
import { IBM_Plex_Mono, IBM_Plex_Sans, IBM_Plex_Serif } from 'next/font/google';
import { product } from '@/config/product';
import { themeScript } from '@/ui/theme';
import { TooltipProvider } from '@/ui/tooltip';
import './globals.css';

const serif = IBM_Plex_Serif({
  weight: ['400', '500'],
  subsets: ['latin'],
  variable: '--font-plex-serif',
});
const sans = IBM_Plex_Sans({
  weight: ['400', '500', '600'],
  subsets: ['latin'],
  variable: '--font-plex-sans',
});
const mono = IBM_Plex_Mono({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-plex-mono',
});

export const metadata: Metadata = {
  title: product.name,
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="en"
      className={`${serif.variable} ${sans.variable} ${mono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  );
}
