import type { PageMessages } from './page-english';
import { arSA } from './page-locales/asian/ar-SA';
import { filPH } from './page-locales/asian/fil-PH';
import { heIL } from './page-locales/asian/he-IL';
import { hiIN } from './page-locales/asian/hi-IN';
import { idID } from './page-locales/asian/id-ID';
import { jaJP } from './page-locales/asian/ja-JP';
import { koKR } from './page-locales/asian/ko-KR';
import { msMY } from './page-locales/asian/ms-MY';
import { thTH } from './page-locales/asian/th-TH';
import { viVN } from './page-locales/asian/vi-VN';
import { zhCN } from './page-locales/asian/zh-CN';
import { zhTW } from './page-locales/asian/zh-TW';

type AsianPageLocale =
  | 'ar-SA'
  | 'fil-PH'
  | 'he-IL'
  | 'hi-IN'
  | 'id-ID'
  | 'ja-JP'
  | 'ko-KR'
  | 'ms-MY'
  | 'th-TH'
  | 'vi-VN'
  | 'zh-CN'
  | 'zh-TW';

export const asianPageMessages: Record<AsianPageLocale, PageMessages> = {
  'ar-SA': arSA,
  'fil-PH': filPH,
  'he-IL': heIL,
  'hi-IN': hiIN,
  'id-ID': idID,
  'ja-JP': jaJP,
  'ko-KR': koKR,
  'ms-MY': msMY,
  'th-TH': thTH,
  'vi-VN': viVN,
  'zh-CN': zhCN,
  'zh-TW': zhTW,
};
