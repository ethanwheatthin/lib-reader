export interface Shelf {
  id: string;
  name: string;
  /** Hex color for shelf visual identification */
  color: string;
  /** ISO date string */
  createdAt: string;
  /** IDs of documents assigned to this shelf */
  documentIds: string[];
  /** Display order */
  order: number;
}

export const DEFAULT_SHELF_COLORS = [
  '#FF6B6B', // Red
  '#4ECDC4', // Teal
  '#45B7D1', // Blue
  '#FFA07A', // Coral
  '#98D8C8', // Mint
  '#F7DC6F', // Yellow
  '#BB8FCE', // Purple
  '#85C1E2', // Sky Blue
  '#F8B500', // Orange
  '#95E1D3', // Aqua
];
