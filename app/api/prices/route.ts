import { NextRequest, NextResponse } from "next/server";
import { serverCache, serverCacheKeys } from "@/lib/cache/server-cache";
import { ChainId } from "@/types/portfolio";

// Common tokens that should always be cached with longer TTL
const COMMON_TOKENS: Record<string, { coinId: string; chainIds: ChainId[] }> = {
  "0x0000000000000000000000000000000000000000": {
    coinId: "ethereum",
    chainIds: [1, 42161, 8453],
  },
  "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48": {
    coinId: "usd-coin",
    chainIds: [1],
  },
  "0xdac17f958d2ee523a2206206994597c13d831ec7": {
    coinId: "tether",
    chainIds: [1],
  },
  "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599": {
    coinId: "wrapped-bitcoin",
    chainIds: [1],
  },
  "0x6b175474e89094c44da98b954eedeac495271d0f": {
    coinId: "dai",
    chainIds: [1],
  },
  "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2": {
    coinId: "weth",
    chainIds: [1],
  },
  // Arbitrum
  "0xff970a61a04b1ca14834a43f5de4533ebddb5cc8": {
    coinId: "usd-coin",
    chainIds: [42161],
  },
  "0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9": {
    coinId: "tether",
    chainIds: [42161],
  },
  "0xfc5a1a6eb076a2c7ad06ed22c90d7e710e35ad0a": {
    coinId: "gmx",
    chainIds: [42161],
  },
  // Base
  "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913": {
    coinId: "usd-coin",
    chainIds: [8453],
  },
};

const COINGECKO_PLATFORMS: Record<ChainId, string> = {
  1: "ethereum",
  42161: "arbitrum-one",
  8453: "base",
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(url: string, maxRetries = 3): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url);

      if (response.status === 429) {
        const waitTime = Math.pow(2, attempt) * 1000;
        console.warn(`[API] Rate limited, waiting ${waitTime}ms`);
        await sleep(waitTime);
        continue;
      }

      return response;
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxRetries - 1) {
        await sleep(1000 * (attempt + 1));
      }
    }
  }

  throw lastError || new Error("Max retries exceeded");
}

async function fetchCoinGeckoPrice(
  address: string,
  chainId: ChainId
): Promise<number | null> {
  const normalizedAddress = address.toLowerCase();
  const tokenInfo = COMMON_TOKENS[normalizedAddress];

  try {
    if (tokenInfo) {
      // Fetch price by coin ID (more reliable for common tokens)
      const response = await fetchWithRetry(
        `https://api.coingecko.com/api/v3/simple/price?ids=${tokenInfo.coinId}&vs_currencies=usd`
      );

      if (!response.ok) {
        console.error(`[API] CoinGecko error: ${response.status}`);
        return null;
      }

      const data = await response.json();
      return data[tokenInfo.coinId]?.usd || null;
    } else {
      // Fetch price by contract address
      const platform = COINGECKO_PLATFORMS[chainId];
      const response = await fetchWithRetry(
        `https://api.coingecko.com/api/v3/simple/token_price/${platform}?contract_addresses=${address}&vs_currencies=usd`
      );

      if (!response.ok) {
        console.error(`[API] CoinGecko error: ${response.status}`);
        return null;
      }

      const data = await response.json();
      return data[normalizedAddress]?.usd || null;
    }
  } catch (error) {
    console.error(`[API] Error fetching price for ${address}:`, error);
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tokens } = body as {
      tokens: Array<{ address: string; chainId: ChainId }>;
    };

    if (!tokens || !Array.isArray(tokens)) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    const priceMap: Record<string, number> = {};
    const tokensToFetch: Array<{ address: string; chainId: ChainId }> = [];

    // Check cache first
    for (const { address, chainId } of tokens) {
      const cacheKey = serverCacheKeys.tokenPrice(address, chainId);
      const cachedPrice = serverCache.get<number>(cacheKey);

      if (cachedPrice !== null) {
        const key = `${address.toLowerCase()}_${chainId}`;
        priceMap[key] = cachedPrice;
      } else {
        tokensToFetch.push({ address, chainId });
      }
    }

    console.log(
      `[API] Cache hit: ${tokens.length - tokensToFetch.length}/${tokens.length} tokens`
    );

    // Fetch missing prices in batches
    const BATCH_SIZE = 5;
    const DELAY_MS = 500;

    for (let i = 0; i < tokensToFetch.length; i += BATCH_SIZE) {
      const batch = tokensToFetch.slice(i, i + BATCH_SIZE);

      await Promise.allSettled(
        batch.map(async ({ address, chainId }) => {
          const price = await fetchCoinGeckoPrice(address, chainId);

          if (price !== null) {
            const key = `${address.toLowerCase()}_${chainId}`;
            priceMap[key] = price;

            // Cache with longer TTL for common tokens (30 min vs 5 min)
            const isCommon = COMMON_TOKENS[address.toLowerCase()];
            const ttl = isCommon ? 30 : 5;

            const cacheKey = serverCacheKeys.tokenPrice(address, chainId);
            serverCache.set(cacheKey, price, ttl);

            console.log(
              `[API] Fetched ${address} on chain ${chainId}: $${price} (TTL: ${ttl}m)`
            );
          }
        })
      );

      // Add delay between batches
      if (i + BATCH_SIZE < tokensToFetch.length) {
        await sleep(DELAY_MS);
      }
    }

    return NextResponse.json({
      prices: priceMap,
      cached: tokens.length - tokensToFetch.length,
      fetched: tokensToFetch.length,
      total: tokens.length,
    });
  } catch (error) {
    console.error("[API] Error in /api/prices:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Optional: Add a GET endpoint to check cache stats
export async function GET() {
  const stats = serverCache.getStats();
  return NextResponse.json({
    message: "Price API is running",
    cache: stats,
  });
}
