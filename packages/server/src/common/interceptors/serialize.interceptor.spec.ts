import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, CallHandler, BadRequestException } from '@nestjs/common';
import { of } from 'rxjs';
import { SerializeInterceptor, camelToSnake, snakeToCamel } from './serialize.interceptor';

describe('SerializeInterceptor Security', () => {
  let interceptor: SerializeInterceptor;
  let mockExecutionContext: jest.Mocked<ExecutionContext>;
  let mockCallHandler: jest.Mocked<CallHandler>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SerializeInterceptor],
    }).compile();

    interceptor = module.get<SerializeInterceptor>(SerializeInterceptor);

    mockExecutionContext = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({
          body: undefined,
          query: undefined,
          route: { path: '/test' },
          method: 'POST',
          headers: { 'user-agent': 'test' },
          ip: '127.0.0.1'
        }),
      }),
    } as any;

    mockCallHandler = {
      handle: jest.fn().mockReturnValue(of({ test: 'data' })),
    } as any;
  });

  describe('Prototype Pollution Prevention', () => {
    it('should filter out dangerous keys from request body', (done) => {
      const maliciousBody = {
        "__proto__": { "isAdmin": true },
        "constructor": { "prototype": { "isAdmin": true } },
        "normal_field": "safe_value"
      };

      const request = {
        body: maliciousBody,
        query: {},
        route: { path: '/test' },
        method: 'POST',
        headers: { 'user-agent': 'test' },
        ip: '127.0.0.1'
      };

      mockExecutionContext.switchToHttp().getRequest = jest.fn().mockReturnValue(request);

      const result$ = interceptor.intercept(mockExecutionContext, mockCallHandler);

      result$.subscribe({
        next: () => {
          // Check that dangerous keys were filtered out
          expect(request.body).not.toHaveProperty('__proto__');
          expect(request.body).not.toHaveProperty('constructor');
          expect(request.body).toHaveProperty('normalField', 'safe_value');
          
          // Ensure prototype wasn't polluted
          const testObj = {};
          expect((testObj as any).isAdmin).toBeUndefined();
          done();
        },
        error: done
      });
    });

    it('should filter out dangerous keys from query parameters', (done) => {
      const maliciousQuery = {
        "__proto__": "polluted",
        "prototype": "dangerous",
        "search_term": "valid"
      };

      const request = {
        body: {},
        query: maliciousQuery,
        route: { path: '/test' },
        method: 'GET',
        headers: { 'user-agent': 'test' },
        ip: '127.0.0.1'
      };

      mockExecutionContext.switchToHttp().getRequest = jest.fn().mockReturnValue(request);

      const result$ = interceptor.intercept(mockExecutionContext, mockCallHandler);

      result$.subscribe({
        next: () => {
          expect(request.query).not.toHaveProperty('__proto__');
          expect(request.query).not.toHaveProperty('prototype');
          expect(request.query).toHaveProperty('searchTerm', 'valid');
          done();
        },
        error: done
      });
    });

    it('should handle encoded dangerous keys', (done) => {
      const maliciousBody = {
        "%5f%5fproto%5f%5f": { "polluted": true },
        "safe_field": "value"
      };

      const request = {
        body: maliciousBody,
        query: {},
        route: { path: '/test' },
        method: 'POST',
        headers: { 'user-agent': 'test' },
        ip: '127.0.0.1'
      };

      mockExecutionContext.switchToHttp().getRequest = jest.fn().mockReturnValue(request);

      const result$ = interceptor.intercept(mockExecutionContext, mockCallHandler);

      result$.subscribe({
        next: () => {
          expect(request.body).not.toHaveProperty('%5f%5fproto%5f%5f');
          expect(request.body).toHaveProperty('safeField', 'value');
          done();
        },
        error: done
      });
    });
  });

  describe('Depth and Key Limiting', () => {
    it('should throw BadRequestException for deeply nested objects', () => {
      const createDeepObject = (depth: number): any => {
        if (depth === 0) return { value: 'end' };
        return { nested: createDeepObject(depth - 1) };
      };

      const deepObject = createDeepObject(20);
      const request = {
        body: deepObject,
        query: {},
        route: { path: '/test' },
        method: 'POST',
        headers: { 'user-agent': 'test' },
        ip: '127.0.0.1'
      };

      mockExecutionContext.switchToHttp().getRequest = jest.fn().mockReturnValue(request);

      expect(() => {
        interceptor.intercept(mockExecutionContext, mockCallHandler);
      }).toThrow(BadRequestException);
    });

    it('should throw BadRequestException for objects with too many keys', () => {
      const manyKeys: any = {};
      for (let i = 0; i < 2100; i++) {
        manyKeys[`key_${i}`] = i;
      }

      const request = {
        body: manyKeys,
        query: {},
        route: { path: '/test' },
        method: 'POST',
        headers: { 'user-agent': 'test' },
        ip: '127.0.0.1'
      };

      mockExecutionContext.switchToHttp().getRequest = jest.fn().mockReturnValue(request);

      expect(() => {
        interceptor.intercept(mockExecutionContext, mockCallHandler);
      }).toThrow(BadRequestException);
    });

    it('should apply more restrictive limits to query parameters', () => {
      const manyQueryKeys: any = {};
      for (let i = 0; i < 110; i++) {
        manyQueryKeys[`param_${i}`] = i;
      }

      const request = {
        body: {},
        query: manyQueryKeys,
        route: { path: '/test' },
        method: 'GET',
        headers: { 'user-agent': 'test' },
        ip: '127.0.0.1'
      };

      mockExecutionContext.switchToHttp().getRequest = jest.fn().mockReturnValue(request);

      expect(() => {
        interceptor.intercept(mockExecutionContext, mockCallHandler);
      }).toThrow(BadRequestException);
    });
  });

  describe('Circular Reference Detection', () => {
    it('should throw BadRequestException for circular references in body', () => {
      const circularObj: any = { name: 'test' };
      circularObj.self = circularObj;

      const request = {
        body: circularObj,
        query: {},
        route: { path: '/test' },
        method: 'POST',
        headers: { 'user-agent': 'test' },
        ip: '127.0.0.1'
      };

      mockExecutionContext.switchToHttp().getRequest = jest.fn().mockReturnValue(request);

      expect(() => {
        interceptor.intercept(mockExecutionContext, mockCallHandler);
      }).toThrow(BadRequestException);
    });

    it('should throw BadRequestException for circular references in query', () => {
      const circularObj: any = { search: 'test' };
      circularObj.ref = circularObj;

      const request = {
        body: {},
        query: circularObj,
        route: { path: '/test' },
        method: 'GET',
        headers: { 'user-agent': 'test' },
        ip: '127.0.0.1'
      };

      mockExecutionContext.switchToHttp().getRequest = jest.fn().mockReturnValue(request);

      expect(() => {
        interceptor.intercept(mockExecutionContext, mockCallHandler);
      }).toThrow(BadRequestException);
    });
  });

  describe('Key Pattern Validation', () => {
    it('should filter out keys with invalid patterns', (done) => {
      const maliciousBody = {
        "valid_key": "value1",
        "script>alert(1)</script": "malicious",
        "another-valid.key": "value2",
        "key with spaces": "invalid"
      };

      const request = {
        body: maliciousBody,
        query: {},
        route: { path: '/test' },
        method: 'POST',
        headers: { 'user-agent': 'test' },
        ip: '127.0.0.1'
      };

      mockExecutionContext.switchToHttp().getRequest = jest.fn().mockReturnValue(request);

      const result$ = interceptor.intercept(mockExecutionContext, mockCallHandler);

      result$.subscribe({
        next: () => {
          expect(request.body).toHaveProperty('validKey', 'value1');
          expect(request.body).toHaveProperty('anotherValidKey', 'value2');
          expect(request.body).not.toHaveProperty('script>alert(1)</script');
          expect(request.body).not.toHaveProperty('key with spaces');
          done();
        },
        error: done
      });
    });
  });

  describe('Response Transformation Security', () => {
    it('should securely transform response data', (done) => {
      const responseData = {
        "user_name": "john",
        "__proto__": { "isAdmin": true },
        "user_data": {
          "first_name": "John",
          "last_name": "Doe"
        }
      };

      mockCallHandler.handle.mockReturnValue(of(responseData));

      const request = {
        body: {},
        query: {},
        route: { path: '/test' },
        method: 'GET',
        headers: { 'user-agent': 'test' },
        ip: '127.0.0.1'
      };

      mockExecutionContext.switchToHttp().getRequest = jest.fn().mockReturnValue(request);

      const result$ = interceptor.intercept(mockExecutionContext, mockCallHandler);

      result$.subscribe({
        next: (result) => {
          expect(result).toHaveProperty('userName', 'john');
          expect(result).not.toHaveProperty('__proto__');
          expect(result.userData).toHaveProperty('firstName', 'John');
          expect(result.userData).toHaveProperty('lastName', 'Doe');
          done();
        },
        error: done
      });
    });

    it('should handle response transformation errors gracefully', (done) => {
      // Create a response with circular reference that should fail transformation
      const circularResponse: any = { name: 'test' };
      circularResponse.self = circularResponse;

      mockCallHandler.handle.mockReturnValue(of(circularResponse));

      const request = {
        body: {},
        query: {},
        route: { path: '/test' },
        method: 'GET',
        headers: { 'user-agent': 'test' },
        ip: '127.0.0.1'
      };

      mockExecutionContext.switchToHttp().getRequest = jest.fn().mockReturnValue(request);

      const result$ = interceptor.intercept(mockExecutionContext, mockCallHandler);

      // Should return original data when transformation fails
      result$.subscribe({
        next: (result) => {
          expect(result).toBe(circularResponse);
          done();
        },
        error: done
      });
    });
  });

  describe('Null and Undefined Handling', () => {
    it('should handle null body gracefully', (done) => {
      const request = {
        body: null,
        query: { search: 'test' },
        route: { path: '/test' },
        method: 'POST',
        headers: { 'user-agent': 'test' },
        ip: '127.0.0.1'
      };

      mockExecutionContext.switchToHttp().getRequest = jest.fn().mockReturnValue(request);

      const result$ = interceptor.intercept(mockExecutionContext, mockCallHandler);

      result$.subscribe({
        next: () => {
          expect(request.body).toBeNull();
          expect(request.query).toHaveProperty('search', 'test');
          done();
        },
        error: done
      });
    });

    it('should handle undefined query gracefully', (done) => {
      const request = {
        body: { test: 'data' },
        query: undefined,
        route: { path: '/test' },
        method: 'POST',
        headers: { 'user-agent': 'test' },
        ip: '127.0.0.1'
      };

      mockExecutionContext.switchToHttp().getRequest = jest.fn().mockReturnValue(request);

      const result$ = interceptor.intercept(mockExecutionContext, mockCallHandler);

      result$.subscribe({
        next: () => {
          expect(request.body).toHaveProperty('test', 'data');
          expect(request.query).toBeUndefined();
          done();
        },
        error: done
      });
    });
  });

  describe('Error Logging', () => {
    let consoleSpy: jest.SpyInstance;

    beforeEach(() => {
      consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    });

    afterEach(() => {
      consoleSpy.mockRestore();
    });

    it('should log security violations with context', () => {
      const deepObject = {
        level1: { level2: { level3: { level4: { level5: { level6: { level7: { level8: { level9: { level10: { level11: { level12: { level13: { level14: { level15: { level16: { value: 'deep' } } } } } } } } } } } } } } } }
      };

      const request = {
        body: deepObject,
        query: {},
        route: { path: '/api/test' },
        method: 'POST',
        headers: { 'user-agent': 'Mozilla/5.0 Test' },
        ip: '192.168.1.1'
      };

      mockExecutionContext.switchToHttp().getRequest = jest.fn().mockReturnValue(request);

      try {
        interceptor.intercept(mockExecutionContext, mockCallHandler);
      } catch (error) {
        expect(consoleSpy).toHaveBeenCalledWith(
          'Security violation in SerializeInterceptor:',
          expect.objectContaining({
            error: expect.stringContaining('Maximum object depth'),
            route: '/api/test',
            method: 'POST',
            userAgent: 'Mozilla/5.0 Test',
            ip: '192.168.1.1'
          })
        );
      }
    });
  });
});

describe('Transformation Functions', () => {
  describe('camelToSnake', () => {
    it('should transform camelCase to snake_case securely', () => {
      const input = {
        firstName: 'John',
        lastName: 'Doe',
        userProfile: {
          emailAddress: 'john@example.com',
          phoneNumber: '123-456-7890'
        }
      };

      const result = camelToSnake(input);

      expect(result).toHaveProperty('first_name', 'John');
      expect(result).toHaveProperty('last_name', 'Doe');
      expect(result.user_profile).toHaveProperty('email_address', 'john@example.com');
      expect(result.user_profile).toHaveProperty('phone_number', '123-456-7890');
    });

    it('should filter out dangerous keys during transformation', () => {
      const input = {
        firstName: 'John',
        __proto__: { isAdmin: true },
        constructor: { prototype: { isAdmin: true } }
      };

      const result = camelToSnake(input);

      expect(result).toHaveProperty('first_name', 'John');
      expect(result).not.toHaveProperty('__proto__');
      expect(result).not.toHaveProperty('constructor');
    });
  });

  describe('snakeToCamel', () => {
    it('should transform snake_case to camelCase securely', () => {
      const input = {
        first_name: 'John',
        last_name: 'Doe',
        user_profile: {
          email_address: 'john@example.com',
          phone_number: '123-456-7890'
        }
      };

      const result = snakeToCamel(input);

      expect(result).toHaveProperty('firstName', 'John');
      expect(result).toHaveProperty('lastName', 'Doe');
      expect(result.userProfile).toHaveProperty('emailAddress', 'john@example.com');
      expect(result.userProfile).toHaveProperty('phoneNumber', '123-456-7890');
    });

    it('should filter out dangerous keys during transformation', () => {
      const input = {
        first_name: 'John',
        __proto__: { isAdmin: true },
        prototype: { polluted: true }
      };

      const result = snakeToCamel(input);

      expect(result).toHaveProperty('firstName', 'John');
      expect(result).not.toHaveProperty('__proto__');
      expect(result).not.toHaveProperty('prototype');
    });
  });

  describe('Null and undefined handling', () => {
    it('should handle null values', () => {
      expect(camelToSnake(null)).toBeNull();
      expect(snakeToCamel(null)).toBeNull();
    });

    it('should handle undefined values', () => {
      expect(camelToSnake(undefined)).toBeUndefined();
      expect(snakeToCamel(undefined)).toBeUndefined();
    });
  });
});