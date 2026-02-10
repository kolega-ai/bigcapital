import { registerAs } from '@nestjs/config';

export default registerAs('jwt', () => {
  const secret = process.env.APP_JWT_SECRET;
  
  // Validate JWT secret exists
  if (!secret || secret.trim() === '') {
    throw new Error(
      'JWT_SECRET_MISSING: JWT secret is required but not configured. ' +
      'Please set the APP_JWT_SECRET environment variable. ' +
      'Generate a secure secret using: openssl rand -base64 32'
    );
  }

  // Check for common weak patterns first (these are critical regardless of length)
  if (secret === '123123' || secret === 'secret' || secret === 'password' || 
      secret.includes('123123') || secret.includes('secret') || secret.includes('password')) {
    throw new Error(
      'JWT_SECRET_WEAK_PATTERN: JWT secret contains a commonly used weak pattern. ' +
      'Use a cryptographically secure random value. ' +
      'Generate a secure secret using: openssl rand -base64 32'
    );
  }

  // Validate JWT secret length for security
  if (secret.length < 32) {
    throw new Error(
      `JWT_SECRET_TOO_WEAK: JWT secret must be at least 32 characters long for security. ` +
      `Current length: ${secret.length}. ` +
      'Generate a secure secret using: openssl rand -base64 32'
    );
  }

  return {
    secret,
  };
});
