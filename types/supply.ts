export type SupplyStatus = "正常" | "低庫存" | "缺貨";

export interface SupplyItem {
  id: string;
  number: string;
  category: string;
  categoryCode: string;
  name: string;
  remainingQuantity: number;
  unit: string;
  safetyStockThreshold: number;
  status: SupplyStatus;
  note?: string;
  rawQuantity?: string;
  gapToThreshold: number;
}

export interface SupplySummary {
  totalItems: number;
  normalItems: number;
  lowStockItems: number;
  outOfStockItems: number;
}

export interface CategoryStat {
  category: string;
  categoryCode: string;
  total: number;
  normal: number;
  lowStock: number;
  outOfStock: number;
}

export interface SuppliesMeta {
  generatedAt: string;
  thresholdMode: "sheet" | "derived" | "mixed";
  warning?: string;
}

export interface SuppliesApiResponse {
  supplies: SupplyItem[];
  summary: SupplySummary;
  categoryStats: CategoryStat[];
  topRestock: SupplyItem[];
  meta: SuppliesMeta;
}
