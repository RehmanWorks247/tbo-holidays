'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import type { HotelSearchRequest } from '@hotel/contracts';
import { ChevronDown, MapPin, Minus, Moon, Plus, Search, Users, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useState } from 'react';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import type { z } from 'zod';

import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { publicEnvironment } from '@/config/env';
import { DateRangePicker } from '@/features/hotel-search/components/date-range-picker';
import styles from '@/features/hotel-search/components/hotel-search-form.module.css';
import { useHotelDestinations } from '@/features/hotel-search/queries/use-hotel-destinations';
import { hotelSearchFormSchema } from '@/features/hotel-search/schemas/hotel-search.schema';
import { searchStayOnly, serializeHotelSearch } from '@/features/hotel-search/utils/search-params';
import { useSitePreferences } from '@/providers/site-preferences-provider';
import { useSiteMessages } from '@/providers/use-site-messages';

export function HotelSearchForm({
  initialSearch,
  variant = 'default',
}: {
  initialSearch?: HotelSearchRequest | null;
  variant?: 'default' | 'results';
}) {
  const router = useRouter();
  const { currency } = useSitePreferences();
  const { locale, dir, messages } = useSiteMessages();
  const copy = messages.search;
  const initialCurrency = initialSearch?.currency;
  const formId = useId();
  const [guestsOpen, setGuestsOpen] = useState(false);
  const destinations = useHotelDestinations();
  const {
    register,
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<z.input<typeof hotelSearchFormSchema>, unknown, HotelSearchRequest>({
    resolver: zodResolver(hotelSearchFormSchema),
    defaultValues: initialSearch ?? {
      destination: '',
      checkIn: '',
      checkOut: '',
      nationality: '',
      currency,
      rooms: [{ adults: 2, childrenAges: [] }],
    },
  });
  useEffect(() => {
    if (initialCurrency) setValue('currency', initialCurrency, { shouldValidate: false });
  }, [initialCurrency, setValue]);
  useEffect(() => {
    if (!initialCurrency) setValue('currency', currency, { shouldValidate: false });
  }, [currency, initialCurrency, setValue]);
  const { fields, append, remove } = useFieldArray({ control, name: 'rooms' });
  const checkIn = watch('checkIn');
  const checkOut = watch('checkOut');
  const rooms = watch('rooms');
  const searchCurrency = watch('currency');
  const adults = rooms.reduce((total, room) => total + room.adults, 0);
  const children = rooms.reduce((total, room) => total + room.childrenAges.length, 0);
  const guestsLabel = copy.guestSummary(adults, children, rooms.length);
  const nights =
    checkIn && checkOut ? Math.round((Date.parse(checkOut) - Date.parse(checkIn)) / 86_400_000) : 7;

  return (
    <form
      id={formId}
      className={`${styles.form} ${variant === 'results' ? styles.resultsForm : ''}`}
      lang={locale}
      dir={dir}
      noValidate
      aria-label={copy.formLabel}
      onSubmit={handleSubmit(
        (request) => router.push(`/hotels?${serializeHotelSearch(searchStayOnly(request))}`),
        (invalidFields) => {
          if (invalidFields.rooms || invalidFields.nationality || invalidFields.currency) {
            setGuestsOpen(true);
          }
        },
      )}
    >
      <input type="hidden" {...register('currency')} />
      <div className={styles.searchRow}>
        <div className={styles.destination}>
          <MapPin size={22} strokeWidth={1.8} aria-hidden="true" />
          <div className={styles.destinationText}>
            <label htmlFor={`${formId}-destination`}>{copy.destination}</label>
            {destinations.data?.source === 'mock' ? (
              <select
                id={`${formId}-destination`}
                {...register('destination')}
                aria-invalid={Boolean(errors.destination)}
                aria-describedby={errors.destination ? `${formId}-destination-error` : undefined}
              >
                <option value="">Choose a destination</option>
                {destinations.data.destinations.map((destination) => (
                  <option key={destination.id} value={destination.id}>
                    {destination.name}
                  </option>
                ))}
              </select>
            ) : (
              <input
                id={`${formId}-destination`}
                placeholder={copy.destinationPlaceholder}
                autoComplete="off"
                {...register('destination')}
                aria-invalid={Boolean(errors.destination)}
                aria-describedby={`${formId}-destination-help${errors.destination ? ` ${formId}-destination-error` : ''}`}
              />
            )}
          </div>
          {destinations.data?.source !== 'mock' ? (
            <div id={`${formId}-destination-help`} className={styles.destinationHelp}>
              <strong>{copy.destinationHelpTitle}</strong>
              <p>{copy.destinationHelp}</p>
            </div>
          ) : null}
        </div>

        {variant === 'results' ? (
          <label className={styles.durationField}>
            <span className={styles.fieldLabel} lang="en">
              How long
            </span>
            <Moon size={19} aria-hidden="true" />
            <select
              aria-label="Length of stay"
              value={Number.isFinite(nights) && nights > 0 ? nights : 7}
              onChange={(event) => {
                if (!checkIn) return;
                setValue(
                  'checkOut',
                  new Date(Date.parse(checkIn) + Number(event.target.value) * 86_400_000)
                    .toISOString()
                    .slice(0, 10),
                  { shouldValidate: true },
                );
              }}
            >
              {Array.from({ length: publicEnvironment.maxStayNights }, (_, index) => index + 1).map(
                (count) => (
                  <option key={count} value={count}>
                    {count} {count === 1 ? 'night' : 'nights'}
                  </option>
                ),
              )}
            </select>
          </label>
        ) : null}
        <DateRangePicker
          checkIn={checkIn}
          checkOut={checkOut}
          invalid={Boolean(errors.checkIn || errors.checkOut)}
          errorId={`${formId}-dates-error`}
          compact={variant === 'results'}
          onChange={(from, to) => {
            setValue('checkIn', from, { shouldValidate: false });
            setValue('checkOut', to, { shouldValidate: true });
          }}
        />

        <div className={styles.guestField}>
          <Popover open={guestsOpen} onOpenChange={setGuestsOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className={styles.fieldButton}
                data-invalid={Boolean(errors.rooms || errors.nationality)}
                aria-describedby={
                  errors.rooms || errors.nationality ? `${formId}-guests-error` : undefined
                }
              >
                <Users size={22} strokeWidth={1.8} aria-hidden="true" />
                <span className={styles.fieldText}>
                  <span className={styles.fieldLabel}>{copy.roomsAndGuests}</span>
                  <span className={styles.fieldValue}>{guestsLabel}</span>
                </span>
                <ChevronDown className={styles.chevron} size={17} aria-hidden="true" />
              </button>
            </PopoverTrigger>

            <PopoverContent
              align="end"
              sideOffset={10}
              aria-label={copy.roomsAndGuests}
              lang={locale}
              dir={dir}
              className={`${styles.popover} ${styles.guestsPopover}`}
            >
              <div className={styles.popoverHeading}>
                <strong>{copy.guestsTitle}</strong>
                <PopoverClose asChild>
                  <button
                    type="button"
                    className={styles.closeButton}
                    aria-label={copy.closeGuests}
                  >
                    <X size={20} aria-hidden="true" />
                  </button>
                </PopoverClose>
              </div>
              {fields.map((field, index) => {
                const room = rooms[index];
                if (!room) return null;
                return (
                  <fieldset key={field.id} className={styles.room}>
                    <legend>{copy.room(index + 1)}</legend>
                    {fields.length > 1 ? (
                      <button
                        type="button"
                        className={styles.removeRoom}
                        onClick={() => remove(index)}
                        aria-label={copy.removeRoom(index + 1)}
                      >
                        {copy.remove}
                      </button>
                    ) : null}
                    <div className={styles.occupancyRow}>
                      <span>
                        {copy.adults} <small>{copy.adultAges}</small>
                      </span>
                      <div
                        className={styles.stepper}
                        role="group"
                        aria-label={copy.adultsInRoom(index + 1)}
                      >
                        <button
                          type="button"
                          disabled={room.adults <= 1}
                          aria-label={copy.removeAdult(index + 1)}
                          onClick={() =>
                            setValue(`rooms.${index}.adults`, room.adults - 1, {
                              shouldValidate: true,
                            })
                          }
                        >
                          <Minus size={17} aria-hidden="true" />
                        </button>
                        <output aria-live="polite">{room.adults}</output>
                        <button
                          type="button"
                          disabled={room.adults >= 4}
                          aria-label={copy.addAdult(index + 1)}
                          onClick={() =>
                            setValue(`rooms.${index}.adults`, room.adults + 1, {
                              shouldValidate: true,
                            })
                          }
                        >
                          <Plus size={17} aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                    <div className={styles.occupancyRow}>
                      <span>
                        {copy.children} <small>{copy.childAges}</small>
                      </span>
                      <div
                        className={styles.stepper}
                        role="group"
                        aria-label={copy.childrenInRoom(index + 1)}
                      >
                        <button
                          type="button"
                          disabled={room.childrenAges.length === 0}
                          aria-label={copy.removeChild(index + 1)}
                          onClick={() =>
                            setValue(
                              `rooms.${index}.childrenAges`,
                              room.childrenAges.slice(0, -1),
                              { shouldValidate: true },
                            )
                          }
                        >
                          <Minus size={17} aria-hidden="true" />
                        </button>
                        <output aria-live="polite">{room.childrenAges.length}</output>
                        <button
                          type="button"
                          disabled={room.childrenAges.length >= 2}
                          aria-label={copy.addChild(index + 1)}
                          onClick={() =>
                            setValue(
                              `rooms.${index}.childrenAges`,
                              [...room.childrenAges, Number.NaN],
                              { shouldValidate: false },
                            )
                          }
                        >
                          <Plus size={17} aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                    {room.childrenAges.length > 0 ? (
                      <Controller
                        control={control}
                        name={`rooms.${index}.childrenAges`}
                        render={({ field: ageField }) => (
                          <div className={styles.childAges}>
                            {ageField.value.map((age, childIndex) => (
                              <label key={`${field.id}-${childIndex}`}>
                                {copy.childAge(childIndex + 1)}
                                <select
                                  ref={childIndex === 0 ? ageField.ref : undefined}
                                  value={Number.isFinite(age) ? age : ''}
                                  onBlur={ageField.onBlur}
                                  aria-invalid={Boolean(errors.rooms?.[index]?.childrenAges)}
                                  aria-describedby={
                                    errors.rooms?.[index]?.childrenAges
                                      ? `${formId}-ages-${index}`
                                      : undefined
                                  }
                                  onChange={(event) =>
                                    ageField.onChange(
                                      ageField.value.map((existingAge, ageIndex) =>
                                        ageIndex === childIndex
                                          ? Number(event.target.value)
                                          : existingAge,
                                      ),
                                    )
                                  }
                                >
                                  <option value="" disabled>
                                    {copy.selectAge}
                                  </option>
                                  {Array.from({ length: 18 }, (_, childAge) => (
                                    <option key={childAge} value={childAge}>
                                      {childAge === 0 ? copy.underOne : childAge}
                                    </option>
                                  ))}
                                </select>
                              </label>
                            ))}
                          </div>
                        )}
                      />
                    ) : null}
                    {errors.rooms?.[index]?.childrenAges ? (
                      <p id={`${formId}-ages-${index}`} className={styles.error}>
                        {copy.childAgeError}
                      </p>
                    ) : null}
                  </fieldset>
                );
              })}
              <button
                type="button"
                className={styles.addRoom}
                disabled={fields.length >= 4}
                onClick={() => append({ adults: 2, childrenAges: [] })}
              >
                <Plus size={16} aria-hidden="true" /> {copy.addRoom}
              </button>
              <div className={styles.preferences}>
                <label htmlFor={`${formId}-nationality`}>
                  {copy.nationality}
                  <input
                    id={`${formId}-nationality`}
                    form={formId}
                    placeholder={copy.nationalityPlaceholder}
                    maxLength={2}
                    autoComplete="country"
                    {...register('nationality', {
                      setValueAs: (value: string) => value.toUpperCase(),
                    })}
                    aria-invalid={Boolean(errors.nationality)}
                    aria-describedby={
                      errors.nationality
                        ? `${formId}-nationality-error`
                        : `${formId}-nationality-help`
                    }
                  />
                </label>
                <label htmlFor={`${formId}-currency`}>
                  {copy.currency}
                  <output id={`${formId}-currency`} dir="ltr">
                    {searchCurrency}
                  </output>
                </label>
              </div>
              <p id={`${formId}-nationality-help`} className={styles.hint}>
                {copy.nationalityHelp}
              </p>
              {errors.nationality ? (
                <p id={`${formId}-nationality-error`} className={styles.error}>
                  {copy.nationalityError}
                </p>
              ) : null}
              <PopoverClose asChild>
                <button type="button" className={styles.doneButton}>
                  {copy.done}
                </button>
              </PopoverClose>
            </PopoverContent>
          </Popover>
        </div>

        <button type="submit" className={styles.searchButton} aria-label={copy.searchHotels}>
          <Search size={21} strokeWidth={2.5} aria-hidden="true" />
          {copy.search}
        </button>
      </div>
      {Object.keys(errors).length > 0 ? (
        <div className={styles.errors} role="alert">
          {errors.destination ? (
            <p id={`${formId}-destination-error`}>{copy.destinationError}</p>
          ) : null}
          {errors.checkIn || errors.checkOut ? (
            <p id={`${formId}-dates-error`}>{copy.datesError}</p>
          ) : null}
          {errors.nationality || errors.rooms || errors.currency ? (
            <p id={`${formId}-guests-error`}>{copy.guestsError}</p>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}
