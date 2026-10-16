import { describe, expect, it } from 'vitest';

import { validateEnvironment } from './environment';

const infrastructure = {
  DATABASE_URL: 'postgresql://local:local@localhost/test',
  REDIS_URL: 'redis://localhost:6379',
};
describe('environment validation', () => {
  it('defaults to live and rejects production or externally active mock mode', () => {
    expect(validateEnvironment(infrastructure).HOTEL_DATA_MODE).toBe('live');
    expect(
      validateEnvironment({ ...infrastructure, HOTEL_DATA_MODE: 'mock' }).HOTEL_DATA_MODE,
    ).toBe('mock');
    expect(() =>
      validateEnvironment({ ...infrastructure, HOTEL_DATA_MODE: 'mock', NODE_ENV: 'production' }),
    ).toThrow('forbidden in production');
    expect(() =>
      validateEnvironment({ ...infrastructure, HOTEL_DATA_MODE: 'mock', JOBS_ENABLED: 'true' }),
    ).toThrow('cannot enable');
  });
  it('allows public local development but never turns string false into true', () => {
    const config = validateEnvironment({
      ...infrastructure,
      JOBS_ENABLED: 'false',
      TBO_READS_ENABLED: 'false',
    });
    expect(config.JOBS_ENABLED).toBe(false);
    expect(config.TBO_READS_ENABLED).toBe(false);
  });
  it('rejects unconfigured production authentication and insecure supplier transports', () => {
    expect(() => validateEnvironment({ ...infrastructure, NODE_ENV: 'production' })).toThrow(
      'Production requires',
    );
    expect(() =>
      validateEnvironment({ ...infrastructure, TBO_BASE_URL: 'http://supplier.test' }),
    ).toThrow('HTTPS');
    expect(() => validateEnvironment({ ...infrastructure, TBO_READS_ENABLED: 'true' })).toThrow(
      'credentials',
    );
  });
  it('never repeats supplied secret values in validation errors', () => {
    try {
      validateEnvironment({ ...infrastructure, DATABASE_URL: 'confidential-connection-value' });
    } catch (error) {
      expect(String(error)).not.toContain('confidential-connection-value');
    }
  });
  it('accepts an assigned HTTPS base path but rejects credentials or parameters in the URL', () => {
    expect(
      validateEnvironment({
        ...infrastructure,
        TBO_BASE_URL: 'https://supplier.example.test/HotelAPI/',
      }).TBO_BASE_URL,
    ).toBe('https://supplier.example.test/HotelAPI/');
    for (const value of [
      'https://user:private-value@supplier.example.test/HotelAPI',
      'https://supplier.example.test/HotelAPI?token=private-value',
      'https://supplier.example.test/HotelAPI#private-value',
    ]) {
      expect(() => validateEnvironment({ ...infrastructure, TBO_BASE_URL: value })).toThrow(
        'Supplier endpoints cannot contain',
      );
      try {
        validateEnvironment({ ...infrastructure, TBO_BASE_URL: value });
      } catch (error) {
        expect(String(error)).not.toContain('private-value');
      }
    }
  });
});
