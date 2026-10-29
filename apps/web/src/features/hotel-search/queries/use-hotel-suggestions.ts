import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { hotelsApi } from '@/services/api/hotels.api';

export function useHotelSuggestions(text: string, enabled: boolean) {
  const query = text.trim().slice(0, 80);
  const [debounced, setDebounced] = useState(query);
  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(query), 200);
    return () => clearTimeout(timeout);
  }, [query]);
  const result = useQuery({
    queryKey: ['hotel-suggestions', debounced],
    queryFn: ({ signal }) => hotelsApi.suggestions(debounced, signal),
    enabled: enabled && debounced.length >= 2 && query === debounced,
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
    retry: false,
  });
  // A previous spelling must never appear as selectable results for new text.
  return {
    ...result,
    data: query === debounced ? result.data : undefined,
    error: query === debounced ? result.error : null,
    loading: enabled && query.length >= 2 && (query !== debounced || result.isFetching),
  };
}
