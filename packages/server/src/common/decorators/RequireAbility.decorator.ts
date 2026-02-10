import { SetMetadata } from '@nestjs/common';

export interface RequiredAbility {
  action: string;
  subject: string;
}

export const ABILITY_METADATA_KEY = 'required_ability';

/**
 * Decorator to specify required ability for a controller method
 * @param action - The action required (e.g., 'CREATE', 'VIEW', 'EDIT', 'DELETE')
 * @param subject - The subject/resource (e.g., 'Account', 'Invoice', etc.)
 */
export const RequireAbility = (
  action: string,
  subject: string
): MethodDecorator => {
  return SetMetadata(ABILITY_METADATA_KEY, { action, subject });
};

/**
 * Decorator to specify multiple required abilities for a controller method
 * @param abilities - Array of required abilities
 */
export const RequireAbilities = (
  ...abilities: RequiredAbility[]
): MethodDecorator => {
  return SetMetadata(ABILITY_METADATA_KEY, abilities);
};