'use client';

import { addDays, format, isValid, parseISO } from 'date-fns';
import { CalendarDays, ChevronDown, X } from 'lucide-react';
import { useState } from 'react';
import { type DateRange, DayPicker } from 'react-day-picker';

import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { publicEnvironment } from '@/config/env';
import styles from '@/features/hotel-search/components/hotel-search-form.module.css';

export function DateRangePicker({
  checkIn,
  checkOut,
  onChange,
  invalid = false,
  errorId,
}: {
  checkIn: string;
  checkOut: string;
  onChange: (checkIn: string, checkOut: string) => void;
  invalid?: boolean;
  errorId?: string;
}) {
  const [open, setOpen] = useState(false);
  const today = parseISO(new Date().toISOString().slice(0, 10));
  const from = checkIn && isValid(parseISO(checkIn)) ? parseISO(checkIn) : undefined;
  const to = checkOut && isValid(parseISO(checkOut)) ? parseISO(checkOut) : undefined;
  const selected: DateRange | undefined = from ? { from, to } : undefined;

  return (
    <div className={styles.dateField}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={styles.fieldButton}
            data-invalid={invalid}
            aria-describedby={invalid ? errorId : undefined}
          >
            <CalendarDays size={22} strokeWidth={1.8} aria-hidden="true" />
            <span className={styles.fieldText}>
              <span className={styles.fieldLabel}>When?</span>
              <span className={styles.fieldValue}>
                {from ? format(from, 'd MMM yyyy') : 'Check-in'}
                <span className={styles.dateSeparator}> – </span>
                {to ? format(to, 'd MMM yyyy') : 'Check-out'}
              </span>
            </span>
            <ChevronDown className={styles.chevron} size={17} aria-hidden="true" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          sideOffset={10}
          className={`${styles.popover} ${styles.calendarPopover}`}
          aria-label="Choose your stay dates"
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <div className={styles.popoverHeading}>
            <strong>Choose your stay dates</strong>
            <PopoverClose asChild>
              <button type="button" className={styles.closeButton} aria-label="Close calendar">
                <X size={20} aria-hidden="true" />
              </button>
            </PopoverClose>
          </div>
          <DayPicker
            autoFocus
            mode="range"
            selected={selected}
            defaultMonth={from ?? today}
            min={1}
            max={publicEnvironment.maxStayNights}
            disabled={{ before: today }}
            startMonth={today}
            endMonth={addDays(today, 730)}
            onSelect={(range) => {
              onChange(
                range?.from ? format(range.from, 'yyyy-MM-dd') : '',
                range?.to ? format(range.to, 'yyyy-MM-dd') : '',
              );
              if (range?.from && range.to) {
                setOpen(false);
              }
            }}
            numberOfMonths={1}
            showOutsideDays
          />
          <p className={styles.calendarHint}>
            Select check-in, then check-out. Stay up to {publicEnvironment.maxStayNights} nights.
          </p>
        </PopoverContent>
      </Popover>
    </div>
  );
}
