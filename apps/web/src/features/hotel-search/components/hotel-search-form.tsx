'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import type { HotelSearchRequest } from '@hotel/contracts';
import { ChevronDown, MapPin, Minus, Plus, Search, Users, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useId, useState } from 'react';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import type { z } from 'zod';

import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DateRangePicker } from '@/features/hotel-search/components/date-range-picker';
import styles from '@/features/hotel-search/components/hotel-search-form.module.css';
import { hotelSearchFormSchema } from '@/features/hotel-search/schemas/hotel-search.schema';
import { serializeHotelSearch } from '@/features/hotel-search/utils/search-params';

export function HotelSearchForm({ initialSearch }: { initialSearch?: HotelSearchRequest | null }) {
  const router = useRouter();
  const formId = useId();
  const [guestsOpen, setGuestsOpen] = useState(false);
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
      currency: 'USD',
      rooms: [{ adults: 2, childrenAges: [] }],
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'rooms' });
  const checkIn = watch('checkIn');
  const checkOut = watch('checkOut');
  const rooms = watch('rooms');
  const adults = rooms.reduce((total, room) => total + room.adults, 0);
  const children = rooms.reduce((total, room) => total + room.childrenAges.length, 0);
  const guestsLabel = [
    `${adults} adult${adults === 1 ? '' : 's'}`,
    children ? `${children} child${children === 1 ? '' : 'ren'}` : '',
    `${rooms.length} room${rooms.length === 1 ? '' : 's'}`,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <form
      id={formId}
      className={styles.form}
      noValidate
      aria-label="Find your hotel"
      onSubmit={handleSubmit(
        (request) => router.push(`/hotels?${serializeHotelSearch(request)}`),
        (invalidFields) => {
          if (invalidFields.rooms || invalidFields.nationality || invalidFields.currency) {
            setGuestsOpen(true);
          }
        },
      )}
    >
      <div className={styles.searchRow}>
        <div className={styles.destination}>
          <MapPin size={22} strokeWidth={1.8} aria-hidden="true" />
          <div className={styles.destinationText}>
            <label htmlFor={`${formId}-destination`}>Where to?</label>
            <input
              id={`${formId}-destination`}
              placeholder="Destination city code"
              autoComplete="off"
              {...register('destination')}
              aria-invalid={Boolean(errors.destination)}
              aria-describedby={`${formId}-destination-help${errors.destination ? ` ${formId}-destination-error` : ''}`}
            />
          </div>
          <div id={`${formId}-destination-help`} className={styles.destinationHelp}>
            <strong>Find your next hotel stay</strong>
            <p>Enter a destination city code from your connected hotel catalogue.</p>
          </div>
        </div>

        <DateRangePicker
          checkIn={checkIn}
          checkOut={checkOut}
          invalid={Boolean(errors.checkIn || errors.checkOut)}
          errorId={`${formId}-dates-error`}
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
                  <span className={styles.fieldLabel}>Rooms &amp; guests</span>
                  <span className={styles.fieldValue}>{guestsLabel}</span>
                </span>
                <ChevronDown className={styles.chevron} size={17} aria-hidden="true" />
              </button>
            </PopoverTrigger>

            <PopoverContent
              align="end"
              sideOffset={10}
              aria-label="Rooms and guests"
              className={`${styles.popover} ${styles.guestsPopover}`}
            >
              <div className={styles.popoverHeading}>
                <strong>Who’s coming along?</strong>
                <PopoverClose asChild>
                  <button
                    type="button"
                    className={styles.closeButton}
                    aria-label="Close rooms and guests"
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
                    <legend>Room {index + 1}</legend>
                    {fields.length > 1 ? (
                      <button
                        type="button"
                        className={styles.removeRoom}
                        onClick={() => remove(index)}
                        aria-label={`Remove room ${index + 1}`}
                      >
                        Remove
                      </button>
                    ) : null}
                    <div className={styles.occupancyRow}>
                      <span>
                        Adults <small>Ages 18+</small>
                      </span>
                      <div
                        className={styles.stepper}
                        role="group"
                        aria-label={`Adults in room ${index + 1}`}
                      >
                        <button
                          type="button"
                          disabled={room.adults <= 1}
                          aria-label={`Remove an adult from room ${index + 1}`}
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
                          aria-label={`Add an adult to room ${index + 1}`}
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
                        Children <small>Ages 0–17</small>
                      </span>
                      <div
                        className={styles.stepper}
                        role="group"
                        aria-label={`Children in room ${index + 1}`}
                      >
                        <button
                          type="button"
                          disabled={room.childrenAges.length === 0}
                          aria-label={`Remove a child from room ${index + 1}`}
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
                          aria-label={`Add a child to room ${index + 1}`}
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
                                Child {childIndex + 1} age
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
                                    Select age
                                  </option>
                                  {Array.from({ length: 18 }, (_, childAge) => (
                                    <option key={childAge} value={childAge}>
                                      {childAge === 0 ? 'Under 1' : childAge}
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
                        Select each child’s age at check-in.
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
                <Plus size={16} aria-hidden="true" /> Add another room
              </button>
              <div className={styles.preferences}>
                <label htmlFor={`${formId}-nationality`}>
                  Guest nationality
                  <input
                    id={`${formId}-nationality`}
                    form={formId}
                    placeholder="e.g. PK"
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
                  Currency
                  <select id={`${formId}-currency`} {...register('currency')}>
                    {['USD', 'EUR', 'GBP', 'AED', 'PKR', 'INR'].map((currency) => (
                      <option key={currency}>{currency}</option>
                    ))}
                  </select>
                </label>
              </div>
              <p id={`${formId}-nationality-help`} className={styles.hint}>
                Use your two-letter nationality code.
              </p>
              {errors.nationality ? (
                <p id={`${formId}-nationality-error`} className={styles.error}>
                  Enter a two-letter nationality code, for example PK.
                </p>
              ) : null}
              <PopoverClose asChild>
                <button type="button" className={styles.doneButton}>
                  Done
                </button>
              </PopoverClose>
            </PopoverContent>
          </Popover>
        </div>

        <button type="submit" className={styles.searchButton} aria-label="Search hotels">
          <Search size={21} strokeWidth={2.5} aria-hidden="true" />
          Search
        </button>
      </div>
      {Object.keys(errors).length > 0 ? (
        <div className={styles.errors} role="alert">
          {errors.destination ? (
            <p id={`${formId}-destination-error`}>Enter a destination city code.</p>
          ) : null}
          {errors.checkIn || errors.checkOut ? (
            <p id={`${formId}-dates-error`}>
              Choose valid check-in and check-out dates for your stay.
            </p>
          ) : null}
          {errors.nationality || errors.rooms || errors.currency ? (
            <p id={`${formId}-guests-error`}>Check the guest details before searching.</p>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}
