export const REQUEST_CATEGORIES = [
  'Medical', 
  'Groceries', 
  'Electrical', 
  'Plumbing'
] as const;

export const DISCOVER_CATEGORIES = [
  'All',
  ...REQUEST_CATEGORIES
] as const;

export type CategoryType = typeof REQUEST_CATEGORIES[number];

