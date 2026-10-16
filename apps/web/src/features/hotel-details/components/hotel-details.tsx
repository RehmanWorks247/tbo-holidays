'use client';

import { currencySchema, type HotelRate } from '@hotel/contracts';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  BedDouble,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Images,
  MapPin,
  ShieldCheck,
  Sparkles,
  Star,
  Users,
  Utensils,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';

import { RequestError } from '@/components/shared/request-error';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useHotelSearch } from '@/features/hotel-search/queries/use-hotel-search';
import {
  parseHotelSearch,
  serializeHotelSearch,
} from '@/features/hotel-search/utils/search-params';
import { formatDate } from '@/lib/format-date';
import { formatMoney } from '@/lib/format-money';
import type { SiteLocale } from '@/lib/site-preferences';
import { usePageMessages } from '@/providers/use-page-messages';
import { hotelsApi } from '@/services/api/hotels.api';

import { hotelDetailsSearch } from '../utils/detail-search';
import styles from './hotel-details.module.css';

function displayCharge(amount: number, currency: string, locale: SiteLocale) {
  const supported = currencySchema.safeParse(currency);
  return supported.success
    ? formatMoney({ totalAmount: amount, currency: supported.data }, locale)
    : `${new Intl.NumberFormat(locale).format(amount)} minor units ${currency}`;
}

function RateConditions({ rate, locale }: { rate: HotelRate; locale: SiteLocale }) {
  const terms = rate.terms;
  const policies = rate.cancellationPolicies ?? [];
  if (!terms && !policies.length) return null;
  return (
    <details className={styles.conditions} lang="en">
      <summary>Rate details & cancellation policy</summary>
      <div className={styles.conditionContent}>
        {terms?.inclusion ? (
          <p lang="und" dir="auto">
            {terms.inclusion}
          </p>
        ) : null}
        {terms?.roomNames.length && terms.roomNames.length > 1 ? (
          <p lang="und" dir="auto">
            {terms.roomNames.join(' · ')}
          </p>
        ) : null}
        {terms?.rateConditions.length ? (
          <ul>
            {terms.rateConditions.map((condition, index) => (
              <li key={index} lang="und" dir="auto">
                {condition}
              </li>
            ))}
          </ul>
        ) : null}
        {terms?.supplements.map((charge, index) => (
          <p key={index}>
            <strong>
              {charge.payment === 'at-property'
                ? 'Payable at the property: '
                : 'Included in the rate: '}
            </strong>
            <span lang="und" dir="auto">
              {charge.description}
            </span>{' '}
            — {displayCharge(charge.amount, charge.currency, locale)}
            {charge.roomIndex !== undefined ? ` · Room ${charge.roomIndex + 1}` : ''}
          </p>
        ))}
        {policies.length ? (
          <div className={styles.policies}>
            <strong>Cancellation charges</strong>
            {policies.map((policy, index) => (
              <p key={index}>
                From{' '}
                {new Intl.DateTimeFormat(locale, {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                  timeZone: 'UTC',
                }).format(new Date(`${policy.from}Z`))}{' '}
                (property local time):{' '}
                {policy.chargeType === 'fixed'
                  ? displayCharge(policy.amount, policy.currency, locale)
                  : `${new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 2 }).format(policy.percentageBasisPoints / 10000)} penalty`}
                {policy.roomIndex !== undefined ? ` · Room ${policy.roomIndex + 1}` : ''}
              </p>
            ))}
          </div>
        ) : null}
      </div>
    </details>
  );
}

export function HotelDetails({ hotelId }: { hotelId: string }) {
  const {
    messages: { results: messages },
    locale,
    t,
  } = usePageMessages();
  const params = useSearchParams();
  const request = parseHotelSearch(params);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [photoIndex, setPhotoIndex] = useState(0);
  const details = useQuery({
    queryKey: ['hotel', hotelId],
    queryFn: ({ signal }) => hotelsApi.details(hotelId, signal),
    staleTime: 5 * 60_000,
  });
  const search = useHotelSearch(hotelDetailsSearch(request, details.data));
  const result = search.data?.hotels.find(({ hotel }) => hotel.id === hotelId);
  if (details.isPending)
    return (
      <div role="status" aria-label={messages.loadingHotel}>
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    );
  if (details.error) return <RequestError error={details.error} />;
  const hotel = details.data;
  const isMock = hotel.source === 'mock' || search.data?.metadata?.source === 'mock';
  const photos = hotel.images;
  const selectedPhoto = photos[photoIndex] ?? photos[0];
  const lowestRate = result?.rates.reduce<HotelRate | undefined>(
    (lowest, rate) =>
      !lowest || rate.price.totalAmount < lowest.price.totalAmount ? rate : lowest,
    undefined,
  );
  const openGallery = (index: number) => {
    setPhotoIndex(index);
    setGalleryOpen(true);
  };
  const changePhoto = (direction: number) =>
    setPhotoIndex((current) => (current + direction + photos.length) % photos.length);
  const backHref = request ? `/hotels?${serializeHotelSearch(request)}` : '/hotels';
  return (
    <div className={styles.page}>
      <Link href={backHref} className={styles.back} lang="en">
        <ArrowLeft size={17} aria-hidden="true" /> Back to hotel results
      </Link>
      {isMock ? (
        <p className={styles.mockNote} lang="en">
          <Sparkles size={15} aria-hidden="true" /> Sample hotel · Illustrative photos and guest
          ratings · Booking unavailable
        </p>
      ) : null}
      <header className={styles.heading}>
        <div>
          <div
            className={styles.stars}
            aria-label={t(messages.hotelStars, { count: String(hotel.starRating ?? 0) })}
          >
            {Array.from({ length: Math.floor(hotel.starRating ?? 0) }, (_, index) => (
              <Star key={index} size={16} fill="currentColor" aria-hidden="true" />
            ))}
            {hotel.propertyType ? (
              <span lang="und" dir="auto">
                {hotel.propertyType}
              </span>
            ) : null}
          </div>
          <h1 lang="und" dir="auto" translate="no">
            {hotel.name}
          </h1>
          <p className={styles.location} lang="und" dir="auto">
            <MapPin size={17} aria-hidden="true" />{' '}
            {[hotel.address, hotel.neighbourhood, hotel.city, hotel.countryCode]
              .filter(Boolean)
              .join(', ')}
          </p>
        </div>
        {hotel.reviewScore !== undefined ? (
          <div className={styles.review} lang="en">
            <strong>
              {new Intl.NumberFormat(locale, { minimumFractionDigits: 1 }).format(
                hotel.reviewScore,
              )}
            </strong>
            <div>
              <b>
                {hotel.reviewScore >= 9
                  ? 'Exceptional'
                  : hotel.reviewScore >= 8
                    ? 'Very good'
                    : 'Good'}
              </b>
              <span>
                {new Intl.NumberFormat(locale).format(hotel.reviewCount ?? 0)}{' '}
                {isMock ? 'sample reviews' : 'reviews'}
              </span>
            </div>
          </div>
        ) : null}
      </header>

      {photos.length ? (
        <div className={styles.gallery}>
          {photos.slice(0, 3).map((photo, index) => (
            <button
              type="button"
              key={`${photo}-${index}`}
              className={index === 0 ? styles.mainPhoto : styles.sidePhoto}
              onClick={() => openGallery(index)}
              aria-label={`View photo ${index + 1} of ${hotel.name}`}
              lang="en"
            >
              <Image
                src={photo}
                alt={`${isMock ? 'Illustrative hotel photo' : hotel.name} ${index + 1}`}
                fill
                sizes={
                  index === 0 ? '(max-width: 640px) 100vw, 65vw' : '(max-width: 640px) 50vw, 32vw'
                }
                className={styles.photo}
                priority={index === 0}
                unoptimized={!photo.startsWith('/images/')}
              />
              {index === Math.min(2, photos.length - 1) ? (
                <span className={styles.photoCount}>
                  <Images size={17} aria-hidden="true" /> View all {photos.length} photos
                </span>
              ) : null}
            </button>
          ))}
        </div>
      ) : (
        <div className={styles.noPhoto}>
          <BedDouble size={48} aria-hidden="true" />
          <span lang="en">Hotel photos coming soon</span>
        </div>
      )}

      <nav className={styles.tabs} aria-label="Hotel sections" lang="en">
        <a href="#overview">Overview</a>
        <a href="#facilities">Facilities</a>
        <a href="#rooms">Rooms & rates</a>
      </nav>
      <div className={styles.overviewLayout}>
        <div>
          <section id="overview" className={styles.section}>
            <h2 lang="en">A little about this hotel</h2>
            <p className={styles.description} lang="und" dir="auto" translate="no">
              {hotel.description ?? messages.hotelInformationFallback}
            </p>
            {hotel.badges?.length ? (
              <div className={styles.badges}>
                {hotel.badges.map((badge) => (
                  <span key={badge} lang="und">
                    <Check size={15} aria-hidden="true" />
                    {badge}
                  </span>
                ))}
              </div>
            ) : null}
          </section>
          {hotel.facilities.length ? (
            <section id="facilities" className={styles.section}>
              <h2 lang="en">Everything for a great stay</h2>
              <ul className={styles.facilities}>
                {hotel.facilities.map((facility) => (
                  <li key={facility} lang="und" dir="auto">
                    <Check size={19} aria-hidden="true" />
                    {facility}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
        <aside className={styles.stayCard}>
          <h2 lang="en">Your stay</h2>
          {request ? (
            <>
              <p>
                <CalendarDays size={19} aria-hidden="true" />
                {formatDate(request.checkIn, locale)} – {formatDate(request.checkOut, locale)}
              </p>
              <p lang="en">
                <Users size={19} aria-hidden="true" />
                {request.rooms.reduce(
                  (total, room) => total + room.adults + room.childrenAges.length,
                  0,
                )}{' '}
                guests · {request.rooms.length} {request.rooms.length === 1 ? 'room' : 'rooms'}
              </p>
            </>
          ) : (
            <p>{messages.chooseDatesAndGuests}</p>
          )}
          {lowestRate ? (
            <div className={styles.stayPrice}>
              <span>{messages.fullStayFrom}</span>
              <strong>{formatMoney(lowestRate.price, locale)}</strong>
              <span lang="en">
                {isMock ? 'Sample total for all guests' : 'Total for all guests'}
              </span>
            </div>
          ) : null}
          <Button asChild className="w-full">
            <a href="#rooms">{messages.viewRooms}</a>
          </Button>
          <p className={styles.stayFootnote} lang="en">
            <ShieldCheck size={16} aria-hidden="true" />
            {isMock
              ? 'Explore rooms and sample rates below'
              : 'Rates and terms confirmed at recheck'}
          </p>
        </aside>
      </div>
      <section id="rooms" className={styles.rooms}>
        <div className={styles.roomHeading}>
          <h2>{messages.roomsForStay}</h2>
          {request ? (
            <Link href={backHref} lang="en">
              Change search
            </Link>
          ) : null}
        </div>
        {!request ? (
          <Card className="space-y-4">
            <p>{messages.chooseDatesAndGuests}</p>
            <Button asChild>
              <Link href="/hotels">{messages.searchAvailability}</Link>
            </Button>
          </Card>
        ) : null}
        {request && search.isPending ? (
          <div role="status" aria-label={messages.loadingRooms}>
            <Skeleton className="h-48 rounded-xl" />
          </div>
        ) : null}
        {search.error ? <RequestError error={search.error} /> : null}
        {result?.rates.map((rate) => (
          <article key={rate.rateId} className={styles.roomCard}>
            <div className={styles.roomInfo}>
              <h3 lang="und" dir="auto" translate="no">
                <BedDouble size={22} aria-hidden="true" />
                {rate.roomName}
              </h3>
              <p>
                <Utensils size={16} aria-hidden="true" />
                {rate.mealType ? (
                  <span lang="und" dir="auto">
                    {rate.mealType}
                  </span>
                ) : (
                  messages.mealDetailsAtRecheck
                )}
              </p>
              <p className={rate.refundable ? styles.refundable : undefined}>
                <ShieldCheck size={16} aria-hidden="true" />
                {rate.refundable ? messages.refundableRate : messages.nonRefundableRate}
              </p>
              {rate.terms?.amenities.length ? (
                <div className={styles.roomAmenities}>
                  {rate.terms.amenities.map((amenity) => (
                    <span key={amenity} lang="und">
                      {amenity}
                    </span>
                  ))}
                </div>
              ) : null}
              <RateConditions rate={rate} locale={locale} />
            </div>
            <div className={styles.roomPrice}>
              <strong>{formatMoney(rate.price, locale)}</strong>
              <span lang="en">{isMock ? 'Sample total · all guests' : messages.stayTotal}</span>
              {isMock ? (
                <Button disabled lang="en">
                  Sample rate — booking unavailable
                </Button>
              ) : (
                <Button asChild>
                  <Link href={`/checkout?rateId=${encodeURIComponent(rate.rateId)}`}>
                    {messages.selectRoom}
                  </Link>
                </Button>
              )}
            </div>
          </article>
        ))}
        {search.data && !result?.rates.length ? <Card>{messages.noRooms}</Card> : null}
      </section>
      <p className={styles.contentNote}>{messages.originalHotelContent}</p>
      <Dialog open={galleryOpen} onOpenChange={setGalleryOpen}>
        <DialogContent className={styles.galleryDialog}>
          <DialogTitle lang="und" dir="auto">
            {hotel.name}
          </DialogTitle>
          <DialogDescription lang="en">
            {isMock
              ? 'Illustrative stock photography for this sample hotel.'
              : 'Hotel photo gallery.'}
          </DialogDescription>
          {selectedPhoto ? (
            <div className={styles.enlargedPhoto}>
              <Image
                src={selectedPhoto}
                alt={`${isMock ? 'Illustrative hotel photo' : hotel.name} ${photoIndex + 1}`}
                fill
                sizes="90vw"
                className={styles.photo}
                unoptimized={!selectedPhoto.startsWith('/images/')}
              />
            </div>
          ) : null}
          <div className={styles.galleryControls} lang="en">
            <Button
              variant="outline"
              className="size-10 p-0"
              aria-label="Previous photo"
              onClick={() => changePhoto(-1)}
              disabled={photos.length < 2}
            >
              <ChevronLeft size={20} />
            </Button>
            <span aria-live="polite">
              {photoIndex + 1} / {photos.length}
            </span>
            <Button
              variant="outline"
              className="size-10 p-0"
              aria-label="Next photo"
              onClick={() => changePhoto(1)}
              disabled={photos.length < 2}
            >
              <ChevronRight size={20} />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
