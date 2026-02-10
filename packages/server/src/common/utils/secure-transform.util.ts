import { isPlainObject, isArray, isString } from 'lodash';

export interface SecureTransformOptions {
  maxDepth?: number;
  maxKeys?: number;
  keyTransformer?: (key: string) => string;
  allowedKeyPattern?: RegExp;
  sanitizeStrings?: boolean;
}

/**
 * Comprehensive list of dangerous property names that could lead to prototype pollution
 * or other security vulnerabilities
 */
const DANGEROUS_KEYS = new Set([
  // Prototype pollution vectors
  '__proto__',
  'constructor',
  'prototype',
  
  // Object methods that could be dangerous
  '__defineGetter__',
  '__defineSetter__',
  '__lookupGetter__',
  '__lookupSetter__',
  'hasOwnProperty',
  'isPrototypeOf',
  'propertyIsEnumerable',
  'toLocaleString',
  'toString',
  'valueOf',
  
  // Node.js specific dangerous globals
  'require',
  'exports',
  'module',
  'global',
  'process',
  'Buffer',
  
  // Timer functions
  'setTimeout',
  'setInterval',
  'setImmediate',
  'clearTimeout',
  'clearInterval',
  'clearImmediate',
]);

/**
 * Secure object transformer that protects against prototype pollution,
 * object injection, and other unsafe object transformation attacks
 */
export class SecureObjectTransformer {
  private static readonly DEFAULT_OPTIONS: Required<SecureTransformOptions> = {
    maxDepth: 10,
    maxKeys: 1000,
    keyTransformer: (key: string) => key,
    allowedKeyPattern: /^[\w\-\.@$]+$/,
    sanitizeStrings: false,
  };

  /**
   * Securely transform an object with protection against various attacks
   * @param input - The input object to transform
   * @param options - Configuration options for transformation
   * @param currentDepth - Internal tracking of recursion depth
   * @returns Safely transformed object
   */
  static transform<T = any>(
    input: unknown,
    options: SecureTransformOptions = {},
    currentDepth = 0
  ): T {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };

    // Prevent stack overflow through depth limiting
    if (currentDepth > opts.maxDepth) {
      throw new Error(`Maximum object depth (${opts.maxDepth}) exceeded`);
    }

    // Handle null and undefined
    if (input === null || input === undefined) {
      return input as T;
    }

    // Handle arrays by recursively transforming each element
    if (isArray(input)) {
      return input.map(item => 
        this.transform(item, opts, currentDepth + 1)
      ) as unknown as T;
    }

    // Handle plain objects
    if (isPlainObject(input)) {
      const keys = Object.keys(input);
      
      // Prevent DoS through excessive key count
      if (keys.length > opts.maxKeys) {
        throw new Error(`Maximum key count (${opts.maxKeys}) exceeded`);
      }

      // Create object without prototype to prevent prototype pollution
      const safeObject = Object.create(null);
      let transformedKeyCount = 0;

      for (const key of keys) {
        // Skip dangerous keys that could lead to prototype pollution
        if (this.isDangerousKey(key)) {
          console.warn(`Dangerous key "${key}" filtered out for security`);
          continue;
        }

        // Validate key against allowed pattern
        if (!opts.allowedKeyPattern.test(key)) {
          console.warn(`Key "${key}" does not match allowed pattern`);
          continue;
        }

        // Transform the key using provided transformer
        const transformedKey = opts.keyTransformer(key);
        
        // Double-check transformed key for safety
        if (this.isDangerousKey(transformedKey)) {
          console.warn(`Transformed key "${transformedKey}" is dangerous`);
          continue;
        }

        // Prevent key collision attacks
        if (transformedKey in safeObject) {
          console.warn(`Duplicate key "${transformedKey}" detected, skipping`);
          continue;
        }

        transformedKeyCount++;
        if (transformedKeyCount > opts.maxKeys) {
          throw new Error(`Maximum transformed key count exceeded`);
        }

        // Recursively transform the value
        safeObject[transformedKey] = this.transform(
          (input as any)[key],
          opts,
          currentDepth + 1
        );
      }

      return safeObject as T;
    }

    // Handle strings with optional sanitization
    if (isString(input) && opts.sanitizeStrings) {
      return this.sanitizeString(input as string) as unknown as T;
    }

    // Return primitives and other types as-is
    return input as T;
  }

  /**
   * Check if a key is dangerous and could lead to security vulnerabilities
   * @param key - The property key to check
   * @returns true if the key is dangerous
   */
  private static isDangerousKey(key: string): boolean {
    // Check exact match
    if (DANGEROUS_KEYS.has(key)) {
      return true;
    }

    // Check lowercase variant to catch case variations
    if (DANGEROUS_KEYS.has(key.toLowerCase())) {
      return true;
    }

    // Check for encoded variants (URL encoding, HTML entities, etc.)
    const decodedKey = this.decodeKey(key);
    if (decodedKey !== key && DANGEROUS_KEYS.has(decodedKey)) {
      return true;
    }

    // Check for Unicode normalization attacks
    const normalizedKey = key.normalize('NFD');
    if (normalizedKey !== key && DANGEROUS_KEYS.has(normalizedKey)) {
      return true;
    }

    return false;
  }

  /**
   * Decode potentially encoded keys to detect obfuscated dangerous keys
   * @param key - The key to decode
   * @returns Decoded key
   */
  private static decodeKey(key: string): string {
    try {
      // Try URL decoding
      let decoded = decodeURIComponent(key);
      
      // Try HTML entity decoding
      decoded = decoded
        .replace(/&#x([0-9A-Fa-f]+);/g, (_, hex) => 
          String.fromCharCode(parseInt(hex, 16)))
        .replace(/&#(\d+);/g, (_, dec) => 
          String.fromCharCode(parseInt(dec, 10)))
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#x27;/g, "'");
      
      return decoded;
    } catch {
      // If decoding fails, return original key
      return key;
    }
  }

  /**
   * Basic string sanitization to prevent common injection attacks
   * @param str - String to sanitize
   * @returns Sanitized string
   */
  private static sanitizeString(str: string): string {
    // Remove null bytes
    let sanitized = str.replace(/\0/g, '');
    
    // Limit string length to prevent memory exhaustion
    const MAX_STRING_LENGTH = 10000;
    if (sanitized.length > MAX_STRING_LENGTH) {
      sanitized = sanitized.substring(0, MAX_STRING_LENGTH);
      console.warn(`String truncated to ${MAX_STRING_LENGTH} characters`);
    }
    
    // Remove dangerous control characters
    sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    
    return sanitized;
  }

  /**
   * Validate that an object is safe for processing
   * @param obj - Object to validate
   * @returns true if the object is safe
   */
  static isObjectSafe(obj: unknown): boolean {
    try {
      // Basic type check
      if (typeof obj !== 'object' || obj === null) {
        return true;
      }

      // Check for circular references using JSON.stringify
      JSON.stringify(obj);
      
      return true;
    } catch (error) {
      console.warn('Object validation failed:', error.message);
      return false;
    }
  }
}