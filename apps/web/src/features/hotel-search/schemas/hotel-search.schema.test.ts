import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createHotelSearchFormSchema } from './hotel-search.schema';

vi.mock('@/config/env', () => ({ publicEnvironment: { maxStayNights: 30 } }));

const completeStay = {
  destination: 'dubai',
  checkIn: '2030-06-10',
  checkOut: '2030-06-17',
  nationality: 'GB',
  currency: 'GBP',
  rooms: [{ adults: 2, childrenAges: [] }],
};

describe('hotel search form modes', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2030-06-01T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('accepts an empty mock browse form while keeping live stay fields required', () => {
    expect(createHotelSearchFormSchema('mock').parse({})).toEqual({ currency: 'USD' });
    expect(createHotelSearchFormSchema('live').safeParse({}).success).toBe(false);
  });

  it('accepts the blank default form only in mock mode without filling dates or location', () => {
    const defaults = {
      destination: '',
      checkIn: '',
      checkOut: '',
      nationality: '',
      currency: 'GBP',
      rooms: [{ adults: 2, childrenAges: [] }],
    };
    const parsed = createHotelSearchFormSchema('mock').parse(defaults);
    expect(parsed).toEqual({ currency: 'GBP', rooms: defaults.rooms });
    expect(parsed.destination).toBeUndefined();
    expect(parsed.checkIn).toBeUndefined();
    expect(parsed.checkOut).toBeUndefined();
    expect(createHotelSearchFormSchema('live').safeParse(defaults).success).toBe(false);
  });

  it.each([
    { destination: 'london' },
    { checkIn: '2030-06-10' },
    { checkOut: '2030-06-17' },
    { destination: 'bali', checkIn: '2030-06-10' },
  ])(
    'preserves optional mock criteria without supplying the missing stay fields: %j',
    (criteria) => {
      const parsed = createHotelSearchFormSchema('mock').parse({ ...criteria, currency: 'GBP' });
      expect(parsed).toEqual({ ...criteria, currency: 'GBP' });
      expect(parsed.rooms).toBeUndefined();
      expect(
        createHotelSearchFormSchema('live').safeParse({ ...criteria, currency: 'GBP' }).success,
      ).toBe(false);
    },
  );

  it('accepts a complete future stay in both modes', () => {
    expect(createHotelSearchFormSchema('live').parse(completeStay)).toEqual(completeStay);
    expect(createHotelSearchFormSchema('mock').parse(completeStay)).toEqual(completeStay);
  });

  it.each([
    { destination: 'a'.repeat(101) },
    { checkIn: '2030-02-30' },
    { checkOut: 'tomorrow' },
    { nationality: 'United Kingdom' },
    { currency: 'ZZZ' },
    { rooms: [{ adults: 0, childrenAges: [] }] },
    { rooms: [{ adults: 2, childrenAges: [18] }] },
  ])('rejects invalid supplied mock criteria: %j', (criteria) => {
    expect(createHotelSearchFormSchema('mock').safeParse(criteria).success).toBe(false);
  });

  it.each([
    { checkIn: '2030-05-31' },
    { checkOut: '2030-05-31' },
    { checkOut: '2030-06-01' },
    { checkIn: '2030-05-31', checkOut: '2030-06-07' },
  ])('rejects past dates even when other mock stay fields are omitted: %j', (criteria) => {
    expect(createHotelSearchFormSchema('mock').safeParse(criteria).success).toBe(false);
  });

  it.each(['live', 'mock'] as const)(
    'enforces date order and the maximum stay in %s mode',
    (mode) => {
      const schema = createHotelSearchFormSchema(mode);
      expect(schema.safeParse({ ...completeStay, checkOut: completeStay.checkIn }).success).toBe(
        false,
      );
      expect(schema.safeParse({ ...completeStay, checkOut: '2030-06-09' }).success).toBe(false);
      expect(
        schema.safeParse({ ...completeStay, checkIn: '2030-06-01', checkOut: '2030-07-02' })
          .success,
      ).toBe(false);
      expect(
        schema.safeParse({ ...completeStay, checkIn: '2030-06-01', checkOut: '2030-07-01' })
          .success,
      ).toBe(true);
    },
  );
});
