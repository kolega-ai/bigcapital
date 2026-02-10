import { Test, TestingModule } from '@nestjs/testing';
import { ArgumentsHost, HttpStatus } from '@nestjs/common';
import { ServiceErrorFilter } from '../service-error.filter';
import { ServiceError } from '@/modules/Items/ServiceError';

// Mock the environment
const mockEnv = (nodeEnv: string) => {
  process.env.NODE_ENV = nodeEnv;
};

describe('ServiceErrorFilter', () => {
  let filter: ServiceErrorFilter;
  let mockArgumentsHost: ArgumentsHost;
  let mockResponse: any;
  let mockRequest: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ServiceErrorFilter],
    }).compile();

    filter = module.get<ServiceErrorFilter>(ServiceErrorFilter);

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    mockRequest = {
      method: 'POST',
      url: '/api/test',
      get: jest.fn().mockReturnValue('test-user-agent'),
      ip: '127.0.0.1',
    };

    mockArgumentsHost = {
      switchToHttp: () => ({
        getResponse: () => mockResponse,
        getRequest: () => mockRequest,
      }),
    } as ArgumentsHost;
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete process.env.NODE_ENV;
  });

  describe('Production Environment', () => {
    beforeEach(() => {
      mockEnv('production');
    });

    it('should sanitize sensitive payload data in production', () => {
      const sensitivePayload = {
        matchedTransactionsIds: [1, 2, 3, 4, 5],
        accountId: 12345,
        userId: 67890,
        email: 'user@example.com',
        code: 'VALIDATION_ERROR', // This should be allowed
      };

      const serviceError = new ServiceError(
        'TEST_ERROR',
        'Test error message',
        sensitivePayload,
        HttpStatus.BAD_REQUEST,
      );

      filter.catch(serviceError, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      expect(mockResponse.json).toHaveBeenCalledWith({
        errors: [
          {
            statusCode: HttpStatus.BAD_REQUEST,
            type: 'TEST_ERROR',
            message: 'Test error message',
            payload: {
              code: 'VALIDATION_ERROR', // Only safe fields should remain
            },
          },
        ],
      });
    });

    it('should return null payload for primitive values in production', () => {
      const serviceError = new ServiceError(
        'TEST_ERROR',
        'Test error message',
        'sensitive string data',
        HttpStatus.BAD_REQUEST,
      );

      filter.catch(serviceError, mockArgumentsHost);

      expect(mockResponse.json).toHaveBeenCalledWith({
        errors: [
          {
            statusCode: HttpStatus.BAD_REQUEST,
            type: 'TEST_ERROR',
            message: 'Test error message',
            payload: null, // Primitive values should be null in production
          },
        ],
      });
    });
  });

  describe('Development Environment', () => {
    beforeEach(() => {
      mockEnv('development');
    });

    it('should sanitize sensitive fields but preserve structure in development', () => {
      const sensitivePayload = {
        matchedTransactionsIds: [1, 2, 3],
        accountId: 12345,
        code: 'VALIDATION_ERROR',
        field: 'amount',
        nonSensitiveData: 'some value',
      };

      const serviceError = new ServiceError(
        'TEST_ERROR',
        'Test error message',
        sensitivePayload,
        HttpStatus.BAD_REQUEST,
      );

      filter.catch(serviceError, mockArgumentsHost);

      expect(mockResponse.json).toHaveBeenCalledWith({
        errors: [
          {
            statusCode: HttpStatus.BAD_REQUEST,
            type: 'TEST_ERROR',
            message: 'Test error message',
            payload: {
              matchedTransactionsIds: '[REDACTED]', // Sensitive field redacted
              accountId: '[REDACTED]', // Sensitive field redacted
              code: 'VALIDATION_ERROR', // Safe field preserved
              field: 'amount', // Safe field preserved
              nonSensitiveData: 'some value', // Non-sensitive data preserved
            },
          },
        ],
      });
    });

    it('should handle null and undefined payloads', () => {
      const serviceError = new ServiceError(
        'TEST_ERROR',
        'Test error message',
        null,
        HttpStatus.BAD_REQUEST,
      );

      filter.catch(serviceError, mockArgumentsHost);

      expect(mockResponse.json).toHaveBeenCalledWith({
        errors: [
          {
            statusCode: HttpStatus.BAD_REQUEST,
            type: 'TEST_ERROR',
            message: 'Test error message',
            payload: null,
          },
        ],
      });
    });
  });

  describe('Logging', () => {
    beforeEach(() => {
      mockEnv('development');
      // Mock the logger to avoid console output during tests
      jest.spyOn(filter as any, 'logErrorDetails').mockImplementation();
    });

    it('should log error details server-side regardless of environment', () => {
      const sensitivePayload = { userId: 123, sensitive: 'data' };
      const serviceError = new ServiceError(
        'TEST_ERROR',
        'Test error message',
        sensitivePayload,
        HttpStatus.BAD_REQUEST,
      );

      filter.catch(serviceError, mockArgumentsHost);

      // Verify that logErrorDetails was called with full error information
      expect((filter as any).logErrorDetails).toHaveBeenCalledWith(
        serviceError,
        mockRequest,
        HttpStatus.BAD_REQUEST,
      );
    });
  });

  describe('Error Status Handling', () => {
    beforeEach(() => {
      mockEnv('development');
    });

    it('should handle different HTTP status codes', () => {
      const serviceError = new ServiceError(
        'INTERNAL_ERROR',
        'Internal server error',
        { debug: 'info' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );

      filter.catch(serviceError, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(mockResponse.json).toHaveBeenCalledWith({
        errors: [
          {
            statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
            type: 'INTERNAL_ERROR',
            message: 'Internal server error',
            payload: { debug: 'info' },
          },
        ],
      });
    });
  });
});