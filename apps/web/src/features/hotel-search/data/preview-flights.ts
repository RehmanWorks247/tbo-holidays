import type { PreviewHotel, PreviewStay } from './preview-hotels';

/** Local presentation fixtures. No airline availability or bookable fare is implied. */
export const previewAirports: {
  id: PreviewStay['departureAirport'];
  name: string;
  code: string;
  group: string;
}[] = [
  { id: 'any', name: 'Any airport', code: '', group: 'Airports & Regions' },
  { id: 'london', name: 'Any London Airport', code: 'LON', group: 'Airports & Regions' },
  { id: 'midlands', name: 'Any Midlands Airport', code: 'MID', group: 'Airports & Regions' },
  { id: 'SEN', name: 'London Southend', code: 'SEN', group: 'Airports' },
  { id: 'LGW', name: 'London Gatwick', code: 'LGW', group: 'Airports' },
  { id: 'LHR', name: 'London Heathrow', code: 'LHR', group: 'Airports' },
  { id: 'MAN', name: 'Manchester', code: 'MAN', group: 'Airports' },
  { id: 'BHX', name: 'Birmingham', code: 'BHX', group: 'Airports' },
  { id: 'EDI', name: 'Edinburgh', code: 'EDI', group: 'Airports' },
];

export const previewFlightOptions: {
  id: PreviewStay['flightId'];
  label: string;
  priceMinor: number;
}[] = [
  { id: 'standard', label: 'Best value flights', priceMinor: 0 },
  { id: 'early', label: 'Morning departure', priceMinor: 2000 },
  { id: 'evening', label: 'Later return', priceMinor: 3000 },
];

export interface PreviewFlightLeg {
  number: string;
  from: string;
  fromCode: string;
  to: string;
  toCode: string;
  departure: string;
  arrival: string;
  duration: string;
}

export interface PreviewFlight {
  id: PreviewStay['flightId'];
  airline: string;
  outbound: PreviewFlightLeg;
  inbound: PreviewFlightLeg;
  /** Upgrade over the bundled return flights, in sample GBP minor units. */
  priceMinor: number;
}

const destinations: Record<string, { name: string; code: string; duration: string }> = {
  amsterdam: { name: 'Amsterdam', code: 'AMS', duration: '1h' },
  benidorm: { name: 'Alicante', code: 'ALC', duration: '2h 30m' },
  dublin: { name: 'Dublin', code: 'DUB', duration: '1h 20m' },
  dubai: { name: 'Dubai', code: 'DXB', duration: '7h' },
  london: { name: 'London Heathrow', code: 'LHR', duration: '1h 20m' },
};

export function getPreviewFlight(hotel: PreviewHotel, stay: PreviewStay): PreviewFlight {
  const choice = previewFlightOptions.find((option) => option.id === stay.flightId)!;
  const airportId = stay.departureAirport === 'midlands' ? 'BHX' : stay.departureAirport;
  let airport = previewAirports.find((item) => item.id === airportId && item.group === 'Airports');
  const destination = destinations[hotel.destination] ?? destinations.amsterdam!;
  // London city-break examples depart from another city, avoiding same-city mock legs.
  if (hotel.destination === 'london' && (!airport || airport.name.startsWith('London'))) {
    airport = previewAirports.find((item) => item.id === 'MAN');
  }
  airport ??= previewAirports.find((item) => item.id === 'SEN')!;
  const early = stay.flightId === 'early';
  const evening = stay.flightId === 'evening';
  return {
    id: choice.id,
    airline: 'Example Air',
    priceMinor: choice.priceMinor,
    outbound: {
      number: 'DEMO 5707',
      from: airport.name,
      fromCode: airport.code,
      to: destination.name,
      toCode: destination.code,
      departure: early ? '08:35' : '19:35',
      arrival: early ? '10:35' : '21:35',
      duration: destination.duration,
    },
    inbound: {
      number: 'DEMO 5708',
      from: destination.name,
      fromCode: destination.code,
      to: airport.name,
      toCode: airport.code,
      departure: evening ? '20:50' : '14:50',
      arrival: evening ? '20:45' : '14:45',
      duration: destination.duration,
    },
  };
}

/** Demonstrates the calendar interaction; never an authoritative price calculation. */
export function getPreviewDateSupplement(checkIn: string): number {
  const weekday = new Date(`${checkIn}T12:00:00Z`).getUTCDay();
  return [0, 1000, 2000, 2000, 1000, 4000, 5000][weekday] ?? 0;
}

export function getPreviewPackageTotal(hotel: PreviewHotel, stay: PreviewStay): number {
  return (
    (hotel.rooms[0]?.totalMinor ?? 0) +
    getPreviewFlight(hotel, stay).priceMinor +
    getPreviewDateSupplement(stay.checkIn)
  );
}
