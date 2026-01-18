// Product size options based on category
// Each category has its own set of common sizes

export interface SizeOption {
  label: string;
  value: string;
}

export interface CategorySizes {
  categoryId: string;
  unit: string;
  sizes: SizeOption[];
}

// Size options per category
export const CATEGORY_SIZES: CategorySizes[] = [
  {
    categoryId: "dairy",
    unit: "נפח/משקל",
    sizes: [
      { label: "1 ליטר", value: "1 ליטר" },
      { label: "1.5 ליטר", value: "1.5 ליטר" },
      { label: "3 ליטר", value: "3 ליטר" },
      { label: "0.5 ליטר", value: "0.5 ליטר" },
      { label: "200 גרם", value: "200 גרם" },
      { label: "250 גרם", value: "250 גרם" },
      { label: "300 גרם", value: "300 גרם" },
      { label: "500 גרם", value: "500 גרם" },
      { label: "1 ק״ג", value: "1 ק״ג" },
    ],
  },
  {
    categoryId: "beverages",
    unit: "נפח",
    sizes: [
      { label: "330 מ״ל", value: "330 מ״ל" },
      { label: "500 מ״ל", value: "500 מ״ל" },
      { label: "1 ליטר", value: "1 ליטר" },
      { label: "1.5 ליטר", value: "1.5 ליטר" },
      { label: "2 ליטר", value: "2 ליטר" },
      { label: "6 פחיות", value: "6 פחיות" },
    ],
  },
  {
    categoryId: "bread",
    unit: "כמות",
    sizes: [
      { label: "1 יחידה", value: "1 יחידה" },
      { label: "חצי", value: "חצי" },
      { label: "6 יחידות", value: "6 יחידות" },
      { label: "12 יחידות", value: "12 יחידות" },
    ],
  },
  {
    categoryId: "eggs",
    unit: "כמות",
    sizes: [
      { label: "12 ביצים", value: "12 ביצים" },
      { label: "18 ביצים", value: "18 ביצים" },
      { label: "30 ביצים", value: "30 ביצים" },
      { label: "6 ביצים", value: "6 ביצים" },
    ],
  },
  {
    categoryId: "grains",
    unit: "משקל",
    sizes: [
      { label: "500 גרם", value: "500 גרם" },
      { label: "1 ק״ג", value: "1 ק״ג" },
      { label: "250 גרם", value: "250 גרם" },
      { label: "400 גרם", value: "400 גרם" },
    ],
  },
  {
    categoryId: "oils",
    unit: "נפח",
    sizes: [
      { label: "500 מ״ל", value: "500 מ״ל" },
      { label: "750 מ״ל", value: "750 מ״ל" },
      { label: "1 ליטר", value: "1 ליטר" },
      { label: "2 ליטר", value: "2 ליטר" },
    ],
  },
  {
    categoryId: "canned",
    unit: "משקל/כמות",
    sizes: [
      { label: "פחית אחת", value: "פחית אחת" },
      { label: "4 פחיות", value: "4 פחיות" },
      { label: "185 גרם", value: "185 גרם" },
      { label: "400 גרם", value: "400 גרם" },
      { label: "560 גרם", value: "560 גרם" },
    ],
  },
  {
    categoryId: "meat",
    unit: "משקל",
    sizes: [
      { label: "500 גרם", value: "500 גרם" },
      { label: "1 ק״ג", value: "1 ק״ג" },
      { label: "700 גרם", value: "700 גרם" },
      { label: "300 גרם", value: "300 גרם" },
    ],
  },
  {
    categoryId: "fish",
    unit: "משקל",
    sizes: [
      { label: "200 גרם", value: "200 גרם" },
      { label: "300 גרם", value: "300 גרם" },
      { label: "500 גרם", value: "500 גרם" },
      { label: "1 ק״ג", value: "1 ק״ג" },
    ],
  },
  {
    categoryId: "fruits",
    unit: "משקל/כמות",
    sizes: [
      { label: "1 ק״ג", value: "1 ק״ג" },
      { label: "500 גרם", value: "500 גרם" },
      { label: "יחידה אחת", value: "יחידה אחת" },
      { label: "שקית", value: "שקית" },
    ],
  },
  {
    categoryId: "vegetables",
    unit: "משקל/כמות",
    sizes: [
      { label: "1 ק״ג", value: "1 ק״ג" },
      { label: "500 גרם", value: "500 גרם" },
      { label: "יחידה אחת", value: "יחידה אחת" },
      { label: "אגודה", value: "אגודה" },
      { label: "שקית", value: "שקית" },
    ],
  },
  {
    categoryId: "snacks",
    unit: "משקל",
    sizes: [
      { label: "80 גרם", value: "80 גרם" },
      { label: "100 גרם", value: "100 גרם" },
      { label: "200 גרם", value: "200 גרם" },
      { label: "מארז משפחתי", value: "מארז משפחתי" },
    ],
  },
  {
    categoryId: "frozen",
    unit: "משקל",
    sizes: [
      { label: "400 גרם", value: "400 גרם" },
      { label: "500 גרם", value: "500 גרם" },
      { label: "1 ק״ג", value: "1 ק״ג" },
      { label: "מארז 4", value: "מארז 4" },
    ],
  },
  {
    categoryId: "household",
    unit: "כמות",
    sizes: [
      { label: "יחידה אחת", value: "יחידה אחת" },
      { label: "זוג", value: "זוג" },
      { label: "מארז 8", value: "מארז 8" },
      { label: "מארז 12", value: "מארז 12" },
      { label: "24 גלילים", value: "24 גלילים" },
      { label: "32 גלילים", value: "32 גלילים" },
      { label: "500 מ״ל", value: "500 מ״ל" },
      { label: "1 ליטר", value: "1 ליטר" },
    ],
  },
  {
    categoryId: "baby",
    unit: "כמות/משקל",
    sizes: [
      { label: "מארז קטן", value: "מארז קטן" },
      { label: "מארז גדול", value: "מארז גדול" },
      { label: "ג'מבו", value: "ג'מבו" },
      { label: "200 גרם", value: "200 גרם" },
    ],
  },
  {
    categoryId: "spices",
    unit: "משקל",
    sizes: [
      { label: "50 גרם", value: "50 גרם" },
      { label: "100 גרם", value: "100 גרם" },
      { label: "500 גרם", value: "500 גרם" },
      { label: "1 ק״ג", value: "1 ק״ג" },
    ],
  },
  {
    categoryId: "legumes",
    unit: "משקל",
    sizes: [
      { label: "500 גרם", value: "500 גרם" },
      { label: "1 ק״ג", value: "1 ק״ג" },
      { label: "400 גרם", value: "400 גרם" },
    ],
  },
  {
    categoryId: "baking",
    unit: "משקל",
    sizes: [
      { label: "1 ק״ג", value: "1 ק״ג" },
      { label: "500 גרם", value: "500 גרם" },
      { label: "400 גרם", value: "400 גרם" },
      { label: "צנצנת", value: "צנצנת" },
    ],
  },
];

// Default sizes for unknown categories
export const DEFAULT_SIZES: SizeOption[] = [
  { label: "יחידה אחת", value: "יחידה אחת" },
  { label: "מארז", value: "מארז" },
  { label: "500 גרם", value: "500 גרם" },
  { label: "1 ק״ג", value: "1 ק״ג" },
];

// Get sizes for a specific category
export function getSizesForCategory(categoryId: string): SizeOption[] {
  const categorySizes = CATEGORY_SIZES.find(c => c.categoryId === categoryId);
  return categorySizes?.sizes ?? DEFAULT_SIZES;
}
