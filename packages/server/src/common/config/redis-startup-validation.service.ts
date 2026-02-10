import { Injectable, OnApplicationBootstrap, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '@liaoliaots/nestjs-redis';
import Redis from 'ioredis';

/**
 * Service to validate Redis configuration and connectivity at application startup
 * Ensures Redis is properly configured and accessible before the application starts accepting requests
 */
@Injectable()
export class RedisStartupValidationService implements OnApplicationBootstrap {
  private readonly logger = new Logger(RedisStartupValidationService.name);
  private redisClient: Redis;

  constructor(
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
  ) {}

  async onApplicationBootstrap() {
    const isProduction = this.configService.get('NODE_ENV') === 'production';
    
    try {
      this.logger.log('Validating Redis connection and configuration...');
      
      // Get Redis client instance
      this.redisClient = this.redisService.getOrThrow();
      
      // Perform comprehensive validation
      await this.validateRedisConnection();
      await this.validateRedisAuthentication();
      await this.validateRedisOperations();
      
      // Log successful validation
      const redisConfig = {
        host: this.configService.get('redis.host'),
        port: this.configService.get('redis.port'),
        db: this.configService.get('redis.db'),
        authEnabled: !!this.configService.get('redis.password'),
        tlsEnabled: !!this.configService.get('redis.tls'),
        environment: this.configService.get('NODE_ENV'),
      };
      
      this.logger.log(
        `✅ Redis validation successful: ${redisConfig.host}:${redisConfig.port} ` +
        `(DB: ${redisConfig.db}, Auth: ${redisConfig.authEnabled ? 'Enabled' : 'Disabled'}, ` +
        `TLS: ${redisConfig.tlsEnabled ? 'Enabled' : 'Disabled'})`
      );
      
    } catch (error: any) {
      this.logger.error(`❌ Redis validation failed: ${error.message}`);
      
      // In production, fail fast to prevent insecure deployments
      if (isProduction) {
        this.logger.error('🚨 Application startup aborted due to Redis configuration error in production environment');
        this.logger.error('Please ensure Redis is properly configured with authentication enabled');
        process.exit(1);
      } else {
        this.logger.warn('⚠️  Redis validation failed in non-production environment. Application will continue with warnings.');
        this.logger.warn('Consider fixing Redis configuration for optimal performance and security');
      }
    }
  }

  /**
   * Test basic Redis connectivity
   */
  private async validateRedisConnection(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Redis connection timeout after 5 seconds'));
      }, 5000);

      this.redisClient.ping()
        .then((result) => {
          clearTimeout(timeout);
          if (result === 'PONG') {
            this.logger.debug('Redis PING test successful');
            resolve();
          } else {
            reject(new Error(`Unexpected PING response: ${result}`));
          }
        })
        .catch((error) => {
          clearTimeout(timeout);
          reject(new Error(`Redis connection failed: ${error.message}`));
        });
    });
  }

  /**
   * Validate Redis authentication configuration
   */
  private async validateRedisAuthentication(): Promise<void> {
    const password = this.configService.get('redis.password');
    const isProduction = this.configService.get('NODE_ENV') === 'production';

    try {
      // Try to get server info - requires auth if enabled on Redis server
      await this.redisClient.info('server');
      this.logger.debug('Redis authentication validation successful');
      
      // Log security status
      if (password) {
        this.logger.log('🔒 Redis authentication is enabled and working');
      } else if (isProduction) {
        this.logger.warn('⚠️  Redis authentication not configured in production - this is a security risk');
      } else {
        this.logger.debug('Redis authentication not configured (development mode)');
      }
      
    } catch (error: any) {
      if (error.message.includes('NOAUTH') || error.message.includes('Authentication')) {
        throw new Error(
          'Redis authentication failed. The Redis server requires a password but none was provided or the password is incorrect. ' +
          'Please check your REDIS_PASSWORD configuration.'
        );
      }
      
      if (error.message.includes('WRONGPASS')) {
        throw new Error(
          'Redis authentication failed with wrong password. Please check your REDIS_PASSWORD configuration.'
        );
      }
      
      // Re-throw other errors
      throw new Error(`Redis authentication validation failed: ${error.message}`);
    }
  }

  /**
   * Test basic Redis read/write operations
   */
  private async validateRedisOperations(): Promise<void> {
    const testKey = `health_check:${Date.now()}:${Math.random()}`;
    const testValue = 'redis_validation_test';

    try {
      // Test SET operation
      await this.redisClient.set(testKey, testValue, 'EX', 10);
      
      // Test GET operation
      const retrievedValue = await this.redisClient.get(testKey);
      if (retrievedValue !== testValue) {
        throw new Error(`Read/write test failed: expected '${testValue}', got '${retrievedValue}'`);
      }
      
      // Test DELETE operation
      const deleteResult = await this.redisClient.del(testKey);
      if (deleteResult !== 1) {
        this.logger.warn(`Warning: Test key deletion returned unexpected result: ${deleteResult}`);
      }
      
      this.logger.debug('Redis read/write operations test successful');
      
    } catch (error: any) {
      throw new Error(`Redis operations validation failed: ${error.message}`);
    }
  }

  /**
   * Get Redis connection health status for monitoring
   */
  async getHealthStatus(): Promise<{
    status: 'healthy' | 'unhealthy';
    details: Record<string, any>;
  }> {
    try {
      const startTime = Date.now();
      await this.redisClient.ping();
      const responseTime = Date.now() - startTime;

      // Get Redis info
      const info = await this.redisClient.info('memory');
      const memoryInfo = this.parseRedisInfo(info);

      return {
        status: 'healthy',
        details: {
          responseTime: `${responseTime}ms`,
          memory: memoryInfo,
          connected: this.redisClient.status === 'ready',
          host: this.configService.get('redis.host'),
          port: this.configService.get('redis.port'),
          db: this.configService.get('redis.db'),
        },
      };
    } catch (error: any) {
      return {
        status: 'unhealthy',
        details: {
          error: error.message,
          connected: false,
        },
      };
    }
  }

  /**
   * Parse Redis INFO command output into key-value pairs
   */
  private parseRedisInfo(infoString: string): Record<string, string> {
    const result = {};
    const lines = infoString.split('\r\n');
    
    for (const line of lines) {
      if (line && !line.startsWith('#')) {
        const [key, value] = line.split(':');
        if (key && value) {
          result[key] = value;
        }
      }
    }
    
    return result;
  }
}