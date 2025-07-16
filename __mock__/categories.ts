import * as schema from '../src/db/schema';

// Mock category data
export const mockCategoryResult: schema.Category = {
  id: 'category-1',
  name: 'Food',
  color: '#FF5733',
  icon: 'ShoppingCart',
  userId: 'user-1',
  isDefault: false,
  isDeleted: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

export const mockGlobalCategoryResult: schema.Category = {
  id: 'global-category-1',
  name: 'Transport',
  color: '#33FF57',
  icon: 'Car',
  userId: null,
  isDefault: false,
  isDeleted: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

export const mockDefaultCategoryResult: schema.Category = {
  id: 'default-category-1',
  name: 'Other',
  color: '#5733FF',
  icon: 'Package',
  userId: null,
  isDefault: true,
  isDeleted: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

export const mockDeletedCategoryResult: schema.Category = {
  id: 'deleted-category-1',
  name: 'Deleted Category',
  color: '#FF3357',
  icon: 'Trash',
  userId: 'user-1',
  isDefault: false,
  isDeleted: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// Collection of categories
export const mockCategoriesResults: schema.Category[] = [
  mockCategoryResult,
  mockGlobalCategoryResult,
  mockDefaultCategoryResult
];
