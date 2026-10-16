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
import { usePageMessages } from '@/providers/use-page-messages';

const guestTitles = ['Mr', 'Mrs', 'Ms', 'Miss', 'Master'] as const;

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
    messages: { booking: copy },
    locale,
    dir,
    t,
  } = usePageMessages();
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
    <form
      noValidate
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-6"
      aria-label={copy.guests.formLabel}
      lang={locale}
      dir={dir}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="contact-email" className="field-label">
            {copy.guests.contactEmail}
          </label>
          <Input
            id="contact-email"
            type="email"
            dir="ltr"
            autoComplete="email"
            aria-invalid={Boolean(errors.contactEmail)}
            aria-describedby={errors.contactEmail ? 'contact-email-error' : undefined}
            {...register('contactEmail')}
          />
          {errors.contactEmail ? (
            <p id="contact-email-error" className="field-error">
              {copy.guests.emailError}
            </p>
          ) : null}
        </div>
        <div>
          <label htmlFor="contact-phone" className="field-label">
            {copy.guests.contactPhone}
          </label>
          <Input
            id="contact-phone"
            type="tel"
            dir="ltr"
            autoComplete="tel"
            {...register('contactPhone')}
            aria-invalid={Boolean(errors.contactPhone)}
            aria-describedby={errors.contactPhone ? 'contact-phone-error' : undefined}
          />
          {errors.contactPhone ? (
            <p id="contact-phone-error" className="field-error">
              {copy.guests.phoneError}
            </p>
          ) : null}
        </div>
      </div>
      {guests.map((guest, index) => (
        <fieldset key={index} className="rounded-md border p-4">
          <legend className="px-2 text-sm font-medium">
            {t(copy.guests.room, { number: guest.roomIndex + 1 })} ·{' '}
            {guest.type === 'ADULT'
              ? copy.guests.adult
              : t(copy.guests.child, { age: guest.age ?? '' })}
            {guest.leadGuest ? ` · ${copy.details.leadGuest}` : ''}
          </legend>
          <div className="grid gap-4 sm:grid-cols-[90px_1fr_1fr]">
            <div>
              <label className="field-label" htmlFor={`title-${index}`}>
                {copy.guests.title}
              </label>
              <select
                id={`title-${index}`}
                className="h-10 w-full rounded-md border bg-background px-2 text-sm"
                {...register(`guests.${index}.title`)}
                aria-invalid={Boolean(errors.guests?.[index]?.title)}
                aria-describedby={
                  errors.guests?.[index]?.title ? `title-error-${index}` : undefined
                }
              >
                {guestTitles.map((title) => (
                  <option key={title} value={title}>
                    {copy.guests.titles[title]}
                  </option>
                ))}
              </select>
              {errors.guests?.[index]?.title ? (
                <p id={`title-error-${index}`} className="field-error">
                  {copy.guests.titleError}
                </p>
              ) : null}
            </div>
            <div>
              <label className="field-label" htmlFor={`first-name-${index}`}>
                {copy.guests.firstName}
              </label>
              <Input
                id={`first-name-${index}`}
                dir="auto"
                {...register(`guests.${index}.firstName`)}
                aria-invalid={Boolean(errors.guests?.[index]?.firstName)}
                aria-describedby={
                  errors.guests?.[index]?.firstName ? `first-name-error-${index}` : undefined
                }
              />
              {errors.guests?.[index]?.firstName ? (
                <p id={`first-name-error-${index}`} className="field-error">
                  {copy.guests.firstNameError}
                </p>
              ) : null}
            </div>
            <div>
              <label className="field-label" htmlFor={`last-name-${index}`}>
                {copy.guests.lastName}
              </label>
              <Input
                id={`last-name-${index}`}
                dir="auto"
                {...register(`guests.${index}.lastName`)}
                aria-invalid={Boolean(errors.guests?.[index]?.lastName)}
                aria-describedby={
                  errors.guests?.[index]?.lastName ? `last-name-error-${index}` : undefined
                }
              />
              {errors.guests?.[index]?.lastName ? (
                <p id={`last-name-error-${index}`} className="field-error">
                  {copy.guests.lastNameError}
                </p>
              ) : null}
            </div>
          </div>
        </fieldset>
      ))}
      {errors.guests?.message || errors.guests?.root ? (
        <p className="field-error" role="alert">
          {copy.guests.detailsError}
        </p>
      ) : null}
      <p className="text-sm text-muted-foreground">{copy.guests.guidance}</p>
      <Button type="submit" disabled={pending}>
        {pending ? copy.guests.preparing : copy.guests.continue}
      </Button>
    </form>
  );
}
