/** Warframe.market API response types. */

export type OrderType = "buy" | "sell";

export type ItemRank = number; // 0–maxRank

export interface MarketOrder {
  readonly id: string;
  readonly userId: string;
  readonly userName: string;
  readonly orderType: OrderType;
  readonly platinum: number;
  readonly quantity: number;
  readonly modRank: ItemRank | null;
  readonly createdAt: string; // ISO 8601
  readonly updatedAt: string; // ISO 8601
  readonly isOnline: boolean;
}

export interface MarketItem {
  readonly urlName: string;
  readonly itemName: string;
  readonly thumb: string;
  readonly tags: readonly string[];
}

export interface PriceSnapshot {
  readonly itemUrlName: string;
  readonly datetime: string; // ISO 8601
  readonly avgPrice: number;
  readonly minPrice: number;
  readonly maxPrice: number;
  readonly volume: number;
  readonly median: number;
}
