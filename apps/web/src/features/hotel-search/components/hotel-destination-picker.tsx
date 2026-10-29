'use client';

import type { HotelSearchSuggestion } from '@hotel/contracts';
import { Building2, Globe2, MapPin } from 'lucide-react';
import { type Ref, useId, useState } from 'react';

import { useHotelSuggestions } from '@/features/hotel-search/queries/use-hotel-suggestions';

import styles from './hotel-destination-picker.module.css';

type Selection = { destination: string; hotelId?: string };

export function HotelDestinationPicker({
  id,
  value,
  initialLabel,
  onChange,
  onBlur,
  invalid,
  errorId,
  inputRef,
}: {
  id: string;
  value: Selection;
  initialLabel?: string;
  onChange: (selection: Selection) => void;
  onBlur: () => void;
  invalid?: boolean;
  errorId?: string;
  inputRef?: Ref<HTMLInputElement>;
}) {
  const listId = useId();
  const [draft, setDraft] = useState<string | null>(null);
  const [selected, setSelected] = useState<HotelSearchSuggestion | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const selectionId = value.hotelId ?? value.destination;
  const query = draft ?? selectionId;
  const suggestions = useHotelSuggestions(query, open || Boolean(selectionId));
  const options = suggestions.data?.suggestions ?? [];
  const resolved =
    (selected?.id === selectionId ? selected : undefined) ??
    options.find(
      (item) =>
        item.id === selectionId && (value.hotelId ? item.type === 'hotel' : item.type !== 'hotel'),
    );
  const label = resolved
    ? `${resolved.name}${resolved.type === 'hotel' ? `, ${resolved.destinationName}` : ''}`
    : value.hotelId
      ? 'Selected hotel'
      : (initialLabel ?? (/^\d+$/.test(selectionId) ? 'Selected destination' : selectionId));
  const showOptions = open && draft !== null && draft.trim().length >= 2;
  const activeOption = showOptions ? options[active] : undefined;

  function select(option: HotelSearchSuggestion) {
    setSelected(option);
    setDraft(null);
    setOpen(false);
    setActive(-1);
    onChange({
      destination: option.destinationId,
      hotelId: option.type === 'hotel' ? option.id : undefined,
    });
  }

  return (
    <div
      className={styles.picker}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setOpen(false);
          onBlur();
        }
      }}
    >
      <input
        ref={inputRef}
        id={id}
        role="combobox"
        aria-autocomplete="list"
        aria-controls={listId}
        aria-expanded={open}
        aria-activedescendant={activeOption ? `${listId}-${active}` : undefined}
        aria-invalid={invalid}
        aria-describedby={invalid ? errorId : undefined}
        autoComplete="off"
        placeholder="Country, city or hotel name"
        maxLength={80}
        value={draft ?? label}
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          setDraft(event.target.value);
          setSelected(null);
          setActive(-1);
          setOpen(true);
          onChange({ destination: event.target.value.trim(), hotelId: undefined });
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            setOpen(false);
            setActive(-1);
          } else if (
            (event.key === 'ArrowDown' || event.key === 'ArrowUp') &&
            draft !== null &&
            draft.trim().length >= 2 &&
            options.length
          ) {
            event.preventDefault();
            setOpen(true);
            const next =
              event.key === 'ArrowDown'
                ? (active + 1) % options.length
                : (active <= 0 ? options.length : active) - 1;
            setActive(next);
            document.getElementById(`${listId}-${next}`)?.scrollIntoView({ block: 'nearest' });
          } else if (event.key === 'Enter' && open && activeOption) {
            event.preventDefault();
            select(activeOption);
          } else if (event.key === 'Enter') {
            setOpen(false);
          }
        }}
      />
      {open ? (
        <div className={styles.dropdown} lang="en">
          <ul id={listId} role="listbox" aria-label="Country, city and hotel suggestions">
            {showOptions
              ? options.map((option, index) => {
                  const Icon =
                    option.type === 'hotel'
                      ? Building2
                      : option.type === 'country'
                        ? Globe2
                        : MapPin;
                  return (
                    <li key={`${option.type}-${option.id}`} role="presentation">
                      <button
                        id={`${listId}-${index}`}
                        type="button"
                        role="option"
                        aria-selected={active === index}
                        tabIndex={-1}
                        onPointerDown={(event) => event.preventDefault()}
                        onClick={() => select(option)}
                        onPointerMove={() => setActive(index)}
                      >
                        <Icon size={19} aria-hidden="true" />
                        <span>
                          <strong>{option.name}</strong>
                          <small>
                            {option.type === 'country'
                              ? 'Hotels across all cities'
                              : `${option.type === 'hotel' ? option.destinationName : 'City'} · ${option.countryName ?? option.countryCode}`}
                          </small>
                        </span>
                      </button>
                    </li>
                  );
                })
              : null}
          </ul>
          {showOptions && options.length ? (
            <span className="sr-only" role="status">
              {options.length} suggestions available. Use the up and down arrows to choose.
            </span>
          ) : null}
          {suggestions.loading ? <p role="status">Finding suggestions…</p> : null}
          {showOptions && suggestions.error ? (
            <p role="alert">
              Suggestions are unavailable.{' '}
              <button type="button" onClick={() => void suggestions.refetch()}>
                Try again
              </button>
            </p>
          ) : null}
          {showOptions && !suggestions.loading && !suggestions.error && options.length === 0 ? (
            <p role="status">No suggestions. Try another country, city or hotel name.</p>
          ) : null}
          {!showOptions ? (
            <p>Type at least 2 characters to find a country, city or hotel.</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
