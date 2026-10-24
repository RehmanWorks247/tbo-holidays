import { z } from 'zod';

/** Presentation fixtures only. These IDs and amounts never enter a booking API. */
export interface PreviewRoom {
  id: string;
  name: string;
  board: string;
  refundable: boolean;
  totalMinor: number;
  nightlyMinor: number;
  image: string;
}

export interface PreviewHotel {
  id: string;
  name: string;
  destination: string;
  location: string;
  stars: number;
  image: string;
  images: string[];
  reviewScore: number;
  reviewCount: number;
  description: string;
  facilities: string[];
  rooms: PreviewRoom[];
}

export const previewStaySchema = z.object({
  product: z.enum(['hotel', 'hotel-flights']).default('hotel'),
  departureAirport: z
    .enum(['any', 'london', 'midlands', 'SEN', 'LGW', 'LHR', 'MAN', 'BHX', 'EDI'])
    .default('any'),
  flightId: z.enum(['standard', 'early', 'evening']).default('standard'),
  destination: z.string().max(80).default(''),
  checkIn: z.iso.date().default('2027-02-16'),
  nights: z.coerce.number().int().min(1).max(30).default(7),
  rooms: z
    .array(
      z.object({
        adults: z.number().int().min(1).max(4),
        childrenAges: z.array(z.number().int().min(0).max(17)).max(2),
      }),
    )
    .min(1)
    .max(4)
    .default([{ adults: 1, childrenAges: [] }]),
});

export type PreviewStay = z.infer<typeof previewStaySchema>;
export const DEFAULT_PREVIEW_STAY: PreviewStay = previewStaySchema.parse({});

export const previewDestinations = [
  {
    id: 'ireland',
    name: 'Republic of Ireland',
    subtitle: 'Country',
    image: '/images/hero-greece.jpg',
    temperature: 14,
  },
  {
    id: 'dublin',
    name: 'Dublin',
    subtitle: 'Leinster, Republic of Ireland',
    image: '/images/city.jpg',
    temperature: 14,
  },
  {
    id: 'leinster',
    name: 'Leinster',
    subtitle: 'Republic of Ireland',
    image: '/images/italy.jpg',
    temperature: 14,
  },
  {
    id: 'holland',
    name: 'Holland',
    subtitle: 'Country',
    image: '/images/city.jpg',
    temperature: 13,
  },
  {
    id: 'amsterdam',
    name: 'Amsterdam',
    subtitle: 'Holland',
    image: '/images/city.jpg',
    temperature: 13,
  },
  { id: 'spain', name: 'Spain', subtitle: 'Country', image: '/images/beach.jpg', temperature: 23 },
  {
    id: 'benidorm',
    name: 'Benidorm',
    subtitle: 'Costa Blanca, Spain',
    image: '/images/hotels/resort-pool.jpg',
    temperature: 23,
  },
  {
    id: 'dubai',
    name: 'Dubai',
    subtitle: 'United Arab Emirates',
    image: '/images/dubai.jpg',
    temperature: 31,
  },
  {
    id: 'london',
    name: 'London',
    subtitle: 'England, United Kingdom',
    image: '/images/city.jpg',
    temperature: 15,
  },
];

const makeRooms = (totalMinor: number): PreviewRoom[] => [
  {
    id: 'single-balcony',
    name: 'Single Room with Balcony/Terrace',
    board: 'Breakfast included',
    refundable: false,
    totalMinor,
    nightlyMinor: Math.ceil(totalMinor / 7),
    image: '/images/hotels/deluxe-room.jpg',
  },
  {
    id: 'double-balcony',
    name: 'Double Room with Balcony/Terrace',
    board: 'Breakfast included',
    refundable: false,
    totalMinor: totalMinor + 5400,
    nightlyMinor: Math.ceil((totalMinor + 5400) / 7),
    image: '/images/hotels/luxury-suite.jpg',
  },
  {
    id: 'flexible-balcony',
    name: 'Double Room with Balcony/Terrace',
    board: 'Breakfast included',
    refundable: true,
    totalMinor: totalMinor + 5900,
    nightlyMinor: Math.ceil((totalMinor + 5900) / 7),
    image: '/images/hotels/deluxe-room.jpg',
  },
];

export const previewHotels: PreviewHotel[] = [
  {
    id: 'pueblo-benidorm',
    name: 'Servigroup Pueblo Benidorm',
    destination: 'benidorm',
    location: 'Benidorm, Costa Blanca, Spain',
    stars: 3,
    image: '/images/hotels/resort-pool.jpg',
    images: [
      '/images/hotels/resort-pool.jpg',
      '/images/hotels/deluxe-room.jpg',
      '/images/hotels/hotel-lobby.jpg',
      '/images/hotels/infinity-pool.jpg',
    ],
    reviewScore: 8.8,
    reviewCount: 3050,
    description:
      'Make yourself at home in sunny Benidorm. Spend slow mornings by the pool, enjoy breakfast on the terrace and stroll to the beach. This illustrative hotel brings a relaxed Mediterranean escape to life.',
    facilities: [
      'Outdoor pool',
      'Free Wi-Fi',
      'Restaurant',
      'Air conditioning',
      'Family rooms',
      '24-hour reception',
    ],
    rooms: makeRooms(45000),
  },
  {
    id: 'lancaster-amsterdam',
    name: 'Leonardo Boutique Hotel The Lancaster Amsterdam',
    destination: 'amsterdam',
    location: 'Amsterdam, Holland · 0.6 km from the city centre',
    stars: 4,
    image: '/images/hotels/boutique-courtyard.jpg',
    images: [
      '/images/hotels/boutique-courtyard.jpg',
      '/images/hotels/luxury-suite.jpg',
      '/images/hotels/hotel-lobby.jpg',
    ],
    reviewScore: 8.6,
    reviewCount: 2272,
    description:
      'A charming city escape with peaceful rooms and welcoming spaces. Discover canals, neighbourhood cafés and the best of the city from your doorstep.',
    facilities: [
      'Free Wi-Fi',
      'Breakfast',
      'Air conditioning',
      'Bicycle hire',
      '24-hour reception',
    ],
    rooms: makeRooms(23900),
  },
  {
    id: 'eden-amsterdam',
    name: 'Leonardo Eden Hotel Amsterdam City Center',
    destination: 'amsterdam',
    location: 'Amsterdam, Holland · 0.4 km from the city centre',
    stars: 4,
    image: '/images/hotels/city-hotel.jpg',
    images: [
      '/images/hotels/city-hotel.jpg',
      '/images/hotels/deluxe-room.jpg',
      '/images/hotels/hotel-lobby.jpg',
    ],
    reviewScore: 8.4,
    reviewCount: 1854,
    description:
      'A comfortable base for your next city break, with light-filled rooms, relaxed dining and local sights within easy reach.',
    facilities: ['Free Wi-Fi', 'Restaurant', 'Air conditioning', '24-hour reception'],
    rooms: makeRooms(26800),
  },
  {
    id: 'dublin-courtyard',
    name: 'The Dublin Courtyard Hotel',
    destination: 'dublin',
    location: 'Dublin, Leinster, Republic of Ireland',
    stars: 4,
    image: '/images/hotels/boutique-courtyard.jpg',
    images: ['/images/hotels/boutique-courtyard.jpg', '/images/hotels/deluxe-room.jpg'],
    reviewScore: 9.1,
    reviewCount: 982,
    description:
      'An inviting courtyard retreat with cosy rooms, a generous breakfast and a handy city location. A fictional hotel for exploring the booking experience.',
    facilities: ['Free Wi-Fi', 'Breakfast', 'Restaurant', 'Family rooms'],
    rooms: makeRooms(32900),
  },
  {
    id: 'dubai-palm',
    name: 'Palm Bay Resort Dubai',
    destination: 'dubai',
    location: 'Palm Jumeirah, Dubai, United Arab Emirates',
    stars: 5,
    image: '/images/hotels/palm-resort.jpg',
    images: [
      '/images/hotels/palm-resort.jpg',
      '/images/hotels/infinity-pool.jpg',
      '/images/hotels/luxury-suite.jpg',
    ],
    reviewScore: 9.4,
    reviewCount: 4120,
    description:
      'An illustrative beachfront resort with open sea views, spacious rooms and a pool made for lazy afternoons.',
    facilities: [
      'Private beach',
      'Outdoor pool',
      'Free Wi-Fi',
      'Spa',
      'Restaurant',
      'Air conditioning',
    ],
    rooms: makeRooms(74900),
  },
  {
    id: 'london-gardens',
    name: 'London Garden House',
    destination: 'london',
    location: 'Kensington, London, England, United Kingdom',
    stars: 4,
    image: '/images/hotels/city-hotel.jpg',
    images: ['/images/hotels/city-hotel.jpg', '/images/hotels/luxury-suite.jpg'],
    reviewScore: 8.9,
    reviewCount: 1250,
    description:
      'Discover a relaxed city stay near leafy gardens, museums and neighbourhood restaurants. Fictional rooms and prices for the UI preview.',
    facilities: ['Free Wi-Fi', 'Breakfast', 'Air conditioning', '24-hour reception'],
    rooms: makeRooms(38900),
  },
];

const money = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'GBP',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});
export function previewMoney(amount: number): string {
  return money.format(amount / 100);
}

/** A bounded URL model keeps shareable demo selections separate from guest information. */
export function readPreviewStay(params: { get(name: string): string | null }): PreviewStay {
  const encodedRooms = params.get('rooms');
  let rooms: unknown;
  if (encodedRooms && encodedRooms.length <= 1024) {
    try {
      rooms = JSON.parse(encodedRooms) as unknown;
    } catch {
      return { ...DEFAULT_PREVIEW_STAY };
    }
  }
  const parsed = previewStaySchema.safeParse({
    product: params.get('product') ?? undefined,
    departureAirport: params.get('departureAirport') ?? undefined,
    flightId: params.get('flightId') ?? undefined,
    destination: params.get('destination') ?? undefined,
    checkIn: params.get('checkIn') ?? undefined,
    nights: params.get('nights') ?? undefined,
    rooms,
  });
  return parsed.success ? parsed.data : { ...DEFAULT_PREVIEW_STAY };
}

export function previewHref(
  path: string,
  stay: PreviewStay,
  extra: Record<string, string> = {},
): string {
  const params = new URLSearchParams({
    product: stay.product,
    departureAirport: stay.departureAirport,
    flightId: stay.flightId,
    destination: stay.destination,
    checkIn: stay.checkIn,
    nights: String(stay.nights),
    rooms: JSON.stringify(stay.rooms),
    ...extra,
  });
  return `${path}?${params.toString()}`;
}
