export interface ShoppingItem {
  id: string;
  name: string;
  quantity: number;
  isBought: boolean;
  orderIndex: number;
  priceEstimateIls: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface DeletedItem extends ShoppingItem {
  deletedAt: number;
}
