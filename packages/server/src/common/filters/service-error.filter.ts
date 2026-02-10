import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { ServiceError } from '@/modules/Items/ServiceError';

@Catch(ServiceError)
export class ServiceErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger(ServiceErrorFilter.name);
  private readonly isProduction = process.env.NODE_ENV === 'production';

  catch(exception: ServiceError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();

    // Log full error details server-side for debugging
    this.logErrorDetails(exception, request, status);

    // Sanitize payload for client response based on environment
    const sanitizedPayload = this.sanitizePayload(exception.payload);

    response.status(status).json({
      errors: [
        {
          statusCode: status,
          type: exception.errorType,
          message: exception.message,
          payload: sanitizedPayload,
        }
      ]
    });
  }

  /**
   * Log comprehensive error details for server-side debugging
   */
  private logErrorDetails(
    exception: ServiceError, 
    request: Request, 
    status: HttpStatus
  ): void {
    const errorContext = {
      timestamp: new Date().toISOString(),
      method: request.method,
      url: request.url,
      userAgent: request.get('user-agent'),
      ip: request.ip,
      statusCode: status,
      errorType: exception.errorType,
      message: exception.message,
      payload: exception.payload, // Full payload logged server-side
      stack: exception.stack,
    };

    // Use appropriate log level based on HTTP status
    if (status >= 500) {
      this.logger.error('Service Error (Server)', errorContext);
    } else {
      this.logger.warn('Service Error (Client)', errorContext);
    }
  }

  /**
   * Sanitize error payload based on environment and security requirements
   */
  private sanitizePayload(payload: any): any {
    if (!payload) {
      return payload;
    }

    // In production, sanitize sensitive data
    if (this.isProduction) {
      return this.sanitizeForProduction(payload);
    }

    // In development, provide more details but still sanitize sensitive fields
    return this.sanitizeForDevelopment(payload);
  }

  /**
   * Production sanitization - minimal information disclosure
   */
  private sanitizeForProduction(payload: any): any {
    if (payload === null || payload === undefined) {
      return null;
    }

    if (typeof payload !== 'object') {
      return null; // Don't expose primitive values in production
    }

    // Return only safe, non-sensitive fields for production
    const sanitized: any = {};

    // Allow only specific safe fields that don't expose internal data
    const safeFields = [
      'code',        // Error codes are generally safe
      'field',       // Field names for validation errors
      'constraint',  // Validation constraint names
      'expected',    // Expected values for validation
      'received',    // Received values (if not sensitive)
    ];

    for (const field of safeFields) {
      if (payload[field] !== undefined && !this.isSensitiveValue(payload[field])) {
        sanitized[field] = payload[field];
      }
    }

    return Object.keys(sanitized).length > 0 ? sanitized : null;
  }

  /**
   * Development sanitization - more permissive but still secure
   */
  private sanitizeForDevelopment(payload: any): any {
    if (payload === null || payload === undefined) {
      return payload;
    }

    if (typeof payload !== 'object') {
      return payload;
    }

    const sanitized: any = {};

    // In development, allow more fields but sanitize sensitive ones
    for (const [key, value] of Object.entries(payload)) {
      if (this.isSensitiveField(key)) {
        sanitized[key] = '[REDACTED]';
      } else if (this.isSensitiveValue(value)) {
        sanitized[key] = '[REDACTED]';
      } else if (Array.isArray(value)) {
        sanitized[key] = this.sanitizeArray(value);
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeForDevelopment(value);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * Sanitize arrays to prevent ID exposure
   */
  private sanitizeArray(arr: any[]): any[] {
    return arr.map(item => {
      if (typeof item === 'object' && item !== null) {
        return this.sanitizeForDevelopment(item);
      } else if (this.isSensitiveValue(item)) {
        return '[REDACTED]';
      }
      return item;
    });
  }

  /**
   * Check if field name indicates sensitive data
   */
  private isSensitiveField(fieldName: string): boolean {
    const sensitivePatterns = [
      /id$/i,           // Fields ending with 'id'
      /ids$/i,          // Fields ending with 'ids'
      /password/i,      // Password fields
      /token/i,         // Token fields
      /secret/i,        // Secret fields
      /key$/i,          // Key fields
      /hash/i,          // Hash fields
      /email/i,         // Email fields
      /phone/i,         // Phone fields
      /ssn/i,           // SSN fields
      /account/i,       // Account information
      /transaction/i,   // Transaction data
    ];

    return sensitivePatterns.some(pattern => pattern.test(fieldName));
  }

  /**
   * Check if value appears to be sensitive data
   */
  private isSensitiveValue(value: any): boolean {
    if (typeof value !== 'string' && typeof value !== 'number') {
      return false;
    }

    const valueStr = String(value);

    // Check for patterns that might be sensitive
    const sensitivePatterns = [
      /^\d{8,}$/,           // Long numeric IDs
      /^[a-f0-9]{32,}$/i,   // Hash-like strings
      /jwt\./i,             // JWT tokens
      /bearer\s/i,          // Bearer tokens
      /@[\w.-]+\.\w+$/,     // Email addresses
      /^\+?\d{10,}$/,       // Phone numbers
    ];

    return sensitivePatterns.some(pattern => pattern.test(valueStr));
  }
}
