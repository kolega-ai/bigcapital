/**
 * Configuration validation utilities for secure parsing of environment variables
 */

import { isEmpty } from 'lodash';

export interface IntegerValidationOptions {
  min: number;
  max: number;
  default: number;
}

/**
 * Parses and validates an integer environment variable with bounds checking
 * @param value - The environment variable value to parse
 * @param options - Validation options including min, max, and default values
 * @param varName - The environment variable name for error messages
 * @returns A valid integer within the specified bounds
 * @throws Error if the value is invalid or outside bounds
 */
export function parseIntWithValidation(
  value: string | undefined,
  options: IntegerValidationOptions,
  varName: string
): number {
  const { min, max, default: defaultValue } = options;

  // If no value provided or empty string, use default
  if (isEmpty(value)) {
    return defaultValue;
  }

  // Parse the value
  const parsed = parseInt(value!, 10);

  // Check for NaN (invalid input)
  if (isNaN(parsed)) {
    throw new Error(
      `Invalid configuration: ${varName} must be a valid integer. Received: "${value}"`
    );
  }

  // Check minimum bound
  if (parsed < min) {
    throw new Error(
      `Invalid configuration: ${varName} must be at least ${min}. Received: ${parsed}`
    );
  }

  // Check maximum bound
  if (parsed > max) {
    throw new Error(
      `Invalid configuration: ${varName} must be at most ${max}. Received: ${parsed}`
    );
  }

  return parsed;
}

/**
 * Validates throttle TTL (time to live) values
 * TTL must be between 1 second and 1 hour (1000-3600000ms)
 */
export function parseThrottleTTL(
  value: string | undefined,
  varName: string,
  defaultValue: number = 60000
): number {
  return parseIntWithValidation(
    value,
    {
      min: 1000,      // 1 second minimum
      max: 3600000,   // 1 hour maximum
      default: defaultValue
    },
    varName
  );
}

/**
 * Validates throttle limit values
 * Limit must be between 1 and 10000 requests per TTL window
 */
export function parseThrottleLimit(
  value: string | undefined,
  varName: string,
  defaultValue: number = 100
): number {
  return parseIntWithValidation(
    value,
    {
      min: 1,         // At least 1 request
      max: 10000,     // Maximum 10000 requests
      default: defaultValue
    },
    varName
  );
}