import {
  BedDouble,
  CalendarDays,
  Info,
  Moon,
  ShieldCheck,
  Star,
  Users,
  Utensils,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

import {
  type PreviewHotel,
  previewHref,
  previewMoney,
  type PreviewRoom,
  type PreviewStay,
} from '@/features/hotel-search/data/preview-hotels';

import styles from './preview-checkout.module.css';
import { type PreviewTransferId, previewTransfers } from './preview-transfer-options';

const dateFormat = new Intl.DateTimeFormat('en-GB', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

export function PreviewCheckoutSummary({
  hotel,
  room,
  stay,
  transferId,
}: {
  hotel: PreviewHotel;
  room: PreviewRoom;
  stay: PreviewStay;
  transferId: PreviewTransferId | null;
}) {
  const transfer = previewTransfers.find((item) => item.id === transferId);
  const checkIn = new Date(`${stay.checkIn}T12:00:00Z`);
  const checkOut = new Date(checkIn.getTime() + stay.nights * 86_400_000);
  const adults = stay.rooms.reduce((count, item) => count + item.adults, 0);
  const children = stay.rooms.reduce((count, item) => count + item.childrenAges.length, 0);

  return (
    <aside className={styles.summary} aria-label="Your booking summary">
      <div className={styles.summaryTop}>
        <h2>Your booking</h2>
        <span className={styles.previewBadge}>Preview</span>
      </div>
      <div className={styles.hotelIdentity}>
        <Image
          src={hotel.image}
          alt={`Illustrative photograph of ${hotel.name}`}
          width={92}
          height={76}
          className={styles.hotelImage}
        />
        <div>
          <h3>{hotel.name}</h3>
          <div className={styles.stars} aria-label={`${hotel.stars} star hotel`}>
            {Array.from({ length: hotel.stars }, (_, index) => (
              <Star key={index} size={11} fill="currentColor" aria-hidden="true" />
            ))}
          </div>
          <p>{hotel.location}</p>
        </div>
      </div>
      <div className={styles.summaryLinks}>
        <Link href={previewHref(`/preview/hotels/${hotel.id}`, stay)}>Hotel details</Link>
        <Link href={previewHref('/preview/hotels', stay)}>Change hotel</Link>
      </div>
      <div className={styles.stayDetails}>
        <p>
          <CalendarDays size={16} aria-hidden="true" />
          <span>
            Check-in: <strong>{dateFormat.format(checkIn)}</strong>
            <br />
            Check-out: <strong>{dateFormat.format(checkOut)}</strong>
          </span>
        </p>
        <p>
          <Moon size={16} aria-hidden="true" />
          {stay.nights} {stay.nights === 1 ? 'night' : 'nights'}
        </p>
        <p>
          <Users size={16} aria-hidden="true" />
          {adults} {adults === 1 ? 'Adult' : 'Adults'}
          {children ? `, ${children} ${children === 1 ? 'Child' : 'Children'}` : ''} ·{' '}
          {stay.rooms.length} {stay.rooms.length === 1 ? 'Room' : 'Rooms'}
        </p>
        <p>
          <Utensils size={16} aria-hidden="true" />
          {room.board}
        </p>
        <p>
          <BedDouble size={16} aria-hidden="true" />
          <span>
            {room.name}
            <small>
              {room.refundable
                ? 'Flexible cancellation · sample terms'
                : 'Non-refundable · sample terms'}
            </small>
          </span>
        </p>
      </div>
      <section className={styles.priceBreakdown} aria-labelledby="preview-price-heading">
        <h3 id="preview-price-heading">Price breakdown</h3>
        <dl>
          <div>
            <dt>
              Hotel <span>sample package</span>
            </dt>
            <dd>{previewMoney(room.totalMinor)}</dd>
          </div>
          <div>
            <dt>{transfer?.name ?? 'Transfers'}</dt>
            <dd>{transfer ? previewMoney(transfer.priceMinor) : 'Not included'}</dd>
          </div>
          <div className={styles.total}>
            <dt>
              Total <span>GBP · sample price</span>
            </dt>
            <dd aria-live="polite">
              {previewMoney(room.totalMinor + (transfer?.priceMinor ?? 0))}
            </dd>
          </div>
        </dl>
      </section>
      <p className={styles.summaryNote}>
        <Info size={16} aria-hidden="true" />
        <span>Illustrative prices only. No room is reserved and no payment will be taken.</span>
      </p>
      <p className={styles.secureNote}>
        <ShieldCheck size={17} aria-hidden="true" />
        Your holiday, one step closer
      </p>
    </aside>
  );
}
