-- Isolated, non-bookable development catalogue. No existing tables are modified.
CREATE TABLE "MockDestination" (
  "id" VARCHAR(100) NOT NULL,
  "name" VARCHAR(100) NOT NULL,
  "countryCode" VARCHAR(2) NOT NULL,
  "aliases" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MockDestination_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MockDestination_countryCode_check" CHECK ("countryCode" ~ '^[A-Z]{2}$'),
  CONSTRAINT "MockDestination_sortOrder_check" CHECK ("sortOrder" >= 0)
);

CREATE TABLE "MockHotel" (
  "id" VARCHAR(100) NOT NULL,
  "destinationId" VARCHAR(100) NOT NULL,
  "name" VARCHAR(150) NOT NULL,
  "description" TEXT NOT NULL,
  "address" VARCHAR(250) NOT NULL,
  "starRating" INTEGER NOT NULL,
  "reviewScore" DOUBLE PRECISION NOT NULL,
  "reviewCount" INTEGER NOT NULL,
  "neighbourhood" VARCHAR(100) NOT NULL,
  "propertyType" VARCHAR(50) NOT NULL,
  "beachDistanceMeters" INTEGER,
  "latitude" DOUBLE PRECISION,
  "longitude" DOUBLE PRECISION,
  "images" TEXT[] NOT NULL,
  "facilities" TEXT[] NOT NULL,
  "badges" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MockHotel_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MockHotel_starRating_check" CHECK ("starRating" BETWEEN 1 AND 5),
  CONSTRAINT "MockHotel_reviewScore_check" CHECK ("reviewScore" BETWEEN 0 AND 10),
  CONSTRAINT "MockHotel_reviewCount_check" CHECK ("reviewCount" >= 0),
  CONSTRAINT "MockHotel_beachDistanceMeters_check" CHECK ("beachDistanceMeters" IS NULL OR "beachDistanceMeters" >= 0),
  CONSTRAINT "MockHotel_latitude_check" CHECK ("latitude" IS NULL OR "latitude" BETWEEN -90 AND 90),
  CONSTRAINT "MockHotel_longitude_check" CHECK ("longitude" IS NULL OR "longitude" BETWEEN -180 AND 180),
  CONSTRAINT "MockHotel_sortOrder_check" CHECK ("sortOrder" >= 0)
);

CREATE TABLE "MockRate" (
  "id" VARCHAR(150) NOT NULL,
  "hotelId" VARCHAR(100) NOT NULL,
  "currency" VARCHAR(3) NOT NULL,
  "mealType" VARCHAR(50) NOT NULL,
  "roomName" VARCHAR(100) NOT NULL,
  "nightlyBaseAmount" INTEGER NOT NULL,
  "taxBasisPoints" INTEGER NOT NULL DEFAULT 1000,
  "refundable" BOOLEAN NOT NULL,
  "cancellationLeadDays" INTEGER NOT NULL DEFAULT 3,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MockRate_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MockRate_currency_check" CHECK ("currency" IN ('USD', 'EUR', 'GBP', 'AED', 'PKR', 'INR')),
  CONSTRAINT "MockRate_nightlyBaseAmount_check" CHECK ("nightlyBaseAmount" BETWEEN 0 AND 2000000000),
  CONSTRAINT "MockRate_taxBasisPoints_check" CHECK ("taxBasisPoints" BETWEEN 0 AND 10000),
  CONSTRAINT "MockRate_cancellationLeadDays_check" CHECK ("cancellationLeadDays" BETWEEN 0 AND 90),
  CONSTRAINT "MockRate_sortOrder_check" CHECK ("sortOrder" >= 0)
);

CREATE INDEX "MockDestination_aliases_idx" ON "MockDestination" USING GIN ("aliases");
CREATE INDEX "MockHotel_destinationId_sortOrder_idx" ON "MockHotel"("destinationId", "sortOrder");
CREATE UNIQUE INDEX "MockRate_hotelId_currency_mealType_key" ON "MockRate"("hotelId", "currency", "mealType");
CREATE INDEX "MockRate_hotelId_currency_sortOrder_idx" ON "MockRate"("hotelId", "currency", "sortOrder");
ALTER TABLE "MockHotel" ADD CONSTRAINT "MockHotel_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "MockDestination"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MockRate" ADD CONSTRAINT "MockRate_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "MockHotel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
