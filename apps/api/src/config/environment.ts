import { z } from 'zod';

const optionalValue = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z.string().min(1).optional(),
);
const booleanValue = z
  .enum(['true', 'false'])
  .default('false')
  .transform((value) => value === 'true');
const environmentSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    HOST: z.string().default('0.0.0.0'),
    HOTEL_DATA_MODE: z.enum(['live', 'mock']).default('live'),
    DATABASE_URL: z
      .url()
      .refine((url) => ['postgres:', 'postgresql:'].includes(new URL(url).protocol)),
    REDIS_URL: z.url().refine((url) => ['redis:', 'rediss:'].includes(new URL(url).protocol)),
    WEB_ORIGIN: z.url().default('http://localhost:3000'),
    CLERK_SECRET_KEY: optionalValue,
    CLERK_JWT_KEY: optionalValue,
    CLERK_AUTHORIZED_PARTIES: z.string().default('http://localhost:3000'),
    TBO_BASE_URL: optionalValue,
    TBO_USERNAME: optionalValue,
    TBO_PASSWORD: optionalValue,
    TBO_READS_ENABLED: booleanValue,
    TBO_TIMEOUT_MS: z.coerce.number().int().min(1000).max(120000).default(30000),
    TBO_MAX_RETRIES: z.coerce.number().int().min(0).max(3).default(2),
    TBO_SEARCH_TIMEOUT_MS: z.coerce.number().int().min(1000).max(110000).default(90000),
    TBO_CATALOG_COUNTRIES: z
      .string()
      .regex(/^[A-Z]{2}(,[A-Z]{2})*$/)
      .default('SA,AE,GB,TR,ID,PK'),
    TBO_CATALOG_WARM_CITIES: z
      .string()
      .regex(/^(?:[1-9]\d{0,15}(?:,[1-9]\d{0,15})*)?$/)
      .default(''),
    TBO_CATALOG_TTL_SECONDS: z.coerce.number().int().min(300).max(604800).default(86400),
    PAYMENT_PROVIDER: z.literal('disabled').default('disabled'),
    JOBS_ENABLED: booleanValue,
    MARKUP_BASIS_POINTS: z.coerce.number().int().min(0).max(10000).default(1000),
    QUOTE_TTL_SECONDS: z.coerce.number().int().min(30).max(900).default(300),
    MAX_STAY_NIGHTS: z.coerce.number().int().min(1).max(90).default(30),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
  })
  .superRefine((env, context) => {
    const issue = (path: string, message: string) =>
      context.addIssue({ code: 'custom', path: [path], message });
    if (env.TBO_READS_ENABLED && (!env.TBO_BASE_URL || !env.TBO_USERNAME || !env.TBO_PASSWORD))
      issue('TBO_READS_ENABLED', 'Enabled supplier reads require a URL and credentials.');
    if (env.TBO_BASE_URL) {
      const parsed = z.url().safeParse(env.TBO_BASE_URL);
      if (!parsed.success || new URL(env.TBO_BASE_URL).protocol !== 'https:') {
        issue('TBO_BASE_URL', 'Supplier credentials require an HTTPS endpoint.');
      } else {
        const endpoint = new URL(env.TBO_BASE_URL);
        if (endpoint.username || endpoint.password || endpoint.search || endpoint.hash)
          issue(
            'TBO_BASE_URL',
            'Supplier endpoints cannot contain credentials, queries or fragments.',
          );
      }
    }
    for (const party of env.CLERK_AUTHORIZED_PARTIES.split(',')) {
      const url = z.url().safeParse(party.trim());
      if (!url.success || !['https:', 'http:'].includes(new URL(party.trim()).protocol))
        issue('CLERK_AUTHORIZED_PARTIES', 'Supply comma-separated HTTP origins.');
    }
    if (env.NODE_ENV === 'production') {
      if (env.HOTEL_DATA_MODE === 'mock')
        issue('HOTEL_DATA_MODE', 'Mock hotel data is forbidden in production.');
      if (!env.CLERK_SECRET_KEY && !env.CLERK_JWT_KEY)
        issue('CLERK_SECRET_KEY', 'Production requires Clerk verification credentials.');
      if (!env.WEB_ORIGIN.startsWith('https://')) issue('WEB_ORIGIN', 'Production requires HTTPS.');
      if (
        env.CLERK_AUTHORIZED_PARTIES.split(',').some(
          (party) => !party.trim().startsWith('https://'),
        )
      )
        issue('CLERK_AUTHORIZED_PARTIES', 'Production requires explicit HTTPS origins.');
    }
    if (env.HOTEL_DATA_MODE === 'mock' && (env.TBO_READS_ENABLED || env.JOBS_ENABLED))
      issue('HOTEL_DATA_MODE', 'Mock hotel data cannot enable supplier reads or background jobs.');
  });

export type Environment = z.infer<typeof environmentSchema>;

export function validateEnvironment(input: Record<string, unknown>): Environment {
  const result = environmentSchema.safeParse(input);
  if (!result.success) {
    // Never include the supplied values; config can contain passwords and tokens.
    throw new Error(
      `Invalid environment: ${result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ')}`,
    );
  }
  return result.data;
}
