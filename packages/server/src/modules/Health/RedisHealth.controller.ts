import { Controller, Get } from '@nestjs/common';
import { RedisStartupValidationService } from '@/common/config/redis-startup-validation.service';

/**
 * Health check controller for Redis connectivity
 * Provides endpoints to monitor Redis service health
 */
@Controller('health')
export class RedisHealthController {
  constructor(
    private readonly redisValidationService: RedisStartupValidationService,
  ) {}

  /**
   * Get Redis health status
   * Returns detailed information about Redis connectivity and performance
   */
  @Get('redis')
  async getRedisHealth() {
    const healthStatus = await this.redisValidationService.getHealthStatus();
    
    return {
      service: 'Redis',
      timestamp: new Date().toISOString(),
      ...healthStatus,
    };
  }

  /**
   * Basic health check endpoint
   * Returns overall service health including Redis status
   */
  @Get()
  async getOverallHealth() {
    const redisHealth = await this.redisValidationService.getHealthStatus();
    
    const overallStatus = redisHealth.status === 'healthy' ? 'ok' : 'degraded';
    
    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      services: {
        redis: redisHealth,
      },
    };
  }
}