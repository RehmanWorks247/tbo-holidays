import { describe, expect, it } from 'vitest';

import { validateEnvironment } from './environment';

const infrastructure = {
  DATABASE_URL: 'postgresql://local:local@localhost/test',
  REDIS_URL: 'redis://localhost:6379',
};
describe('environment validation', () => {
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
});
