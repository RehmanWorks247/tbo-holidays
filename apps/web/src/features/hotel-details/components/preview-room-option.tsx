import {
  BedDouble,
  Check,
  ChevronDown,
  CircleHelp,
  CreditCard,
  ShieldCheck,
  Utensils,
  Wifi,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

import {
  previewHref,
  previewMoney,
  type PreviewRoom,
  type PreviewStay,
} from '@/features/hotel-search/data/preview-hotels';

import styles from './preview-room-option.module.css';

type PreviewRoomOptionProps = {
  room: PreviewRoom;
  hotelId: string;
  stay: PreviewStay;
};

/** A presentational offer; the preview never reserves inventory or creates a quote. */
export function PreviewRoomOption({ room, hotelId, stay }: PreviewRoomOptionProps) {
  return (
    <article className={styles.card} aria-label={room.name} lang="en">
      <div className={styles.room}>
        <h3>{room.name}</h3>
        <details className={styles.facilities}>
          <summary>
            <span>
              <BedDouble size={17} aria-hidden="true" /> Facilities
            </span>
            <ChevronDown size={15} aria-hidden="true" />
          </summary>
          <div className={styles.facilityContent}>
            <Image
              src={room.image}
              alt="Illustrative room interior"
              width={280}
              height={176}
              sizes="(max-width: 600px) 80vw, 220px"
            />
            <ul>
              <li>
                <Wifi size={15} aria-hidden="true" /> Wi-Fi
              </li>
              <li>
                <Check size={15} aria-hidden="true" /> Private bathroom
              </li>
              <li>
                <Check size={15} aria-hidden="true" /> Air conditioning
              </li>
            </ul>
            <p>Illustrative room facilities.</p>
          </div>
        </details>
      </div>

      <div className={styles.terms}>
        <p className={styles.board}>
          <Utensils size={18} aria-hidden="true" />
          <span>{room.board}</span>
        </p>
        <details className={styles.policy}>
          <summary>
            <ShieldCheck size={17} aria-hidden="true" />
            <span>{room.refundable ? 'Flexible hotel changes' : 'Non-refundable'}</span>
            <CircleHelp size={14} aria-hidden="true" />
          </summary>
          <p>
            {room.refundable
              ? 'Sample flexible rate. Cancellation deadlines and any charges will be confirmed with live rates.'
              : 'Sample non-refundable rate. Cancellation or changes would incur the full room cost.'}
          </p>
        </details>
        <p className={room.refundable ? styles.flexible : styles.payment}>
          {room.refundable ? (
            <ShieldCheck size={19} aria-hidden="true" />
          ) : (
            <CreditCard size={19} aria-hidden="true" />
          )}
          <span>
            {room.refundable
              ? 'A little more flexibility for your plans'
              : 'Pay the full amount today to get our cheapest price'}
          </span>
        </p>
      </div>

      <div className={styles.selection}>
        <p className={styles.price}>
          From <strong>{previewMoney(room.nightlyMinor)}</strong> per night
          <span>
            / <strong>{previewMoney(room.totalMinor)}</strong> total
          </span>
        </p>
        <Link
          className={styles.continue}
          href={previewHref('/preview/checkout', stay, { hotel: hotelId, room: room.id })}
          aria-label={`Continue with ${room.name}, ${room.board}, ${room.refundable ? 'flexible' : 'non-refundable'}`}
        >
          Continue
        </Link>
        <span className={styles.priceNote}>7-night sample price · no payment required</span>
      </div>
    </article>
  );
}
