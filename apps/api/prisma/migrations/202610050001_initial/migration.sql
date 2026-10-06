-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('BOOKING_PENDING', 'BOOKING_PROCESSING', 'BOOKING_CONFIRMED', 'BOOKING_FAILED', 'BOOKING_CANCELLED', 'RECONCILIATION_REQUIRED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PAYMENT_PENDING', 'PAYMENT_SUCCEEDED', 'PAYMENT_FAILED', 'REFUND_PENDING', 'REFUNDED');

-- CreateEnum
CREATE TYPE "GuestType" AS ENUM ('ADULT', 'CHILD');

-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "OutboxKind" AS ENUM ('BOOKING_FULFILLMENT', 'BOOKING_STATUS_CHECK', 'BOOKING_CONFIRMATION_EMAIL', 'PAYMENT_RECONCILIATION', 'REFUND_PROCESSING');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "clerkId" TEXT NOT NULL,
    "email" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerProfile" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "nationality" VARCHAR(2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceQuote" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "supplier" TEXT NOT NULL,
    "supplierRateId" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "hotelName" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "roomName" TEXT NOT NULL,
    "checkIn" DATE NOT NULL,
    "checkOut" DATE NOT NULL,
    "occupancy" JSONB NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "baseAmount" INTEGER NOT NULL,
    "taxAmount" INTEGER NOT NULL,
    "feeAmount" INTEGER NOT NULL,
    "markupAmount" INTEGER NOT NULL,
    "discountAmount" INTEGER NOT NULL,
    "totalAmount" INTEGER NOT NULL,
    "pricingSnapshot" JSONB NOT NULL,
    "policySnapshot" JSONB NOT NULL,
    "supplierMetadata" JSONB NOT NULL DEFAULT '{}',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceQuote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "quoteId" UUID NOT NULL,
    "idempotencyKey" VARCHAR(128) NOT NULL,
    "requestHash" VARCHAR(64) NOT NULL,
    "supplier" TEXT NOT NULL,
    "supplierBookingId" TEXT,
    "confirmationNumber" TEXT,
    "hotelCode" TEXT NOT NULL,
    "hotelName" TEXT NOT NULL,
    "checkIn" DATE NOT NULL,
    "checkOut" DATE NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "baseAmount" INTEGER NOT NULL,
    "taxAmount" INTEGER NOT NULL,
    "feeAmount" INTEGER NOT NULL,
    "markupAmount" INTEGER NOT NULL,
    "discountAmount" INTEGER NOT NULL,
    "totalAmount" INTEGER NOT NULL,
    "pricingSnapshot" JSONB NOT NULL,
    "policySnapshot" JSONB NOT NULL,
    "customerSnapshot" JSONB,
    "occupancySnapshot" JSONB NOT NULL,
    "bookingStatus" "BookingStatus" NOT NULL DEFAULT 'BOOKING_PENDING',
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PAYMENT_PENDING',
    "guestsCapturedAt" TIMESTAMP(3),
    "supplierAttemptedAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "failureCode" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingGuest" (
    "id" UUID NOT NULL,
    "bookingId" UUID NOT NULL,
    "roomIndex" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "type" "GuestType" NOT NULL,
    "age" INTEGER,
    "leadGuest" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "BookingGuest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingRoom" (
    "id" UUID NOT NULL,
    "bookingId" UUID NOT NULL,
    "roomIndex" INTEGER NOT NULL,
    "roomCode" TEXT NOT NULL,
    "roomName" TEXT NOT NULL,
    "adults" INTEGER NOT NULL,
    "childrenAges" JSONB NOT NULL,

    CONSTRAINT "BookingRoom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" UUID NOT NULL,
    "bookingId" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "providerPaymentId" TEXT,
    "idempotencyKey" VARCHAR(128) NOT NULL,
    "requestHash" VARCHAR(64) NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PAYMENT_PENDING',
    "checkoutUrl" TEXT,
    "checkoutExpiresAt" TIMESTAMP(3),
    "requiresReconciliation" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentEvent" (
    "id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "providerEventId" TEXT NOT NULL,
    "paymentId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "payloadHash" VARCHAR(64) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Refund" (
    "id" UUID NOT NULL,
    "bookingId" UUID NOT NULL,
    "paymentId" UUID NOT NULL,
    "providerRefundId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "RefundStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Refund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HotelFavorite" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "supplier" TEXT NOT NULL,
    "hotelCode" TEXT NOT NULL,
    "hotelName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HotelFavorite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" UUID NOT NULL,
    "userId" UUID,
    "bookingId" UUID,
    "action" TEXT NOT NULL,
    "requestId" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutboxEvent" (
    "id" UUID NOT NULL,
    "kind" "OutboxKind" NOT NULL,
    "aggregateId" UUID NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,

    CONSTRAINT "OutboxEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_clerkId_key" ON "User"("clerkId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerProfile_userId_key" ON "CustomerProfile"("userId");

-- CreateIndex
CREATE INDEX "PriceQuote_userId_expiresAt_idx" ON "PriceQuote"("userId", "expiresAt");

-- CreateIndex
CREATE INDEX "PriceQuote_expiresAt_idx" ON "PriceQuote"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_quoteId_key" ON "Booking"("quoteId");

-- CreateIndex
CREATE INDEX "Booking_userId_createdAt_idx" ON "Booking"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Booking_bookingStatus_updatedAt_idx" ON "Booking"("bookingStatus", "updatedAt");

-- CreateIndex
CREATE INDEX "Booking_paymentStatus_updatedAt_idx" ON "Booking"("paymentStatus", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_userId_idempotencyKey_key" ON "Booking"("userId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_supplier_supplierBookingId_key" ON "Booking"("supplier", "supplierBookingId");

-- CreateIndex
CREATE INDEX "BookingGuest_bookingId_roomIndex_idx" ON "BookingGuest"("bookingId", "roomIndex");

-- CreateIndex
CREATE UNIQUE INDEX "BookingRoom_bookingId_roomIndex_key" ON "BookingRoom"("bookingId", "roomIndex");

-- CreateIndex
CREATE INDEX "Payment_status_updatedAt_idx" ON "Payment"("status", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_bookingId_key" ON "Payment"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_provider_providerPaymentId_key" ON "Payment"("provider", "providerPaymentId");

-- CreateIndex
CREATE INDEX "PaymentEvent_paymentId_receivedAt_idx" ON "PaymentEvent"("paymentId", "receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentEvent_provider_providerEventId_key" ON "PaymentEvent"("provider", "providerEventId");

-- CreateIndex
CREATE UNIQUE INDEX "Refund_idempotencyKey_key" ON "Refund"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Refund_status_updatedAt_idx" ON "Refund"("status", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "HotelFavorite_userId_supplier_hotelCode_key" ON "HotelFavorite"("userId", "supplier", "hotelCode");

-- CreateIndex
CREATE INDEX "AuditLog_bookingId_createdAt_idx" ON "AuditLog"("bookingId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_userId_createdAt_idx" ON "AuditLog"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "OutboxEvent_dedupeKey_key" ON "OutboxEvent"("dedupeKey");

-- CreateIndex
CREATE INDEX "OutboxEvent_completedAt_availableAt_idx" ON "OutboxEvent"("completedAt", "availableAt");

-- AddForeignKey
ALTER TABLE "CustomerProfile" ADD CONSTRAINT "CustomerProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceQuote" ADD CONSTRAINT "PriceQuote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "PriceQuote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingGuest" ADD CONSTRAINT "BookingGuest_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingRoom" ADD CONSTRAINT "BookingRoom_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentEvent" ADD CONSTRAINT "PaymentEvent_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HotelFavorite" ADD CONSTRAINT "HotelFavorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Preserve the monetary and occupancy invariants even for writes outside Prisma.
-- Prisma does not currently express CHECK constraints; retain these in migrations.
ALTER TABLE "PriceQuote" ADD CONSTRAINT "PriceQuote_money_valid" CHECK (
  "baseAmount" >= 0 AND "taxAmount" >= 0 AND "feeAmount" >= 0 AND
  "markupAmount" >= 0 AND "discountAmount" >= 0 AND "totalAmount" >= 0 AND
  "totalAmount"::bigint = "baseAmount"::bigint + "taxAmount" + "feeAmount" + "markupAmount" - "discountAmount" AND
  "currency" ~ '^[A-Z]{3}$'
);
ALTER TABLE "PriceQuote" ADD CONSTRAINT "PriceQuote_stay_valid" CHECK ("checkOut" > "checkIn");
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_money_valid" CHECK (
  "baseAmount" >= 0 AND "taxAmount" >= 0 AND "feeAmount" >= 0 AND
  "markupAmount" >= 0 AND "discountAmount" >= 0 AND "totalAmount" >= 0 AND
  "totalAmount"::bigint = "baseAmount"::bigint + "taxAmount" + "feeAmount" + "markupAmount" - "discountAmount" AND
  "currency" ~ '^[A-Z]{3}$'
);
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_stay_valid" CHECK ("checkOut" > "checkIn");
ALTER TABLE "BookingGuest" ADD CONSTRAINT "BookingGuest_age_valid" CHECK (
  ("type" = 'CHILD' AND "age" IS NOT NULL AND "age" BETWEEN 0 AND 17) OR
  ("type" = 'ADULT' AND ("age" IS NULL OR "age" BETWEEN 18 AND 120))
);
ALTER TABLE "BookingGuest" ADD CONSTRAINT "BookingGuest_room_valid" CHECK ("roomIndex" >= 0);
ALTER TABLE "BookingGuest" ADD CONSTRAINT "BookingGuest_lead_valid" CHECK (NOT "leadGuest" OR "type" = 'ADULT');
CREATE UNIQUE INDEX "BookingGuest_one_lead_per_booking" ON "BookingGuest" ("bookingId") WHERE "leadGuest";
ALTER TABLE "BookingRoom" ADD CONSTRAINT "BookingRoom_occupancy_valid" CHECK ("roomIndex" >= 0 AND "adults" BETWEEN 1 AND 8);
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_money_valid" CHECK ("amount" >= 0 AND "currency" ~ '^[A-Z]{3}$');
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_money_valid" CHECK ("amount" >= 0 AND "currency" ~ '^[A-Z]{3}$');
