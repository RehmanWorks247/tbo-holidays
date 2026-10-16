'use client';

import { interpolateMessage, pageMessages } from '@/lib/page-messages';

import { useSitePreferences } from './site-preferences-provider';

export function usePageMessages() {
  const { locale } = useSitePreferences();
  const dir = locale === 'ar-SA' || locale === 'he-IL' ? 'rtl' : 'ltr';
  return {
    locale,
    dir,
    messages: pageMessages[locale],
    t: (template: string, parameters?: Record<string, string | number>) =>
      interpolateMessage(template, parameters, locale),
  };
}
