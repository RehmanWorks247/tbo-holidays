import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';

import type { Environment } from './environment';

/** Only allowlist safe request metadata; query strings can contain guest data. */
export function loggingOptions(level: Environment['LOG_LEVEL']) {
  return {
    level,
    genReqId: (_request: IncomingMessage, response: ServerResponse) => {
      const id = randomUUID();
      response.setHeader('X-Request-Id', id);
      return id;
    },
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'res.headers["set-cookie"]',
        'password',
        'token',
        'secret',
        'authorization',
      ],
      censor: '[REDACTED]',
    },
    serializers: {
      req: (request: { id?: string; method?: string; url?: string }) => ({
        id: request.id,
        method: request.method,
        path: request.url?.split('?')[0],
      }),
      res: (response: { statusCode?: number }) => ({ statusCode: response.statusCode }),
      err: (error: { name?: string }) => ({ type: error.name ?? 'Error' }),
    },
  };
}
