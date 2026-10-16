'use client';

import { Check } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { parseHotelSearch } from '@/features/hotel-search/utils/search-params';
import { siteLocales, suggestedLocales } from '@/lib/site-locales';
import { type Currency, replaceCurrencyInUrl } from '@/lib/site-preferences';
import { useSitePreferences } from '@/providers/site-preferences-provider';
import { usePageMessages } from '@/providers/use-page-messages';
import { useSiteMessages } from '@/providers/use-site-messages';

import { LanguageFlag } from './language-flag';
import styles from './regional-selectors.module.css';

const currencies: { code: Currency }[] = [
  { code: 'EUR' },
  { code: 'USD' },
  { code: 'GBP' },
  { code: 'AED' },
  { code: 'PKR' },
  { code: 'INR' },
];

const languages = siteLocales;

function RegionalSelectorControls({
  activeCurrency,
  onCurrencyChange,
}: {
  activeCurrency?: Currency;
  onCurrencyChange?: (currency: Currency) => void;
}) {
  const { currency, setCurrency, setLocale, storageError } = useSitePreferences();
  const { locale, dir, messages } = useSiteMessages();
  const {
    messages: { app },
  } = usePageMessages();
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const [languageOpen, setLanguageOpen] = useState(false);
  const selectedCurrency = activeCurrency ?? currency;
  const selectedLanguage = languages.find((language) => language.code === locale) ?? languages[0]!;
  const copy = messages.selectors;

  function currencyOptions(options: typeof currencies) {
    return (
      <ul className={styles.options}>
        {options.map((option) => (
          <li key={option.code}>
            <button
              type="button"
              className={styles.option}
              aria-pressed={selectedCurrency === option.code}
              onClick={() => {
                setCurrency(option.code);
                onCurrencyChange?.(option.code);
                setCurrencyOpen(false);
              }}
            >
              <span className={styles.optionCopy}>
                {copy.currencyNames[option.code]}
                <span className={styles.code} dir="ltr">
                  {option.code}
                </span>
              </span>
              {selectedCurrency === option.code ? (
                <Check className={styles.check} size={20} aria-hidden="true" />
              ) : null}
            </button>
          </li>
        ))}
      </ul>
    );
  }

  function languageOptions(options: readonly (typeof languages)[number][]) {
    return (
      <ul className={styles.options}>
        {options.map((option) => (
          <li key={option.code}>
            <button
              type="button"
              className={styles.option}
              aria-pressed={locale === option.code}
              onClick={() => {
                setLocale(option.code);
                setLanguageOpen(false);
              }}
            >
              <LanguageFlag locale={option.code} className={styles.flag} />
              <span className={styles.optionCopy}>
                <bdi lang={option.code}>{option.name}</bdi>
              </span>
              {locale === option.code ? (
                <Check className={styles.check} size={20} aria-hidden="true" />
              ) : null}
            </button>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className={styles.controls} lang={locale} dir={dir}>
      <Dialog open={currencyOpen} onOpenChange={setCurrencyOpen}>
        <DialogTrigger asChild>
          <button
            type="button"
            className={styles.trigger}
            aria-label={copy.currencyLabel(selectedCurrency)}
            title={copy.chooseCurrency}
          >
            <span dir="ltr">{selectedCurrency}</span>
          </button>
        </DialogTrigger>
        <DialogContent className={styles.dialog} lang={locale} dir={dir} closeLabel={copy.close}>
          <div className={styles.heading}>
            <DialogTitle className={styles.title}>{copy.chooseCurrency}</DialogTitle>
          </div>
          <DialogDescription className={styles.description}>
            {copy.currencyDescription}
          </DialogDescription>
          <section className={styles.section} aria-labelledby="suggested-currencies">
            <h3 id="suggested-currencies">{copy.suggested}</h3>
            {currencyOptions(
              currencies.filter(({ code }) => ['USD', 'GBP', 'EUR', 'PKR'].includes(code)),
            )}
          </section>
          <section className={styles.section} aria-labelledby="all-currencies">
            <h3 id="all-currencies">{copy.allCurrencies}</h3>
            {currencyOptions(currencies)}
          </section>
          {storageError ? (
            <p role="status" className={styles.storageError}>
              {copy.storageError}
            </p>
          ) : null}
        </DialogContent>
      </Dialog>
      <Dialog open={languageOpen} onOpenChange={setLanguageOpen}>
        <DialogTrigger asChild>
          <button
            type="button"
            className={styles.trigger}
            aria-label={copy.languageLabel(selectedLanguage.name)}
            title={copy.chooseLanguage}
          >
            <LanguageFlag locale={locale} className={styles.flag} />
          </button>
        </DialogTrigger>
        <DialogContent className={styles.dialog} lang={locale} dir={dir} closeLabel={copy.close}>
          <div className={styles.heading}>
            <DialogTitle className={styles.title}>{copy.chooseLanguage}</DialogTitle>
          </div>
          <DialogDescription className={styles.description}>
            {app.languageDescription}
          </DialogDescription>
          <section className={styles.section} aria-labelledby="suggested-languages">
            <h3 id="suggested-languages">{copy.suggested}</h3>
            {languageOptions(
              suggestedLocales.flatMap((code) =>
                languages.filter((language) => language.code === code),
              ),
            )}
          </section>
          <section className={styles.section} aria-labelledby="all-languages">
            <h3 id="all-languages">{copy.allLanguages}</h3>
            {languageOptions(languages)}
          </section>
          {storageError ? (
            <p role="status" className={styles.storageError}>
              {copy.storageError}
            </p>
          ) : null}
        </DialogContent>
      </Dialog>
      <span className="sr-only" role="status">
        {storageError ? copy.storageError : ''}
      </span>
    </div>
  );
}

function RouteRegionalSelectors() {
  const pathname = usePathname();
  const params = useSearchParams();
  const router = useRouter();
  const { currency } = useSitePreferences();
  const isHotelSearch = pathname === '/hotels' || pathname.startsWith('/hotels/');
  const activeSearch = isHotelSearch ? parseHotelSearch(params) : null;
  const activeCurrency = activeSearch?.currency ?? currency;

  return (
    <RegionalSelectorControls
      activeCurrency={activeCurrency}
      onCurrencyChange={(nextCurrency) => {
        if (activeSearch && nextCurrency !== activeCurrency) {
          router.replace(
            replaceCurrencyInUrl(
              `${pathname}?${params.toString()}${window.location.hash}`,
              nextCurrency,
            ),
            { scroll: false },
          );
        }
      }}
    />
  );
}

export function RegionalSelectors() {
  return (
    <Suspense fallback={<RegionalSelectorControls />}>
      <RouteRegionalSelectors />
    </Suspense>
  );
}
