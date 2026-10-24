'use client';

import { MapPin, Search, Sun, X } from 'lucide-react';
import Image from 'next/image';
import { useId, useRef, useState } from 'react';

import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import { previewDestinations, previewHotels } from '@/features/hotel-search/data/preview-hotels';

import styles from './preview-search-form.module.css';

type Suggestion = {
  id: string;
  name: string;
  subtitle: string;
  image?: string;
  temperature?: number;
  kind: 'destination' | 'hotel';
};

const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

export function PreviewDestinationPicker({
  value,
  onChange,
  onHotelSelect,
}: {
  value: string;
  onChange: (destination: string) => void;
  onHotelSelect: (hotelId: string) => void;
}) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const selected = previewDestinations.find((item) => item.id === value);
  const term = normalize(query);
  const suggestions: Suggestion[] = [
    ...(!term
      ? [
          {
            id: '',
            name: 'Any destination',
            subtitle: 'Find your next favourite place',
            kind: 'destination' as const,
          },
        ]
      : []),
    ...previewDestinations
      .filter((item) => !term || normalize(`${item.name} ${item.subtitle}`).includes(term))
      .map((item) => ({ ...item, kind: 'destination' as const })),
    ...(term
      ? previewHotels
          .filter((hotel) => normalize(`${hotel.name} ${hotel.location}`).includes(term))
          .slice(0, 4)
          .map((hotel) => ({
            id: hotel.id,
            name: hotel.name,
            subtitle: hotel.location,
            image: hotel.image,
            kind: 'hotel' as const,
          }))
      : []),
  ];
  const activeIndex = Math.min(active, Math.max(0, suggestions.length - 1));

  function choose(suggestion: Suggestion) {
    inputRef.current?.focus();
    setOpen(false);
    setQuery('');
    if (suggestion.kind === 'hotel') onHotelSelect(suggestion.id);
    else onChange(suggestion.id);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div className={styles.destinationField}>
          <label htmlFor={id}>Destination or hotel name</label>
          <div className={styles.inputRow}>
            <MapPin size={20} aria-hidden="true" />
            <input
              ref={inputRef}
              id={id}
              name="destination"
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={open}
              aria-controls={`${id}-list`}
              aria-activedescendant={
                open && suggestions.length ? `${id}-option-${activeIndex}` : undefined
              }
              autoComplete="off"
              placeholder="Where to?"
              value={open ? query : (selected?.name ?? '')}
              onFocus={() => {
                setOpen(true);
                setQuery('');
                setActive(0);
              }}
              onClick={() => {
                if (!open) {
                  setOpen(true);
                  setQuery('');
                  setActive(0);
                }
              }}
              onChange={(event) => {
                setQuery(event.target.value);
                setActive(0);
                setOpen(true);
              }}
              onKeyDown={(event) => {
                if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                  event.preventDefault();
                  setOpen(true);
                  const direction = event.key === 'ArrowDown' ? 1 : -1;
                  const next =
                    (activeIndex + direction + suggestions.length) %
                    Math.max(1, suggestions.length);
                  setActive(next);
                  document
                    .getElementById(`${id}-option-${next}`)
                    ?.scrollIntoView({ block: 'nearest' });
                } else if (event.key === 'Enter' && open) {
                  event.preventDefault();
                  const suggestion = suggestions[activeIndex];
                  if (suggestion) choose(suggestion);
                } else if (event.key === 'Escape') {
                  event.preventDefault();
                  setOpen(false);
                } else if (event.key === 'Tab') setOpen(false);
              }}
            />
            {value || query ? (
              <button
                type="button"
                className={styles.clearDestination}
                aria-label="Clear destination"
                onClick={() => {
                  onChange('');
                  setQuery('');
                  inputRef.current?.focus();
                }}
              >
                <X size={16} aria-hidden="true" />
              </button>
            ) : null}
          </div>
        </div>
      </PopoverAnchor>
      <PopoverContent
        align="start"
        sideOffset={8}
        className={`${styles.popover} ${styles.destinationPopover}`}
        onOpenAutoFocus={(event) => event.preventDefault()}
        onCloseAutoFocus={(event) => event.preventDefault()}
        onInteractOutside={(event) => {
          if (
            event.target instanceof Node &&
            inputRef.current?.parentElement?.parentElement?.contains(event.target)
          )
            event.preventDefault();
        }}
        lang="en"
        dir="ltr"
      >
        <p className={styles.destinationHeading}>
          {term ? 'Suggested places & hotels' : 'Destinations'}
        </p>
        <div
          className={styles.suggestionList}
          id={`${id}-list`}
          role="listbox"
          aria-label="Destination suggestions"
        >
          {suggestions.map((suggestion, index) => (
            <button
              type="button"
              key={`${suggestion.kind}-${suggestion.id}`}
              id={`${id}-option-${index}`}
              role="option"
              tabIndex={-1}
              aria-selected={activeIndex === index}
              className={styles.suggestion}
              onPointerMove={() => setActive(index)}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(suggestion)}
            >
              <span className={styles.suggestionImage}>
                {suggestion.image ? (
                  <Image src={suggestion.image} alt="" width={52} height={52} sizes="52px" />
                ) : (
                  <MapPin size={24} aria-hidden="true" />
                )}
              </span>
              <span className={styles.suggestionText}>
                <strong>{suggestion.name}</strong>
                <span>{suggestion.subtitle}</span>
                {suggestion.temperature !== undefined ? (
                  <small>
                    <Sun size={13} aria-hidden="true" /> {suggestion.temperature}° in Oct · sample
                  </small>
                ) : null}
              </span>
              {suggestion.kind === 'hotel' ? (
                <small className={styles.hotelTag}>Hotel</small>
              ) : null}
            </button>
          ))}
          {!suggestions.length ? (
            <p className={styles.noSuggestions}>
              <Search size={22} aria-hidden="true" />
              No matches. Try Amsterdam, Benidorm or Dubai.
            </p>
          ) : null}
        </div>
        <span className="sr-only" aria-live="polite">
          {suggestions.length} suggestions
        </span>
      </PopoverContent>
    </Popover>
  );
}
