export const mockNotification = {
  id: 'notification-1',
  userId: 'user-1',
  type: 'reminder',
  message: 'Your account balance is negative: -100 EUR.',
  level: 'warning',
  isRead: false,
  createdAt: new Date('2024-01-01T00:00:00.000Z'),
  updatedAt: new Date('2024-01-01T00:00:00.000Z'),
};

export const mockNotifications = [
  mockNotification,
  {
    id: 'notification-2',
    userId: 'user-1',
    type: 'transaction',
    message: 'New transaction recorded',
    level: 'info',
    isRead: false,
    createdAt: new Date('2024-01-02T00:00:00.000Z'),
    updatedAt: new Date('2024-01-02T00:00:00.000Z'),
  }
];

export const mockCreateNotificationDto = {
  level: 'warning',
  type: 'reminder',
  message: 'Your account balance is negative: -100 EUR.',
};
