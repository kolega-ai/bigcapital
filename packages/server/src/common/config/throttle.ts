import { registerAs } from '@nestjs/config';
import { parseThrottleTTL, parseThrottleLimit } from '@/utils/config-validators';

export default registerAs('throttle', () => {
  try {
    return {
      global: {
        ttl: parseThrottleTTL(
          process.env.THROTTLE_GLOBAL_TTL,
          'THROTTLE_GLOBAL_TTL',
          60000
        ),
        limit: parseThrottleLimit(
          process.env.THROTTLE_GLOBAL_LIMIT,
          'THROTTLE_GLOBAL_LIMIT',
          100
        ),
      },
      auth: {
        ttl: parseThrottleTTL(
          process.env.THROTTLE_AUTH_TTL,
          'THROTTLE_AUTH_TTL',
          60000
        ),
        limit: parseThrottleLimit(
          process.env.THROTTLE_AUTH_LIMIT,
          'THROTTLE_AUTH_LIMIT',
          10
        ),
      },
    };
  } catch (error) {
    // Fail fast with clear error message for invalid throttle configuration
    console.error('FATAL ERROR: Throttle configuration validation failed');
    console.error(error instanceof Error ? error.message : String(error));
    console.error('Application cannot start with invalid rate limiting configuration');
    process.exit(1);
  }
});


