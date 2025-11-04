/**
 * Alchemy Prices API Client (REST)
 *
 * Replaces CoinGecko for token price lookups using Alchemy's Prices API.
 * Uses REST endpoints (not deprecated SDK) for future-proofing.
 *
 * Features:
 * - Current prices by address
 * - Historical prices with hourly precision
 * - Batch processing
 * - Multi-chain support (Ethereum, Arbitrum, Base)
 * - Error handling with fallbacks
 */

import { Address } from "viem";
import { ChainId } from "@/types/portfolio";

// Alchemy network names mapping
const ALCHEMY_NETWORKS: Record<ChainId, string> = {
  1: "eth-mainnet",
  42161: "arb-mainnet",
  8453: "base-mainnet",
};

interface AlchemyPriceResponse {
  data: Array<{
    address: string;
    network: string;
    prices: Array<{
      currency: string;
      value: string;
      lastUpdatedAt: string;
    }>;
    error?: string;
  }>;
}

interface AlchemyHistoricalPriceResponse {
  data: {
    address: string;
    network: string;
    prices: Array<{
      timestamp: string;
      value: string;
      currency: string;
    }>;
  };
}

/**
 * Get current token price from Alchemy Prices API
 */
export async function getAlchemyCurrentPrice(
  address: Address,
  chainId: ChainId
): Promise<number | null> {
  try {
    const apiKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;
    if (!apiKey) {
      console.error("[Alchemy] API key not found");
      return null;
    }

    const network = ALCHEMY_NETWORKS[chainId];
    if (!network) {
      console.error(`[Alchemy] Unsupported chain ID: ${chainId}`);
      return null;
    }

    const response = await fetch(
      "https://api.g.alchemy.com/prices/v1/tokens/by-address",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          addresses: [
            {
              network,
              address: address.toLowerCase(),
            },
          ],
        }),
      }
    );

    if (!response.ok) {
      console.error(`[Alchemy] HTTP ${response.status}: ${response.statusText}`);
      return null;
    }

    const data: AlchemyPriceResponse = await response.json();

    if (!data.data || data.data.length === 0) {
      console.warn(`[Alchemy] No price data for ${address} on ${network}`);
      return null;
    }

    const tokenData = data.data[0];
    if (tokenData.error) {
      console.warn(`[Alchemy] Error for ${address}: ${tokenData.error}`);
      return null;
    }

    const usdPrice = tokenData.prices.find((p) => p.currency === "usd");
    if (!usdPrice) {
      console.warn(`[Alchemy] No USD price for ${address}`);
      return null;
    }

    return parseFloat(usdPrice.value);
  } catch (error) {
    console.error("[Alchemy] Error fetching current price:", error);
    return null;
  }
}

/**
 * Get current prices for multiple tokens in batch
 */
export async function getAlchemyBatchCurrentPrices(
  tokens: Array<{ address: Address; chainId: ChainId }>
): Promise<Map<string, number>> {
  const results = new Map<string, number>();

  if (tokens.length === 0) return results;

  try {
    const apiKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;
    if (!apiKey) {
      console.error("[Alchemy] API key not found");
      return results;
    }

    // Group tokens by chain for efficient batching
    const tokensByChain = tokens.reduce((acc, token) => {
      const network = ALCHEMY_NETWORKS[token.chainId];
      if (!network) return acc;

      if (!acc[network]) acc[network] = [];
      acc[network].push(token);
      return acc;
    }, {} as Record<string, typeof tokens>);

    // Fetch prices for each chain
    await Promise.all(
      Object.entries(tokensByChain).map(async ([network, chainTokens]) => {
        const addresses = chainTokens.map((t) => ({
          network,
          address: t.address.toLowerCase(),
        }));

        const response = await fetch(
          "https://api.g.alchemy.com/prices/v1/tokens/by-address",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ addresses }),
          }
        );

        if (!response.ok) {
          console.error(`[Alchemy] Batch fetch failed for ${network}: ${response.status}`);
          return;
        }

        const data: AlchemyPriceResponse = await response.json();

        // Map results back to original tokens
        data.data.forEach((tokenData, index) => {
          if (tokenData.error) {
            console.warn(`[Alchemy] Error for ${tokenData.address}: ${tokenData.error}`);
            return;
          }

          const usdPrice = tokenData.prices.find((p) => p.currency === "usd");
          if (usdPrice) {
            const originalToken = chainTokens[index];
            const key = `${originalToken.address.toLowerCase()}_${originalToken.chainId}`;
            results.set(key, parseFloat(usdPrice.value));
          }
        });
      })
    );

    console.log(`[Alchemy] Fetched ${results.size}/${tokens.length} prices in batch`);
    return results;
  } catch (error) {
    console.error("[Alchemy] Error in batch fetch:", error);
    return results;
  }
}

/**
 * Get historical token price at specific timestamp
 */
export async function getAlchemyHistoricalPrice(
  address: Address,
  chainId: ChainId,
  timestamp: number
): Promise<number | null> {
  try {
    const apiKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;
    if (!apiKey) {
      console.error("[Alchemy] API key not found");
      return null;
    }

    const network = ALCHEMY_NETWORKS[chainId];
    if (!network) {
      console.error(`[Alchemy] Unsupported chain ID: ${chainId}`);
      return null;
    }

    // Alchemy expects ISO-8601 format
    const startTime = new Date(timestamp * 1000).toISOString();
    // Query a 1-hour window around the target time
    const endTime = new Date((timestamp + 3600) * 1000).toISOString();

    const response = await fetch(
      `https://api.g.alchemy.com/prices/v1/tokens/historical?` +
        `network=${network}&` +
        `address=${address.toLowerCase()}&` +
        `startTime=${startTime}&` +
        `endTime=${endTime}`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      }
    );

    if (!response.ok) {
      console.error(`[Alchemy] Historical fetch failed: ${response.status}`);
      return null;
    }

    const data: AlchemyHistoricalPriceResponse = await response.json();

    if (!data.data || !data.data.prices || data.data.prices.length === 0) {
      console.warn(`[Alchemy] No historical price for ${address} at ${timestamp}`);
      return null;
    }

    // Get the closest price to the target timestamp
    const prices = data.data.prices;
    const closestPrice = prices.reduce((prev, curr) => {
      const prevDiff = Math.abs(new Date(prev.timestamp).getTime() / 1000 - timestamp);
      const currDiff = Math.abs(new Date(curr.timestamp).getTime() / 1000 - timestamp);
      return currDiff < prevDiff ? curr : prev;
    });

    return parseFloat(closestPrice.value);
  } catch (error) {
    console.error("[Alchemy] Error fetching historical price:", error);
    return null;
  }
}

/**
 * Get historical prices for multiple tokens in batch
 */
export async function getAlchemyBatchHistoricalPrices(
  requests: Array<{ address: Address; chainId: ChainId; timestamp: number }>
): Promise<Map<string, number>> {
  const results = new Map<string, number>();

  if (requests.length === 0) return results;

  try {
    // Process in parallel (Alchemy should have higher limits than CoinGecko)
    await Promise.all(
      requests.map(async (req) => {
        const price = await getAlchemyHistoricalPrice(
          req.address,
          req.chainId,
          req.timestamp
        );

        if (price !== null) {
          const key = `${req.address.toLowerCase()}_${req.chainId}_${req.timestamp}`;
          results.set(key, price);
        }
      })
    );

    console.log(`[Alchemy] Fetched ${results.size}/${requests.length} historical prices`);
    return results;
  } catch (error) {
    console.error("[Alchemy] Error in batch historical fetch:", error);
    return results;
  }
}

/**
 * Health check - test if Alchemy Prices API is accessible
 */
export async function testAlchemyPricesAPI(): Promise<boolean> {
  try {
    // Test with WETH on Ethereum
    const WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2" as Address;
    const price = await getAlchemyCurrentPrice(WETH, 1);
    return price !== null && price > 0;
  } catch (error) {
    console.error("[Alchemy] Health check failed:", error);
    return false;
  }
}
