import { Module } from '@nestjs/common';
import { RedisHealthController } from './RedisHealth.controller';
import { RedisStartupValidationService } from '@/common/config/redis-startup-validation.service';

/**
 * Health check module providing system health monitoring
 * Includes Redis connectivity status and other service health checks
 */
@Module({
  controllers: [RedisHealthController],
  providers: [RedisStartupValidationService],
  exports: [RedisStartupValidationService],
})
export class HealthModule {}