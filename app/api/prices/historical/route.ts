import { NextRequest, NextResponse } from "next/server";
import { serverCache, serverCacheKeys } from "@/lib/cache/server-cache";
import { ChainId } from "@/types/portfolio";

// Common tokens that should always be cached with longer TTL
const WELL_KNOWN_TOKENS: Record<string, string> = {
  // Ethereum mainnet
  "0x0000000000000000000000000000000000000000": "ethereum", // ETH
  "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48": "usd-coin", // USDC
  "0xdac17f958d2ee523a2206206994597c13d831ec7": "tether", // USDT
  "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599": "wrapped-bitcoin", // WBTC
  "0x6b175474e89094c44da98b954eedeac495271d0f": "dai", // DAI
  "0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9": "aave", // AAVE
  "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984": "uniswap", // UNI
  "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2": "weth", // WETH
  // Arbitrum
  "0xff970a61a04b1ca14834a43f5de4533ebddb5cc8": "usd-coin", // USDC on Arbitrum
  "0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9": "tether", // USDT on Arbitrum
  "0xfc5a1a6eb076a2c7ad06ed22c90d7e710e35ad0a": "gmx", // GMX
  // Base
  "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913": "usd-coin", // USDC on Base
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
        console.warn(`[Historical API] Rate limited, waiting ${waitTime}ms`);
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

async function fetchHistoricalCoinGeckoPrice(
  address: string,
  chainId: ChainId,
  timestamp: number
): Promise<number | null> {
  try {
    const normalizedAddress = address.toLowerCase();
    let coinId = WELL_KNOWN_TOKENS[normalizedAddress];

    // If not a well-known token, try to get coinId from contract address
    if (!coinId) {
      const platform = COINGECKO_PLATFORMS[chainId];

      try {
        // Try to get the coin info by contract address first
        const infoResponse = await fetchWithRetry(
          `https://api.coingecko.com/api/v3/coins/${platform}/contract/${address}`
        );

        if (infoResponse.ok) {
          const info = await infoResponse.json();
          coinId = info.id;
        } else {
          console.warn(
            `[Historical API] Could not resolve coinId for ${address} on chain ${chainId}`
          );
          return null;
        }
      } catch (error) {
        console.warn(
          `[Historical API] Error resolving coinId for ${address}:`,
          error
        );
        return null;
      }
    }

    if (!coinId) {
      return null;
    }

    // CoinGecko /market_chart/range requires timestamps in seconds
    const timestampSec = Math.floor(timestamp / 1000);

    // Query a 1-hour range around the timestamp for better accuracy
    const fromSec = timestampSec - 1800; // 30 min before
    const toSec = timestampSec + 1800; // 30 min after

    const response = await fetchWithRetry(
      `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart/range?vs_currency=usd&from=${fromSec}&to=${toSec}`
    );

    if (!response.ok) {
      console.error(
        `[Historical API] CoinGecko error for ${coinId}: ${response.status}`
      );
      return null;
    }

    const data = await response.json();
    const prices = data.prices as [number, number][] | undefined;

    if (!prices || prices.length === 0) {
      console.warn(`[Historical API] No prices returned for ${coinId}`);
      return null;
    }

    // Find the price closest to our target timestamp
    let closestPrice = prices[0][1];
    let closestDiff = Math.abs(prices[0][0] - timestamp);

    for (const [priceTimestamp, price] of prices) {
      const diff = Math.abs(priceTimestamp - timestamp);
      if (diff < closestDiff) {
        closestDiff = diff;
        closestPrice = price;
      }
    }

    return closestPrice;
  } catch (error) {
    console.error(
      `[Historical API] Error fetching price for ${address}:`,
      error
    );
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { requests } = body as {
      requests: Array<{ address: string; chainId: ChainId; timestamp: number }>;
    };

    if (!requests || !Array.isArray(requests)) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    const priceMap: Record<string, number> = {};
    const requestsToFetch: Array<{
      address: string;
      chainId: ChainId;
      timestamp: number;
    }> = [];

    // Check cache first
    for (const { address, chainId, timestamp } of requests) {
      const cacheKey = serverCacheKeys.historicalPrice(
        address,
        chainId,
        timestamp
      );
      const cachedPrice = serverCache.get<number>(cacheKey);

      if (cachedPrice !== null) {
        const key = `${address.toLowerCase()}_${chainId}_${timestamp}`;
        priceMap[key] = cachedPrice;
      } else {
        requestsToFetch.push({ address, chainId, timestamp });
      }
    }

    console.log(
      `[Historical API] Cache hit: ${requests.length - requestsToFetch.length}/${requests.length} prices`
    );

    // Fetch missing prices in batches to respect rate limits
    const BATCH_SIZE = 3; // Smaller batch for historical prices (more expensive API calls)
    const DELAY_MS = 1000; // Longer delay between batches

    for (let i = 0; i < requestsToFetch.length; i += BATCH_SIZE) {
      const batch = requestsToFetch.slice(i, i + BATCH_SIZE);

      await Promise.allSettled(
        batch.map(async ({ address, chainId, timestamp }) => {
          const price = await fetchHistoricalCoinGeckoPrice(
            address,
            chainId,
            timestamp
          );

          if (price !== null) {
            const key = `${address.toLowerCase()}_${chainId}_${timestamp}`;
            priceMap[key] = price;

            // Cache historical prices with very long TTL (7 days - effectively permanent)
            const cacheKey = serverCacheKeys.historicalPrice(
              address,
              chainId,
              timestamp
            );
            serverCache.set(cacheKey, price, 10080); // 7 days in minutes

            console.log(
              `[Historical API] Fetched ${address} on chain ${chainId} at ${new Date(timestamp).toISOString()}: $${price}`
            );
          }
        })
      );

      // Add delay between batches
      if (i + BATCH_SIZE < requestsToFetch.length) {
        await sleep(DELAY_MS);
      }
    }

    return NextResponse.json({
      prices: priceMap,
      cached: requests.length - requestsToFetch.length,
      fetched: requestsToFetch.length,
      total: requests.length,
    });
  } catch (error) {
    console.error("[Historical API] Error in /api/prices/historical:", error);
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
    message: "Historical Price API is running",
    cache: stats,
  });
}
