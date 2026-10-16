'use client';

import { siteMessages } from '@/lib/site-messages';
import { useSitePreferences } from '@/providers/site-preferences-provider';

export function useSiteMessages() {
  const { locale } = useSitePreferences();
  const dir = locale === 'he-IL' || locale === 'ar-SA' ? 'rtl' : 'ltr';
  return { locale, dir, messages: siteMessages[locale] } as const;
}
