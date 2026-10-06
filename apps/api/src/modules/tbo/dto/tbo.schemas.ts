import { z } from 'zod';

/** Candidate REST shapes. Validate against the agency's signed specification before enabling reads. */
const code = z.union([z.string(), z.number()]).transform(String);
const decimal = z.union([z.number().finite().nonnegative(), z.string().regex(/^\d+(?:\.\d+)?$/)]);

export const tboStatusSchema = z.object({
  Status: z.object({ Code: z.number().int(), Description: z.string().optional() }),
});

export const tboRoomSchema = z.object({
  Name: z.array(z.string()).min(1),
  BookingCode: z.string().min(1),
  TotalFare: decimal,
  TotalTax: decimal,
  MealType: z.string().optional(),
  IsRefundable: z.boolean().optional(),
});

export const tboSearchResponseSchema = tboStatusSchema.extend({
  HotelResult: z
    .array(
      z.object({
        HotelCode: code,
        Currency: z.string().regex(/^[A-Z]{3}$/),
        Rooms: z.array(tboRoomSchema),
      }),
    )
    .default([]),
});

export const tboCatalogResponseSchema = tboStatusSchema.extend({
  Hotels: z.array(
    z.object({
      HotelCode: code,
      HotelName: z.string().min(1),
      Address: z.string().optional(),
      CityName: z.string().optional(),
      CountryCode: z.string().optional(),
    }),
  ),
});

export const tboDetailsResponseSchema = tboStatusSchema.extend({
  HotelDetails: z.array(
    z.object({
      HotelCode: code,
      HotelName: z.string().min(1),
      Description: z.string().optional(),
      Address: z.string().optional(),
      CityName: z.string().optional(),
      CountryCode: z.string().optional(),
      Images: z.array(z.string()).default([]),
      HotelFacilities: z.array(z.string()).default([]),
    }),
  ),
});

export type TboRoom = z.infer<typeof tboRoomSchema>;
export type TboDetails = z.infer<typeof tboDetailsResponseSchema>['HotelDetails'][number];
export type TboCatalogHotel = z.infer<typeof tboCatalogResponseSchema>['Hotels'][number];
