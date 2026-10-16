import '@/styles/globals.css';

import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { PageLanguage } from '@/components/shared/page-language';
import { SiteFooter } from '@/components/shared/site-footer';
import { SiteHeader } from '@/components/shared/site-header';
import { ThemeProvider } from '@/components/shared/theme-provider';
import { getServerEnvironment } from '@/config/server-env';
import { loadClerkLocale } from '@/features/authentication/clerk-locales';
import { HolidayInspirationProvider } from '@/features/hotel-search/components/holiday-inspiration-provider';
import { pageMessages } from '@/lib/page-messages';
import { getRequestLocale } from '@/lib/request-locale';
import { AppProviders } from '@/providers/app-providers';
import { SitePreferencesProvider } from '@/providers/site-preferences-provider';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const { app } = pageMessages[locale];
  return {
    title: { default: app.pageTitle, template: '%s · Best Holiday Packages' },
    applicationName: 'Best Holiday Packages',
    description: app.pageDescription,
  };
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const { authEnabled } = getServerEnvironment();
  const locale = await getRequestLocale();
  const initialLocalization = authEnabled ? await loadClerkLocale(locale) : undefined;
  return (
    <html
      lang={locale}
      dir={locale === 'ar-SA' || locale === 'he-IL' ? 'rtl' : 'ltr'}
      suppressHydrationWarning
    >
      <body>
        <ThemeProvider>
          <SitePreferencesProvider initialLocale={locale}>
            <AppProviders authEnabled={authEnabled} initialLocalization={initialLocalization}>
              <HolidayInspirationProvider>
                <PageLanguage />
                <SiteHeader />
                <main id="main-content" className="site-main">
                  {children}
                </main>
                <SiteFooter />
              </HolidayInspirationProvider>
            </AppProviders>
          </SitePreferencesProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
