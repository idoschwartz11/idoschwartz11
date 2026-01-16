export interface ShoppingItem {
  id: string;
  name: string;
  userText: string;
  resolvedCanonicalKey: string | null;
  canonical_key: string;
  resolveConfidence: number;
  resolveSource: string;
  quantity: number;
  isBought: boolean;
  orderIndex: number;
  priceEstimateIls: number | null;
  categoryId: string;
  categoryEmoji: string;
  createdAt: number;
  updatedAt: number;
}

export interface DeletedItem extends ShoppingItem {
  deletedAt: number;
}

export interface GroupedItems {
  categoryId: string;
  categoryTitle: string;
  categoryEmoji: string;
  unboughtItems: ShoppingItem[];
  boughtItems: ShoppingItem[];
}
