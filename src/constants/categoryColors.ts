// Category color mapping - soft, pleasant tints
// Format: [light mode tint, dark mode tint, accent color for indicator]

export interface CategoryColor {
  bg: string;
  indicator: string;
}

export const CATEGORY_COLORS: Record<string, CategoryColor> = {
  dairy: {
    bg: 'bg-sky-50 dark:bg-sky-950/40',
    indicator: 'bg-sky-400 dark:bg-sky-500',
  },
  bread: {
    bg: 'bg-amber-50 dark:bg-amber-950/40',
    indicator: 'bg-amber-400 dark:bg-amber-500',
  },
  eggs: {
    bg: 'bg-yellow-50 dark:bg-yellow-950/40',
    indicator: 'bg-yellow-400 dark:bg-yellow-500',
  },
  grains: {
    bg: 'bg-orange-50 dark:bg-orange-950/40',
    indicator: 'bg-orange-400 dark:bg-orange-500',
  },
  oils: {
    bg: 'bg-lime-50 dark:bg-lime-950/40',
    indicator: 'bg-lime-500 dark:bg-lime-500',
  },
  baking: {
    bg: 'bg-rose-50 dark:bg-rose-950/40',
    indicator: 'bg-rose-400 dark:bg-rose-500',
  },
  canned: {
    bg: 'bg-slate-100 dark:bg-slate-800/40',
    indicator: 'bg-slate-400 dark:bg-slate-500',
  },
  beverages: {
    bg: 'bg-cyan-50 dark:bg-cyan-950/40',
    indicator: 'bg-cyan-400 dark:bg-cyan-500',
  },
  meat: {
    bg: 'bg-red-50 dark:bg-red-950/40',
    indicator: 'bg-red-400 dark:bg-red-500',
  },
  fish: {
    bg: 'bg-blue-50 dark:bg-blue-950/40',
    indicator: 'bg-blue-400 dark:bg-blue-500',
  },
  fruits: {
    bg: 'bg-pink-50 dark:bg-pink-950/40',
    indicator: 'bg-pink-400 dark:bg-pink-500',
  },
  vegetables: {
    bg: 'bg-green-50 dark:bg-green-950/40',
    indicator: 'bg-green-500 dark:bg-green-500',
  },
  snacks: {
    bg: 'bg-fuchsia-50 dark:bg-fuchsia-950/40',
    indicator: 'bg-fuchsia-400 dark:bg-fuchsia-500',
  },
  frozen: {
    bg: 'bg-indigo-50 dark:bg-indigo-950/40',
    indicator: 'bg-indigo-400 dark:bg-indigo-500',
  },
  household: {
    bg: 'bg-purple-50 dark:bg-purple-950/40',
    indicator: 'bg-purple-400 dark:bg-purple-500',
  },
  baby: {
    bg: 'bg-teal-50 dark:bg-teal-950/40',
    indicator: 'bg-teal-400 dark:bg-teal-500',
  },
  spices: {
    bg: 'bg-orange-50 dark:bg-orange-950/40',
    indicator: 'bg-orange-500 dark:bg-orange-500',
  },
  legumes: {
    bg: 'bg-emerald-50 dark:bg-emerald-950/40',
    indicator: 'bg-emerald-500 dark:bg-emerald-500',
  },
  other: {
    bg: 'bg-gray-50 dark:bg-gray-800/40',
    indicator: 'bg-gray-400 dark:bg-gray-500',
  },
};

export function getCategoryColor(categoryId: string): CategoryColor {
  return CATEGORY_COLORS[categoryId] || CATEGORY_COLORS.other;
}

// Expensive threshold in ILS
export const EXPENSIVE_THRESHOLD = 30;
