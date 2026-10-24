'use client';

import {
  ArrowRight,
  CalendarDays,
  Check,
  ChevronDown,
  Heart,
  MapPin,
  Plane,
  PlaneLanding,
  PlaneTakeoff,
  RotateCcw,
  Search,
  SearchX,
  ShieldCheck,
  SlidersHorizontal,
  Star,
  Utensils,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  getPreviewFlight,
  getPreviewPackageTotal,
} from '@/features/hotel-search/data/preview-flights';
import {
  previewDestinations,
  previewHotels,
  previewHref,
  previewMoney,
  type PreviewStay,
  readPreviewStay,
} from '@/features/hotel-search/data/preview-hotels';

import styles from './preview-hotel-results.module.css';
import { PreviewSearchForm } from './preview-search-form';

type PreviewHotel = (typeof previewHotels)[number];
type PreviewRoom = PreviewHotel['rooms'][number];
type Sort = 'recommended' | 'price-low' | 'price-high' | 'rating';

function lowestRoom(hotel: PreviewHotel, refundableOnly = false): PreviewRoom | undefined {
  return hotel.rooms
    .filter((room) => !refundableOnly || room.refundable)
    .reduce<PreviewRoom | undefined>(
      (lowest, room) => (!lowest || room.totalMinor < lowest.totalMinor ? room : lowest),
      undefined,
    );
}

function resultPrice(
  hotel: PreviewHotel,
  stay: PreviewStay,
  room: PreviewRoom | undefined,
): number {
  if (!room) return 0;
  if (stay.product === 'hotel') return room.totalMinor;
  const baseRoom = lowestRoom(hotel);
  return getPreviewPackageTotal(hotel, stay) + room.totalMinor - (baseRoom?.totalMinor ?? 0);
}

function FlightsIncluded({ hotel, stay }: { hotel: PreviewHotel; stay: PreviewStay }) {
  const flight = getPreviewFlight(hotel, stay);
  return (
    <details className={styles.flights}>
      <summary>
        <Plane size={18} aria-hidden="true" />
        <span>Flights included</span>
        <small>Return flights · {flight.airline}</small>
        <ChevronDown size={17} aria-hidden="true" />
      </summary>
      <div className={styles.flightDetails}>
        {[
          { label: 'Outbound', leg: flight.outbound, Icon: PlaneTakeoff },
          { label: 'Inbound', leg: flight.inbound, Icon: PlaneLanding },
        ].map(({ label, leg, Icon }) => (
          <div className={styles.flightLeg} key={label}>
            <div className={styles.flightDirection}>
              <Icon size={18} aria-hidden="true" />
              <strong>{label}</strong>
              <small>
                {flight.airline} · {leg.number}
              </small>
            </div>
            <div className={styles.flightTimes}>
              <div>
                <strong>{leg.departure}</strong>
                <span>{leg.fromCode}</span>
                <small>{leg.from}</small>
              </div>
              <div className={styles.flightDuration}>
                <small>{leg.duration}</small>
                <span aria-hidden="true">
                  <i />
                  <Plane size={14} />
                </span>
                <small>Direct</small>
              </div>
              <div>
                <strong>{leg.arrival}</strong>
                <span>{leg.toCode}</span>
                <small>{leg.to}</small>
              </div>
            </div>
          </div>
        ))}
        <p>Illustrative flights and local times. No flight availability has been checked.</p>
      </div>
    </details>
  );
}

function MapArtwork() {
  return (
    <svg viewBox="0 0 640 400" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <rect width="640" height="400" fill="#eef0e6" />
      <path d="M430 -20C380 90 520 110 480 240S390 370 410 430H700V-20Z" fill="#bbdfe8" />
      <path d="M0 25H165V115H30ZM205 245H320V375H170ZM505 155H640V295H540Z" fill="#d4e4c5" />
      <g fill="none" stroke="#fff" strokeWidth="13">
        <path d="M-20 140L660 70M-20 290L670 340M85 -20L165 420M310 -20L255 420M-20 390L640 145" />
      </g>
      <g fill="none" stroke="#d9d9c9" strokeWidth="2">
        <path d="M-20 140L660 70M-20 290L670 340M85 -20L165 420M310 -20L255 420M-20 390L640 145" />
      </g>
      <g fill="none" stroke="#fff" strokeWidth="5">
        <path d="M0 205L430 190M0 65L405 35M220 0L205 400M350 0L385 400M40 0L70 400" />
      </g>
    </svg>
  );
}

function HotelCard({
  hotel,
  stay,
  room,
  saved,
  onSave,
  priority,
}: {
  hotel: PreviewHotel;
  stay: PreviewStay;
  room: PreviewRoom;
  saved: boolean;
  onSave: () => void;
  priority: boolean;
}) {
  const href = previewHref(`/preview/hotels/${hotel.id}`, stay);
  const withFlights = stay.product === 'hotel-flights';
  return (
    <article className={styles.hotelCard}>
      <div className={styles.photoArea}>
        <Link href={href} className={styles.photoLink} aria-label={`View ${hotel.name}`}>
          <Image
            src={hotel.image}
            alt={`Illustrative photo for ${hotel.name}`}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1000px) 40vw, 370px"
            className={styles.photo}
            priority={priority}
          />
        </Link>
        <span className={styles.photoLabel}>A little holiday inspiration</span>
        <button
          type="button"
          onClick={onSave}
          className={styles.saveButton}
          aria-label={`${saved ? 'Unsave' : 'Save'} ${hotel.name}`}
          aria-pressed={saved}
          title="Saved for this preview visit"
        >
          <Heart size={21} fill={saved ? 'currentColor' : 'none'} aria-hidden="true" />
        </button>
        <span className={styles.photoDots} aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
      </div>
      <div className={styles.hotelInfo}>
        <div className={styles.titleRow}>
          <h2>
            <Link href={href}>{hotel.name}</Link>
          </h2>
          <span className={styles.stars} aria-label={`${hotel.stars} stars`}>
            {Array.from({ length: hotel.stars }, (_, index) => (
              <Star key={index} size={12} fill="currentColor" aria-hidden="true" />
            ))}
          </span>
        </div>
        <p className={styles.location}>{hotel.location}</p>
        <div className={styles.reviews}>
          <strong>{hotel.reviewScore.toFixed(1)}</strong>
          <span>
            {hotel.reviewScore >= 9 ? 'Exceptional' : 'Very good'}{' '}
            <small>· {hotel.reviewCount.toLocaleString('en-GB')} sample reviews</small>
          </span>
        </div>
        <div className={styles.cardBottom}>
          <div className={styles.stayFacts}>
            <p>
              <CalendarDays size={17} aria-hidden="true" />
              {new Intl.DateTimeFormat('en-GB', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                timeZone: 'UTC',
              }).format(new Date(`${stay.checkIn}T12:00:00Z`))}{' '}
              · {stay.nights} {stay.nights === 1 ? 'night' : 'nights'}
            </p>
            <p>
              <Utensils size={17} aria-hidden="true" />
              {room.board}
            </p>
            <p>
              <ShieldCheck size={17} aria-hidden="true" />
              {room.refundable ? 'Free cancellation option' : 'Non-refundable option'}
            </p>
          </div>
          <div className={styles.price}>
            <span>{withFlights ? 'Sample hotel + flights from' : 'Sample 7-night price from'}</span>
            <strong>{previewMoney(resultPrice(hotel, stay, room))}</strong>
            <small>Illustrative total · GBP</small>
            <Link href={href} className={styles.primaryButton}>
              {withFlights ? 'View holiday' : 'View rooms'}{' '}
              <ArrowRight size={17} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>
      {withFlights ? <FlightsIncluded hotel={hotel} stay={stay} /> : null}
    </article>
  );
}

export function PreviewHotelResults() {
  const params = useSearchParams();
  const stay = useMemo(() => readPreviewStay(params), [params]);
  const withFlights = stay.product === 'hotel-flights';
  const [name, setName] = useState('');
  const [maxPrice, setMaxPrice] = useState(250000);
  const [stars, setStars] = useState<number[]>([]);
  const [refundableOnly, setRefundableOnly] = useState(false);
  const [sort, setSort] = useState<Sort>('recommended');
  const [saved, setSaved] = useState<string[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const destination = previewDestinations.find((item) => item.id === stay.destination);
  const filtered = useMemo(() => {
    const selected = previewDestinations.find((item) => item.id === stay.destination);
    const rows = previewHotels.filter((hotel) => {
      const matchesDestination =
        !stay.destination ||
        hotel.destination === stay.destination ||
        (selected &&
          `${hotel.location} ${hotel.name}`
            .toLocaleLowerCase('en-GB')
            .includes(selected.name.toLocaleLowerCase('en-GB')));
      const room = lowestRoom(hotel, refundableOnly);
      return (
        matchesDestination &&
        hotel.name.toLocaleLowerCase('en-GB').includes(name.trim().toLocaleLowerCase('en-GB')) &&
        (!stars.length || stars.includes(hotel.stars)) &&
        room &&
        resultPrice(hotel, stay, room) <= maxPrice
      );
    });
    if (sort === 'price-low' || sort === 'price-high') {
      rows.sort(
        (a, b) =>
          (resultPrice(a, stay, lowestRoom(a, refundableOnly)) -
            resultPrice(b, stay, lowestRoom(b, refundableOnly))) *
          (sort === 'price-low' ? 1 : -1),
      );
    } else if (sort === 'rating') {
      rows.sort((a, b) => b.reviewScore - a.reviewScore);
    } else if (stay.product === 'hotel-flights') {
      rows.sort(
        (a, b) => Number(b.destination === 'amsterdam') - Number(a.destination === 'amsterdam'),
      );
    }
    return rows;
  }, [stay, name, maxPrice, stars, refundableOnly, sort]);
  const activeCount =
    Number(Boolean(name)) + Number(maxPrice < 250000) + stars.length + Number(refundableOnly);

  function resetFilters() {
    setName('');
    setMaxPrice(250000);
    setStars([]);
    setRefundableOnly(false);
  }

  return (
    <div className={styles.page} lang="en" dir="ltr" data-hotel-results>
      <section
        className={styles.searchBand}
        aria-label={withFlights ? 'Find your holiday' : 'Find your hotel'}
      >
        <div className={styles.inner}>
          <PreviewSearchForm key={JSON.stringify(stay)} initialStay={stay} />
        </div>
      </section>
      <div className={styles.resultsArea}>
        <div className={styles.headingRow}>
          <div className={styles.heading}>
            <h1>{withFlights ? 'Holiday Results' : 'Hotel Results'}</h1>
            <button type="button" onClick={resetFilters} className={styles.resetButton}>
              <RotateCcw size={14} aria-hidden="true" />
              Reset filters
            </button>
          </div>
          <p className={styles.resultCount} aria-live="polite">
            <strong>
              {filtered.length} {withFlights ? 'holidays found' : 'hotels'}
            </strong>
            {destination ? ` in ${destination.name}` : ' to explore'}
          </p>
          <label className={styles.sort}>
            Sort by
            <select value={sort} onChange={(event) => setSort(event.target.value as Sort)}>
              <option value="recommended">Most popular</option>
              <option value="price-low">Price: low to high</option>
              <option value="price-high">Price: high to low</option>
              <option value="rating">Guest rating</option>
            </select>
          </label>
        </div>
        <div className={styles.layout}>
          <aside className={styles.sidebar} aria-label="Filter sample hotels">
            <Dialog>
              <DialogTrigger asChild>
                <button type="button" className={styles.mapPreview}>
                  <MapArtwork />
                  <MapPin
                    className={styles.mapPin}
                    size={33}
                    fill="#0876ce"
                    color="white"
                    aria-hidden="true"
                  />
                  <span>Show on map</span>
                </button>
              </DialogTrigger>
              <DialogContent className={styles.mapDialog} lang="en" dir="ltr">
                <DialogTitle>Explore your hotel options</DialogTitle>
                <DialogDescription>
                  Illustrative map layout for this UI preview. Pins do not represent real hotel
                  locations.
                </DialogDescription>
                <div className={styles.largeMap}>
                  <MapArtwork />
                  {filtered.slice(0, 8).map((hotel, index) => (
                    <Link
                      key={hotel.id}
                      className={styles.mapMarker}
                      style={{
                        left: `${15 + (index % 3) * 29}%`,
                        top: `${18 + Math.floor(index / 3) * 28}%`,
                      }}
                      href={previewHref(`/preview/hotels/${hotel.id}`, stay)}
                      aria-label={`View ${hotel.name}`}
                    >
                      <MapPin size={16} aria-hidden="true" />
                      {previewMoney(resultPrice(hotel, stay, lowestRoom(hotel, refundableOnly)))}
                    </Link>
                  ))}
                </div>
                <p className={styles.mapHelp}>
                  {filtered.length
                    ? 'Choose a price pin to explore a hotel.'
                    : 'Clear a filter to see sample hotels on the map.'}
                </p>
              </DialogContent>
            </Dialog>
            <button
              type="button"
              className={styles.mobileFiltersButton}
              aria-expanded={filtersOpen}
              aria-controls="preview-filter-options"
              onClick={() => setFiltersOpen(!filtersOpen)}
            >
              <SlidersHorizontal size={17} aria-hidden="true" />
              Filters{activeCount ? ` (${activeCount})` : ''}
              <span>{filtersOpen ? 'Hide' : 'Show'}</span>
            </button>
            <div
              id="preview-filter-options"
              className={`${styles.filterPanel} ${filtersOpen ? styles.filterPanelOpen : ''}`}
            >
              <div className={styles.filterTitle}>
                <h2>Find your perfect stay</h2>
                {activeCount ? <span>{activeCount}</span> : null}
              </div>
              <label className={styles.nameFilter}>
                Hotel name
                <div>
                  <Search size={17} aria-hidden="true" />
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Search hotel name"
                  />
                </div>
              </label>
              <fieldset className={styles.filterGroup}>
                <legend>Your budget</legend>
                <p className={styles.budgetValue}>
                  Up to <strong>{previewMoney(maxPrice)}</strong>
                </p>
                <input
                  aria-label={
                    withFlights ? 'Maximum sample holiday price' : 'Maximum sample stay price'
                  }
                  type="range"
                  min={10000}
                  max={250000}
                  step={5000}
                  value={maxPrice}
                  onChange={(event) => setMaxPrice(Number(event.target.value))}
                />
                <div className={styles.rangeLabels}>
                  <span>£100</span>
                  <span>£2,500</span>
                </div>
                <small>
                  {withFlights
                    ? 'Illustrative hotel + flights total'
                    : 'Illustrative total for the stay'}
                </small>
              </fieldset>
              <fieldset className={styles.filterGroup}>
                <legend>Hotel star rating</legend>
                {[5, 4, 3].map((rating) => (
                  <label key={rating} className={styles.checkbox}>
                    <input
                      type="checkbox"
                      checked={stars.includes(rating)}
                      onChange={() =>
                        setStars(
                          stars.includes(rating)
                            ? stars.filter((value) => value !== rating)
                            : [...stars, rating],
                        )
                      }
                    />
                    <span aria-label={`${rating} stars`}>
                      {Array.from({ length: rating }, (_, index) => (
                        <Star key={index} size={14} fill="currentColor" aria-hidden="true" />
                      ))}
                    </span>
                  </label>
                ))}
              </fieldset>
              <fieldset className={styles.filterGroup}>
                <legend>A little more flexibility</legend>
                <label className={styles.checkbox}>
                  <input
                    type="checkbox"
                    checked={refundableOnly}
                    onChange={(event) => setRefundableOnly(event.target.checked)}
                  />
                  <span>Free cancellation option</span>
                </label>
              </fieldset>
              <div className={styles.promise}>
                <Check size={18} aria-hidden="true" />
                <p>
                  Make it a stay to remember.<small>Compare rooms and explore your options.</small>
                </p>
              </div>
            </div>
          </aside>
          <section
            className={styles.hotelList}
            aria-label={withFlights ? 'Sample holidays' : 'Sample hotels'}
          >
            <p className={styles.sampleNotice}>
              UI preview · Illustrative photos and reviews. Prices show a fixed 7-night sample;
              {withFlights ? ' with sample return flights.' : ';'} Changing dates or guests does not
              recalculate them.
            </p>
            {filtered.length ? (
              filtered.map((hotel, index) => {
                const room = lowestRoom(hotel, refundableOnly);
                return room ? (
                  <HotelCard
                    key={hotel.id}
                    hotel={hotel}
                    stay={stay}
                    room={room}
                    saved={saved.includes(hotel.id)}
                    onSave={() =>
                      setSaved(
                        saved.includes(hotel.id)
                          ? saved.filter((id) => id !== hotel.id)
                          : [...saved, hotel.id],
                      )
                    }
                    priority={index === 0}
                  />
                ) : null;
              })
            ) : (
              <div className={styles.empty}>
                <SearchX size={36} aria-hidden="true" />
                <h2>No hotels match these filters</h2>
                <p>Try a different destination or give yourself a few more options.</p>
                <button type="button" className={styles.primaryButton} onClick={resetFilters}>
                  Clear filters
                </button>
                <Link href={previewHref('/preview/hotels', { ...stay, destination: '' })}>
                  Explore all destinations
                </Link>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
