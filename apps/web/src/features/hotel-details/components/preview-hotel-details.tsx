'use client';

import {
  ArrowLeft,
  BedDouble,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Images,
  Info,
  MapPin,
  Moon,
  Star,
  Users,
  Utensils,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useRef, useState } from 'react';

import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import {
  type PreviewHotel,
  previewHref,
  readPreviewStay,
} from '@/features/hotel-search/data/preview-hotels';

import styles from './preview-hotel-details.module.css';
import { PreviewRoomOption } from './preview-room-option';

type DetailPanel = 'gallery' | 'information' | 'map' | null;

const stayDate = new Intl.DateTimeFormat('en-GB', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

export function PreviewHotelDetails({ hotel }: { hotel: PreviewHotel }) {
  const params = useSearchParams();
  const stay = readPreviewStay(params);
  const [panel, setPanel] = useState<DetailPanel>(null);
  const [photoIndex, setPhotoIndex] = useState(0);
  const panelTriggerRef = useRef<HTMLButtonElement | null>(null);
  const photos = hotel.images.length > 0 ? hotel.images : [hotel.image];
  const currentPhoto = photos[photoIndex] ?? hotel.image;
  const adults = stay.rooms.reduce((total, room) => total + room.adults, 0);
  const children = stay.rooms.reduce((total, room) => total + room.childrenAges.length, 0);
  const guestSummary = `${adults} ${adults === 1 ? 'Adult' : 'Adults'}${children ? `, ${children} ${children === 1 ? 'Child' : 'Children'}` : ''}`;
  const firstRoom = stay.rooms[0];

  function openPanel(next: Exclude<DetailPanel, null>, trigger: HTMLButtonElement) {
    panelTriggerRef.current = trigger;
    if (next === 'gallery') setPhotoIndex(0);
    setPanel(next);
  }

  function changePhoto(offset: number) {
    setPhotoIndex((current) => (current + offset + photos.length) % photos.length);
  }

  return (
    <div className={styles.page} lang="en" dir="ltr">
      <div className={styles.pageHeading}>
        <h1>Refine your holiday</h1>
        <Link href={previewHref('/preview/hotels', stay)}>
          <ArrowLeft size={17} aria-hidden="true" /> Back to hotels
        </Link>
      </div>

      <div className={styles.layout}>
        <aside className={styles.hotelCard} aria-label="Your chosen hotel">
          <button
            type="button"
            className={styles.heroPhoto}
            onClick={(event) => openPanel('gallery', event.currentTarget)}
            aria-label={`View photos of ${hotel.name}`}
          >
            <Image
              src={hotel.image}
              alt={`Illustrative hotel setting for ${hotel.name}`}
              fill
              priority
              sizes="(max-width: 760px) 100vw, 340px"
              className={styles.coverImage}
            />
            <span className={styles.photoBadge}>
              <Images size={16} aria-hidden="true" /> {photos.length} photos
            </span>
          </button>
          <div className={styles.hotelContent}>
            <h2>{hotel.name}</h2>
            <div className={styles.stars} aria-label={`${hotel.stars} out of 5 stars`}>
              {Array.from({ length: hotel.stars }, (_, index) => (
                <Star key={index} size={14} fill="currentColor" aria-hidden="true" />
              ))}
            </div>
            <p className={styles.location}>{hotel.location}</p>
            <div className={styles.reviewRow}>
              <span className={styles.reviewDots} aria-hidden="true">
                {Array.from({ length: 5 }, (_, index) => (
                  <span key={index} />
                ))}
              </span>
              <span>{hotel.reviewCount.toLocaleString('en-GB')} sample reviews</span>
            </div>
            <div className={styles.reviewRow}>
              <strong className={styles.reviewScore}>{hotel.reviewScore.toFixed(1)}</strong>
              <span>
                {hotel.reviewScore >= 9 ? 'Exceptional' : 'Very good'}{' '}
                <span className={styles.reviewQualifier}>· sample rating</span>
              </span>
            </div>
            <div className={styles.hotelActions}>
              <button
                type="button"
                onClick={(event) => openPanel('information', event.currentTarget)}
              >
                <Info size={17} aria-hidden="true" /> Hotel details
              </button>
              <button type="button" onClick={(event) => openPanel('map', event.currentTarget)}>
                <MapPin size={17} aria-hidden="true" /> Map
              </button>
            </div>
            <ul className={styles.stayDetails}>
              <li>
                <CalendarDays size={19} aria-hidden="true" />{' '}
                {stayDate.format(new Date(`${stay.checkIn}T00:00:00Z`))}
              </li>
              <li>
                <Moon size={19} aria-hidden="true" /> {stay.nights}{' '}
                {stay.nights === 1 ? 'night' : 'nights'}
              </li>
              <li>
                <Users size={19} aria-hidden="true" /> {guestSummary}
              </li>
              <li>
                <BedDouble size={19} aria-hidden="true" /> {stay.rooms.length}{' '}
                {stay.rooms.length === 1 ? 'room' : 'rooms'}
              </li>
              <li>
                <Utensils size={19} aria-hidden="true" />{' '}
                {hotel.rooms[0]?.board ?? 'Board options below'}
              </li>
            </ul>
            <Link className={styles.changeSearch} href={previewHref('/preview/hotels', stay)}>
              Change dates or guests
            </Link>
          </div>
        </aside>

        <section className={styles.roomSection} aria-labelledby="preview-room-heading">
          <div className={styles.roomHeading}>
            <BedDouble size={28} strokeWidth={1.5} aria-hidden="true" />
            <h2 id="preview-room-heading">Choose room and board basis</h2>
          </div>
          <p className={styles.occupancy}>
            {stay.rooms.length === 1 && firstRoom
              ? `Room 1 (${guestSummary})`
              : `${stay.rooms.length} rooms (${guestSummary})`}
          </p>
          <div className={styles.roomList}>
            {hotel.rooms.map((room) => (
              <PreviewRoomOption key={room.id} room={room} hotelId={hotel.id} stay={stay} />
            ))}
          </div>
          <p className={styles.priceNote}>
            <Info size={16} aria-hidden="true" /> Sample room prices are for illustration. Your
            dates and guests carry through to the next step.
          </p>
        </section>
      </div>

      <Dialog
        open={panel !== null}
        onOpenChange={(open) => {
          if (!open) setPanel(null);
        }}
      >
        <DialogContent
          lang="en"
          dir="ltr"
          className={`${styles.dialog} ${panel === 'gallery' ? styles.galleryDialog : ''}`}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            panelTriggerRef.current?.focus();
          }}
        >
          <DialogTitle>{panel === 'map' ? 'Hotel location' : hotel.name}</DialogTitle>
          <DialogDescription>
            {panel === 'gallery'
              ? 'Illustrative photography for this hotel preview.'
              : panel === 'map'
                ? `${hotel.location} · illustrative map preview`
                : 'A little more about your stay.'}
          </DialogDescription>
          {panel === 'gallery' ? (
            <>
              <div className={styles.galleryPhoto}>
                <Image
                  src={currentPhoto}
                  alt={`Illustrative hotel photo ${photoIndex + 1}`}
                  fill
                  sizes="(max-width: 760px) 90vw, 800px"
                  className={styles.coverImage}
                />
              </div>
              <div className={styles.galleryControls}>
                <button
                  type="button"
                  aria-label="Previous hotel photo"
                  onClick={() => changePhoto(-1)}
                  disabled={photos.length < 2}
                >
                  <ChevronLeft size={21} />
                </button>
                <span aria-live="polite">
                  {photoIndex + 1} / {photos.length}
                </span>
                <button
                  type="button"
                  aria-label="Next hotel photo"
                  onClick={() => changePhoto(1)}
                  disabled={photos.length < 2}
                >
                  <ChevronRight size={21} />
                </button>
              </div>
            </>
          ) : null}
          {panel === 'information' ? (
            <div className={styles.hotelInformation}>
              <p>{hotel.description}</p>
              <h3>Popular facilities</h3>
              <ul>
                {hotel.facilities.map((facility) => (
                  <li key={facility}>
                    <Check size={17} aria-hidden="true" /> {facility}
                  </li>
                ))}
              </ul>
              <p className={styles.descriptionNote}>
                Facilities and images shown are sample content.
              </p>
            </div>
          ) : null}
          {panel === 'map' ? (
            <div
              className={styles.mapPreview}
              role="img"
              aria-label={`Illustrative location map for ${hotel.location}; not an exact hotel position`}
            >
              <div className={styles.mapPark}>Park</div>
              <div className={styles.mapCoast}>Coast</div>
              <div className={styles.mapMarker}>
                <MapPin size={32} fill="currentColor" aria-hidden="true" />
                <strong>{hotel.name}</strong>
              </div>
              <span className={styles.mapCaption}>Location illustration</span>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
