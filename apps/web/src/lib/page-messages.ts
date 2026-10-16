import { pageEnglish, type PageMessages } from './page-english';
import { etEE } from './page-locales/et-EE';
import { ltLT } from './page-locales/lt-LT';
import { lvLV } from './page-locales/lv-LV';
import { slSI } from './page-locales/sl-SI';
import { asianPageMessages } from './page-messages-asian';
import { europePageMessages } from './page-messages-europe';
import { westernPageMessages } from './page-messages-western';
import type { SiteLocale } from './site-preferences';

export const pageMessages: Record<SiteLocale, PageMessages> = {
  'en-US': pageEnglish,
  'en-GB': pageEnglish,
  'et-EE': etEE,
  'lv-LV': lvLV,
  'lt-LT': ltLT,
  'sl-SI': slSI,
  ...westernPageMessages,
  ...europePageMessages,
  ...asianPageMessages,
};

export function interpolateMessage(
  template: string,
  parameters: Record<string, string | number> = {},
  locale: SiteLocale = 'en-US',
) {
  return template.replace(/\{(\w+)\}/g, (placeholder, name: string) => {
    const value = parameters[name];
    if (value === undefined) return placeholder;
    return typeof value === 'number' ? new Intl.NumberFormat(locale).format(value) : value;
  });
}
