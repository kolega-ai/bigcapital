import { registerAs } from '@nestjs/config';

/**
 * Redis configuration with security validation
 * Enforces authentication in production environments
 */
export default registerAs('redis', () => {
  const isProduction = process.env.NODE_ENV === 'production';
  const host = process.env.REDIS_HOST || 'localhost';
  const port = parseInt(process.env.REDIS_PORT, 10) || 6379;
  const password = process.env.REDIS_PASSWORD;
  const db = parseInt(process.env.REDIS_DB, 10) || 0;
  const tlsEnabled = process.env.REDIS_TLS_ENABLED === 'true';
  const connectTimeout = parseInt(process.env.REDIS_CONNECT_TIMEOUT, 10) || 10000;
  const maxRetries = parseInt(process.env.REDIS_MAX_RETRIES, 10) || 3;

  // Security validation: Require password in production
  if (isProduction && (!password || password.length < 16)) {
    throw new Error(
      'REDIS_PASSWORD is required in production environments and must be at least 16 characters long. ' +
      'Generate a secure password using: openssl rand -base64 32'
    );
  }

  // Validate port range
  if (port < 1 || port > 65535) {
    throw new Error(`Invalid REDIS_PORT: ${port}. Must be between 1 and 65535.`);
  }

  // Validate database number
  if (db < 0 || db > 15) {
    throw new Error(`Invalid REDIS_DB: ${db}. Must be between 0 and 15.`);
  }

  // Build Redis configuration
  const config = {
    host,
    port,
    password: password || undefined,
    db,
    tls: tlsEnabled,
    connectTimeout,
    maxRetriesPerRequest: maxRetries,
    // Enable ready check for connection validation
    enableReadyCheck: true,
    // Enable offline queue to buffer commands during disconnection
    enableOfflineQueue: true,
    // Retry strategy with exponential backoff
    retryStrategy: (times: number) => {
      if (times > maxRetries) {
        return null; // Stop retrying
      }
      return Math.min(times * 100, 3000); // Exponential backoff, max 3s
    },
    // Connection metadata for debugging
    meta: {
      environment: process.env.NODE_ENV || 'development',
      authEnabled: !!password,
      tlsEnabled,
    },
  };

  // Log configuration (without sensitive data)
  const logConfig = {
    host: config.host,
    port: config.port,
    db: config.db,
    tls: config.tls,
    authEnabled: config.meta.authEnabled,
    environment: config.meta.environment,
  };
  
  console.log('[Redis Config] Initialized with:', logConfig);

  return config;
});
