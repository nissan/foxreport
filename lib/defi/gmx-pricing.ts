/**
 * GMX GLP Pricing Module
 *
 * Calculates the value of GMX Liquidity Provider (GLP) tokens by querying
 * on-chain contracts for total AUM (Assets Under Management) and total supply.
 *
 * How GLP Works:
 * - GLP represents a basket of assets (ETH, BTC, USDC, etc.) used for GMX trading
 * - GLP price = Total AUM / Total Supply
 * - AUM fluctuates based on trading fees and trader P&L
 * - GLP is only on Arbitrum (GMX v1) and Avalanche (not implemented here)
 *
 * References:
 * - GMX Docs: https://docs.gmx.io/docs/trading/v1
 * - GLP Overview: https://docs.gmx.io/docs/providing-liquidity/v1
 */

import { createPublicClient, http, Address, formatUnits } from "viem";
import { arbitrum } from "viem/chains";
import { ChainId } from "@/types/portfolio";

// GMX contract addresses (Arbitrum only)
const GMX_CONTRACTS: Record<ChainId, { vault: Address; glp: Address } | null> = {
  1: null, // GMX not on Ethereum
  42161: {
    // Arbitrum
    vault: "0x489ee077994B6911017B2Ea8Be4A2bc1a89aC1BA", // GMX Vault (AUM source)
    glp: "0x4277f8F2c384827B5273592FF7CeBd9f2C1ac258", // GLP token
  },
  8453: null, // GMX not on Base
};

// GMX Vault ABI (minimal - only what we need)
const GMX_VAULT_ABI = [
  {
    name: "getAumInUsdg",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "maximise", type: "bool" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

// ERC20 ABI for totalSupply
const ERC20_TOTAL_SUPPLY_ABI = [
  {
    name: "totalSupply",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

interface GLPValuation {
  glpPriceUsd: number; // Price per GLP token in USD
  totalValueUsd: number; // Total value of user's GLP holdings
  totalAum: string; // Total AUM in USDG (30 decimals)
  totalSupply: string; // Total GLP supply (18 decimals)
  glpBalance: string; // User's GLP balance (18 decimals)
  source: "gmx_contract" | "estimate" | "fallback";
}

/**
 * Get GMX Vault AUM (Assets Under Management) in USDG
 *
 * @param chainId - Must be 42161 (Arbitrum)
 * @param maximise - Whether to use max or min AUM (default: true)
 * @returns AUM in USDG (30 decimals) or null on error
 */
async function getGMXVaultAUM(
  chainId: ChainId,
  maximise: boolean = true
): Promise<bigint | null> {
  try {
    const contracts = GMX_CONTRACTS[chainId];
    if (!contracts) {
      console.warn(`[GMX] No contracts for chain ${chainId}`);
      return null;
    }

    const client = createPublicClient({
      chain: arbitrum,
      transport: http(),
    });

    const aum = await client.readContract({
      address: contracts.vault,
      abi: GMX_VAULT_ABI,
      functionName: "getAumInUsdg",
      args: [maximise],
    });

    return aum;
  } catch (error) {
    console.error(`[GMX] Error fetching vault AUM:`, error);
    return null;
  }
}

/**
 * Get GLP total supply
 *
 * @param chainId - Must be 42161 (Arbitrum)
 * @returns Total GLP supply (18 decimals) or null on error
 */
async function getGLPTotalSupply(chainId: ChainId): Promise<bigint | null> {
  try {
    const contracts = GMX_CONTRACTS[chainId];
    if (!contracts) {
      console.warn(`[GMX] No contracts for chain ${chainId}`);
      return null;
    }

    const client = createPublicClient({
      chain: arbitrum,
      transport: http(),
    });

    const totalSupply = await client.readContract({
      address: contracts.glp,
      abi: ERC20_TOTAL_SUPPLY_ABI,
      functionName: "totalSupply",
    });

    return totalSupply;
  } catch (error) {
    console.error(`[GMX] Error fetching GLP total supply:`, error);
    return null;
  }
}

/**
 * Calculate GLP price in USD
 *
 * Formula: glpPrice = totalAUM / totalSupply
 * Note: AUM is in USDG (30 decimals), supply is 18 decimals
 *
 * @param totalAum - Total AUM in USDG (30 decimals)
 * @param totalSupply - Total GLP supply (18 decimals)
 * @returns GLP price in USD
 */
function calculateGLPPrice(totalAum: bigint, totalSupply: bigint): number {
  try {
    // Convert AUM from 30 decimals to USD (divide by 10^30)
    // Convert supply from 18 decimals to tokens (divide by 10^18)
    // Price = (AUM / 10^30) / (supply / 10^18)
    //       = (AUM * 10^18) / (supply * 10^30)
    //       = AUM / (supply * 10^12)

    const aumInUsd = Number(formatUnits(totalAum, 30));
    const supplyInTokens = Number(formatUnits(totalSupply, 18));

    if (supplyInTokens === 0) {
      console.warn("[GMX] Total supply is zero, cannot calculate price");
      return 0;
    }

    const glpPrice = aumInUsd / supplyInTokens;

    return glpPrice;
  } catch (error) {
    console.error("[GMX] Error calculating GLP price:", error);
    return 0;
  }
}

/**
 * Get GLP token valuation
 *
 * @param glpBalance - User's GLP balance (in wei as string)
 * @param chainId - Must be 42161 (Arbitrum)
 * @returns GLP valuation with price and total value
 */
export async function getGLPValuation(
  glpBalance: string,
  chainId: ChainId
): Promise<GLPValuation> {
  try {
    console.log(`[GMX] Valuing GLP (${glpBalance} wei)`);

    // GLP only exists on Arbitrum
    if (chainId !== 42161) {
      console.warn(`[GMX] GLP only exists on Arbitrum (chain ${chainId} not supported)`);
      return {
        glpPriceUsd: 0,
        totalValueUsd: 0,
        totalAum: "0",
        totalSupply: "0",
        glpBalance,
        source: "fallback",
      };
    }

    // Step 1: Get total AUM
    const totalAum = await getGMXVaultAUM(chainId);
    if (!totalAum) {
      console.warn("[GMX] Could not get vault AUM");
      return {
        glpPriceUsd: 0,
        totalValueUsd: 0,
        totalAum: "0",
        totalSupply: "0",
        glpBalance,
        source: "fallback",
      };
    }

    // Step 2: Get total supply
    const totalSupply = await getGLPTotalSupply(chainId);
    if (!totalSupply) {
      console.warn("[GMX] Could not get GLP total supply");
      return {
        glpPriceUsd: 0,
        totalValueUsd: 0,
        totalAum: totalAum.toString(),
        totalSupply: "0",
        glpBalance,
        source: "fallback",
      };
    }

    // Step 3: Calculate GLP price
    const glpPriceUsd = calculateGLPPrice(totalAum, totalSupply);

    // Step 4: Calculate total value of user's holdings
    const balanceInTokens = parseFloat(formatUnits(BigInt(glpBalance), 18));
    const totalValueUsd = balanceInTokens * glpPriceUsd;

    console.log(
      `[GMX] GLP price: $${glpPriceUsd.toFixed(4)}, balance: ${balanceInTokens.toFixed(4)} GLP, value: $${totalValueUsd.toFixed(2)}`
    );

    return {
      glpPriceUsd,
      totalValueUsd,
      totalAum: totalAum.toString(),
      totalSupply: totalSupply.toString(),
      glpBalance,
      source: "gmx_contract",
    };
  } catch (error) {
    console.error(`[GMX] Error in GLP valuation:`, error);

    // Fallback: Return zero value
    return {
      glpPriceUsd: 0,
      totalValueUsd: 0,
      totalAum: "0",
      totalSupply: "0",
      glpBalance,
      source: "fallback",
    };
  }
}

/**
 * Batch get GLP valuations for multiple holdings
 *
 * Note: Since GLP price is the same for all users, we can optimize
 * by fetching AUM and supply once, then calculating for each balance.
 *
 * @param glpBalances - Array of GLP balances with chain IDs
 * @returns Map of identifiers to valuations
 */
export async function getGLPValuationsBatch(
  glpBalances: Array<{ balance: string; chainId: ChainId; identifier?: string }>
): Promise<Map<string, GLPValuation>> {
  const results = new Map<string, GLPValuation>();

  // Filter to only Arbitrum (GLP only exists there)
  const arbitrumBalances = glpBalances.filter((b) => b.chainId === 42161);

  if (arbitrumBalances.length === 0) {
    console.warn("[GMX] No GLP balances on Arbitrum");
    return results;
  }

  // Optimization: Fetch AUM and supply once for all balances
  const totalAum = await getGMXVaultAUM(42161);
  const totalSupply = await getGLPTotalSupply(42161);

  if (!totalAum || !totalSupply) {
    console.error("[GMX] Failed to fetch AUM or supply for batch valuation");
    // Return fallback valuations for all
    arbitrumBalances.forEach((b) => {
      const key = b.identifier || b.balance;
      results.set(key, {
        glpPriceUsd: 0,
        totalValueUsd: 0,
        totalAum: "0",
        totalSupply: "0",
        glpBalance: b.balance,
        source: "fallback",
      });
    });
    return results;
  }

  // Calculate GLP price once
  const glpPriceUsd = calculateGLPPrice(totalAum, totalSupply);

  // Calculate value for each balance
  arbitrumBalances.forEach((b) => {
    const balanceInTokens = parseFloat(formatUnits(BigInt(b.balance), 18));
    const totalValueUsd = balanceInTokens * glpPriceUsd;

    const key = b.identifier || b.balance;
    results.set(key, {
      glpPriceUsd,
      totalValueUsd,
      totalAum: totalAum.toString(),
      totalSupply: totalSupply.toString(),
      glpBalance: b.balance,
      source: "gmx_contract",
    });
  });

  console.log(
    `[GMX] Batch valuation complete: ${results.size}/${arbitrumBalances.length} GLP holdings`
  );
  return results;
}

/**
 * Check if an address is the GLP token on Arbitrum
 *
 * @param address - Token address to check
 * @param chainId - Chain ID
 * @returns True if address is GLP token
 */
export function isGLPToken(address: Address, chainId: ChainId): boolean {
  const contracts = GMX_CONTRACTS[chainId];
  return contracts !== null && address.toLowerCase() === contracts.glp.toLowerCase();
}

/**
 * Get current GLP price without calculating user holdings
 * Useful for displaying GLP price in UI
 *
 * @param chainId - Must be 42161 (Arbitrum)
 * @returns GLP price in USD or null on error
 */
export async function getGLPPrice(chainId: ChainId): Promise<number | null> {
  try {
    if (chainId !== 42161) {
      console.warn("[GMX] GLP only exists on Arbitrum");
      return null;
    }

    const totalAum = await getGMXVaultAUM(chainId);
    const totalSupply = await getGLPTotalSupply(chainId);

    if (!totalAum || !totalSupply) {
      return null;
    }

    return calculateGLPPrice(totalAum, totalSupply);
  } catch (error) {
    console.error("[GMX] Error getting GLP price:", error);
    return null;
  }
}
