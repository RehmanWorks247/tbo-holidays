import baseConfig from '@hotel/eslint-config';
import nextVitals from 'eslint-config-next/core-web-vitals';

const config = [
  ...baseConfig,
  ...nextVitals,
  {
    // React Hook Form owns field subscriptions; watch/getValues are intentional here.
    rules: { 'react-hooks/incompatible-library': 'off' },
  },
];

export default config;
