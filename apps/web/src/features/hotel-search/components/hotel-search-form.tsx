'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import type { HotelSearchRequest } from '@hotel/contracts';
import { useRouter } from 'next/navigation';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import type { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { DateRangePicker } from '@/features/hotel-search/components/date-range-picker';
import { hotelSearchFormSchema } from '@/features/hotel-search/schemas/hotel-search.schema';
import { serializeHotelSearch } from '@/features/hotel-search/utils/search-params';

export function HotelSearchForm({ initialSearch }: { initialSearch?: HotelSearchRequest | null }) {
  const router = useRouter();
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

  return (
    <Card>
      <form
        noValidate
        onSubmit={handleSubmit((request) =>
          router.push(`/hotels?${serializeHotelSearch(request)}`),
        )}
        className="space-y-5"
      >
        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <label className="field-label" htmlFor="destination">
              Destination city code
            </label>
            <Input
              id="destination"
              placeholder="Enter a destination code"
              {...register('destination')}
              aria-invalid={Boolean(errors.destination)}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Use a destination code from your connected hotel catalogue.
            </p>
            {errors.destination ? (
              <p className="field-error">{errors.destination.message}</p>
            ) : null}
          </div>
          <div>
            <span className="field-label">Check-in and check-out</span>
            <DateRangePicker
              checkIn={checkIn}
              checkOut={checkOut}
              onChange={(from, to) => {
                setValue('checkIn', from, { shouldValidate: false });
                setValue('checkOut', to, { shouldValidate: true });
              }}
            />
            {errors.checkIn || errors.checkOut ? (
              <p className="field-error">{errors.checkOut?.message ?? errors.checkIn?.message}</p>
            ) : null}
          </div>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className="field-label" htmlFor="nationality">
              Guest nationality (2-letter code)
            </label>
            <Input
              id="nationality"
              placeholder="e.g. PK"
              maxLength={2}
              {...register('nationality', { setValueAs: (value: string) => value.toUpperCase() })}
            />
            {errors.nationality ? (
              <p className="field-error">Enter a two-letter country code.</p>
            ) : null}
          </div>
          <div>
            <label className="field-label" htmlFor="currency">
              Currency
            </label>
            <select
              id="currency"
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              {...register('currency')}
            >
              <option>USD</option>
              <option>EUR</option>
              <option>GBP</option>
              <option>AED</option>
              <option>PKR</option>
            </select>
          </div>
        </div>
        <fieldset className="space-y-3">
          <legend className="field-label">Guests and rooms</legend>
          {fields.map((field, index) => (
            <div
              key={field.id}
              className="grid items-start gap-3 rounded-md border p-3 sm:grid-cols-[80px_1fr_2fr_auto]"
            >
              <p className="pt-7 text-sm font-medium">Room {index + 1}</p>
              <div>
                <label className="field-label" htmlFor={`adults-${field.id}`}>
                  Adults
                </label>
                <Input
                  id={`adults-${field.id}`}
                  type="number"
                  min={1}
                  max={4}
                  {...register(`rooms.${index}.adults`, { valueAsNumber: true })}
                />
                {errors.rooms?.[index]?.adults ? (
                  <p className="field-error">Choose 1–4 adults.</p>
                ) : null}
              </div>
              <div>
                <label className="field-label" htmlFor={`children-${field.id}`}>
                  Children’s ages (optional)
                </label>
                <Controller
                  control={control}
                  name={`rooms.${index}.childrenAges`}
                  render={({ field: ageField }) => (
                    <Input
                      id={`children-${field.id}`}
                      placeholder="e.g. 5, 10"
                      defaultValue={ageField.value.join(', ')}
                      ref={ageField.ref}
                      name={ageField.name}
                      onBlur={ageField.onBlur}
                      onChange={(event) => {
                        ageField.onChange(
                          event.target.value.trim()
                            ? event.target.value
                                .split(',')
                                .map((age) => (age.trim() ? Number(age.trim()) : Number.NaN))
                            : [],
                        );
                      }}
                    />
                  )}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Up to two ages, separated by a comma.
                </p>
                {errors.rooms?.[index]?.childrenAges ? (
                  <p className="field-error">Enter up to two ages from 0–17.</p>
                ) : null}
              </div>
              {fields.length > 1 ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="sm:mt-6"
                  onClick={() => remove(index)}
                  aria-label={`Remove room ${index + 1}`}
                >
                  Remove
                </Button>
              ) : (
                <span />
              )}
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={fields.length >= 4}
            onClick={() => append({ adults: 1, childrenAges: [] })}
          >
            Add room
          </Button>
        </fieldset>
        <Button type="submit" size="lg">
          Search hotels
        </Button>
      </form>
    </Card>
  );
}
