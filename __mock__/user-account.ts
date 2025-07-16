import { currencys } from '../src/db/constants/currency';

export const mockUserAccount = {
  id: 'account-1',
  userId: 'user-1',
  accountName: 'Main Account',
  amount: 1000,
  currency: 'EUR' as typeof currencys[number],
  createdAt: new Date('2024-01-01T00:00:00.000Z'),
  updatedAt: new Date('2024-01-01T00:00:00.000Z'),
};

export const mockUserAccounts = [
  mockUserAccount,
  {
    id: 'account-2',
    userId: 'user-2',
    accountName: 'Secondary Account',
    amount: 2000,
    currency: 'USD' as typeof currencys[number],
    createdAt: new Date('2024-01-02T00:00:00.000Z'),
    updatedAt: new Date('2024-01-02T00:00:00.000Z'),
  }
];

export const mockCreateUserAccountDto = {
  accountName: 'New Account',
  amount: 500,
  currency: 'EUR' as typeof currencys[number],
};

export const mockUpdateUserAccountDto = {
  accountName: 'Updated Account',
  amount: 1500,
};

export const mockUserAccountWithNegativeBalance = {
  ...mockUserAccount,
  id: 'account-3',
  amount: -100,
};
