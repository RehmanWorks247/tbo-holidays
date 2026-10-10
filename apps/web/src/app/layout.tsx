import '@/styles/globals.css';

import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { SiteFooter } from '@/components/shared/site-footer';
import { SiteHeader } from '@/components/shared/site-header';
import { ThemeProvider } from '@/components/shared/theme-provider';
import { getServerEnvironment } from '@/config/server-env';
import { HolidayInspirationProvider } from '@/features/hotel-search/components/holiday-inspiration-provider';
import { AppProviders } from '@/providers/app-providers';

export const metadata: Metadata = {
  title: {
    default: 'Best Holiday Packages · Find your next stay',
    template: '%s · Best Holiday Packages',
  },
  applicationName: 'Best Holiday Packages',
  description:
    'Discover your next destination and find a hotel for your journey with Best Holiday Packages.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const { authEnabled } = getServerEnvironment();
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <AppProviders authEnabled={authEnabled}>
            <HolidayInspirationProvider>
              <a
                href="#main-content"
                className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-card focus:p-3 focus:text-foreground"
              >
                Skip to content
              </a>
              <SiteHeader />
              <main id="main-content" className="site-main">
                {children}
              </main>
              <SiteFooter />
            </HolidayInspirationProvider>
          </AppProviders>
        </ThemeProvider>
      </body>
    </html>
  );
}
