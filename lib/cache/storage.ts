import { CachedData } from "@/types/portfolio";

const isBrowser = typeof window !== "undefined";

export class CacheManager {
  private storage: Storage;

  constructor(storageType: "local" | "session" = "local") {
    if (!isBrowser) {
      // Mock storage for SSR
      this.storage = {
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {},
        clear: () => {},
        key: () => null,
        length: 0,
      };
      return;
    }

    this.storage = storageType === "local" ? localStorage : sessionStorage;
  }

  set<T>(key: string, data: T, ttlMinutes: number = 60): void {
    if (!isBrowser) return;

    const cachedData: CachedData<T> = {
      data,
      timestamp: Date.now(),
      ttl: ttlMinutes * 60 * 1000, // Convert to milliseconds
    };

    try {
      this.storage.setItem(key, JSON.stringify(cachedData));
    } catch (error) {
      console.error("Failed to cache data:", error);
      // Handle quota exceeded
      if (error instanceof Error && error.name === "QuotaExceededError") {
        this.clearOldest();
        // Retry
        try {
          this.storage.setItem(key, JSON.stringify(cachedData));
        } catch (retryError) {
          console.error("Failed to cache data after clearing:", retryError);
        }
      }
    }
  }

  get<T>(key: string): T | null {
    if (!isBrowser) return null;

    try {
      const item = this.storage.getItem(key);
      if (!item) return null;

      const cachedData: CachedData<T> = JSON.parse(item);
      const now = Date.now();

      // Check if expired
      if (now - cachedData.timestamp > cachedData.ttl) {
        this.storage.removeItem(key);
        return null;
      }

      return cachedData.data;
    } catch (error) {
      console.error("Failed to retrieve cached data:", error);
      return null;
    }
  }

  remove(key: string): void {
    if (!isBrowser) return;
    this.storage.removeItem(key);
  }

  clear(): void {
    if (!isBrowser) return;
    this.storage.clear();
  }

  has(key: string): boolean {
    if (!isBrowser) return false;
    return this.get(key) !== null;
  }

  private clearOldest(): void {
    if (!isBrowser) return;

    const keys: string[] = [];
    const timestamps: number[] = [];

    // Collect all cached items with timestamps
    for (let i = 0; i < this.storage.length; i++) {
      const key = this.storage.key(i);
      if (key) {
        try {
          const item = this.storage.getItem(key);
          if (item) {
            const cachedData = JSON.parse(item);
            keys.push(key);
            timestamps.push(cachedData.timestamp || 0);
          }
        } catch (error) {
          // Invalid JSON, remove it
          this.storage.removeItem(key);
        }
      }
    }

    // Find and remove oldest
    if (keys.length > 0) {
      const oldestIndex = timestamps.indexOf(Math.min(...timestamps));
      this.storage.removeItem(keys[oldestIndex]);
    }
  }

  getCacheAge(key: string): number | null {
    if (!isBrowser) return null;

    try {
      const item = this.storage.getItem(key);
      if (!item) return null;

      const cachedData = JSON.parse(item);
      return Date.now() - cachedData.timestamp;
    } catch (error) {
      return null;
    }
  }
}

// Create instances
export const localCache = new CacheManager("local");
export const sessionCache = new CacheManager("session");

// Helper functions for common cache keys
export const getCacheKey = {
  balances: (address: string, chainId: number) => `balances_${address}_${chainId}`,
  transactions: (address: string, chainId: number) => `transactions_${address}_${chainId}`,
  defiPositions: (address: string, protocol: string, chainId: number) =>
    `defi_${protocol}_${address}_${chainId}`,
  price: (tokenAddress: string, chainId: number) => `price_${tokenAddress}_${chainId}`,
  priceHistory: (tokenAddress: string, chainId: number, timestamp: number) =>
    `price_history_${tokenAddress}_${chainId}_${timestamp}`,
  portfolio: (address: string) => `portfolio_${address}`,
  walletInfo: (address: string) => `wallet_info_${address}`,
  blockTimestamp: (blockNumber: number, chainId: number) => `block_timestamp_${blockNumber}_${chainId}`,
};
