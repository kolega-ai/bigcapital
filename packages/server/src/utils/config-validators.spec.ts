/**
 * Unit tests for configuration validation utilities
 */

import {
  parseIntWithValidation,
  parseThrottleTTL,
  parseThrottleLimit
} from '@/utils/config-validators';

describe('Config Validators', () => {
  describe('parseIntWithValidation', () => {
    it('should return default value when input is undefined', () => {
      const result = parseIntWithValidation(
        undefined,
        { min: 1, max: 100, default: 50 },
        'TEST_VAR'
      );
      expect(result).toBe(50);
    });

    it('should return default value when input is empty string', () => {
      const result = parseIntWithValidation(
        '',
        { min: 1, max: 100, default: 50 },
        'TEST_VAR'
      );
      expect(result).toBe(50);
    });

    it('should parse valid integer strings', () => {
      const result = parseIntWithValidation(
        '75',
        { min: 1, max: 100, default: 50 },
        'TEST_VAR'
      );
      expect(result).toBe(75);
    });

    it('should throw error for non-numeric input', () => {
      expect(() => 
        parseIntWithValidation(
          'abc',
          { min: 1, max: 100, default: 50 },
          'TEST_VAR'
        )
      ).toThrow('Invalid configuration: TEST_VAR must be a valid integer');
    });

    it('should throw error for values below minimum', () => {
      expect(() => 
        parseIntWithValidation(
          '0',
          { min: 1, max: 100, default: 50 },
          'TEST_VAR'
        )
      ).toThrow('Invalid configuration: TEST_VAR must be at least 1');
    });

    it('should throw error for values above maximum', () => {
      expect(() => 
        parseIntWithValidation(
          '101',
          { min: 1, max: 100, default: 50 },
          'TEST_VAR'
        )
      ).toThrow('Invalid configuration: TEST_VAR must be at most 100');
    });

    it('should handle edge case values', () => {
      // Test minimum boundary
      const minResult = parseIntWithValidation(
        '1',
        { min: 1, max: 100, default: 50 },
        'TEST_VAR'
      );
      expect(minResult).toBe(1);

      // Test maximum boundary
      const maxResult = parseIntWithValidation(
        '100',
        { min: 1, max: 100, default: 50 },
        'TEST_VAR'
      );
      expect(maxResult).toBe(100);
    });

    it('should handle negative values correctly', () => {
      expect(() =>
        parseIntWithValidation(
          '-5',
          { min: 1, max: 100, default: 50 },
          'TEST_VAR'
        )
      ).toThrow('Invalid configuration: TEST_VAR must be at least 1');
    });
  });

  describe('parseThrottleTTL', () => {
    it('should return default TTL value for undefined input', () => {
      const result = parseThrottleTTL(undefined, 'TEST_TTL');
      expect(result).toBe(60000);
    });

    it('should return custom default TTL value', () => {
      const result = parseThrottleTTL(undefined, 'TEST_TTL', 30000);
      expect(result).toBe(30000);
    });

    it('should parse valid TTL values', () => {
      const result = parseThrottleTTL('5000', 'TEST_TTL');
      expect(result).toBe(5000);
    });

    it('should reject TTL values below minimum (1 second)', () => {
      expect(() =>
        parseThrottleTTL('500', 'TEST_TTL')
      ).toThrow('Invalid configuration: TEST_TTL must be at least 1000');
    });

    it('should reject TTL values above maximum (1 hour)', () => {
      expect(() =>
        parseThrottleTTL('3700000', 'TEST_TTL')
      ).toThrow('Invalid configuration: TEST_TTL must be at most 3600000');
    });

    it('should reject invalid TTL values', () => {
      expect(() =>
        parseThrottleTTL('invalid', 'TEST_TTL')
      ).toThrow('Invalid configuration: TEST_TTL must be a valid integer');
    });
  });

  describe('parseThrottleLimit', () => {
    it('should return default limit value for undefined input', () => {
      const result = parseThrottleLimit(undefined, 'TEST_LIMIT');
      expect(result).toBe(100);
    });

    it('should return custom default limit value', () => {
      const result = parseThrottleLimit(undefined, 'TEST_LIMIT', 50);
      expect(result).toBe(50);
    });

    it('should parse valid limit values', () => {
      const result = parseThrottleLimit('25', 'TEST_LIMIT');
      expect(result).toBe(25);
    });

    it('should reject limit values below minimum (1)', () => {
      expect(() =>
        parseThrottleLimit('0', 'TEST_LIMIT')
      ).toThrow('Invalid configuration: TEST_LIMIT must be at least 1');
    });

    it('should reject limit values above maximum (10000)', () => {
      expect(() =>
        parseThrottleLimit('10001', 'TEST_LIMIT')
      ).toThrow('Invalid configuration: TEST_LIMIT must be at most 10000');
    });

    it('should reject invalid limit values', () => {
      expect(() =>
        parseThrottleLimit('not-a-number', 'TEST_LIMIT')
      ).toThrow('Invalid configuration: TEST_LIMIT must be a valid integer');
    });
  });
});