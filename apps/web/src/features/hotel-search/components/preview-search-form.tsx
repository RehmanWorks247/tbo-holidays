'use client';

import { CalendarDays, ChevronDown, Moon, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { DayPicker } from 'react-day-picker';

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  DEFAULT_PREVIEW_STAY,
  previewHref,
  type PreviewStay,
} from '@/features/hotel-search/data/preview-hotels';

import { PreviewAirportPicker } from './preview-airport-picker';
import { PreviewDestinationPicker } from './preview-destination-picker';
import { PreviewGuestsPicker } from './preview-guests-picker';
import styles from './preview-search-form.module.css';

export function PreviewSearchForm({
  initialStay = DEFAULT_PREVIEW_STAY,
  compact = false,
  product,
}: {
  initialStay?: PreviewStay;
  compact?: boolean;
  product?: PreviewStay['product'];
}) {
  const router = useRouter();
  const [stay, setStay] = useState(initialStay);
  const [datesOpen, setDatesOpen] = useState(false);
  const effectiveStay = { ...stay, product: product ?? stay.product };
  const includesFlights = effectiveStay.product === 'hotel-flights';
  const selectedDate = new Date(`${stay.checkIn}T12:00:00`);

  return (
    <form
      className={`${styles.form} ${includesFlights ? styles.flightForm : ''} ${compact ? styles.compact : ''}`}
      lang="en"
      dir="ltr"
      aria-label={includesFlights ? 'Preview hotel and flights search' : 'Preview hotel search'}
      onSubmit={(event) => {
        event.preventDefault();
        router.push(previewHref('/preview/hotels', effectiveStay));
      }}
    >
      <PreviewDestinationPicker
        value={stay.destination}
        onChange={(destination) => setStay({ ...stay, destination })}
        onHotelSelect={(hotelId) => router.push(previewHref(`/preview/hotels/${hotelId}`, effectiveStay))}
      />
      {includesFlights ? (
        <PreviewAirportPicker value={stay.departureAirport} onChange={(departureAirport) => setStay({ ...stay, departureAirport })} />
      ) : null}
      <label className={styles.nightsField}>
        <span className={styles.fieldLabel}>How long</span>
        <span className={styles.fieldValue}>
          <Moon size={19} aria-hidden="true" />
          <select
            aria-label="Number of nights"
            value={stay.nights}
            onChange={(event) => setStay({ ...stay, nights: Number(event.target.value) })}
          >
            {Array.from({ length: 30 }, (_, index) => (
              <option value={index + 1} key={index + 1}>
                {index + 1} {index === 0 ? 'night' : 'nights'}
              </option>
            ))}
          </select>
          <ChevronDown size={15} aria-hidden="true" />
        </span>
      </label>
      <Popover open={datesOpen} onOpenChange={setDatesOpen}>
        <PopoverTrigger asChild>
          <button type="button" className={styles.dateField}>
            <span className={styles.fieldLabel}>{includesFlights ? 'Departure date' : 'Check-in date'}</span>
            <span className={styles.fieldValue}>
              <CalendarDays size={20} aria-hidden="true" />
              <span>
                {new Intl.DateTimeFormat('en-GB', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                }).format(selectedDate)}
              </span>
              <ChevronDown size={15} aria-hidden="true" />
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent
          className={`${styles.popover} ${styles.calendarPopover}`}
          align="start"
          aria-label={includesFlights ? 'Choose departure date' : 'Choose check-in date'}
          lang="en"
          dir="ltr"
        >
          <DayPicker
            mode="single"
            autoFocus
            selected={selectedDate}
            defaultMonth={selectedDate}
            onSelect={(date) => {
              if (!date) return;
              const checkIn = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
              setStay({ ...stay, checkIn });
              setDatesOpen(false);
            }}
          />
          <p>Choose a date for your sample {includesFlights ? 'holiday' : 'stay'}.</p>
        </PopoverContent>
      </Popover>
      <PreviewGuestsPicker rooms={stay.rooms} onChange={(rooms) => setStay({ ...stay, rooms })} />
      <button type="submit" className={styles.searchButton} aria-label={includesFlights ? 'Search hotel and flights' : 'Search hotels'}>
        <Search size={23} aria-hidden="true" />
        <span>Search</span>
      </button>
    </form>
  );
}
