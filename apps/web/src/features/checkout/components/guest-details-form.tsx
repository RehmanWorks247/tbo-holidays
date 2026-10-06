'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  type BookingGuestInput,
  type BookingResponse,
  type UpdateBookingGuestsRequest,
  updateBookingGuestsRequestSchema,
} from '@hotel/contracts';
import { useForm } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

function initialGuests(booking: BookingResponse): BookingGuestInput[] {
  if (booking.guests.length) return booking.guests;
  return booking.rooms.flatMap((room) => [
    ...Array.from({ length: room.adults }, (_, index): BookingGuestInput => ({
      roomIndex: room.roomIndex,
      title: 'Mr',
      firstName: '',
      lastName: '',
      type: 'ADULT',
      leadGuest: room.roomIndex === 0 && index === 0,
    })),
    ...room.childrenAges.map((age): BookingGuestInput => ({
      roomIndex: room.roomIndex,
      title: 'Master',
      firstName: '',
      lastName: '',
      type: 'CHILD',
      age,
      leadGuest: false,
    })),
  ]);
}

export function GuestDetailsForm({
  booking,
  onSubmit,
  pending,
}: {
  booking: BookingResponse;
  onSubmit: (request: UpdateBookingGuestsRequest) => void;
  pending: boolean;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
    getValues,
  } = useForm<UpdateBookingGuestsRequest>({
    resolver: zodResolver(updateBookingGuestsRequestSchema),
    defaultValues: { guests: initialGuests(booking), contactEmail: '', contactPhone: '' },
  });
  const guests = getValues('guests');
  return (
    <form noValidate onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="contact-email" className="field-label">
            Contact email
          </label>
          <Input
            id="contact-email"
            type="email"
            autoComplete="email"
            {...register('contactEmail')}
          />
          {errors.contactEmail ? (
            <p className="field-error">{errors.contactEmail.message}</p>
          ) : null}
        </div>
        <div>
          <label htmlFor="contact-phone" className="field-label">
            Contact phone
          </label>
          <Input id="contact-phone" type="tel" autoComplete="tel" {...register('contactPhone')} />
          {errors.contactPhone ? (
            <p className="field-error">{errors.contactPhone.message}</p>
          ) : null}
        </div>
      </div>
      {guests.map((guest, index) => (
        <fieldset key={index} className="rounded-md border p-4">
          <legend className="px-2 text-sm font-medium">
            Room {guest.roomIndex + 1} ·{' '}
            {guest.type === 'ADULT' ? 'Adult' : `Child, age ${guest.age}`}
            {guest.leadGuest ? ' · Lead guest' : ''}
          </legend>
          <div className="grid gap-4 sm:grid-cols-[90px_1fr_1fr]">
            <div>
              <label className="field-label" htmlFor={`title-${index}`}>
                Title
              </label>
              <select
                id={`title-${index}`}
                className="h-10 w-full rounded-md border bg-background px-2 text-sm"
                {...register(`guests.${index}.title`)}
              >
                {['Mr', 'Mrs', 'Ms', 'Miss', 'Master'].map((title) => (
                  <option key={title}>{title}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label" htmlFor={`first-name-${index}`}>
                First name
              </label>
              <Input id={`first-name-${index}`} {...register(`guests.${index}.firstName`)} />
              {errors.guests?.[index]?.firstName ? (
                <p className="field-error">{errors.guests[index]?.firstName?.message}</p>
              ) : null}
            </div>
            <div>
              <label className="field-label" htmlFor={`last-name-${index}`}>
                Last name
              </label>
              <Input id={`last-name-${index}`} {...register(`guests.${index}.lastName`)} />
              {errors.guests?.[index]?.lastName ? (
                <p className="field-error">{errors.guests[index]?.lastName?.message}</p>
              ) : null}
            </div>
          </div>
        </fieldset>
      ))}
      {errors.guests?.root?.message ? (
        <p className="field-error">{errors.guests.root.message}</p>
      ) : null}
      <p className="text-sm text-muted-foreground">
        Enter guest names as they appear on travel documents. Payment is handled by the configured
        payment provider.
      </p>
      <Button type="submit" disabled={pending}>
        {pending ? 'Preparing checkout…' : 'Save guests and continue to payment'}
      </Button>
    </form>
  );
}
