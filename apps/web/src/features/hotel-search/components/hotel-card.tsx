'use client';

import {
  type HotelPreviewStay,
  hotelSearchRequestSchema,
  type HotelSearchResult,
  type MockHotelSearchRequest,
} from '@hotel/contracts';
import {
  ArrowRight,
  Building2,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Heart,
  Star,
  Utensils,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';

import { serializeHotelSearch } from '@/features/hotel-search/utils/search-params';
import { formatDate } from '@/lib/format-date';
import { formatMoney } from '@/lib/format-money';
import { usePageMessages } from '@/providers/use-page-messages';

import styles from './hotel-card.module.css';

export function HotelCard({
  result,
  search,
  previewStay,
  priority = false,
  saved = false,
  onToggleSave,
}: {
  result: HotelSearchResult;
  search: MockHotelSearchRequest;
  previewStay?: HotelPreviewStay;
  priority?: boolean;
  saved?: boolean;
  onToggleSave?: () => void;
}) {
  const {
    messages: { results: messages },
    locale,
    t,
  } = usePageMessages();
  const [imageIndex, setImageIndex] = useState(0);
  const [failedImage, setFailedImage] = useState<string>();
  const { hotel } = result;
  const images = hotel.images.slice(0, 8);
  const activeImage = images[imageIndex] ?? images[0];
  const lowestRate = result.rates.reduce<HotelSearchResult['rates'][number] | undefined>(
    (lowest, rate) =>
      !lowest || rate.price.totalAmount < lowest.price.totalAmount ? rate : lowest,
    undefined,
  );
  const hotelUrl = `/hotels/${encodeURIComponent(hotel.id)}?${serializeHotelSearch(search)}`;
  const fullSearch = hotelSearchRequestSchema.safeParse(search);
  const isMock = hotel.source === 'mock';
  const stay = (isMock ? previewStay : undefined) ?? (fullSearch.success ? fullSearch.data : null);
  const sampleDates = isMock && (!search.checkIn || !search.checkOut);
  const sampleGuests = isMock && !search.rooms;
  const nights = stay
    ? Math.round((Date.parse(stay.checkOut) - Date.parse(stay.checkIn)) / 86_400_000)
    : undefined;
  const guests = stay?.rooms.reduce(
    (total, room) => total + room.adults + room.childrenAges.length,
    0,
  );
  const reviewLabel =
    hotel.reviewScore === undefined
      ? undefined
      : hotel.reviewScore >= 9
        ? 'Exceptional'
        : hotel.reviewScore >= 8
          ? 'Excellent'
          : hotel.reviewScore >= 7
            ? 'Very good'
            : 'Good';
  const propertySupplements =
    lowestRate?.terms?.supplements.filter((item) => item.payment === 'at-property') ?? [];

  function changePhoto(direction: number) {
    setImageIndex((current) => (current + direction + images.length) % images.length);
  }

  return (
    <article className={styles.card} aria-labelledby={`hotel-${hotel.id}`}>
      <div className={styles.gallery} aria-label={`${hotel.name} photos`} lang="en">
        <Link href={hotelUrl} className={styles.imageLink} aria-label={`View ${hotel.name}`}>
          {activeImage && failedImage !== activeImage ? (
            <Image
              src={activeImage}
              alt={`${hotel.name} · photo ${imageIndex + 1}`}
              fill
              sizes="(max-width: 600px) 100vw, (max-width: 1000px) 42vw, 400px"
              className={styles.image}
              priority={priority && imageIndex === 0}
              unoptimized={!activeImage.startsWith('/')}
              onError={() => setFailedImage(activeImage)}
            />
          ) : (
            <span className={styles.imageFallback}>
              <Building2 size={40} aria-hidden="true" />
              <span>Discover this hotel</span>
            </span>
          )}
        </Link>
        {hotel.badges?.[0] ? <span className={styles.photoBadge}>{hotel.badges[0]}</span> : null}
        {onToggleSave ? (
          <button
            type="button"
            className={`${styles.saveButton} ${saved ? styles.saved : ''}`}
            aria-label={`${saved ? 'Unsave' : 'Save'} ${hotel.name}`}
            aria-pressed={saved}
            onClick={onToggleSave}
          >
            <Heart size={21} aria-hidden="true" fill={saved ? 'currentColor' : 'none'} />
          </button>
        ) : null}
        {images.length > 1 ? (
          <>
            <button
              type="button"
              className={`${styles.galleryArrow} ${styles.previous}`}
              onClick={() => changePhoto(-1)}
              aria-label={`Previous photo of ${hotel.name}`}
            >
              <ChevronLeft size={22} aria-hidden="true" />
            </button>
            <button
              type="button"
              className={`${styles.galleryArrow} ${styles.next}`}
              onClick={() => changePhoto(1)}
              aria-label={`Next photo of ${hotel.name}`}
            >
              <ChevronRight size={22} aria-hidden="true" />
            </button>
          </>
        ) : null}
        {images.length ? (
          <span className={styles.photoCount} aria-live="polite" aria-atomic="true">
            {imageIndex + 1} / {images.length}
          </span>
        ) : null}
      </div>
      <div className={styles.information}>
        <div className={styles.heading}>
          <h2
            id={`hotel-${hotel.id}`}
            className={styles.title}
            lang="und"
            dir="auto"
            translate="no"
          >
            <Link href={hotelUrl}>{hotel.name}</Link>
          </h2>
          {hotel.starRating ? (
            <span
              className={styles.stars}
              role="img"
              aria-label={t(messages.hotelStars, {
                count: new Intl.NumberFormat(locale).format(hotel.starRating),
              })}
            >
              {Array.from({ length: Math.floor(hotel.starRating) }, (_, index) => (
                <Star key={index} size={10} fill="currentColor" aria-hidden="true" />
              ))}
            </span>
          ) : null}
        </div>
        <p className={styles.location} lang="und" dir="auto" translate="no">
          {[hotel.neighbourhood, hotel.city].filter(Boolean).join(', ') ||
            hotel.address ||
            hotel.countryCode}
        </p>
        {hotel.reviewScore !== undefined ? (
          <div className={styles.review} lang="en">
            <span className={styles.reviewDots} aria-hidden="true">
              {Array.from({ length: 5 }, (_, index) => {
                const fill = Math.min(
                  100,
                  Math.max(0, ((hotel.reviewScore ?? 0) / 2 - index) * 100),
                );
                return (
                  <span
                    key={index}
                    style={{
                      background: `linear-gradient(to right, currentColor ${fill}%, transparent ${fill}%)`,
                    }}
                  />
                );
              })}
            </span>
            <strong>
              {new Intl.NumberFormat(locale, {
                minimumFractionDigits: 1,
                maximumFractionDigits: 1,
              }).format(hotel.reviewScore)}
              <span className={styles.reviewScale}>/10</span>
            </strong>
            <span className={styles.reviewLabel}>{reviewLabel}</span>
            {hotel.reviewCount !== undefined ? (
              <small>({new Intl.NumberFormat(locale).format(hotel.reviewCount)} reviews)</small>
            ) : null}
          </div>
        ) : null}
        <div className={styles.offer}>
          <div className={styles.stayDetails}>
            {stay && nights !== undefined ? (
              <p className={styles.stayDates} lang="en">
                <CalendarDays size={16} aria-hidden="true" />
                <span>
                  {sampleDates ? 'Sample stay: ' : ''}
                  {formatDate(stay.checkIn, locale)} ·{' '}
                  {new Intl.NumberFormat(locale).format(nights)} {nights === 1 ? 'night' : 'nights'}
                </span>
              </p>
            ) : null}
            {lowestRate?.mealType ? (
              <p className={styles.boardBasis} lang="und" dir="auto" translate="no">
                <Utensils size={16} aria-hidden="true" />
                <span>{lowestRate.mealType}</span>
              </p>
            ) : null}
            {lowestRate ? (
              <>
                <p className={styles.roomName} lang="und" dir="auto" translate="no">
                  {lowestRate.roomName}
                </p>
                <p className={lowestRate.refundable ? styles.refundable : styles.nonRefundable}>
                  {lowestRate.refundable ? <Check size={14} aria-hidden="true" /> : null}
                  {lowestRate.refundable ? messages.refundableRate : messages.nonRefundableRate}
                </p>
              </>
            ) : null}
          </div>
          <div className={styles.pricePanel}>
            {lowestRate ? (
              <>
                <span className={styles.priceLabel} lang={isMock ? 'en' : undefined}>
                  {isMock ? 'Sample stay from' : messages.fullStayFrom}
                </span>
                <p className={styles.price}>{formatMoney(lowestRate.price, locale)}</p>
                {guests !== undefined ? (
                  <p className={styles.priceNote} lang="en">
                    {sampleGuests ? 'Sample: ' : ''}
                    {new Intl.NumberFormat(locale).format(guests)}{' '}
                    {guests === 1 ? 'guest' : 'guests'} · taxes included
                  </p>
                ) : null}
                {propertySupplements.length ? (
                  <p className={styles.supplementNote} lang="en">
                    Additional property charges apply
                  </p>
                ) : null}
              </>
            ) : null}
            <Link href={hotelUrl} className={styles.viewButton}>
              {locale === 'en-US' ? 'View deal' : messages.viewRooms}
              <ArrowRight size={18} aria-hidden="true" />
            </Link>
          </div>
        </div>
        <p className={styles.priceDisclaimer} lang="en">
          {hotel.source === 'mock'
            ? 'Demo price, reviews & photos · booking unavailable'
            : 'Price confirmed at recheck'}
        </p>
      </div>
    </article>
  );
}
