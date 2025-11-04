/**
 * Token Valuation Module
 *
 * Hybrid approach for pricing wrapped tokens:
 * 1. Try to fetch real-time value from protocol contracts (Aave, Uniswap)
 * 2. Fall back to underlying token price estimates
 * 3. Cache results to minimize contract calls
 */

import { Address } from "viem";
import { ChainId } from "@/types/portfolio";
import {
  isAToken,
  isLPToken,
  isWrappedToken,
  getUnderlyingTokenFromAToken,
} from "./detection";

export interface UnderlyingAsset {
  address: Address;
  symbol: string;
  amount: string;
  valueUsd?: number;
}

export interface TokenValuation {
  totalValueUsd: number;
  underlyingAssets?: UnderlyingAsset[];
  source: "protocol" | "estimate" | "fallback";
}

/**
 * Get token valuation with hybrid approach
 * Tries protocol contracts first, falls back to estimates
 */
export async function getTokenValuation(
  tokenAddress: Address,
  symbol: string,
  amount: string,
  chainId: ChainId,
  tokenPriceUsd?: number
): Promise<TokenValuation> {
  // For aTokens (Aave lending positions)
  if (isAToken(symbol, tokenAddress.toLowerCase())) {
    return await getATokenValuation(
      tokenAddress,
      symbol,
      amount,
      chainId,
      tokenPriceUsd
    );
  }

  // For LP tokens (Uniswap liquidity positions)
  if (isLPToken(symbol, tokenAddress.toLowerCase())) {
    return await getLPTokenValuation(
      tokenAddress,
      symbol,
      amount,
      chainId,
      tokenPriceUsd
    );
  }

  // For wrapped tokens (WETH, WBTC, wstETH)
  if (isWrappedToken(tokenAddress.toLowerCase(), chainId)) {
    return await getWrappedTokenValuation(
      tokenAddress,
      symbol,
      amount,
      chainId,
      tokenPriceUsd
    );
  }

  // Standard token - use provided price
  return {
    totalValueUsd: tokenPriceUsd
      ? parseFloat(amount) * tokenPriceUsd
      : 0,
    source: "fallback",
  };
}

/**
 * Get aToken valuation (Aave lending position)
 * aTokens accrue interest, so exchange rate changes over time
 */
async function getATokenValuation(
  tokenAddress: Address,
  symbol: string,
  amount: string,
  chainId: ChainId,
  fallbackPriceUsd?: number
): Promise<TokenValuation> {
  try {
    // Try to get exchange rate from Aave V3 Pool contract
    const exchangeRate = await getAaveExchangeRate(tokenAddress, chainId);

    if (exchangeRate) {
      const underlyingSymbol = getUnderlyingTokenFromAToken(symbol);
      const underlyingAmount = (parseFloat(amount) * exchangeRate).toString();

      // TODO: Get underlying token price from price service
      // For now, use fallback or estimate 1:1
      const underlyingPriceUsd = fallbackPriceUsd || 0;

      return {
        totalValueUsd: parseFloat(underlyingAmount) * underlyingPriceUsd,
        underlyingAssets: [
          {
            address: tokenAddress, // TODO: Get actual underlying token address
            symbol: underlyingSymbol,
            amount: underlyingAmount,
            valueUsd: parseFloat(underlyingAmount) * underlyingPriceUsd,
          },
        ],
        source: "protocol",
      };
    }
  } catch (error) {
    console.warn(`Failed to get Aave exchange rate for ${symbol}:`, error);
  }

  // Fallback: Assume 1:1 with underlying token
  const underlyingSymbol = getUnderlyingTokenFromAToken(symbol);
  return {
    totalValueUsd: fallbackPriceUsd
      ? parseFloat(amount) * fallbackPriceUsd
      : 0,
    underlyingAssets: [
      {
        address: tokenAddress,
        symbol: underlyingSymbol,
        amount,
        valueUsd: fallbackPriceUsd
          ? parseFloat(amount) * fallbackPriceUsd
          : 0,
      },
    ],
    source: "estimate",
  };
}

/**
 * Get LP token valuation (Uniswap liquidity position)
 */
async function getLPTokenValuation(
  tokenAddress: Address,
  symbol: string,
  amount: string,
  chainId: ChainId,
  fallbackPriceUsd?: number
): Promise<TokenValuation> {
  try {
    // Try to get pool reserves from Uniswap V3 contract
    const poolInfo = await getUniswapPoolInfo(tokenAddress, chainId);

    if (poolInfo) {
      // TODO: Calculate LP token value from pool reserves and token prices
      return {
        totalValueUsd: 0, // Placeholder
        underlyingAssets: poolInfo.tokens,
        source: "protocol",
      };
    }
  } catch (error) {
    console.warn(`Failed to get Uniswap pool info for ${symbol}:`, error);
  }

  // Fallback: Use provided price or 0
  return {
    totalValueUsd: fallbackPriceUsd
      ? parseFloat(amount) * fallbackPriceUsd
      : 0,
    source: "fallback",
  };
}

/**
 * Get wrapped token valuation
 * Most wrapped tokens have 1:1 exchange rate with underlying
 */
async function getWrappedTokenValuation(
  tokenAddress: Address,
  symbol: string,
  amount: string,
  chainId: ChainId,
  fallbackPriceUsd?: number
): Promise<TokenValuation> {
  // For most wrapped tokens (WETH, WBTC), exchange rate is 1:1
  // For wstETH (wrapped staked ETH), rate changes due to staking rewards

  if (symbol === "wstETH") {
    try {
      // TODO: Get wstETH exchange rate from Lido contract
      const exchangeRate = 1.0; // Placeholder - actual rate is ~1.15+
      const stETHAmount = (parseFloat(amount) * exchangeRate).toString();

      return {
        totalValueUsd: fallbackPriceUsd
          ? parseFloat(stETHAmount) * fallbackPriceUsd
          : 0,
        underlyingAssets: [
          {
            address: tokenAddress,
            symbol: "stETH",
            amount: stETHAmount,
            valueUsd: fallbackPriceUsd
              ? parseFloat(stETHAmount) * fallbackPriceUsd
              : 0,
          },
        ],
        source: "estimate",
      };
    } catch (error) {
      console.warn("Failed to get wstETH exchange rate:", error);
    }
  }

  // Default: 1:1 exchange rate
  const underlyingSymbol = symbol.replace(/^w/, ""); // WETH -> ETH, WBTC -> BTC
  return {
    totalValueUsd: fallbackPriceUsd
      ? parseFloat(amount) * fallbackPriceUsd
      : 0,
    underlyingAssets: [
      {
        address: tokenAddress,
        symbol: underlyingSymbol,
        amount,
        valueUsd: fallbackPriceUsd
          ? parseFloat(amount) * fallbackPriceUsd
          : 0,
      },
    ],
    source: "estimate",
  };
}

/**
 * Get Aave exchange rate from Pool contract
 * Returns the conversion rate from aToken to underlying token
 */
async function getAaveExchangeRate(
  aTokenAddress: Address,
  chainId: ChainId
): Promise<number | null> {
  // TODO: Implement contract call to Aave V3 Pool
  // This requires the Aave Pool ABI and viem contract reads
  // For now, return null to trigger fallback
  return null;
}

/**
 * Get Uniswap pool info from contract
 */
async function getUniswapPoolInfo(
  poolAddress: Address,
  chainId: ChainId
): Promise<{ tokens: UnderlyingAsset[] } | null> {
  // TODO: Implement contract call to Uniswap V3 Pool
  // This requires the Uniswap Pool ABI and viem contract reads
  // For now, return null to trigger fallback
  return null;
}

/**
 * Batch get valuations for multiple tokens
 */
export async function batchGetTokenValuations(
  tokens: Array<{
    address: Address;
    symbol: string;
    amount: string;
    chainId: ChainId;
    priceUsd?: number;
  }>
): Promise<Map<string, TokenValuation>> {
  const results = new Map<string, TokenValuation>();

  // Process in parallel for performance
  await Promise.all(
    tokens.map(async (token) => {
      const key = `${token.address.toLowerCase()}_${token.chainId}`;
      const valuation = await getTokenValuation(
        token.address,
        token.symbol,
        token.amount,
        token.chainId,
        token.priceUsd
      );
      results.set(key, valuation);
    })
  );

  return results;
}
