import {
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
  type CallHandler,
  Optional,
  BadRequestException,
} from '@nestjs/common';
import { type Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { 
  SecureObjectTransformer, 
  type SecureTransformOptions 
} from '@/common/utils/secure-transform.util';

/**
 * Secure camelCase to snake_case transformer using SecureObjectTransformer
 */
export function camelToSnake<T = any>(value: T): T {
  if (value === null || value === undefined) {
    return value;
  }

  return SecureObjectTransformer.transform(
    value,
    {
      maxDepth: 15,
      maxKeys: 2000,
      keyTransformer: (key: string) => {
        return key
          .split(/(?=[A-Z])/)
          .join('_')
          .toLowerCase();
      },
      allowedKeyPattern: /^[\w\-\.@$]+$/,
      sanitizeStrings: false,
    }
  ) as T;
}

/**
 * Secure snake_case to camelCase transformer using SecureObjectTransformer
 */
export function snakeToCamel<T = any>(value: T): T {
  if (value === null || value === undefined) {
    return value;
  }

  return SecureObjectTransformer.transform(
    value,
    {
      maxDepth: 15,
      maxKeys: 2000,
      keyTransformer: (key: string) => {
        const converted = key.replace(/([-_]\w)/g, (group) =>
          group[1].toUpperCase(),
        );
        return converted[0].toLowerCase() + converted.slice(1);
      },
      allowedKeyPattern: /^[\w\-\.@$]+$/,
      sanitizeStrings: false,
    }
  ) as T;
}

export const DEFAULT_STRATEGY = {
  in: snakeToCamel,
  out: camelToSnake,
};

@Injectable()
export class SerializeInterceptor implements NestInterceptor<any, any> {
  private readonly requestOptions: SecureTransformOptions;
  private readonly queryOptions: SecureTransformOptions;
  private readonly responseOptions: SecureTransformOptions;

  constructor(@Optional() readonly strategy = DEFAULT_STRATEGY) {
    // Configuration for request body transformation
    this.requestOptions = {
      maxDepth: 15,
      maxKeys: 2000,
      keyTransformer: this.getKeyTransformer(strategy.in),
      allowedKeyPattern: /^[\w\-\.@$]+$/,
      sanitizeStrings: false, // Don't sanitize request data to preserve user input
    };

    // More restrictive configuration for query parameters
    this.queryOptions = {
      maxDepth: 5, // Queries should be shallow
      maxKeys: 100, // Limit query parameter count
      keyTransformer: this.getKeyTransformer(strategy.in),
      allowedKeyPattern: /^[\w\-\.@$]+$/,
      sanitizeStrings: false,
    };

    // Configuration for response transformation
    this.responseOptions = {
      maxDepth: 20,
      maxKeys: 3000,
      keyTransformer: this.getKeyTransformer(strategy.out),
      allowedKeyPattern: /^[\w\-\.@$]+$/,
      sanitizeStrings: false, // Response data should already be clean
    };
  }

  intercept(
    context: ExecutionContext,
    next: CallHandler<any>,
  ): Observable<any> {
    const request = context.switchToHttp().getRequest();

    try {
      // Validate and securely transform request body
      if (request.body !== undefined && request.body !== null) {
        // Check for circular references before processing
        if (!SecureObjectTransformer.isObjectSafe(request.body)) {
          throw new BadRequestException('Invalid request body: circular reference detected');
        }

        request.body = SecureObjectTransformer.transform(
          request.body,
          this.requestOptions
        );
      }

      // Validate and securely transform query parameters
      if (request.query !== undefined && request.query !== null) {
        // Check for circular references before processing
        if (!SecureObjectTransformer.isObjectSafe(request.query)) {
          throw new BadRequestException('Invalid query parameters: circular reference detected');
        }

        request.query = SecureObjectTransformer.transform(
          request.query,
          this.queryOptions
        );
      }

      // Handle response transformation with error handling
      return next.handle().pipe(
        map((data: any) => {
          try {
            if (data === null || data === undefined) {
              return data;
            }

            // Only transform plain objects
            if (typeof data === 'object') {
              return SecureObjectTransformer.transform(
                data,
                this.responseOptions
              );
            }

            return data;
          } catch (error) {
            // Log security violations in response transformation
            console.error('Security violation in response transformation:', {
              error: error.message,
              route: request.route?.path,
              method: request.method,
            });

            // For response errors, return the original data rather than failing
            // This ensures the API doesn't break due to response transformation issues
            return data;
          }
        })
      );
    } catch (error) {
      // Log security violations with context
      console.error('Security violation in SerializeInterceptor:', {
        error: error.message,
        route: request.route?.path,
        method: request.method,
        userAgent: request.headers['user-agent'],
        ip: request.ip,
      });

      // Return proper HTTP error for client-side issues
      if (error.message.includes('Maximum') || error.message.includes('circular reference')) {
        throw new BadRequestException(`Invalid request data: ${error.message}`);
      }

      throw new BadRequestException('Invalid request data structure');
    }
  }

  /**
   * Extract the key transformer function from the transformation strategy
   */
  private getKeyTransformer(transformFn: (value: any) => any): (key: string) => string {
    // This is a bit of a workaround to extract the key transformation logic
    // from the existing transformation functions
    return (key: string) => {
      // Create a simple test object to see how the key gets transformed
      const testObj = { [key]: 'test' };
      const transformed = transformFn(testObj);
      const transformedKeys = Object.keys(transformed);
      return transformedKeys[0] || key;
    };
  }
}
