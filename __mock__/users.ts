export const mockUserResult = {
  id: 'user-1',
  firstName: 'John',
  lastName: 'Doe',
  email: 'john.doe@example.com',
  password: '$2b$10$1234567890123456789012', // hashed password example
  accountType: 'in-app',
  locale: 'fr-FR',
  avatar: 'https://example.com/avatar.jpg',
  firstLogin: true,
  verifiedEmail: true,
  createdAt: new Date('2024-01-01T00:00:00.000Z'),
  updatedAt: new Date('2024-01-01T00:00:00.000Z'),
};

export const mockUpdatedUserResult = {
  ...mockUserResult,
  firstName: 'John Updated',
  lastName: 'Doe Updated',
  email: 'john.updated@example.com',
  locale: 'en-US',
  avatar: 'new-avatar.jpg',
  updatedAt: new Date('2024-01-02T00:00:00.000Z'),
};

export const mockUserWithAccountResult = {
  ...mockUserResult,
  accountId: 'account-1',
  accountName: 'My Account',
  amount: 1000,
  currency: 'EUR',
};

export const mockFirstLoginResult = {
  ...mockUserResult,
  firstLogin: false,
  updatedAt: new Date('2024-01-02T00:00:00.000Z'),
};

export const mockGoogleUserResult = {
  ...mockUserResult,
  accountType: 'google',
};

export const mockUsersResults = [
  mockUserResult,
  {
    ...mockUserResult,
    id: 'user-2',
    firstName: 'Jane',
    lastName: 'Smith',
    email: 'jane.smith@example.com',
  },
];
