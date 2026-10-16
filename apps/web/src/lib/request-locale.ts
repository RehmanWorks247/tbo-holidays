import 'server-only';

import { cookies } from 'next/headers';
import { cache } from 'react';

import {
  DEFAULT_SITE_PREFERENCES,
  SITE_LOCALE_COOKIE_NAME,
  siteLocaleSchema,
} from './site-preferences';

export const getRequestLocale = cache(async () => {
  const cookieStore = await cookies();
  const parsed = siteLocaleSchema.safeParse(cookieStore.get(SITE_LOCALE_COOKIE_NAME)?.value);
  return parsed.success ? parsed.data : DEFAULT_SITE_PREFERENCES.locale;
});
