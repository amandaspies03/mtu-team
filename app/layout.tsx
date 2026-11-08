import type { Metadata, Viewport } from 'next';
import './globals.css';
import { headers } from 'next/headers';

export const metadata: Metadata = {
  title: { default: '184th MTU Team Manager', template: '%s · 184th MTU' },
  description: 'Roster, practices, scores and match-day tools for the 184th Marksmanship Training Unit.',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: '184th MTU', statusBarStyle: 'default' },
  icons: { icon: '/icon.svg' },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#1f2b24' };

export default async function Layout({ children }: { children: React.ReactNode }) {
  // Reading headers renders per request, so Next.js can attach the CSP nonce from proxy.ts.
  await headers();
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
