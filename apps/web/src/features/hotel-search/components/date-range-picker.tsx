'use client';

import { addDays, format, isValid, parseISO } from 'date-fns';
import { arSA, enGB, enUS } from 'date-fns/locale';
import { CalendarDays, ChevronDown, X } from 'lucide-react';
import { useState } from 'react';
import { type DateRange, DayPicker } from 'react-day-picker';

import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { publicEnvironment } from '@/config/env';
import styles from '@/features/hotel-search/components/hotel-search-form.module.css';
import { useSiteMessages } from '@/providers/use-site-messages';

export function DateRangePicker({
  checkIn,
  checkOut,
  onChange,
  invalid = false,
  errorId,
  compact = false,
}: {
  checkIn: string;
  checkOut: string;
  onChange: (checkIn: string, checkOut: string) => void;
  invalid?: boolean;
  errorId?: string;
  compact?: boolean;
}) {
  const { locale, dir, messages } = useSiteMessages();
  const [open, setOpen] = useState(false);
  const today = parseISO(new Date().toISOString().slice(0, 10));
  const from = checkIn && isValid(parseISO(checkIn)) ? parseISO(checkIn) : undefined;
  const to = checkOut && isValid(parseISO(checkOut)) ? parseISO(checkOut) : undefined;
  const selected: DateRange | undefined = from ? { from, to } : undefined;
  const calendarLocale = locale === 'ar-SA' ? arSA : locale === 'en-US' ? enUS : enGB;
  const regionalLocale = new Intl.Locale(locale) as Intl.Locale & {
    getWeekInfo?: () => { firstDay: number };
    weekInfo?: { firstDay: number };
  };
  const firstDay = regionalLocale.getWeekInfo?.().firstDay ?? regionalLocale.weekInfo?.firstDay;
  const weekStartsOn =
    firstDay && firstDay >= 1 && firstDay <= 7
      ? ((firstDay % 7) as 0 | 1 | 2 | 3 | 4 | 5 | 6)
      : calendarLocale.options?.weekStartsOn;
  const dateFormat = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(locale, { ...options, calendar: 'gregory' });
  const shortDate = dateFormat({ day: 'numeric', month: 'short', year: 'numeric' });
  const month = dateFormat({ month: 'long', year: 'numeric' });
  const day = dateFormat({ day: 'numeric' });
  const weekday = dateFormat({ weekday: 'short' });
  const fullDate = dateFormat({ dateStyle: 'full' });

  return (
    <div className={styles.dateField} lang={locale} dir={dir}>
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
              <span className={styles.fieldLabel}>
                {compact ? messages.dates.checkIn : messages.dates.when}
              </span>
              <span className={styles.fieldValue}>
                {from ? shortDate.format(from) : messages.dates.checkIn}
                {!compact ? (
                  <>
                    <span className={styles.dateSeparator}> – </span>
                    {to ? shortDate.format(to) : messages.dates.checkOut}
                  </>
                ) : null}
              </span>
            </span>
            <ChevronDown className={styles.chevron} size={17} aria-hidden="true" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          sideOffset={10}
          className={`${styles.popover} ${styles.calendarPopover}`}
          aria-label={compact ? messages.dates.checkIn : messages.dates.title}
          lang={locale}
          dir={dir}
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <div className={styles.popoverHeading}>
            <strong>{compact ? messages.dates.checkIn : messages.dates.title}</strong>
            <PopoverClose asChild>
              <button
                type="button"
                className={styles.closeButton}
                aria-label={messages.dates.close}
              >
                <X size={20} aria-hidden="true" />
              </button>
            </PopoverClose>
          </div>
          <DayPicker
            autoFocus
            lang={locale}
            dir={dir}
            locale={calendarLocale}
            weekStartsOn={weekStartsOn}
            formatters={{
              formatCaption: (date) => month.format(date),
              formatDay: (date) => day.format(date),
              formatWeekdayName: (date) => weekday.format(date),
              formatMonthDropdown: (date) => dateFormat({ month: 'long' }).format(date),
              formatYearDropdown: (date) => dateFormat({ year: 'numeric' }).format(date),
            }}
            labels={{
              labelNav: () => messages.dates.navigation,
              labelNext: () => messages.dates.nextMonth,
              labelPrevious: () => messages.dates.previousMonth,
              labelGrid: (date) => month.format(date),
              labelWeekday: (date) => dateFormat({ weekday: 'long' }).format(date),
              labelMonthDropdown: () => messages.dates.month,
              labelYearDropdown: () => messages.dates.year,
              labelDayButton: (date, modifiers) =>
                [
                  fullDate.format(date),
                  modifiers.today ? messages.dates.today : '',
                  modifiers.selected ? messages.dates.selected : '',
                ]
                  .filter(Boolean)
                  .join(', '),
            }}
            {...(compact
              ? {
                  mode: 'single' as const,
                  selected: from,
                  onSelect: (date: Date | undefined) => {
                    if (!date) return;
                    const nights =
                      from && to
                        ? Math.max(1, Math.round((to.getTime() - from.getTime()) / 86_400_000))
                        : 7;
                    onChange(
                      format(date, 'yyyy-MM-dd'),
                      format(addDays(date, nights), 'yyyy-MM-dd'),
                    );
                    setOpen(false);
                  },
                }
              : {
                  mode: 'range' as const,
                  selected,
                  min: 1,
                  max: publicEnvironment.maxStayNights,
                  onSelect: (range: DateRange | undefined) => {
                    onChange(
                      range?.from ? format(range.from, 'yyyy-MM-dd') : '',
                      range?.to ? format(range.to, 'yyyy-MM-dd') : '',
                    );
                    if (range?.from && range.to) setOpen(false);
                  },
                })}
            defaultMonth={from ?? today}
            disabled={{ before: today }}
            startMonth={today}
            endMonth={addDays(today, 730)}
            numberOfMonths={1}
            showOutsideDays
          />
          {!compact ? (
            <p className={styles.calendarHint}>
              {messages.dates.hint(publicEnvironment.maxStayNights)}
            </p>
          ) : null}
        </PopoverContent>
      </Popover>
    </div>
  );
}
