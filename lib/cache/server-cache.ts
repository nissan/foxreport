/**
 * Server-side in-memory cache for token prices
 * Shared across all client requests
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

class ServerCache {
  private cache = new Map<string, CacheEntry<any>>();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Clean up expired entries every 5 minutes
    if (typeof window === "undefined") {
      this.cleanupInterval = setInterval(() => {
        this.cleanup();
      }, 5 * 60 * 1000);
    }
  }

  set<T>(key: string, data: T, ttlMinutes: number): void {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl: ttlMinutes * 60 * 1000,
    };
    this.cache.set(key, entry);
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  has(key: string): boolean {
    return this.get(key) !== null;
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  private cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    this.cache.forEach((entry, key) => {
      if (now - entry.timestamp > entry.ttl) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach((key) => this.cache.delete(key));

    if (keysToDelete.length > 0) {
      console.log(`[ServerCache] Cleaned up ${keysToDelete.length} expired entries`);
    }
  }

  getStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}

// Singleton instance - shared across all requests
export const serverCache = new ServerCache();

/**
 * Cache key generators for server-side cache
 */
export const serverCacheKeys = {
  tokenPrice: (address: string, chainId: number) =>
    `price:${address.toLowerCase()}:${chainId}`,

  historicalPrice: (address: string, chainId: number, timestamp: number) =>
    `historical:${address.toLowerCase()}:${chainId}:${timestamp}`,

  batchPrices: (chainId: number) =>
    `batch:${chainId}`,

  commonTokens: () =>
    `common:tokens`,
};
