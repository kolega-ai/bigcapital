import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ABILITY_METADATA_KEY, RequiredAbility } from '../decorators/RequireAbility.decorator';

/**
 * Guard that checks if the user has the required abilities to access a route
 */
@Injectable()
export class AbilityGuard implements CanActivate {
  private readonly logger = new Logger(AbilityGuard.name);

  constructor(private reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredAbilities = this.reflector.get<RequiredAbility | RequiredAbility[]>(
      ABILITY_METADATA_KEY,
      context.getHandler()
    );

    if (!requiredAbilities) {
      // No ability requirements specified - allow access
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const userAbility = request.ability;
    const user = request.user;

    if (!userAbility) {
      this.logger.warn(`Access denied: User abilities not found for user ${user?.id || 'unknown'}`);
      throw new ForbiddenException('User abilities not found. Please ensure you are properly authenticated.');
    }

    // Handle single or multiple abilities
    const abilitiesToCheck = Array.isArray(requiredAbilities) 
      ? requiredAbilities 
      : [requiredAbilities];

    for (const required of abilitiesToCheck) {
      if (!userAbility.can(required.action, required.subject)) {
        const logMessage = `Authorization failed: User ${user?.id || 'unknown'} attempted to ${required.action} ${required.subject} without permission`;
        this.logger.warn(logMessage);
        
        throw new ForbiddenException(
          `Access denied. You don't have permission to ${required.action.toLowerCase()} ${required.subject.toLowerCase()}.`
        );
      }
    }

    // Log successful authorization for audit purposes
    const actionsLog = abilitiesToCheck
      .map(ability => `${ability.action} ${ability.subject}`)
      .join(', ');
    this.logger.log(`Authorization successful: User ${user?.id || 'unknown'} authorized for ${actionsLog}`);

    return true;
  }
}