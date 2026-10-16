import type { enUS } from '@clerk/localizations/en-US';

import type { SiteLocale } from '@/lib/site-preferences';

export type ClerkLocalization = typeof enUS;

// Clerk maintains a separate translation catalogue. Load only the requested
// provider language; never send page content or traveller information to it.
const clerkLocales: Partial<Record<SiteLocale, () => Promise<ClerkLocalization>>> = {
  'en-US': () => import('@clerk/localizations/en-US').then((m) => m.enUS),
  'en-GB': () => import('@clerk/localizations/en-GB').then((m) => m.enGB),
  'de-DE': () => import('@clerk/localizations/de-DE').then((m) => m.deDE),
  'nl-NL': () => import('@clerk/localizations/nl-NL').then((m) => m.nlNL),
  'fr-FR': () => import('@clerk/localizations/fr-FR').then((m) => m.frFR),
  'es-ES': () => import('@clerk/localizations/es-ES').then((m) => m.esES),
  'es-AR': () => import('@clerk/localizations/es-UY').then((m) => m.esUY),
  'es-MX': () => import('@clerk/localizations/es-MX').then((m) => m.esMX),
  'ca-ES': () => import('@clerk/localizations/ca-ES').then((m) => m.caES),
  'it-IT': () => import('@clerk/localizations/it-IT').then((m) => m.itIT),
  'pt-PT': () => import('@clerk/localizations/pt-PT').then((m) => m.ptPT),
  'pt-BR': () => import('@clerk/localizations/pt-BR').then((m) => m.ptBR),
  'nb-NO': () => import('@clerk/localizations/nb-NO').then((m) => m.nbNO),
  'fi-FI': () => import('@clerk/localizations/fi-FI').then((m) => m.fiFI),
  'sv-SE': () => import('@clerk/localizations/sv-SE').then((m) => m.svSE),
  'da-DK': () => import('@clerk/localizations/da-DK').then((m) => m.daDK),
  'cs-CZ': () => import('@clerk/localizations/cs-CZ').then((m) => m.csCZ),
  'hu-HU': () => import('@clerk/localizations/hu-HU').then((m) => m.huHU),
  'ro-RO': () => import('@clerk/localizations/ro-RO').then((m) => m.roRO),
  'ja-JP': () => import('@clerk/localizations/ja-JP').then((m) => m.jaJP),
  'zh-CN': () => import('@clerk/localizations/zh-CN').then((m) => m.zhCN),
  'zh-TW': () => import('@clerk/localizations/zh-TW').then((m) => m.zhTW),
  'pl-PL': () => import('@clerk/localizations/pl-PL').then((m) => m.plPL),
  'el-GR': () => import('@clerk/localizations/el-GR').then((m) => m.elGR),
  'ru-RU': () => import('@clerk/localizations/ru-RU').then((m) => m.ruRU),
  'tr-TR': () => import('@clerk/localizations/tr-TR').then((m) => m.trTR),
  'bg-BG': () => import('@clerk/localizations/bg-BG').then((m) => m.bgBG),
  'ar-SA': () => import('@clerk/localizations/ar-SA').then((m) => m.arSA),
  'ko-KR': () => import('@clerk/localizations/ko-KR').then((m) => m.koKR),
  'he-IL': () => import('@clerk/localizations/he-IL').then((m) => m.heIL),
  'uk-UA': () => import('@clerk/localizations/uk-UA').then((m) => m.ukUA),
  'hi-IN': () => import('@clerk/localizations/hi-IN').then((m) => m.hiIN),
  'id-ID': () => import('@clerk/localizations/id-ID').then((m) => m.idID),
  'ms-MY': () => import('@clerk/localizations/ms-MY').then((m) => m.msMY),
  'th-TH': () => import('@clerk/localizations/th-TH').then((m) => m.thTH),
  'hr-HR': () => import('@clerk/localizations/hr-HR').then((m) => m.hrHR),
  'sk-SK': () => import('@clerk/localizations/sk-SK').then((m) => m.skSK),
  'sr-Latn-RS': () => import('@clerk/localizations/sr-RS').then((m) => m.srRS),
  'vi-VN': () => import('@clerk/localizations/vi-VN').then((m) => m.viVN),
  'is-IS': () => import('@clerk/localizations/is-IS').then((m) => m.isIS),
};

export async function loadClerkLocale(locale: SiteLocale) {
  // This fallback applies only to the external authentication widget, never
  // to the site's own homepage, account, checkout or booking translations.
  return (clerkLocales[locale] ?? clerkLocales['en-US']!)();
}
