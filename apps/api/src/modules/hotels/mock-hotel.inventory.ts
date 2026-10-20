import type { Hotel } from '@hotel/contracts';

/** Fictional properties, ratings and prices for the explicitly selected local preview. */
export const MOCK_DESTINATIONS = [
  { id: 'dubai', name: 'Dubai', countryCode: 'AE' },
  { id: 'london', name: 'London', countryCode: 'GB' },
  { id: 'antalya', name: 'Antalya', countryCode: 'TR' },
  { id: 'bali', name: 'Bali', countryCode: 'ID' },
] as const;

interface InventoryRow {
  hotel: Hotel;
  destination: string;
  nightlyUsd: number;
  allInclusive: boolean;
}

type Fixture = readonly [
  name: string,
  stars: number,
  score: number,
  reviews: number,
  area: string,
  nightlyUsd: number,
  image: string,
  beachMeters: number | undefined,
  propertyType: string,
];
const dubai: Fixture[] = [
  ['The Palm Azure Resort', 5, 9.2, 2846, 'Palm Jumeirah', 189, 'palm-resort', 50, 'Resort'],
  ['Marina Bay Grand Hotel', 5, 9.1, 1832, 'Dubai Marina', 142, 'city-hotel', 650, 'Hotel'],
  ['Jumeirah Sands Beach Resort', 5, 9.4, 3261, 'Jumeirah Beach', 225, 'beach-resort', 0, 'Resort'],
  [
    'Al Seef Heritage House',
    4,
    8.8,
    956,
    'Dubai Creek',
    78,
    'boutique-courtyard',
    12000,
    'Boutique hotel',
  ],
  ['Downtown Skyline Hotel', 5, 9.0, 2174, 'Downtown Dubai', 168, 'city-hotel', 6500, 'Hotel'],
  ['Coral Coast Family Resort', 4, 8.7, 1489, 'Jumeirah Beach', 126, 'resort-pool', 180, 'Resort'],
  [
    'The Crescent Palm Suites',
    5,
    9.3,
    1286,
    'Palm Jumeirah',
    264,
    'infinity-pool',
    80,
    'Aparthotel',
  ],
  ['Creekside Garden Hotel', 4, 8.5, 804, 'Dubai Creek', 86, 'boutique-courtyard', 10000, 'Hotel'],
  ['Marina Vista Apartments', 4, 8.9, 1147, 'Dubai Marina', 118, 'city-hotel', 750, 'Aparthotel'],
  [
    'Pearl Dunes Retreat',
    5,
    9.5,
    692,
    'Jumeirah Beach',
    310,
    'beachfront-hotel',
    0,
    'Boutique hotel',
  ],
  ['City Walk Urban Hotel', 4, 8.6, 1623, 'City Walk', 104, 'hotel-lobby', 2400, 'Hotel'],
  ['Palm Lagoon Palace', 5, 9.6, 2651, 'Palm Jumeirah', 365, 'palm-resort', 0, 'Resort'],
  ['Golden Harbour Hotel', 3, 7.8, 592, 'Dubai Creek', 59, 'city-hotel', 11000, 'Hotel'],
  [
    'Bluewater Beach Residence',
    4,
    8.8,
    917,
    'Jumeirah Beach',
    153,
    'beachfront-hotel',
    100,
    'Aparthotel',
  ],
  [
    'The Fountain View Suites',
    5,
    9.2,
    1341,
    'Downtown Dubai',
    212,
    'luxury-suite',
    7200,
    'Aparthotel',
  ],
  ['Oasis Park Hotel', 3, 8.0, 735, 'City Walk', 69, 'resort-pool', 3200, 'Hotel'],
  [
    'Arabian Courtyard Boutique',
    4,
    8.9,
    478,
    'Dubai Creek',
    95,
    'boutique-courtyard',
    14000,
    'Boutique hotel',
  ],
  ['Sunset Marina Resort', 5, 9.0, 1987, 'Dubai Marina', 196, 'infinity-pool', 450, 'Resort'],
  ['Jumeirah Pearl Hotel', 4, 8.4, 1034, 'Jumeirah Beach', 112, 'beach-resort', 320, 'Hotel'],
  ['The Boulevard Downtown', 4, 8.7, 1268, 'Downtown Dubai', 131, 'hotel-lobby', 6800, 'Hotel'],
  ['Palm Shore Family Club', 4, 8.6, 1742, 'Palm Jumeirah', 158, 'resort-pool', 150, 'Resort'],
  ['Metro Heights Hotel', 3, 7.6, 463, 'City Walk', 54, 'city-hotel', 4800, 'Hotel'],
  ['Creek Quay Residences', 4, 8.3, 689, 'Dubai Creek', 91, 'deluxe-room', 9800, 'Aparthotel'],
  ['Royal Azure Beach Hotel', 5, 9.7, 1528, 'Jumeirah Beach', 428, 'beachfront-hotel', 0, 'Resort'],
  ['Deira Creek Budget Hotel', 1, 6.6, 186, 'Deira', 29, 'city-hotel', 14000, 'Hotel'],
  ['Bur Dubai Market Inn', 2, 7.2, 324, 'Bur Dubai', 42, 'hotel-lobby', 11000, 'Hotel'],
];
const other: { destination: (typeof MOCK_DESTINATIONS)[number]; rows: Fixture[] }[] = [
  {
    destination: MOCK_DESTINATIONS[1],
    rows: [
      [
        'The Kensington Garden Hotel',
        4,
        8.9,
        1827,
        'Kensington',
        164,
        'boutique-courtyard',
        undefined,
        'Hotel',
      ],
      [
        'Westminster Grand Suites',
        5,
        9.3,
        1278,
        'Westminster',
        279,
        'luxury-suite',
        undefined,
        'Aparthotel',
      ],
      [
        'Southbank Riverside House',
        4,
        8.7,
        945,
        'South Bank',
        152,
        'city-hotel',
        undefined,
        'Boutique hotel',
      ],
      ['Camden Courtyard Hotel', 3, 8.1, 734, 'Camden', 98, 'hotel-lobby', undefined, 'Hotel'],
      [
        'Kings Cross Budget Rooms',
        1,
        6.7,
        214,
        "King's Cross",
        62,
        'deluxe-room',
        undefined,
        'Hotel',
      ],
      [
        'Paddington Townhouse Hotel',
        2,
        7.4,
        386,
        'Paddington',
        89,
        'boutique-courtyard',
        undefined,
        'Hotel',
      ],
    ],
  },
  {
    destination: MOCK_DESTINATIONS[2],
    rows: [
      ['Lara Azure Beach Resort', 5, 9.1, 2618, 'Lara Beach', 137, 'beach-resort', 0, 'Resort'],
      [
        'Kaleici Garden Boutique',
        4,
        9.0,
        613,
        'Kaleici',
        84,
        'boutique-courtyard',
        650,
        'Boutique hotel',
      ],
      ['Konyaalti Sun Club', 4, 8.5, 1482, 'Konyaalti', 96, 'resort-pool', 120, 'Resort'],
      ['Mediterranean Pearl Palace', 5, 9.4, 1916, 'Lara Beach', 212, 'infinity-pool', 0, 'Resort'],
      ['Muratpasa City Inn', 1, 6.5, 167, 'Muratpasa', 24, 'hotel-lobby', 4500, 'Hotel'],
      ['Kaleici Harbour Rooms', 2, 7.3, 291, 'Kaleici', 36, 'boutique-courtyard', 500, 'Hotel'],
      ['Konyaalti Coast Hotel', 3, 7.8, 542, 'Konyaalti', 58, 'city-hotel', 900, 'Hotel'],
    ],
  },
  {
    destination: MOCK_DESTINATIONS[3],
    rows: [
      ['Seminyak Palm Retreat', 5, 9.2, 1839, 'Seminyak', 128, 'palm-resort', 100, 'Resort'],
      [
        'Ubud Garden Villas',
        4,
        9.4,
        763,
        'Ubud',
        116,
        'boutique-courtyard',
        28000,
        'Boutique hotel',
      ],
      ['Nusa Dua Coral Resort', 5, 9.1, 2216, 'Nusa Dua', 178, 'beachfront-hotel', 0, 'Resort'],
      ['Canggu Sunset House', 3, 8.6, 418, 'Canggu', 64, 'resort-pool', 420, 'Hotel'],
      ['Denpasar Market Inn', 1, 6.6, 196, 'Denpasar', 18, 'hotel-lobby', 9000, 'Hotel'],
      ['Kuta Courtyard Hotel', 2, 7.4, 327, 'Kuta', 32, 'boutique-courtyard', 800, 'Hotel'],
    ],
  },
];

function createInventory(
  destination: (typeof MOCK_DESTINATIONS)[number],
  rows: Fixture[],
): InventoryRow[] {
  return rows.map(
    ([name, stars, score, reviews, area, nightlyUsd, image, beachMeters, propertyType], index) => {
      const isResort = propertyType === 'Resort';
      const facilities = ['Free WiFi', 'Air conditioning'];
      if (stars >= 3) {
        facilities.push('Restaurant');
        if (index % 7 !== 3 || isResort) facilities.push('Swimming pool');
        if (stars >= 4) facilities.push('Fitness centre');
        if (stars === 5 || index % 3 === 0) facilities.push('Spa');
        if (beachMeters !== undefined && beachMeters <= 200) facilities.push('Beachfront');
        if (isResort || index % 4 === 1) facilities.push('Family friendly', 'Kids club');
        if (index % 3 !== 1) facilities.push('Free parking');
        if (index % 5 === 0) facilities.push('Adults only');
      }
      // A property never advertises mutually exclusive family/adults-only access.
      const offeredFacilities = facilities.includes('Adults only')
        ? facilities.filter((value) => value !== 'Family friendly' && value !== 'Kids club')
        : facilities;
      const coordinate =
        destination.id === 'dubai'
          ? [25.08, 55.14]
          : destination.id === 'london'
            ? [51.5, -0.13]
            : destination.id === 'antalya'
              ? [36.86, 30.73]
              : [-8.68, 115.16];
      return {
        destination: destination.id,
        nightlyUsd,
        allInclusive: isResort,
        hotel: {
          id: `mock-${destination.id}-${String(index + 1).padStart(2, '0')}`,
          name,
          source: 'mock',
          description: `${name} is a fictional ${stars}-star ${propertyType.toLowerCase()} in ${area}, ${destination.name}, created for this preview. ${isResort ? 'Spacious terraces, a landscaped pool area and relaxed dining make it easy to unwind.' : 'Comfortable rooms, welcoming shared spaces and a convenient neighbourhood setting provide an inviting city base.'} Photography is illustrative. Reviews, facilities and prices are sample data, and this property cannot be booked.`,
          address: `${index + 12} ${area} Promenade, ${destination.name}`,
          city: destination.name,
          countryCode: destination.countryCode,
          starRating: stars,
          images: [
            `/images/hotels/${image}.jpg`,
            `/images/hotels/${stars === 5 ? 'luxury-suite' : 'deluxe-room'}.jpg`,
            '/images/hotels/hotel-lobby.jpg',
          ],
          facilities: offeredFacilities,
          reviewScore: score,
          reviewCount: reviews,
          neighbourhood: area,
          propertyType,
          ...(beachMeters !== undefined ? { beachDistanceMeters: beachMeters } : {}),
          latitude: (coordinate[0] ?? 0) + index * 0.0012,
          longitude: (coordinate[1] ?? 0) + index * 0.001,
          badges:
            index === 0
              ? ['Our pick']
              : index % 6 === 2
                ? ['Great for families']
                : index % 7 === 3
                  ? ['Excellent value']
                  : [],
        },
      };
    },
  );
}

export const MOCK_HOTEL_INVENTORY: readonly InventoryRow[] = [
  ...createInventory(MOCK_DESTINATIONS[0], dubai),
  ...other.flatMap(({ destination, rows }) => createInventory(destination, rows)),
];
