import type { PageMessages } from './page-english';
import { catalanPage } from './page-locales/western/ca';
import { danishPage } from './page-locales/western/da';
import { germanPage } from './page-locales/western/de';
import { spanishPage } from './page-locales/western/es';
import { finnishPage } from './page-locales/western/fi';
import { frenchPage } from './page-locales/western/fr';
import { icelandicPage } from './page-locales/western/is';
import { italianPage } from './page-locales/western/it';
import { norwegianPage } from './page-locales/western/nb';
import { dutchPage } from './page-locales/western/nl';
import { portuguesePage } from './page-locales/western/pt';
import {
  portugueseBrazilPage,
  spanishArgentinaPage,
  spanishMexicoPage,
} from './page-locales/western/regional';
import { swedishPage } from './page-locales/western/sv';

type WesternLocale =
  | 'de-DE'
  | 'nl-NL'
  | 'fr-FR'
  | 'es-ES'
  | 'es-AR'
  | 'es-MX'
  | 'ca-ES'
  | 'it-IT'
  | 'pt-PT'
  | 'pt-BR'
  | 'nb-NO'
  | 'fi-FI'
  | 'sv-SE'
  | 'da-DK'
  | 'is-IS';

export const westernPageMessages: Record<WesternLocale, PageMessages> = {
  'de-DE': germanPage,
  'nl-NL': dutchPage,
  'fr-FR': frenchPage,
  'es-ES': spanishPage,
  'es-AR': spanishArgentinaPage,
  'es-MX': spanishMexicoPage,
  'ca-ES': catalanPage,
  'it-IT': italianPage,
  'pt-PT': portuguesePage,
  'pt-BR': portugueseBrazilPage,
  'nb-NO': norwegianPage,
  'fi-FI': finnishPage,
  'sv-SE': swedishPage,
  'da-DK': danishPage,
  'is-IS': icelandicPage,
};
