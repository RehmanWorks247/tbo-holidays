'use client';

import { MapPin, Plane, Search, X } from 'lucide-react';
import { useId, useRef, useState } from 'react';

import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import { previewAirports } from '@/features/hotel-search/data/preview-flights';

import styles from './preview-search-form.module.css';

type Airport = (typeof previewAirports)[number];

export function PreviewAirportPicker({ value, onChange }: { value: string; onChange: (airport: string) => void }) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const selected = previewAirports.find((airport) => airport.id === value);
  const term = query.toLowerCase().trim();
  const suggestions = previewAirports.filter((airport) => `${airport.name} ${airport.code} ${airport.group}`.toLowerCase().includes(term));
  const activeIndex = Math.min(active, Math.max(0, suggestions.length - 1));

  function choose(airport: Airport) {
    inputRef.current?.focus();
    setOpen(false);
    setQuery('');
    onChange(airport.id);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div className={styles.airportField}>
          <label htmlFor={id}>Departure airport</label>
          <div className={styles.inputRow}>
            <Plane size={19} aria-hidden="true" />
            <input
              ref={inputRef}
              id={id}
              name="departureAirport"
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={open}
              aria-controls={`${id}-list`}
              aria-activedescendant={open && suggestions.length ? `${id}-option-${activeIndex}` : undefined}
              autoComplete="off"
              placeholder="Any departure airport"
              value={open ? query : value === 'any' ? '' : selected?.name ?? ''}
              onFocus={() => { setOpen(true); setQuery(''); setActive(0); }}
              onChange={(event) => { setQuery(event.target.value); setActive(0); setOpen(true); }}
              onKeyDown={(event) => {
                if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                  event.preventDefault();
                  setOpen(true);
                  const direction = event.key === 'ArrowDown' ? 1 : -1;
                  const next = (activeIndex + direction + suggestions.length) % Math.max(1, suggestions.length);
                  setActive(next);
                  document.getElementById(`${id}-option-${next}`)?.scrollIntoView({ block: 'nearest' });
                } else if (event.key === 'Enter' && open) {
                  event.preventDefault();
                  const airport = suggestions[activeIndex];
                  if (airport) choose(airport);
                } else if (event.key === 'Escape') {
                  event.preventDefault();
                  setOpen(false);
                } else if (event.key === 'Tab') setOpen(false);
              }}
            />
            {value !== 'any' || query ? <button type="button" className={styles.clearDestination} aria-label="Clear departure airport" onClick={() => { onChange('any'); setQuery(''); inputRef.current?.focus(); }}><X size={16} aria-hidden="true" /></button> : null}
          </div>
        </div>
      </PopoverAnchor>
      <PopoverContent
        align="start"
        sideOffset={8}
        className={`${styles.popover} ${styles.airportPopover}`}
        onOpenAutoFocus={(event) => event.preventDefault()}
        onCloseAutoFocus={(event) => event.preventDefault()}
        onInteractOutside={(event) => { if (event.target instanceof Node && inputRef.current?.parentElement?.parentElement?.contains(event.target)) event.preventDefault(); }}
        lang="en"
        dir="ltr"
      >
        <p className={styles.destinationHeading}>Airports &amp; Regions</p>
        <div className={styles.suggestionList} role="listbox" id={`${id}-list`} aria-label="Departure airports and regions">
          {suggestions.map((airport, index) => (
            <div key={airport.id} role="presentation">
              {suggestions[index - 1]?.group !== airport.group ? <p className={styles.airportGroup} role="presentation">{airport.group}</p> : null}
              <button type="button" id={`${id}-option-${index}`} role="option" tabIndex={-1} aria-selected={activeIndex === index} className={styles.airportOption} onPointerMove={() => setActive(index)} onMouseDown={(event) => event.preventDefault()} onClick={() => choose(airport)}>
                {airport.id === 'any' || airport.name.startsWith('Any ') ? <MapPin size={18} aria-hidden="true" /> : <Plane size={18} aria-hidden="true" />}
                <span>{airport.name}</span>
                {airport.code && !airport.name.startsWith('Any ') ? <small>{airport.code}</small> : null}
              </button>
            </div>
          ))}
          {!suggestions.length ? <p className={styles.noSuggestions}><Search size={20} aria-hidden="true" />No airports found. Try London or Manchester.</p> : null}
        </div>
        <span className="sr-only" aria-live="polite">{suggestions.length} airports and regions</span>
      </PopoverContent>
    </Popover>
  );
}
