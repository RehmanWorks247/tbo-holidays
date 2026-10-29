-- Trigram indexes support bounded, case-normalized city and hotel typeahead.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE "TboCountry" (
  "scope" VARCHAR(64) NOT NULL,
  "code" VARCHAR(2) NOT NULL,
  "name" VARCHAR(150) NOT NULL,
  "destinationsRefreshedAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TboCountry_pkey" PRIMARY KEY ("scope", "code")
);

CREATE TABLE "TboDestination" (
  "scope" VARCHAR(64) NOT NULL,
  "id" VARCHAR(16) NOT NULL,
  "name" VARCHAR(250) NOT NULL,
  "countryCode" VARCHAR(2) NOT NULL,
  "searchText" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "hotelsRefreshedAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TboDestination_pkey" PRIMARY KEY ("scope", "id"),
  CONSTRAINT "TboDestination_scope_countryCode_fkey" FOREIGN KEY ("scope", "countryCode") REFERENCES "TboCountry"("scope", "code") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "TboHotel" (
  "scope" VARCHAR(64) NOT NULL,
  "id" VARCHAR(16) NOT NULL,
  "destinationId" VARCHAR(16) NOT NULL,
  "name" VARCHAR(500) NOT NULL,
  "searchText" TEXT NOT NULL,
  "content" JSONB NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "refreshedAt" TIMESTAMP(3) NOT NULL,
  "detailsRefreshedAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TboHotel_pkey" PRIMARY KEY ("scope", "id"),
  CONSTRAINT "TboHotel_scope_destinationId_fkey" FOREIGN KEY ("scope", "destinationId") REFERENCES "TboDestination"("scope", "id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "TboDestination_scope_countryCode_active_idx" ON "TboDestination"("scope", "countryCode", "active");
CREATE INDEX "TboDestination_searchText_idx" ON "TboDestination" USING GIN ("searchText" gin_trgm_ops);
CREATE INDEX "TboHotel_scope_destinationId_active_idx" ON "TboHotel"("scope", "destinationId", "active");
CREATE INDEX "TboHotel_searchText_idx" ON "TboHotel" USING GIN ("searchText" gin_trgm_ops);
CREATE INDEX "TboDestination_searchText_prefix_idx" ON "TboDestination"("searchText" text_pattern_ops);
CREATE INDEX "TboHotel_searchText_prefix_idx" ON "TboHotel"("searchText" text_pattern_ops);
