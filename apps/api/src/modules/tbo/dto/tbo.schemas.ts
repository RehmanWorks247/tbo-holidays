import { z } from 'zod';

/** Candidate v2.1 shapes; account fixtures must confirm documented inconsistencies. */
const numericIdentifier = z
  .union([
    z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    z.string().regex(/^\d{1,16}$/),
  ])
  .refine((value) => Number.isSafeInteger(Number(value)), 'Invalid supplier identifier.')
  .transform((value) => String(Number(value)));
export const tboHotelCodeSchema = numericIdentifier.refine((value) => value !== '0');
const roomIndex = numericIdentifier.transform(Number).refine((value) => value > 0);
const text = z.string().max(100_000);
const currency = z.string().regex(/^[A-Z]{3}$/);
const decimal = z.union([
  z
    .number()
    .finite()
    .nonnegative()
    .max(2_000_000_000)
    .refine((value) => /^\d+(?:\.\d+)?$/.test(String(value))),
  z
    .string()
    .max(32)
    .regex(/^\d{1,10}(?:\.\d{1,18})?$/)
    .refine((value) => Number(value) <= 2_000_000_000),
]);

/** Parse a hotel-local wall clock without assigning the execution host's timezone. */
export function tboPolicyLocalDate(value: string): string | undefined {
  const match = /^(\d{2})-(\d{2})-(\d{4}) (\d{2}):(\d{2}):(\d{2})$/.exec(value);
  if (!match) return undefined;
  const [, day, month, year, hour, minute, second] = match;
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  const leap = y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (
    y < 1 ||
    m < 1 ||
    m > 12 ||
    d < 1 ||
    d > (days[m - 1] ?? 0) ||
    Number(hour) > 23 ||
    Number(minute) > 59 ||
    Number(second) > 59
  )
    return undefined;
  return `${year}-${month}-${day}T${hour}:${minute}:${second}`;
}

const policy = z
  .object({
    Index: roomIndex.optional(),
    FromDate: z.string().refine((value) => tboPolicyLocalDate(value) !== undefined),
    ChargeType: z.enum(['Fixed', 'Percentage']),
    CancellationCharge: decimal,
  })
  .superRefine((value, context) => {
    if (
      value.ChargeType === 'Percentage' &&
      (Number(value.CancellationCharge) > 100 ||
        !/^\d+(?:\.\d{1,2}0*)?$/.test(String(value.CancellationCharge)))
    ) {
      context.addIssue({
        code: 'custom',
        path: ['CancellationCharge'],
        message: 'Invalid cancellation percentage.',
      });
    }
  });
const supplement = z.object({
  Index: roomIndex.optional(),
  Type: z.enum(['Included', 'AtProperty']),
  Description: text,
  Price: decimal,
  Currency: currency,
});
const roomShape = {
  Name: z.array(text.trim().min(1)).min(1),
  BookingCode: z.string().min(1).max(4_096),
  RoomID: z.array(numericIdentifier).optional(),
  TotalFare: decimal,
  TotalTax: decimal,
  ExtraGuestCharges: decimal.optional(),
  RecommendedSellingRate: decimal.optional(),
  Inclusion: text.optional(),
  DayRates: z.array(z.array(z.object({ BasePrice: decimal }))).optional(),
  RoomPromotion: z.array(z.union([text, z.array(text)])).optional(),
  Amenities: z.array(text).optional(),
  MealType: text.optional(),
  IsRefundable: z.boolean().optional(),
  WithTransfers: z.boolean().optional(),
  CancelPolicies: z.array(policy).optional(),
  Supplements: z.array(z.union([supplement, z.array(supplement)])).optional(),
};
const roomObject = z.object(roomShape);
type RoomFields = z.infer<typeof roomObject>;
function validateRoomIndexes(room: RoomFields, context: z.RefinementCtx): void {
  for (const [index, value] of (room.CancelPolicies ?? []).entries()) {
    if (value.Index !== undefined && value.Index > room.Name.length) {
      context.addIssue({
        code: 'custom',
        path: ['CancelPolicies', index, 'Index'],
        message: 'Room index is outside the booked combination.',
      });
    }
  }
  for (const [index, value] of (room.Supplements ?? []).entries()) {
    const supplements = Array.isArray(value) ? value : [value];
    if (supplements.some((item) => item.Index !== undefined && item.Index > room.Name.length)) {
      context.addIssue({
        code: 'custom',
        path: ['Supplements', index],
        message: 'Room index is outside the booked combination.',
      });
    }
  }
  if (room.RoomID && room.RoomID.length !== room.Name.length) {
    context.addIssue({
      code: 'custom',
      path: ['RoomID'],
      message: 'Room identifiers must match the room combination.',
    });
  }
}
export const tboRoomSchema = roomObject.superRefine(validateRoomIndexes);
const preBookRoom = roomObject
  .extend({
    IsRefundable: z.boolean(),
    CancelPolicies: z.array(policy),
  })
  .superRefine(validateRoomIndexes)
  .superRefine((room, context) => {
    if (room.IsRefundable && room.CancelPolicies.length === 0) {
      context.addIssue({
        code: 'custom',
        path: ['CancelPolicies'],
        message: 'Refundable rates require cancellation terms.',
      });
    }
  });

export const tboStatusSchema = z.object({
  Status: z.object({ Code: z.number().int(), Description: z.string().optional() }),
});
const successStatus = z.object({ Code: z.literal(200), Description: z.string().optional() });
const hotelRateFields = {
  HotelCode: tboHotelCodeSchema,
  Currency: currency,
  RateConditions: z.array(text).optional(),
  CreditCardBillingOptions: z
    .array(
      z.object({
        Amount: decimal,
        Currency: currency,
        ConvenienceCharges: decimal,
      }),
    )
    .optional(),
};
export const tboSearchResponseSchema = z.union([
  z.object({
    Status: successStatus,
    HotelResult: z.array(z.object({ ...hotelRateFields, Rooms: z.array(tboRoomSchema) })),
  }),
  z.object({
    Status: z.object({ Code: z.literal(201), Description: z.string().optional() }),
    HotelResult: z.array(z.never()).max(0).default([]),
  }),
]);
export const tboPreBookResponseSchema = z.object({
  Status: successStatus,
  HotelResult: z.array(z.object({ ...hotelRateFields, Rooms: z.array(preBookRoom).min(1) })).min(1),
});

const starRating = z.union([
  z.number().int().min(0).max(5),
  z.enum(['OneStar', 'TwoStar', 'ThreeStar', 'FourStar', 'FiveStar']),
]);
const staticHotel = z.object({
  HotelCode: tboHotelCodeSchema,
  HotelName: text.trim().min(1),
  Description: text.optional(),
  Address: text.optional(),
  CityName: text.optional(),
  CountryName: text.optional(),
  CountryCode: z
    .string()
    .regex(/^[A-Z]{2}$/)
    .optional(),
  HotelRating: starRating.optional(),
  Images: z.array(z.string().max(8_192)).optional(),
  HotelFacilities: z.array(text).optional(),
  Attractions: z.union([text, z.array(text), z.record(z.string(), text)]).optional(),
  PinCode: z
    .union([z.string().max(50), z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)])
    .optional(),
  CityId: tboHotelCodeSchema.optional(),
  PhoneNumber: z.string().max(100).optional(),
  FaxNumber: z
    .union([z.string().max(100), z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)])
    .optional(),
  Map: z.string().max(100).optional(),
  CheckInTime: z.string().max(100).optional(),
  CheckOutTime: z.string().max(100).optional(),
  HotelWebsiteURL: z.url().optional(),
  HotelWebsiteUrl: z.url().optional(),
});
export const tboCatalogResponseSchema = z.object({
  Status: successStatus,
  Hotels: z.array(staticHotel),
});
export const tboDetailsResponseSchema = z.object({
  Status: successStatus,
  HotelDetails: z.array(staticHotel),
});

export type TboRoom = z.infer<typeof tboRoomSchema>;
export type TboDetails = z.infer<typeof tboDetailsResponseSchema>['HotelDetails'][number];
export type TboCatalogHotel = z.infer<typeof tboCatalogResponseSchema>['Hotels'][number];
