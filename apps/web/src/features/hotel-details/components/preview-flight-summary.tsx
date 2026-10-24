import { Plane, PlaneLanding, PlaneTakeoff } from 'lucide-react';

import { getPreviewFlight } from '@/features/hotel-search/data/preview-flights';
import type { PreviewHotel, PreviewStay } from '@/features/hotel-search/data/preview-hotels';

import styles from './preview-flight-summary.module.css';

type PreviewFlightSummaryProps = {
  hotel: PreviewHotel;
  stay: PreviewStay;
  compact?: boolean;
};

type FlightLeg = ReturnType<typeof getPreviewFlight>['outbound'];

const dateFormatter = new Intl.DateTimeFormat('en-GB', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

function FlightJourney({
  leg,
  airline,
  date,
  inbound = false,
}: {
  leg: FlightLeg;
  airline: string;
  date: Date;
  inbound?: boolean;
}) {
  const heading = inbound ? 'Return flight' : 'Outbound flight';

  return (
    <section
      className={styles.leg}
      aria-label={`${heading}: ${leg.from} to ${leg.to}, ${dateFormatter.format(date)}`}
    >
      <div className={styles.legHeading}>
        <h4>
          {inbound ? (
            <PlaneLanding size={17} aria-hidden="true" />
          ) : (
            <PlaneTakeoff size={17} aria-hidden="true" />
          )}
          {heading}
        </h4>
        <time dateTime={date.toISOString().slice(0, 10)}>{dateFormatter.format(date)}</time>
      </div>
      <p className={styles.airline}>
        <span>{airline}</span>
        <span>{leg.number}</span>
      </p>
      <div className={styles.journey}>
        <div className={styles.airport}>
          <strong>{leg.departure}</strong>
          <abbr title={leg.from}>{leg.fromCode}</abbr>
        </div>
        <div className={styles.route}>
          <span>{leg.duration}</span>
          <div className={styles.routeLine} aria-hidden="true">
            <span />
            <Plane size={15} />
            <span />
          </div>
          <span className={styles.direct}>Direct</span>
        </div>
        <div className={`${styles.airport} ${styles.arrival}`}>
          <strong>{leg.arrival}</strong>
          <abbr title={leg.to}>{leg.toCode}</abbr>
        </div>
      </div>
      <div className={styles.airportNames}>
        <span>{leg.from}</span>
        <span>{leg.to}</span>
      </div>
    </section>
  );
}

/** Read-only flight itinerary for the fictional package preview. */
export function PreviewFlightSummary({ hotel, stay, compact = false }: PreviewFlightSummaryProps) {
  const flight = getPreviewFlight(hotel, stay);
  const outboundDate = new Date(`${stay.checkIn}T12:00:00Z`);
  const returnDate = new Date(outboundDate.getTime() + stay.nights * 86_400_000);

  return (
    <section
      className={styles.summary}
      data-compact={compact || undefined}
      aria-label="Your sample return flights"
      lang="en"
    >
      <h3 className={styles.heading}>
        <Plane size={18} aria-hidden="true" /> Your flights
      </h3>
      <FlightJourney leg={flight.outbound} airline={flight.airline} date={outboundDate} />
      <FlightJourney leg={flight.inbound} airline={flight.airline} date={returnDate} inbound />
      <p className={styles.note}>Illustrative flights · times are local</p>
    </section>
  );
}
