import Image from 'next/image';

import { siteLocales } from '@/lib/site-locales';
import type { SiteLocale } from '@/lib/site-preferences';

export function LanguageFlag({ locale, className }: { locale: SiteLocale; className?: string }) {
  const language = siteLocales.find((option) => option.code === locale) ?? siteLocales[0];
  return (
    <Image
      src={`/images/flags/${language.flag}.svg`}
      alt=""
      aria-hidden="true"
      width={24}
      height={24}
      className={className}
      unoptimized
    />
  );
}
