export type AssetCategory = '국내주식' | '해외주식' | '단기채' | '금은' | '현금' | 'ETF';

export interface StockItem {
  id: string;
  name: string;
  ticker?: string; // Ticker / Stock Code (optional for backward compatibility, but highly recommended)
  purchasePrice: number; // For foreign stock, in USD; for domestic, in KRW
  quantity: number;
  currentPrice: number; // For foreign stock, in USD; for domestic, in KRW
  category: AssetCategory;
  isForeign: boolean; // NVIDIA etc.
}

export interface Account {
  id: string;
  name: string;
  stocks: StockItem[];
  cash: number; // 현금
}

export interface RebalancingTarget {
  name: string;
  targetWeight: number; // in Percentage, e.g. 5.0 for 5%
}
