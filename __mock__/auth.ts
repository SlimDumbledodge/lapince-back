import * as schema from '../src/db/schema'
import ms from 'ms'

export const mockUsersResult: schema.User = {
  id: 'uuid_string',
  firstName: 'John',
  lastName: 'DOE',
  email: 'admin@admin.com',
  password: '$2b$10$gA1jhE5r1FZmj1F5hTRnp.P2Kk3FNadEZemVMdeeIvAeuwTCr5w.C', // admin
  accountType: 'in-app',
  locale: 'fr-FR',
  avatar: 'https://example.com/avatar.jpg',
  firstLogin: false,
  verifiedEmail: true,
  createdAt: new Date(),
  updatedAt: new Date(),
}

export const mockAccessToken : string = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'

export const expectedUser = {
  user: {
    id: 'uuid_string',
    email: 'admin@admin.com',
    firstName: 'John',
    lastName: 'DOE',
    accountName: 'My Account',
    amount: 1000,
  },
  sessionId: 'uuid_string',
  accessToken: mockAccessToken,
  accessTokenExpiresAt: new Date(Date.now() + ms('15m')),
  refreshToken: mockAccessToken,
  refreshTokenExpiresAt: new Date(Date.now() + ms('6h')),
}