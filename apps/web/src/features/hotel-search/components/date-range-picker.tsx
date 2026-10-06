'use client';

import { addDays, format, parseISO } from 'date-fns';
import { type DateRange, DayPicker } from 'react-day-picker';

import { publicEnvironment } from '@/config/env';

export function DateRangePicker({
  checkIn,
  checkOut,
  onChange,
}: {
  checkIn: string;
  checkOut: string;
  onChange: (checkIn: string, checkOut: string) => void;
}) {
  const today = parseISO(new Date().toISOString().slice(0, 10));
  const from = checkIn ? parseISO(checkIn) : undefined;
  const to = checkOut ? parseISO(checkOut) : undefined;
  const selected: DateRange | undefined = from ? { from, to } : undefined;
  return (
    <details className="rounded-md border bg-background p-3">
      <summary className="cursor-pointer text-sm font-medium">
        {from ? format(from, 'dd MMM yyyy') : 'Check-in'} →{' '}
        {to ? format(to, 'dd MMM yyyy') : 'Check-out'}
      </summary>
      <div className="mt-3 overflow-x-auto">
        <DayPicker
          mode="range"
          selected={selected}
          min={1}
          max={publicEnvironment.maxStayNights}
          disabled={{ before: today }}
          startMonth={today}
          endMonth={addDays(today, 730)}
          onSelect={(range) =>
            onChange(
              range?.from ? format(range.from, 'yyyy-MM-dd') : '',
              range?.to ? format(range.to, 'yyyy-MM-dd') : '',
            )
          }
          numberOfMonths={1}
          showOutsideDays
        />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Up to {publicEnvironment.maxStayNights} nights. Availability is checked when you search.
      </p>
    </details>
  );
}
