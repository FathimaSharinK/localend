export const REQUEST_CATEGORIES = [
  'Moving', 
  'Delivery', 
  'Shopping', 
  'Transportation', 
  'Household', 
  'Technical Help', 
  'Education', 
  'Errands', 
  'Community Support', 
  'Other'
] as const;

export const DISCOVER_CATEGORIES = [
  'All',
  ...REQUEST_CATEGORIES
] as const;
