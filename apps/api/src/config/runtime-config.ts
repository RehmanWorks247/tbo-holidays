import { ConfigModule } from '@nestjs/config';

import { validateEnvironment } from './environment';

/** Load and validate one environment before choosing the application runtime. */
export const runtimeConfig = ConfigModule.forRoot({
  isGlobal: true,
  cache: true,
  envFilePath: ['../../.env', '.env'],
  validate: validateEnvironment,
});
