# Authorization Decorators

This directory contains the authorization decorators used to protect API endpoints with role-based access control.

## RequireAbility Decorator

The `@RequireAbility` decorator is used to specify that a controller method requires specific permissions.

### Usage

```typescript
import { RequireAbility } from '@/common/decorators/RequireAbility.decorator';
import { AccountAction } from '@/interfaces/Account';

@Controller('accounts')
@UseGuards(AbilityGuard)
export class AccountsController {
  
  @Post()
  @RequireAbility(AccountAction.CREATE, 'Account')
  async createAccount(@Body() dto: CreateAccountDTO) {
    // Only users with CREATE permission on Account subject can access this
    return this.service.create(dto);
  }

  @Get(':id')
  @RequireAbility(AccountAction.VIEW, 'Account')
  async getAccount(@Param('id') id: number) {
    // Only users with VIEW permission on Account subject can access this
    return this.service.findOne(id);
  }

  @Put(':id')
  @RequireAbility(AccountAction.EDIT, 'Account')
  async updateAccount(@Param('id') id: number, @Body() dto: UpdateAccountDTO) {
    // Only users with EDIT permission on Account subject can access this
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @RequireAbility(AccountAction.DELETE, 'Account')
  async deleteAccount(@Param('id') id: number) {
    // Only users with DELETE permission on Account subject can access this
    return this.service.remove(id);
  }
}
```

### Multiple Abilities

For endpoints that require multiple permissions, use `@RequireAbilities`:

```typescript
import { RequireAbilities } from '@/common/decorators/RequireAbility.decorator';

@Post('complex-operation')
@RequireAbilities(
  { action: AccountAction.VIEW, subject: 'Account' },
  { action: AccountAction.EDIT, subject: 'Account' }
)
async complexOperation() {
  // User needs both VIEW and EDIT permissions
  return this.service.complexOperation();
}
```

## AbilityGuard

The `AbilityGuard` works with the `@RequireAbility` decorator to enforce permissions. It:

1. Reads the required abilities from the decorator metadata
2. Checks the user's abilities (attached by the global `AuthorizationGuard`)
3. Allows or denies access based on the permission check
4. Logs authorization attempts for audit purposes

### Features

- **Automatic Integration**: Works with the existing CASL-based permission system
- **Audit Logging**: Logs all authorization attempts with user and action details
- **Clear Error Messages**: Provides meaningful error messages for authorization failures
- **Performance**: Leverages cached user abilities for fast permission checks

### Error Handling

When authorization fails, the guard throws a `ForbiddenException` with a descriptive message:

```
Access denied. You don't have permission to delete account.
```

This provides clear feedback to the client about why the request was denied.