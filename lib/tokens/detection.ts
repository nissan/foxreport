/**
 * Token Type Detection Module
 *
 * Identifies token types: native, wrapped, aToken (Aave), LP tokens (Uniswap), etc.
 */

import { Address } from "viem";
import { ChainId, TokenType } from "@/types/portfolio";

// Known wrapped token addresses (lowercase for comparison)
const WRAPPED_TOKENS: Record<ChainId, Record<string, string>> = {
  1: {
    // Ethereum Mainnet
    "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2": "WETH", // Wrapped Ether
    "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599": "WBTC", // Wrapped Bitcoin
    "0x7f39c581f595b53c5cb19bd0b3f8da6c935e2ca0": "wstETH", // Wrapped stETH (Lido)
  },
  42161: {
    // Arbitrum
    "0x82af49447d8a07e3bd95bd0d56f35241523fbab1": "WETH",
    "0x2f2a2543b76a4166549f7aab2e75bef0aefc5b0f": "WBTC",
  },
  8453: {
    // Base
    "0x4200000000000000000000000000000000000006": "WETH",
  },
};

// aToken prefix pattern (Aave lending tokens)
const ATOKEN_PREFIXES = ["a", "aArb", "aBase", "aEth"];

// Known Uniswap V3 NFT Position Manager addresses
const UNISWAP_V3_POSITION_MANAGERS: Record<ChainId, string> = {
  1: "0xc36442b4a4522e871399cd717abdd847ab11fe88",
  42161: "0xc36442b4a4522e871399cd717abdd847ab11fe88",
  8453: "0x03a520b32c04bf3beef7beb72e919cf822ed34f1",
};

/**
 * Detect token type based on address and symbol
 */
export function detectTokenType(
  address: Address,
  symbol: string,
  chainId: ChainId
): TokenType {
  const lowerAddress = address.toLowerCase();

  // Check if it's native currency (ETH addresses are usually 0x0 or specific contracts)
  if (isNativeToken(address, chainId)) {
    return "native";
  }

  // Check if it's a known wrapped token
  if (isWrappedToken(lowerAddress, chainId)) {
    return "wrapped";
  }

  // Check if it's an aToken (Aave)
  if (isAToken(symbol, lowerAddress)) {
    return "aToken";
  }

  // Check if it's an LP token (Uniswap)
  if (isLPToken(symbol, lowerAddress)) {
    return "lpToken";
  }

  // Default to standard ERC20
  return "erc20";
}

/**
 * Check if address is native token (ETH)
 */
export function isNativeToken(address: Address, chainId: ChainId): boolean {
  const lowerAddress = address.toLowerCase();

  // Common zero addresses for native currency
  return (
    lowerAddress === "0x0000000000000000000000000000000000000000" ||
    lowerAddress === "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"
  );
}

/**
 * Check if token is a wrapped token
 */
export function isWrappedToken(address: string, chainId: ChainId): boolean {
  return address in (WRAPPED_TOKENS[chainId] || {});
}

/**
 * Get wrapped token symbol
 */
export function getWrappedTokenSymbol(
  address: string,
  chainId: ChainId
): string | null {
  return WRAPPED_TOKENS[chainId]?.[address] || null;
}

/**
 * Check if token is an aToken (Aave lending position)
 * aTokens typically start with 'a' prefix and have specific patterns
 */
export function isAToken(symbol: string, address: string): boolean {
  // Check symbol starts with known aToken prefixes
  const hasATokenPrefix = ATOKEN_PREFIXES.some((prefix) =>
    symbol.toLowerCase().startsWith(prefix.toLowerCase())
  );

  // Additional heuristic: aTokens often have "Aave" in the name
  // and follow pattern like "aUSDC", "aDAI", "aWETH"
  const matchesPattern =
    /^a[A-Z]{3,5}$/.test(symbol) || // e.g., aUSDC, aDAI
    /^aArb[A-Z]{3,5}$/.test(symbol) || // e.g., aArbUSDC
    /^aBase[A-Z]{3,5}$/.test(symbol); // e.g., aBaseUSDC

  return hasATokenPrefix && matchesPattern;
}

/**
 * Get underlying token symbol from aToken
 * Example: aUSDC -> USDC, aArbDAI -> DAI
 */
export function getUnderlyingTokenFromAToken(symbol: string): string {
  for (const prefix of ATOKEN_PREFIXES) {
    if (symbol.startsWith(prefix)) {
      return symbol.substring(prefix.length);
    }
  }
  return symbol;
}

/**
 * Check if token is an LP token (Liquidity Provider token)
 * LP tokens typically have "UNI-V2" or "UNI-V3" in symbol, or are NFTs
 */
export function isLPToken(symbol: string, address: string): boolean {
  // Uniswap V2 LP tokens
  const isUniV2 =
    symbol.includes("UNI-V2") || symbol.includes("LP") || symbol.includes("SLP");

  // Uniswap V3 LP tokens (NFTs from Position Manager)
  const isUniV3NFT = Object.values(UNISWAP_V3_POSITION_MANAGERS).some(
    (manager) => address.toLowerCase() === manager.toLowerCase()
  );

  return isUniV2 || isUniV3NFT;
}

/**
 * Detect if address is Uniswap V3 Position NFT
 */
export function isUniswapV3Position(
  address: Address,
  chainId: ChainId
): boolean {
  return (
    address.toLowerCase() ===
    UNISWAP_V3_POSITION_MANAGERS[chainId]?.toLowerCase()
  );
}

/**
 * Get all wrapped token addresses for a chain
 */
export function getWrappedTokens(chainId: ChainId): Record<string, string> {
  return WRAPPED_TOKENS[chainId] || {};
}

/**
 * Batch detect token types for multiple tokens
 */
export function batchDetectTokenTypes(
  tokens: Array<{ address: Address; symbol: string; chainId: ChainId }>
): Map<string, TokenType> {
  const results = new Map<string, TokenType>();

  for (const token of tokens) {
    const key = `${token.address.toLowerCase()}_${token.chainId}`;
    results.set(key, detectTokenType(token.address, token.symbol, token.chainId));
  }

  return results;
}
