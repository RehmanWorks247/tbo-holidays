'use client';

import type {
  HotelResultsFilters,
  HotelSearchMetadata,
  HotelSearchRequest,
} from '@hotel/contracts';
import {
  Building2,
  ChevronDown,
  CircleDollarSign,
  MapPin,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Star,
  ThumbsUp,
  Umbrella,
  Utensils,
  Waves,
} from 'lucide-react';
import type { ReactNode } from 'react';

import { usePageMessages } from '@/providers/use-page-messages';

import styles from './hotel-filters.module.css';

type Facets = HotelSearchMetadata['facets'];
type ListFilter = 'facilities' | 'mealTypes' | 'propertyTypes' | 'neighbourhoods';

function Section({
  title,
  children,
  icon,
  open = true,
  titleLang = 'en',
}: {
  title: string;
  children: ReactNode;
  icon?: ReactNode;
  open?: boolean;
  titleLang?: string;
}) {
  return (
    <details className={styles.section} open={open}>
      <summary lang={titleLang}>
        <span className={styles.sectionTitle}>
          {icon}
          {title}
        </span>
        <ChevronDown className={styles.chevron} size={18} aria-hidden="true" />
      </summary>
      <div className={styles.sectionBody}>{children}</div>
    </details>
  );
}

function FilterOption({
  id,
  checked,
  onChange,
  children,
  count,
  radio,
  name,
}: {
  id: string;
  checked: boolean;
  onChange: () => void;
  children: ReactNode;
  count?: number;
  radio?: boolean;
  name?: string;
}) {
  return (
    <label className={styles.option} htmlFor={id}>
      <input
        id={id}
        type={radio ? 'radio' : 'checkbox'}
        name={name}
        checked={checked}
        onChange={onChange}
      />
      <span className={styles.optionText}>{children}</span>
      {count !== undefined ? <span className={styles.count}>{count}</span> : null}
    </label>
  );
}

function optionsWithSelection(
  options: { value: string; count: number }[] = [],
  selected: string[] = [],
) {
  return [
    ...options,
    ...selected
      .filter((item) => !options.some((option) => option.value === item))
      .map((value) => ({ value, count: 0 })),
  ];
}

export function HotelFilters({
  value,
  onChange,
  facets,
  currency = 'USD',
  onReset,
  idPrefix = 'hotel-filters',
  sampleStay = false,
  allDestinations = false,
}: {
  value: HotelResultsFilters;
  onChange: (filters: HotelResultsFilters) => void;
  facets?: Facets;
  currency?: HotelSearchRequest['currency'];
  onReset?: () => void;
  idPrefix?: string;
  sampleStay?: boolean;
  allDestinations?: boolean;
}) {
  const {
    messages: { results: messages },
    locale,
    t,
  } = usePageMessages();
  const maximumBudget = Math.max(
    facets?.maxPrice ?? 500_000,
    value.maxPrice ?? 0,
    value.minPrice ?? 0,
    100,
  );
  const sliderMaximum = Math.ceil(maximumBudget / 100) * 100;
  const currencySymbol =
    new Intl.NumberFormat(locale, { style: 'currency', currency, currencyDisplay: 'narrowSymbol' })
      .formatToParts(0)
      .find((part) => part.type === 'currency')?.value ?? currency;
  const formatBudget = (amount: number) =>
    new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 0 }).format(
      amount / 100,
    );
  function toggleList(key: ListFilter, item: string) {
    const selected = value[key] ?? [];
    const next = selected.includes(item)
      ? selected.filter((entry) => entry !== item)
      : [...selected, item];
    onChange({ ...value, [key]: next.length ? next : undefined });
  }

  function toggleStar(rating: number) {
    const selected = value.starRatings ?? [];
    const next = selected.includes(rating)
      ? selected.filter((star) => star !== rating)
      : [...selected, rating];
    onChange({ ...value, starRatings: next.length ? next : undefined });
  }

  function changeBudget(key: 'minPrice' | 'maxPrice', input: string) {
    if (input === '') {
      onChange({ ...value, [key]: undefined });
      return;
    }
    const parsed = Math.round(Number(input) * 100);
    if (!Number.isSafeInteger(parsed) || parsed < 0 || parsed > 2_000_000_000) return;
    const next = { ...value, [key]: parsed };
    if (key === 'minPrice' && next.maxPrice !== undefined && parsed > next.maxPrice)
      next.maxPrice = parsed;
    if (key === 'maxPrice' && next.minPrice !== undefined && parsed < next.minPrice)
      next.minPrice = parsed;
    onChange(next);
  }

  function listOptions(key: ListFilter) {
    return optionsWithSelection(facets?.[key], value[key]).map((option, index) => (
      <FilterOption
        key={option.value}
        id={`${idPrefix}-${key}-${index}`}
        checked={value[key]?.includes(option.value) ?? false}
        onChange={() => toggleList(key, option.value)}
        count={option.count}
      >
        <span lang="und" dir="auto">
          {option.value}
        </span>
      </FilterOption>
    ));
  }

  return (
    <aside aria-label={messages.filterHotels} className={styles.filters}>
      <div className={styles.heading} lang="en">
        <h2>
          <SlidersHorizontal size={16} aria-hidden="true" />
          Filter your results
        </h2>
        <button type="button" onClick={onReset ?? (() => onChange({}))}>
          Reset all
        </button>
      </div>
      <div lang="en">
        <Section title="Popular filters" icon={<Sparkles size={19} aria-hidden="true" />}>
          <div className={styles.popularFilters}>
            {[4, 5].map((rating) => (
              <button
                key={rating}
                type="button"
                aria-pressed={value.starRatings?.includes(rating) ?? false}
                onClick={() => toggleStar(rating)}
              >
                {rating}-star hotel
              </button>
            ))}
            <button
              type="button"
              aria-pressed={value.minReviewScore === 8}
              onClick={() =>
                onChange({ ...value, minReviewScore: value.minReviewScore === 8 ? undefined : 8 })
              }
            >
              8+ guest rating
            </button>
            <button
              type="button"
              aria-pressed={value.mealTypes?.includes('All inclusive') ?? false}
              onClick={() => toggleList('mealTypes', 'All inclusive')}
            >
              All inclusive
            </button>
            <button
              type="button"
              aria-pressed={value.facilities?.includes('Beachfront') ?? false}
              onClick={() => toggleList('facilities', 'Beachfront')}
            >
              Beach
            </button>
          </div>
        </Section>
        <Section title="Your budget" icon={<CircleDollarSign size={19} aria-hidden="true" />}>
          <p className={styles.hint}>
            {sampleStay ? 'Sample stay total' : 'Total price for your whole stay'} ({currency})
          </p>
          <div className={styles.budgetInputs}>
            <label htmlFor={`${idPrefix}-min-price`}>
              Min price
              <div>
                <span>{currencySymbol}</span>
                <input
                  id={`${idPrefix}-min-price`}
                  type="number"
                  inputMode="decimal"
                  min="0"
                  max="20000000"
                  step="1"
                  value={value.minPrice === undefined ? '' : value.minPrice / 100}
                  placeholder="0"
                  onChange={(event) => changeBudget('minPrice', event.target.value)}
                />
              </div>
            </label>
            <span className={styles.budgetSeparator}>–</span>
            <label htmlFor={`${idPrefix}-max-price`}>
              Max price
              <div>
                <span>{currencySymbol}</span>
                <input
                  id={`${idPrefix}-max-price`}
                  type="number"
                  inputMode="decimal"
                  min="0"
                  max="20000000"
                  step="1"
                  value={value.maxPrice === undefined ? '' : value.maxPrice / 100}
                  placeholder={String(Math.ceil((facets?.maxPrice ?? 500_000) / 100))}
                  onChange={(event) => changeBudget('maxPrice', event.target.value)}
                />
              </div>
            </label>
          </div>
          <input
            className={styles.budgetRange}
            type="range"
            min="0"
            max={sliderMaximum}
            step="100"
            value={value.maxPrice ?? sliderMaximum}
            aria-label={`Maximum total stay price in ${currency}`}
            aria-valuetext={formatBudget(value.maxPrice ?? sliderMaximum)}
            onChange={(event) => changeBudget('maxPrice', String(Number(event.target.value) / 100))}
          />
          <div className={styles.rangeLabels}>
            <span>{formatBudget(0)}</span>
            <span>{formatBudget(sliderMaximum)}</span>
          </div>
        </Section>
        <Section title="Board basis" icon={<Utensils size={19} aria-hidden="true" />}>
          {listOptions('mealTypes')}
        </Section>
        <Section
          title={messages.starRating}
          titleLang={locale}
          icon={<Star size={19} aria-hidden="true" />}
        >
          {[5, 4, 3, 2, 1].map((rating) => (
            <FilterOption
              key={rating}
              id={`${idPrefix}-stars-${rating}`}
              checked={value.starRatings?.includes(rating) ?? false}
              count={facets?.starRatings.find((item) => item.value === rating)?.count ?? 0}
              onChange={() => toggleStar(rating)}
            >
              <span className={styles.starOption} aria-label={t(messages.stars, { count: rating })}>
                <span>{rating}</span>
                <span className={styles.stars} aria-hidden="true">
                  {Array.from({ length: rating }, (_, index) => (
                    <Star key={index} size={14} fill="currentColor" />
                  ))}
                </span>
              </span>
            </FilterOption>
          ))}
        </Section>
        <Section title="Guest rating" icon={<ThumbsUp size={19} aria-hidden="true" />}>
          <FilterOption
            id={`${idPrefix}-reviews-any`}
            radio
            name={`${idPrefix}-review`}
            checked={value.minReviewScore === undefined}
            onChange={() => onChange({ ...value, minReviewScore: undefined })}
          >
            Any guest rating
          </FilterOption>
          {[
            { score: 9, label: 'Exceptional' },
            { score: 8, label: 'Excellent' },
            { score: 7, label: 'Very good' },
          ].map(({ score, label }) => (
            <FilterOption
              key={score}
              id={`${idPrefix}-reviews-${score}`}
              radio
              name={`${idPrefix}-review`}
              checked={value.minReviewScore === score}
              onChange={() => onChange({ ...value, minReviewScore: score })}
              count={facets?.reviewScores.find((item) => item.value === score)?.count ?? 0}
            >
              <span className={styles.reviewOption}>
                <strong>{score}+</strong>
                {label}
              </span>
            </FilterOption>
          ))}
        </Section>
        <Section title="Hotel facilities" icon={<Waves size={19} aria-hidden="true" />}>
          {listOptions('facilities')}
        </Section>
        <Section title="Property type" icon={<Building2 size={19} aria-hidden="true" />}>
          {listOptions('propertyTypes')}
        </Section>
        <Section title="Cancellation options" icon={<ShieldCheck size={19} aria-hidden="true" />}>
          <FilterOption
            id={`${idPrefix}-refundable`}
            checked={value.refundable === true}
            onChange={() =>
              onChange({ ...value, refundable: value.refundable === true ? undefined : true })
            }
            count={facets?.refundableCount}
          >
            <span lang={locale}>{messages.refundableOnly}</span>
          </FilterOption>
        </Section>
        <Section
          title={messages.hotelName}
          titleLang={locale}
          icon={<Search size={19} aria-hidden="true" />}
        >
          <div className={styles.searchInput}>
            <Search size={17} aria-hidden="true" />
            <input
              id={`${idPrefix}-name`}
              aria-label={messages.hotelName}
              type="search"
              maxLength={100}
              placeholder="Search by hotel name"
              lang="en"
              value={value.name ?? ''}
              onChange={(event) => onChange({ ...value, name: event.target.value || undefined })}
            />
          </div>
        </Section>
        <Section title="Neighbourhood" open={false} icon={<MapPin size={19} aria-hidden="true" />}>
          {listOptions('neighbourhoods')}
        </Section>
        <Section
          title="Distance to the beach"
          open={false}
          icon={<Umbrella size={19} aria-hidden="true" />}
        >
          <FilterOption
            id={`${idPrefix}-beach-any`}
            radio
            name={`${idPrefix}-beach`}
            checked={value.maxBeachDistance === undefined}
            onChange={() => onChange({ ...value, maxBeachDistance: undefined })}
          >
            Any distance
          </FilterOption>
          {[
            { metres: 100, label: 'Within 100 m' },
            { metres: 500, label: 'Within 500 m' },
            { metres: 1000, label: 'Within 1 km' },
            { metres: 5000, label: 'Within 5 km' },
          ].map(({ metres, label }) => (
            <FilterOption
              key={metres}
              id={`${idPrefix}-beach-${metres}`}
              radio
              name={`${idPrefix}-beach`}
              checked={value.maxBeachDistance === metres}
              onChange={() => onChange({ ...value, maxBeachDistance: metres })}
            >
              {label}
            </FilterOption>
          ))}
        </Section>
        <p className={styles.countHint}>
          Counts show hotels {allDestinations ? 'across all destinations' : 'in this destination'}{' '}
          before filters.
        </p>
      </div>
    </aside>
  );
}
