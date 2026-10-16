'use client';

import { currencySchema } from '@hotel/contracts';
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
} from 'react';

import {
  type Currency,
  DEFAULT_SITE_PREFERENCES,
  parseStoredSitePreferences,
  SITE_LOCALE_COOKIE_NAME,
  SITE_PREFERENCES_STORAGE_KEY,
  type SiteLocale,
  siteLocaleSchema,
  type SitePreferences,
} from '@/lib/site-preferences';

type PreferencesSnapshot = SitePreferences & { storageError: string | null };
type PreferencesContextValue = PreferencesSnapshot & {
  setCurrency: (currency: Currency) => void;
  setLocale: (locale: SiteLocale) => void;
};

const SitePreferencesContext = createContext<PreferencesContextValue | null>(null);

function createPreferencesStore(initialLocale: SiteLocale) {
  const serverSnapshot: PreferencesSnapshot = {
    ...DEFAULT_SITE_PREFERENCES,
    locale: initialLocale,
    storageError: null,
  };
  let snapshot = serverSnapshot;
  let initialized = false;
  const listeners = new Set<() => void>();

  function publish(next: PreferencesSnapshot) {
    if (
      next.currency === snapshot.currency &&
      next.locale === snapshot.locale &&
      next.storageError === snapshot.storageError
    ) {
      return;
    }
    snapshot = next;
    listeners.forEach((listener) => listener());
  }

  function readStored(value: string | null) {
    const { preferences, storageError } = parseStoredSitePreferences(value);
    publish({ ...preferences, storageError });
  }

  function handleStorage(event: StorageEvent) {
    if (event.key !== SITE_PREFERENCES_STORAGE_KEY && event.key !== null) return;
    try {
      if (event.storageArea !== window.localStorage) return;
    } catch {
      publish({
        ...snapshot,
        storageError:
          'Your browser could not load your preferences. You can choose them for this visit.',
      });
      return;
    }
    readStored(event.newValue);
  }

  function save(preferences: SitePreferences) {
    let storageError: string | null = null;
    try {
      window.localStorage.setItem(SITE_PREFERENCES_STORAGE_KEY, JSON.stringify(preferences));
    } catch {
      storageError = 'Your browser could not save your preferences. They apply for this visit.';
    }
    publish({ ...preferences, storageError });
  }

  return {
    getSnapshot: () => snapshot,
    getServerSnapshot: () => serverSnapshot,
    reportStorageError() {
      publish({
        ...snapshot,
        storageError: 'Your browser could not save your preferences. They apply for this visit.',
      });
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      if (listeners.size === 1) window.addEventListener('storage', handleStorage);
      if (!initialized) {
        initialized = true;
        try {
          const saved = window.localStorage.getItem(SITE_PREFERENCES_STORAGE_KEY);
          if (saved !== null) readStored(saved);
        } catch {
          publish({
            ...snapshot,
            storageError:
              'Your browser could not load your preferences. You can choose them for this visit.',
          });
        }
      }
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) window.removeEventListener('storage', handleStorage);
      };
    },
    setCurrency(currency: Currency) {
      save({ currency: currencySchema.parse(currency), locale: snapshot.locale });
    },
    setLocale(locale: SiteLocale) {
      save({ currency: snapshot.currency, locale: siteLocaleSchema.parse(locale) });
    },
  };
}

export function SitePreferencesProvider({
  children,
  initialLocale = DEFAULT_SITE_PREFERENCES.locale,
}: {
  children: ReactNode;
  initialLocale?: SiteLocale;
}) {
  const [store] = useState(() => createPreferencesStore(initialLocale));
  const preferences = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot,
  );

  useEffect(() => {
    document.documentElement.lang = preferences.locale;
    document.documentElement.dir =
      preferences.locale === 'ar-SA' || preferences.locale === 'he-IL' ? 'rtl' : 'ltr';
    try {
      document.cookie = `${SITE_LOCALE_COOKIE_NAME}=${preferences.locale}; Path=/; Max-Age=31536000; SameSite=Lax${window.location.protocol === 'https:' ? '; Secure' : ''}`;
    } catch {
      store.reportStorageError();
    }
  }, [preferences.locale, store]);

  return (
    <SitePreferencesContext.Provider
      value={{ ...preferences, setCurrency: store.setCurrency, setLocale: store.setLocale }}
    >
      {children}
    </SitePreferencesContext.Provider>
  );
}

export function useSitePreferences() {
  const preferences = useContext(SitePreferencesContext);
  if (!preferences) throw new Error('Site preferences must be used inside their provider.');
  return preferences;
}
