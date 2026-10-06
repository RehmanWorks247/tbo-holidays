import '@/styles/globals.css';

import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { SiteHeader } from '@/components/shared/site-header';
import { getServerEnvironment } from '@/config/server-env';
import { AppProviders } from '@/providers/app-providers';

export const metadata: Metadata = {
  title: { default: 'Stayline · Hotel booking', template: '%s · Stayline' },
  description: 'Search hotels, compare room options, and manage your stays.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const { authEnabled } = getServerEnvironment();
  return (
    <html lang="en">
      <body>
        <AppProviders authEnabled={authEnabled}>
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-white focus:p-3"
          >
            Skip to content
          </a>
          <SiteHeader />
          <main id="main-content" className="mx-auto min-h-[75vh] max-w-6xl px-5 py-10">
            {children}
          </main>
          <footer className="border-t px-5 py-6 text-center text-sm text-muted-foreground">
            Stayline · Your next stay, considered.
          </footer>
        </AppProviders>
      </body>
    </html>
  );
}
