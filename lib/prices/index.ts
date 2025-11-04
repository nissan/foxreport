import { Address } from "viem";
import { ChainId, PriceData } from "@/types/portfolio";
import { sessionCache, getCacheKey } from "@/lib/cache/storage";

// CoinGecko platform IDs for our supported chains
const COINGECKO_PLATFORMS: Record<ChainId, string> = {
  1: "ethereum",
  42161: "arbitrum-one",
  8453: "base",
};

// Common token addresses that CoinGecko knows about
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

/**
 * Sleep utility for rate limiting
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetches with retry logic for rate limiting
 */
async function fetchWithRetry(
  url: string,
  maxRetries: number = 3
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url);

      // If rate limited (429), wait and retry
      if (response.status === 429) {
        const waitTime = Math.pow(2, attempt) * 1000; // Exponential backoff: 1s, 2s, 4s
        console.warn(`Rate limited, waiting ${waitTime}ms before retry ${attempt + 1}/${maxRetries}`);
        await sleep(waitTime);
        continue;
      }

      return response;
    } catch (error) {
      lastError = error as Error;
      // Wait before retrying on network errors
      if (attempt < maxRetries - 1) {
        await sleep(1000 * (attempt + 1));
      }
    }
  }

  throw lastError || new Error("Max retries exceeded");
}

/**
 * Fetches current token price from CoinGecko
 */
async function getCoinGeckoPrice(
  tokenAddress: Address,
  chainId: ChainId
): Promise<number | null> {
  try {
    const normalizedAddress = tokenAddress.toLowerCase();
    let coinId = WELL_KNOWN_TOKENS[normalizedAddress];

    // If not a well-known token, try using contract address
    if (!coinId) {
      const platform = COINGECKO_PLATFORMS[chainId];
      const response = await fetchWithRetry(
        `https://api.coingecko.com/api/v3/simple/token_price/${platform}?contract_addresses=${tokenAddress}&vs_currencies=usd`
      );

      if (!response.ok) {
        throw new Error(`CoinGecko API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const priceData = data[normalizedAddress];

      if (priceData?.usd) {
        return priceData.usd;
      }

      return null;
    }

    // Fetch price for well-known token
    const response = await fetchWithRetry(
      `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`
    );

    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data[coinId]?.usd || null;
  } catch (error) {
    console.error(`Error fetching CoinGecko price for ${tokenAddress}:`, error);
    return null;
  }
}

/**
 * Fetches current token price with caching
 */
export async function getTokenPrice(
  tokenAddress: Address,
  chainId: ChainId
): Promise<PriceData | null> {
  // Check cache first (5 minute TTL)
  const cacheKey = getCacheKey.price(tokenAddress, chainId);
  const cached = sessionCache.get<PriceData>(cacheKey);

  if (cached) {
    return cached;
  }

  try {
    // Try CoinGecko
    const price = await getCoinGeckoPrice(tokenAddress, chainId);

    if (price === null) {
      return null;
    }

    const priceData: PriceData = {
      tokenAddress,
      chainId,
      priceUsd: price,
      timestamp: Date.now(),
      source: "coingecko",
    };

    // Cache for 5 minutes
    sessionCache.set(cacheKey, priceData, 5);

    return priceData;
  } catch (error) {
    console.error(`Error fetching price for ${tokenAddress} on chain ${chainId}:`, error);
    return null;
  }
}

/**
 * Fetches historical token price from CoinGecko at a specific timestamp
 * Uses /market_chart/range endpoint for hourly precision
 */
export async function getHistoricalPrice(
  tokenAddress: Address,
  chainId: ChainId,
  timestamp: number
): Promise<number | null> {
  try {
    const normalizedAddress = tokenAddress.toLowerCase();
    let coinId = WELL_KNOWN_TOKENS[normalizedAddress];

    // If not a well-known token, try to get coinId from contract address
    if (!coinId) {
      const platform = COINGECKO_PLATFORMS[chainId];

      try {
        // Try to get the coin info by contract address first
        const infoResponse = await fetchWithRetry(
          `https://api.coingecko.com/api/v3/coins/${platform}/contract/${tokenAddress}`
        );

        if (infoResponse.ok) {
          const info = await infoResponse.json();
          coinId = info.id;
        }
      } catch (error) {
        console.warn(`Could not resolve coinId for ${tokenAddress} on chain ${chainId}`);
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
    const toSec = timestampSec + 1800;   // 30 min after

    const response = await fetchWithRetry(
      `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart/range?vs_currency=usd&from=${fromSec}&to=${toSec}`
    );

    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const prices = data.prices as [number, number][] | undefined;

    if (!prices || prices.length === 0) {
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
      `Error fetching historical price for ${tokenAddress} at ${timestamp}:`,
      error
    );
    return null;
  }
}

/**
 * Fetches historical prices for multiple tokens using server-side API with shared cache
 */
export async function getBatchHistoricalPrices(
  requests: { address: Address; chainId: ChainId; timestamp: number }[]
): Promise<Map<string, number>> {
  const priceMap = new Map<string, number>();

  // Remove duplicates
  const uniqueRequests = Array.from(
    new Map(
      requests.map(r => [
        `${r.address.toLowerCase()}_${r.chainId}_${r.timestamp}`,
        r
      ])
    ).values()
  );

  if (uniqueRequests.length === 0) {
    return priceMap;
  }

  try {
    // Call our server-side API endpoint for historical prices
    const response = await fetch("/api/prices/historical", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        requests: uniqueRequests.map(({ address, chainId, timestamp }) => ({
          address,
          chainId,
          timestamp,
        })),
      }),
    });

    if (!response.ok) {
      throw new Error(`Historical price API error: ${response.status}`);
    }

    const data = await response.json();
    const { prices, cached, fetched, total } = data;

    console.log(
      `[Historical Prices] Retrieved ${total} prices (${cached} from cache, ${fetched} fetched)`
    );

    // Convert to Map
    Object.entries(prices).forEach(([key, price]) => {
      priceMap.set(key, price as number);
    });

    return priceMap;
  } catch (error) {
    console.error("Error fetching batch historical prices from API:", error);
    return priceMap;
  }
}

/**
 * Fetches prices for multiple tokens using server-side API with shared cache
 */
export async function getBatchTokenPrices(
  tokens: { address: Address; chainId: ChainId }[]
): Promise<Map<string, number>> {
  const priceMap = new Map<string, number>();

  // Remove duplicates
  const uniqueTokens = Array.from(
    new Map(tokens.map(t => [`${t.address.toLowerCase()}_${t.chainId}`, t])).values()
  );

  if (uniqueTokens.length === 0) {
    return priceMap;
  }

  try {
    // Call our server-side API endpoint
    const response = await fetch("/api/prices", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tokens: uniqueTokens.map(({ address, chainId }) => ({
          address,
          chainId,
        })),
      }),
    });

    if (!response.ok) {
      throw new Error(`Price API error: ${response.status}`);
    }

    const data = await response.json();
    const { prices, cached, fetched, total } = data;

    console.log(
      `[Prices] Retrieved ${total} prices (${cached} from server cache, ${fetched} fetched)`
    );

    // Convert to Map and also cache locally for faster subsequent loads
    Object.entries(prices).forEach(([key, price]) => {
      priceMap.set(key, price as number);

      // Also cache in session storage
      const [address, chainIdStr] = key.split("_");
      const chainId = parseInt(chainIdStr) as ChainId;
      const cacheKey = getCacheKey.price(address as Address, chainId);

      const priceData: PriceData = {
        tokenAddress: address as Address,
        chainId,
        priceUsd: price as number,
        timestamp: Date.now(),
        source: "api",
      };

      sessionCache.set(cacheKey, priceData, 5);
    });

    return priceMap;
  } catch (error) {
    console.error("Error fetching batch prices from API:", error);

    // Fallback: Try to get prices from session cache if API fails
    console.warn("Falling back to cached prices only");
    uniqueTokens.forEach(({ address, chainId }) => {
      const cacheKey = getCacheKey.price(address, chainId);
      const cached = sessionCache.get<PriceData>(cacheKey);
      if (cached) {
        const key = `${address.toLowerCase()}_${chainId}`;
        priceMap.set(key, cached.priceUsd);
      }
    });

    return priceMap;
  }
}
