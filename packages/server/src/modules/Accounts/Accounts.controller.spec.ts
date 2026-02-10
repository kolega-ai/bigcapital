import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AccountsController } from './Accounts.controller';
import { AccountsApplication } from './AccountsApplication.service';
import { AbilityGuard } from '@/common/guards/Ability.guard';
import { AccountAction } from '@/interfaces/Account';

describe('AccountsController Authorization', () => {
  let controller: AccountsController;
  let guard: AbilityGuard;
  let mockAccountsApplication: jest.Mocked<AccountsApplication>;
  let mockAbility: any;

  beforeEach(async () => {
    mockAccountsApplication = {
      createAccount: jest.fn(),
      editAccount: jest.fn(),
      deleteAccount: jest.fn(),
      bulkDeleteAccounts: jest.fn(),
      validateBulkDeleteAccounts: jest.fn(),
      activateAccount: jest.fn(),
      inactivateAccount: jest.fn(),
      getAccounts: jest.fn(),
      getAccount: jest.fn(),
      getAccountTypes: jest.fn(),
      getAccountsTransactions: jest.fn(),
    } as any;

    mockAbility = {
      can: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AccountsController],
      providers: [
        {
          provide: AccountsApplication,
          useValue: mockAccountsApplication,
        },
        {
          provide: AbilityGuard,
          useClass: AbilityGuard,
        },
        {
          provide: Reflector,
          useClass: Reflector,
        },
      ],
    }).compile();

    controller = module.get<AccountsController>(AccountsController);
    guard = module.get<AbilityGuard>(AbilityGuard);
  });

  describe('createAccount', () => {
    it('should allow access with CREATE permission', async () => {
      mockAbility.can.mockReturnValue(true);
      const createAccountDto = { name: 'Test Account', code: 'TA001' };
      
      const mockContext = {
        getHandler: () => controller.createAccount,
        switchToHttp: () => ({
          getRequest: () => ({
            ability: mockAbility,
            user: { id: 1 },
          }),
        }),
      } as any;

      const canActivate = await guard.canActivate(mockContext);
      expect(canActivate).toBe(true);
      expect(mockAbility.can).toHaveBeenCalledWith(AccountAction.CREATE, 'Account');
    });

    it('should deny access without CREATE permission', async () => {
      mockAbility.can.mockReturnValue(false);
      
      const mockContext = {
        getHandler: () => controller.createAccount,
        switchToHttp: () => ({
          getRequest: () => ({
            ability: mockAbility,
            user: { id: 1 },
          }),
        }),
      } as any;

      await expect(guard.canActivate(mockContext)).rejects.toThrow(ForbiddenException);
      expect(mockAbility.can).toHaveBeenCalledWith(AccountAction.CREATE, 'Account');
    });
  });

  describe('editAccount', () => {
    it('should allow access with EDIT permission', async () => {
      mockAbility.can.mockReturnValue(true);
      
      const mockContext = {
        getHandler: () => controller.editAccount,
        switchToHttp: () => ({
          getRequest: () => ({
            ability: mockAbility,
            user: { id: 1 },
          }),
        }),
      } as any;

      const canActivate = await guard.canActivate(mockContext);
      expect(canActivate).toBe(true);
      expect(mockAbility.can).toHaveBeenCalledWith(AccountAction.EDIT, 'Account');
    });

    it('should deny access without EDIT permission', async () => {
      mockAbility.can.mockReturnValue(false);
      
      const mockContext = {
        getHandler: () => controller.editAccount,
        switchToHttp: () => ({
          getRequest: () => ({
            ability: mockAbility,
            user: { id: 1 },
          }),
        }),
      } as any;

      await expect(guard.canActivate(mockContext)).rejects.toThrow(ForbiddenException);
      expect(mockAbility.can).toHaveBeenCalledWith(AccountAction.EDIT, 'Account');
    });
  });

  describe('deleteAccount', () => {
    it('should allow access with DELETE permission', async () => {
      mockAbility.can.mockReturnValue(true);
      
      const mockContext = {
        getHandler: () => controller.deleteAccount,
        switchToHttp: () => ({
          getRequest: () => ({
            ability: mockAbility,
            user: { id: 1 },
          }),
        }),
      } as any;

      const canActivate = await guard.canActivate(mockContext);
      expect(canActivate).toBe(true);
      expect(mockAbility.can).toHaveBeenCalledWith(AccountAction.DELETE, 'Account');
    });

    it('should deny access without DELETE permission', async () => {
      mockAbility.can.mockReturnValue(false);
      
      const mockContext = {
        getHandler: () => controller.deleteAccount,
        switchToHttp: () => ({
          getRequest: () => ({
            ability: mockAbility,
            user: { id: 1 },
          }),
        }),
      } as any;

      await expect(guard.canActivate(mockContext)).rejects.toThrow(ForbiddenException);
      expect(mockAbility.can).toHaveBeenCalledWith(AccountAction.DELETE, 'Account');
    });
  });

  describe('bulkDeleteAccounts', () => {
    it('should allow access with DELETE permission', async () => {
      mockAbility.can.mockReturnValue(true);
      
      const mockContext = {
        getHandler: () => controller.bulkDeleteAccounts,
        switchToHttp: () => ({
          getRequest: () => ({
            ability: mockAbility,
            user: { id: 1 },
          }),
        }),
      } as any;

      const canActivate = await guard.canActivate(mockContext);
      expect(canActivate).toBe(true);
      expect(mockAbility.can).toHaveBeenCalledWith(AccountAction.DELETE, 'Account');
    });

    it('should deny access without DELETE permission', async () => {
      mockAbility.can.mockReturnValue(false);
      
      const mockContext = {
        getHandler: () => controller.bulkDeleteAccounts,
        switchToHttp: () => ({
          getRequest: () => ({
            ability: mockAbility,
            user: { id: 1 },
          }),
        }),
      } as any;

      await expect(guard.canActivate(mockContext)).rejects.toThrow(ForbiddenException);
      expect(mockAbility.can).toHaveBeenCalledWith(AccountAction.DELETE, 'Account');
    });
  });

  describe('getAccounts', () => {
    it('should allow access with VIEW permission', async () => {
      mockAbility.can.mockReturnValue(true);
      
      const mockContext = {
        getHandler: () => controller.getAccounts,
        switchToHttp: () => ({
          getRequest: () => ({
            ability: mockAbility,
            user: { id: 1 },
          }),
        }),
      } as any;

      const canActivate = await guard.canActivate(mockContext);
      expect(canActivate).toBe(true);
      expect(mockAbility.can).toHaveBeenCalledWith(AccountAction.VIEW, 'Account');
    });

    it('should deny access without VIEW permission', async () => {
      mockAbility.can.mockReturnValue(false);
      
      const mockContext = {
        getHandler: () => controller.getAccounts,
        switchToHttp: () => ({
          getRequest: () => ({
            ability: mockAbility,
            user: { id: 1 },
          }),
        }),
      } as any;

      await expect(guard.canActivate(mockContext)).rejects.toThrow(ForbiddenException);
      expect(mockAbility.can).toHaveBeenCalledWith(AccountAction.VIEW, 'Account');
    });
  });

  describe('without user ability', () => {
    it('should deny access when ability is missing', async () => {
      const mockContext = {
        getHandler: () => controller.createAccount,
        switchToHttp: () => ({
          getRequest: () => ({
            ability: null, // No ability attached
            user: { id: 1 },
          }),
        }),
      } as any;

      await expect(guard.canActivate(mockContext)).rejects.toThrow(ForbiddenException);
      await expect(guard.canActivate(mockContext)).rejects.toThrow(
        'User abilities not found. Please ensure you are properly authenticated.'
      );
    });
  });

  describe('without authorization requirements', () => {
    it('should allow access to endpoints without @RequireAbility decorator', async () => {
      // Mock a method without @RequireAbility decorator
      const mockHandler = jest.fn();
      
      const mockContext = {
        getHandler: () => mockHandler,
        switchToHttp: () => ({
          getRequest: () => ({
            ability: mockAbility,
            user: { id: 1 },
          }),
        }),
      } as any;

      // Mock reflector to return no metadata (no @RequireAbility decorator)
      const reflector = new Reflector();
      jest.spyOn(reflector, 'get').mockReturnValue(undefined);
      
      const guardWithMockedReflector = new AbilityGuard(reflector);
      const canActivate = await guardWithMockedReflector.canActivate(mockContext);
      
      expect(canActivate).toBe(true);
      expect(mockAbility.can).not.toHaveBeenCalled();
    });
  });
});