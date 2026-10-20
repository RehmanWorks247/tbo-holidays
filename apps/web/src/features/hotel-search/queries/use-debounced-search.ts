import type { MockHotelSearchRequest } from '@hotel/contracts';
import { useEffect, useState } from 'react';

import { parseHotelSearch, serializeHotelSearch } from '../utils/search-params';

/** Coalesces slider/text edits; the URL and controls still update immediately. */
export function useDebouncedSearch(
  request: MockHotelSearchRequest | null,
  mode: 'live' | 'mock' = 'live',
) {
  const key = request ? serializeHotelSearch(request) : '';
  const [settled, setSettled] = useState(key);
  useEffect(() => {
    const timer = window.setTimeout(() => setSettled(key), 220);
    return () => window.clearTimeout(timer);
  }, [key]);
  return {
    request: settled ? parseHotelSearch(new URLSearchParams(settled), mode) : null,
    settling: key !== settled,
  };
}
