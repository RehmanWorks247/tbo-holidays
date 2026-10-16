import type { PrismaClient } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';

import {
  assertMockSeedAllowed,
  buildMockSeedRecords,
  prepareMockHotelInventory,
} from './mock-hotel.seed';

const local = {
  nodeEnv: 'development',
  mode: 'mock',
  databaseUrl: 'postgresql://preview:preview@localhost:54329/hotel_platform',
};

describe('mock database seed protection', () => {
  it('allows explicit local development/test targets and rejects production, remote and implicit mode', () => {
    expect(() => assertMockSeedAllowed(local)).not.toThrow();
    expect(() => assertMockSeedAllowed({ ...local, nodeEnv: 'test' })).not.toThrow();
    for (const invalid of [
      { nodeEnv: 'production' },
      { nodeEnv: undefined },
      { mode: 'live' },
      { databaseUrl: 'postgresql://private:secret@db.example.test/hotel_platform' },
      { databaseUrl: 'postgresql://private:secret@localhost/hotel_production' },
      { databaseUrl: undefined },
      { idPrefix: 'unscoped-' },
    ]) {
      expect(() => assertMockSeedAllowed({ ...local, ...invalid })).toThrow();
    }
  });

  it('rejects unsafe prepare targets before any migration process or database write', async () => {
    const deploy = vi.fn();
    const transaction = vi.fn();
    await expect(
      prepareMockHotelInventory(
        { $transaction: transaction } as unknown as PrismaClient,
        { ...local, nodeEnv: 'production' },
        deploy,
      ),
    ).rejects.toThrow('explicit');
    expect(deploy).not.toHaveBeenCalled();
    expect(transaction).not.toHaveBeenCalled();
  });

  it('produces normalized deterministic IDs and six currency offers per meal plan', () => {
    const records = buildMockSeedRecords();
    expect(records.destinations).toHaveLength(4);
    expect(records.hotels).toHaveLength(36);
    expect(new Set(records.rates.map(({ id }) => id)).size).toBe(records.rates.length);
    expect(
      records.rates.every((rate) => records.hotels.some(({ id }) => id === rate.hotelId)),
    ).toBe(true);
    const first = records.rates.filter(({ hotelId }) => hotelId === records.hotels[0]?.id);
    expect(new Set(first.map(({ currency }) => currency)).size).toBe(6);
    expect(
      first.every(
        ({ nightlyBaseAmount }) => Number.isSafeInteger(nightlyBaseAmount) && nightlyBaseAmount > 0,
      ),
    ).toBe(true);
  });
});
