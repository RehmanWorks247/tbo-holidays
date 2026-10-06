import { defineConfig } from 'vitest/config';

import config from './vitest.config';

export default defineConfig({
  ...config,
  test: {
    ...config.test,
    include: ['test/**/*.integration.test.ts'],
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
});
