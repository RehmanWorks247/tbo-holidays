import { createHash } from 'node:crypto';

import {
  type Hotel,
  hotelDestinationsResponseSchema,
  hotelSchema,
  type HotelSearchRequest,
  validateStay,
} from '@hotel/contracts';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { MockDestination, MockHotel } from '@prisma/client';
import { z } from 'zod';

import { DomainError } from '../../common/errors/domain-error';
import type { Environment } from '../../config/environment';
import { DatabaseService } from '../../database/database.service';
import type { HotelSupplier, SupplierRate, SupplierSearchResult } from './hotel-supplier';

const storedRateSchema = z.object({
  id: z.string().min(1),
  currency: z.string().regex(/^[A-Z]{3}$/),
  mealType: z.string().min(1),
  roomName: z.string().min(1),
  nightlyBaseAmount: z.number().int().min(0).max(2_000_000_000),
  taxBasisPoints: z.number().int().min(0).max(10000),
  refundable: z.boolean(),
  cancellationLeadDays: z.number().int().min(0).max(90),
});

function toHotel(row: MockHotel & { destination: MockDestination }): Hotel {
  return hotelSchema.parse({
    id: row.id,
    name: row.name,
    source: 'mock',
    description: row.description,
    address: row.address,
    city: row.destination.name,
    countryCode: row.destination.countryCode,
    starRating: row.starRating,
    reviewScore: row.reviewScore,
    reviewCount: row.reviewCount,
    neighbourhood: row.neighbourhood,
    propertyType: row.propertyType,
    ...(row.beachDistanceMeters === null ? {} : { beachDistanceMeters: row.beachDistanceMeters }),
    ...(row.latitude === null ? {} : { latitude: row.latitude }),
    ...(row.longitude === null ? {} : { longitude: row.longitude }),
    images: row.images,
    facilities: row.facilities,
    badges: row.badges,
  });
}

function inventoryFailure(error: unknown): never {
  if (error instanceof DomainError) throw error;
  throw new DomainError(
    'MOCK_INVENTORY_UNAVAILABLE',
    'Preview inventory is unavailable. Check the database connection and migrations.',
    503,
  );
}

export function rejectMockBooking(): never {
  throw new DomainError(
    'MOCK_BOOKING_DISABLED',
    'Preview hotels cannot be booked or paid for.',
    409,
  );
}

@Injectable()
export class MockHotelSupplier implements HotelSupplier {
  readonly name = 'MOCK';

  constructor(
    private readonly config: ConfigService<Environment, true>,
    private readonly database: DatabaseService,
  ) {
    if (
      config.get('HOTEL_DATA_MODE', { infer: true }) !== 'mock' ||
      config.get('NODE_ENV', { infer: true }) === 'production'
    ) {
      throw new Error('Mock hotel data requires explicitly enabled non-production preview mode.');
    }
  }

  async getDestinations() {
    try {
      const destinations = await this.database.mockDestination.findMany({
        select: { id: true, name: true, countryCode: true },
        orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      });
      if (!destinations.length) this.notSeeded();
      return hotelDestinationsResponseSchema.parse({ source: 'mock', destinations });
    } catch (error) {
      return inventoryFailure(error);
    }
  }

  async destinationName(destination: string): Promise<string> {
    return (await this.findDestination(destination))?.name ?? destination;
  }

  async searchHotels(input: HotelSearchRequest): Promise<SupplierSearchResult[]> {
    const error = validateStay(
      input.checkIn,
      input.checkOut,
      this.config.get('MAX_STAY_NIGHTS', { infer: true }),
    );
    if (error) throw new DomainError('INVALID_STAY', error, 400);
    const destination = await this.findDestination(input.destination);
    if (!destination) return [];
    let entries;
    try {
      entries = await this.database.mockHotel.findMany({
        where: { destinationId: destination.id },
        include: {
          destination: true,
          rates: {
            where: { currency: input.currency },
            orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
          },
        },
        orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      });
    } catch (error) {
      return inventoryFailure(error);
    }
    const nights = (Date.parse(input.checkOut) - Date.parse(input.checkIn)) / 86_400_000;
    const hasChildren = input.rooms.some((room) => room.childrenAges.length > 0);
    const today = new Date().toISOString().slice(0, 10);
    // Season, occupancy and every night of the requested stay determine fixture prices.
    let seasonalNights = 0;
    for (let day = 0; day < nights; day += 1) {
      const date = new Date(Date.parse(input.checkIn) + day * 86_400_000);
      const highSeason =
        destination.countryCode === 'AE'
          ? [10, 11, 0, 1, 2].includes(date.getUTCMonth())
          : [5, 6, 7].includes(date.getUTCMonth());
      seasonalNights += 100 + (highSeason ? 18 : 0) + ([5, 6].includes(date.getUTCDay()) ? 8 : 0);
    }
    const occupancyUnits = input.rooms.reduce(
      (total, room) =>
        total +
        100 +
        Math.max(0, room.adults - 2) * 25 +
        room.childrenAges.reduce((sum, age) => sum + (age < 3 ? 0 : age < 12 ? 12 : 20), 0),
      0,
    );
    const queryId = createHash('sha256')
      .update(
        JSON.stringify({
          checkIn: input.checkIn,
          checkOut: input.checkOut,
          rooms: input.rooms,
          currency: input.currency,
        }),
      )
      .digest('hex')
      .slice(0, 16);
    try {
      return entries
        .filter((entry) => !hasChildren || !entry.facilities.includes('Adults only'))
        .map((entry) => {
          const hotel = toHotel(entry);
          const rates: SupplierRate[] = entry.rates.map((stored) => {
            const variant = storedRateSchema.parse(stored);
            const rooms = input.rooms.map((room) =>
              room.adults > 2 || room.childrenAges.length
                ? 'Family room with balcony'
                : variant.roomName,
            );
            const baseAmount = Number(
              (BigInt(variant.nightlyBaseAmount) * BigInt(seasonalNights) * BigInt(occupancyUnits) +
                5000n) /
                10000n,
            );
            const taxAmount = Number(
              (BigInt(baseAmount) * BigInt(variant.taxBasisPoints) + 5000n) / 10000n,
            );
            if (
              !Number.isSafeInteger(baseAmount + taxAmount) ||
              baseAmount + taxAmount > 2_000_000_000
            )
              throw new DomainError(
                'INVALID_PRICE',
                'The preview price is outside supported bounds.',
                400,
              );
            const cancellationFrom = new Date(
              Date.parse(input.checkIn) - variant.cancellationLeadDays * 86_400_000,
            )
              .toISOString()
              .slice(0, 10);
            const refundable = variant.refundable && cancellationFrom > today;
            return {
              hotelId: hotel.id,
              supplierRateId: `mock:${variant.id}:${queryId}`,
              roomName: rooms.join(' + '),
              mealType: variant.mealType,
              refundable,
              price: { currency: input.currency, baseAmount, taxAmount, feeAmount: 0 },
              cancellationPolicies: [
                {
                  chargeType: 'percentage',
                  percentageBasisPoints: 10_000,
                  from: variant.refundable ? `${cancellationFrom}T14:00:00` : `${today}T00:00:00`,
                  timeBasis: 'property-local',
                },
              ],
              terms: {
                roomNames: rooms,
                amenities: ['Air conditioning', 'Private bathroom', 'Free WiFi'],
                promotions: [],
                rateConditions: [
                  'Fictional preview inventory. No reservation or payment can be made.',
                ],
                supplements: [],
              },
            };
          });
          return { hotel, rates };
        });
    } catch (error) {
      return inventoryFailure(error);
    }
  }

  async getHotelDetails(hotelId: string): Promise<Hotel> {
    try {
      const entry = await this.database.mockHotel.findUnique({
        where: { id: hotelId },
        include: { destination: true },
      });
      if (!entry) throw new DomainError('HOTEL_NOT_FOUND', 'The hotel could not be found.', 404);
      return toHotel(entry);
    } catch (error) {
      return inventoryFailure(error);
    }
  }

  async getAvailability(hotelId: string, input: HotelSearchRequest): Promise<SupplierRate[]> {
    return (await this.searchHotels(input)).find(({ hotel }) => hotel.id === hotelId)?.rates ?? [];
  }

  async recheckPrice(): Promise<never> {
    return rejectMockBooking();
  }
  async createBooking(): Promise<never> {
    return rejectMockBooking();
  }
  async getBooking(): Promise<never> {
    return rejectMockBooking();
  }
  async cancelBooking(): Promise<never> {
    return rejectMockBooking();
  }

  private async findDestination(input: string): Promise<MockDestination | null> {
    const value = input.trim().toLowerCase();
    try {
      const destination = await this.database.mockDestination.findFirst({
        where: { OR: [{ id: value }, { aliases: { has: value } }] },
        orderBy: { id: 'asc' },
      });
      if (!destination && (await this.database.mockDestination.count()) === 0) this.notSeeded();
      return destination;
    } catch (error) {
      return inventoryFailure(error);
    }
  }

  private notSeeded(): never {
    throw new DomainError(
      'MOCK_INVENTORY_NOT_SEEDED',
      'Preview inventory has not been seeded. Run the mock database setup.',
      503,
    );
  }
}
