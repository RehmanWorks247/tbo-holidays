'use client';

import type { HotelResultsFilters, HotelSearchRequest, HotelSort } from '@hotel/contracts';
import {
  ArrowLeft,
  ArrowRight,
  BedDouble,
  ChevronDown,
  CircleX,
  Info,
  SearchX,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';

import { RequestError } from '@/components/shared/request-error';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useDebouncedSearch } from '@/features/hotel-search/queries/use-debounced-search';
import { useHotelDestinations } from '@/features/hotel-search/queries/use-hotel-destinations';
import { useHotelSearch } from '@/features/hotel-search/queries/use-hotel-search';
import { useSavedHotels } from '@/features/hotel-search/queries/use-saved-hotels';
import { activeFilterChips, removeFilterChip } from '@/features/hotel-search/utils/filter-chips';
import {
  defaultMockSearch,
  parseHotelSearch,
  searchStayOnly,
  serializeHotelSearch,
} from '@/features/hotel-search/utils/search-params';
import { useSitePreferences } from '@/providers/site-preferences-provider';
import { usePageMessages } from '@/providers/use-page-messages';

import { HotelCard } from './hotel-card';
import { HotelFilters } from './hotel-filters';
import styles from './hotel-results.module.css';
import { HotelSearchForm } from './hotel-search-form';

export function HotelResults() {
  const {
    messages: { results: copy },
    locale,
    dir,
  } = usePageMessages();
  const { currency } = useSitePreferences();
  const params = useSearchParams();
  const destinations = useHotelDestinations();
  const [defaultSearch] = useState(() => defaultMockSearch(currency));
  const fallback = useMemo(
    () =>
      params.size === 0 && destinations.data?.source === 'mock'
        ? { ...defaultSearch, currency }
        : null,
    [params.size, destinations.data?.source, defaultSearch, currency],
  );
  const request = useMemo(() => parseHotelSearch(params) ?? fallback, [params, fallback]);
  const requestRef = useRef(request);
  useEffect(() => {
    requestRef.current = request;
  }, [request]);
  const debounced = useDebouncedSearch(request);
  const search = useHotelSearch(debounced.request);
  const saved = useSavedHotels();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const resultsRef = useRef<HTMLDivElement>(null);
  const sameStay =
    request &&
    debounced.request &&
    JSON.stringify(searchStayOnly(request)) === JSON.stringify(searchStayOnly(debounced.request));
  const data = sameStay ? search.data : undefined;
  const currentError = !debounced.settling && sameStay ? search.error : null;
  const metadata = data?.metadata;
  const filters = request?.filters ?? {};
  const active = activeFilterChips(filters, request?.currency ?? currency, locale);
  const updating = debounced.settling || search.isFetching;
  const total = metadata?.total ?? data?.hotels.length ?? 0;
  const page = metadata?.page ?? request?.page ?? 1;
  const totalPages = metadata?.totalPages ?? 1;
  const destination =
    metadata?.destination ??
    destinations.data?.destinations.find((item) => item.id === request?.destination)?.name ??
    request?.destination;
  const formKey = request
    ? JSON.stringify({ ...searchStayOnly(request), currency: undefined })
    : 'new';

  useEffect(() => {
    if (fallback)
      window.history.replaceState(null, '', `/hotels?${serializeHotelSearch(fallback)}`);
  }, [fallback]);

  function update(next: HotelSearchRequest, replace = false) {
    requestRef.current = next;
    window.history[replace ? 'replaceState' : 'pushState'](
      null,
      '',
      `/hotels?${serializeHotelSearch(next)}`,
    );
  }
  function changeFilters(next: HotelResultsFilters) {
    const current = requestRef.current;
    if (!current) return;
    update(
      { ...current, filters: next, page: 1 },
      current.filters?.name !== next.name ||
        current.filters?.minPrice !== next.minPrice ||
        current.filters?.maxPrice !== next.maxPrice,
    );
  }
  function changePage(nextPage: number) {
    const current = requestRef.current;
    if (!current) return;
    update({ ...current, page: nextPage });
    resultsRef.current?.scrollIntoView({ behavior: 'instant', block: 'start' });
  }

  return (
    <div className={styles.page} dir={dir} data-hotel-results>
      <section className={styles.searchBand} aria-label="Your hotel search" lang="en">
        <div className={styles.searchTabs}>
          <Link href="/#holiday-inspiration">Holidays</Link>
          <span className={styles.activeTab}>Hotels</span>
          <Link href="/#destinations">
            Inspire me <span className={styles.newBadge}>Explore</span>
          </Link>
        </div>
        <p className={styles.mobileSearchLabel}>Refine your stay</p>
        <HotelSearchForm key={formKey} initialSearch={request} variant="results" />
      </section>

      {!request ? (
        <div className={styles.intro}>
          <BedDouble size={40} aria-hidden="true" />
          <h1 lang="en">Find your next favourite hotel</h1>
          <p>
            {params.size
              ? 'This search link is incomplete or invalid. Choose your destination and dates above.'
              : copy.chooseSearch}
          </p>
          {destinations.isPending ? <p role="status">Loading destinations…</p> : null}
          {destinations.error ? <RequestError error={destinations.error} /> : null}
        </div>
      ) : (
        <section className={styles.resultsArea}>
          <div className={styles.resultsHeader}>
            <div className={styles.resultsHeading} lang="en">
              <h1>Hotel Results</h1>
              <button className={styles.resetLink} onClick={() => changeFilters({})}>
                <CircleX size={15} aria-hidden="true" /> Reset filters
              </button>
            </div>
            <div className={styles.toolbar} lang="en">
              <p role="status" aria-live="polite">
                {data ? (
                  <>
                    <strong>{new Intl.NumberFormat(locale).format(total)} hotels</strong>{' '}
                    {updating ? '· Updating…' : 'found for your stay'}
                  </>
                ) : currentError ? (
                  'We couldn’t load your hotels. Please try again.'
                ) : (
                  'Finding your hotel…'
                )}
              </p>
              <div className={styles.toolbarActions}>
                <Dialog open={filtersOpen} onOpenChange={setFiltersOpen}>
                  <DialogTrigger asChild>
                    <button className={styles.mobileFilters}>
                      <SlidersHorizontal size={17} /> Filters{' '}
                      {active.length ? <b>{active.length}</b> : null}
                    </button>
                  </DialogTrigger>
                  <DialogContent className={styles.filterDialog} lang="en">
                    <DialogTitle>Refine your stay</DialogTitle>
                    <DialogDescription>
                      Choose your filters. Results update automatically.
                    </DialogDescription>
                    <HotelFilters
                      value={filters}
                      onChange={changeFilters}
                      facets={metadata?.facets}
                      currency={request.currency}
                      onReset={() => changeFilters({})}
                      idPrefix="mobile"
                    />
                    <button className={styles.applyFilters} onClick={() => setFiltersOpen(false)}>
                      Show {total} hotels
                    </button>
                  </DialogContent>
                </Dialog>
                <label className={styles.sort}>
                  <span>Sort by:</span>
                  <select
                    aria-label="Sort hotels"
                    value={request.sort ?? 'recommended'}
                    onChange={(event) =>
                      update({ ...request, sort: event.target.value as HotelSort, page: 1 })
                    }
                  >
                    <option value="recommended">Recommended</option>
                    <option value="price-asc">Price: low to high</option>
                    <option value="price-desc">Price: high to low</option>
                    <option value="rating">Guest rating</option>
                    <option value="stars">Star rating</option>
                  </select>
                  <ChevronDown size={14} />
                </label>
              </div>
            </div>
          </div>
          <div className={styles.resultsContext} lang="en">
            <p>
              {destination
                ? `Find your next stay in ${destination}`
                : 'Find your next favourite stay'}
            </p>
            {(metadata?.source ?? destinations.data?.source) === 'mock' ? (
              <p className={styles.demoNotice} role="note">
                <Info size={14} aria-hidden="true" /> Sample hotels, prices &amp; reviews · Preview
                only
              </p>
            ) : null}
          </div>
          <div className={styles.resultsLayout}>
            <div className={styles.desktopFilters}>
              <HotelFilters
                value={filters}
                onChange={changeFilters}
                facets={metadata?.facets}
                currency={request.currency}
                onReset={() => changeFilters({})}
                idPrefix="desktop"
              />
            </div>
            <div className={styles.resultsColumn} ref={resultsRef}>
              {active.length ? (
                <div className={styles.activeFilters} lang="en">
                  {active.map((chip) => (
                    <button
                      key={`${chip.key}-${chip.value ?? ''}`}
                      onClick={() => changeFilters(removeFilterChip(filters, chip))}
                      aria-label={`Remove ${chip.label}`}
                    >
                      {chip.label}
                      <X size={13} />
                    </button>
                  ))}
                  <button className={styles.clearAll} onClick={() => changeFilters({})}>
                    Clear all
                  </button>
                </div>
              ) : null}
              {saved.error ? (
                <p className={styles.storageMessage} role="status">
                  {saved.error}
                </p>
              ) : null}
              {currentError ? (
                <div className={styles.error}>
                  <RequestError error={currentError} />
                  <button onClick={() => void search.refetch()} lang="en">
                    Try again
                  </button>
                </div>
              ) : null}
              {!data && !currentError ? (
                <div
                  className={styles.skeletons}
                  role="status"
                  aria-label={copy.checkingAvailability}
                >
                  {[1, 2, 3].map((id) => (
                    <Skeleton key={id} className="h-72 rounded-xl" />
                  ))}
                </div>
              ) : null}
              {data ? (
                <div
                  className={styles.hotelList}
                  aria-busy={updating}
                  inert={updating}
                  data-updating={updating || undefined}
                >
                  {data.hotels.map((result, index) => (
                    <HotelCard
                      key={result.hotel.id}
                      result={result}
                      search={request}
                      priority={index === 0}
                      saved={saved.ids.includes(result.hotel.id)}
                      onToggleSave={() => saved.toggle(result.hotel.id)}
                    />
                  ))}
                  {!data.hotels.length ? (
                    <div className={styles.empty} lang="en">
                      <SearchX size={42} />
                      <h2>No stays match just yet</h2>
                      <p>
                        Try widening your budget or removing a filter to find more places to stay.
                      </p>
                      <button onClick={() => changeFilters({})}>Reset filters</button>
                    </div>
                  ) : null}
                </div>
              ) : null}
              {totalPages > 1 ? (
                <nav className={styles.pagination} aria-label="Hotel results pages" lang="en">
                  <button
                    disabled={page <= 1 || updating}
                    onClick={() => changePage(page - 1)}
                    aria-label="Previous page"
                  >
                    <ArrowLeft size={17} />
                  </button>
                  {[...new Set([1, page - 2, page - 1, page, page + 1, page + 2, totalPages])]
                    .filter((number) => number >= 1 && number <= totalPages)
                    .sort((a, b) => a - b)
                    .map((number, index, pages) => (
                      <span key={number}>
                        {index > 0 && number - pages[index - 1]! > 1 ? (
                          <span className={styles.ellipsis}>…</span>
                        ) : null}
                        <button
                          aria-label={`Page ${number}`}
                          aria-current={number === page ? 'page' : undefined}
                          disabled={updating}
                          onClick={() => changePage(number)}
                        >
                          {number}
                        </button>
                      </span>
                    ))}
                  <button
                    disabled={page >= totalPages || updating}
                    onClick={() => changePage(page + 1)}
                    aria-label="Next page"
                  >
                    <ArrowRight size={17} />
                  </button>
                </nav>
              ) : null}
              {data?.hotels.length ? (
                <p className={styles.priceNote} lang="en">
                  Prices shown are the total for your selected stay and all rooms, including
                  applicable taxes. Charges payable at the property are listed with the room
                  details.
                </p>
              ) : null}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
