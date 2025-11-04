/**
 * Aave V3 aToken Pricing Module
 *
 * Calculates the value of Aave V3 aTokens by querying on-chain contracts
 * for exchange rates and underlying asset information.
 *
 * How aTokens Work:
 * - aTokens represent lending positions in Aave V3
 * - They accrue interest through an increasing exchange rate
 * - 1 aToken != 1 underlying (exchange rate changes over time)
 * - Formula: underlyingValue = aTokenBalance * liquidityIndex / RAY
 *
 * References:
 * - Aave V3 Docs: https://docs.aave.com/developers/tokens/atoken
 * - Pool Contract: https://docs.aave.com/developers/core-contracts/pool
 */

import { createPublicClient, http, Address } from "viem";
import { mainnet, arbitrum, base } from "viem/chains";
import { ChainId } from "@/types/portfolio";
import { AAVE_V3_POOL_ABI, ATOKEN_ABI } from "@/lib/contracts/abis";

// Aave V3 Pool addresses per chain
const AAVE_V3_POOL_ADDRESSES: Record<ChainId, Address | null> = {
  1: "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2", // Ethereum mainnet
  42161: "0x794a61358D6845594F94dc1DB02A252b5b4814aD", // Arbitrum
  8453: "0xA238Dd80C259a72e81d7e4664a9801593F98d1c5", // Base
};

// RAY constant (10^27) used in Aave calculations
const RAY = BigInt(10) ** BigInt(27);

interface AaveReserveData {
  liquidityIndex: bigint;
  currentLiquidityRate: bigint;
  variableBorrowRate: bigint;
  stableBorrowRate: bigint;
  aTokenAddress: Address;
}

interface ATokenValuation {
  underlyingAmount: string; // Underlying token amount (in wei)
  underlyingSymbol: string; // e.g., "USDC" from "aUSDC"
  exchangeRate: number; // aToken to underlying exchange rate
  valueUsd?: number; // USD value if underlying price available
  source: "aave_contract" | "estimate" | "fallback";
}

/**
 * Get Aave V3 reserve data for a token
 */
async function getAaveReserveData(
  underlyingAsset: Address,
  chainId: ChainId
): Promise<AaveReserveData | null> {
  try {
    const poolAddress = AAVE_V3_POOL_ADDRESSES[chainId];
    if (!poolAddress) {
      console.warn(`[Aave] No Pool address for chain ${chainId}`);
      return null;
    }

    const chain = chainId === 1 ? mainnet : chainId === 42161 ? arbitrum : base;
    const client = createPublicClient({
      chain,
      transport: http(),
    });

    const reserveData = await client.readContract({
      address: poolAddress,
      abi: AAVE_V3_POOL_ABI,
      functionName: "getReserveData",
      args: [underlyingAsset],
    });

    // getReserveData returns a struct with multiple fields
    // We need: liquidityIndex, currentLiquidityRate, and aTokenAddress
    return {
      liquidityIndex: reserveData.liquidityIndex,
      currentLiquidityRate: reserveData.currentLiquidityRate,
      variableBorrowRate: reserveData.currentVariableBorrowRate,
      stableBorrowRate: reserveData.currentStableBorrowRate,
      aTokenAddress: reserveData.aTokenAddress,
    };
  } catch (error) {
    console.error(
      `[Aave] Error fetching reserve data for ${underlyingAsset}:`,
      error
    );
    return null;
  }
}

/**
 * Get underlying asset address from aToken contract
 */
async function getUnderlyingAsset(
  aTokenAddress: Address,
  chainId: ChainId
): Promise<Address | null> {
  try {
    const chain = chainId === 1 ? mainnet : chainId === 42161 ? arbitrum : base;
    const client = createPublicClient({
      chain,
      transport: http(),
    });

    const underlyingAsset = await client.readContract({
      address: aTokenAddress,
      abi: ATOKEN_ABI,
      functionName: "UNDERLYING_ASSET_ADDRESS",
      args: [],
    });

    return underlyingAsset as Address;
  } catch (error) {
    console.error(
      `[Aave] Error fetching underlying asset for ${aTokenAddress}:`,
      error
    );
    return null;
  }
}

/**
 * Calculate underlying token amount from aToken balance
 *
 * Formula: underlyingAmount = aTokenBalance * liquidityIndex / RAY
 *
 * @param aTokenBalance - aToken balance in wei (as string or bigint)
 * @param liquidityIndex - Aave liquidity index (from reserve data)
 * @returns Underlying token amount in wei
 */
function calculateUnderlyingAmount(
  aTokenBalance: string | bigint,
  liquidityIndex: bigint
): string {
  try {
    const balance = typeof aTokenBalance === "string" ? BigInt(aTokenBalance) : aTokenBalance;

    // Formula: balance * liquidityIndex / RAY
    const underlyingAmount = (balance * liquidityIndex) / RAY;

    return underlyingAmount.toString();
  } catch (error) {
    console.error("[Aave] Error calculating underlying amount:", error);
    return aTokenBalance.toString(); // Fallback to 1:1
  }
}

/**
 * Get aToken valuation with underlying asset information
 *
 * @param aTokenAddress - aToken contract address
 * @param aTokenBalance - aToken balance (in wei as string)
 * @param aTokenSymbol - aToken symbol (e.g., "aUSDC")
 * @param chainId - Chain ID (1, 42161, 8453)
 * @param underlyingPriceUsd - Optional: underlying token price in USD
 * @returns aToken valuation with underlying details
 */
export async function getATokenValuation(
  aTokenAddress: Address,
  aTokenBalance: string,
  aTokenSymbol: string,
  chainId: ChainId,
  underlyingPriceUsd?: number
): Promise<ATokenValuation> {
  try {
    console.log(`[Aave] Valuing ${aTokenSymbol} (${aTokenBalance} wei)`);

    // Step 1: Get underlying asset address
    const underlyingAsset = await getUnderlyingAsset(aTokenAddress, chainId);
    if (!underlyingAsset) {
      console.warn(`[Aave] Could not get underlying asset for ${aTokenSymbol}`);
      return {
        underlyingAmount: aTokenBalance,
        underlyingSymbol: aTokenSymbol.replace(/^a/, ""), // Remove 'a' prefix
        exchangeRate: 1.0,
        valueUsd: underlyingPriceUsd
          ? (parseFloat(aTokenBalance) / 1e18) * underlyingPriceUsd
          : undefined,
        source: "estimate",
      };
    }

    // Step 2: Get reserve data (includes liquidityIndex)
    const reserveData = await getAaveReserveData(underlyingAsset, chainId);
    if (!reserveData) {
      console.warn(`[Aave] Could not get reserve data for ${underlyingAsset}`);
      return {
        underlyingAmount: aTokenBalance,
        underlyingSymbol: aTokenSymbol.replace(/^a/, ""),
        exchangeRate: 1.0,
        valueUsd: underlyingPriceUsd
          ? (parseFloat(aTokenBalance) / 1e18) * underlyingPriceUsd
          : undefined,
        source: "estimate",
      };
    }

    // Step 3: Calculate underlying amount using liquidityIndex
    const underlyingAmount = calculateUnderlyingAmount(
      aTokenBalance,
      reserveData.liquidityIndex
    );

    // Step 4: Calculate exchange rate (for display/debugging)
    const exchangeRate = Number(reserveData.liquidityIndex) / Number(RAY);

    // Step 5: Calculate USD value if underlying price provided
    const valueUsd = underlyingPriceUsd
      ? (parseFloat(underlyingAmount) / 1e18) * underlyingPriceUsd
      : undefined;

    console.log(
      `[Aave] ${aTokenSymbol}: ${aTokenBalance} aTokens = ${underlyingAmount} underlying (rate: ${exchangeRate.toFixed(6)})`
    );

    return {
      underlyingAmount,
      underlyingSymbol: aTokenSymbol.replace(/^a/, ""),
      exchangeRate,
      valueUsd,
      source: "aave_contract",
    };
  } catch (error) {
    console.error(`[Aave] Error in aToken valuation for ${aTokenSymbol}:`, error);

    // Fallback: Assume 1:1 ratio
    return {
      underlyingAmount: aTokenBalance,
      underlyingSymbol: aTokenSymbol.replace(/^a/, ""),
      exchangeRate: 1.0,
      valueUsd: underlyingPriceUsd
        ? (parseFloat(aTokenBalance) / 1e18) * underlyingPriceUsd
        : undefined,
      source: "fallback",
    };
  }
}

/**
 * Batch get aToken valuations for multiple aTokens
 *
 * @param aTokens - Array of aToken info (address, balance, symbol, chainId)
 * @param underlyingPrices - Map of underlying addresses to USD prices
 * @returns Map of aToken addresses to valuations
 */
export async function getATokenValuationsBatch(
  aTokens: Array<{
    address: Address;
    balance: string;
    symbol: string;
    chainId: ChainId;
  }>,
  underlyingPrices?: Map<string, number>
): Promise<Map<string, ATokenValuation>> {
  const results = new Map<string, ATokenValuation>();

  // Process in parallel (Aave contracts can handle it)
  await Promise.all(
    aTokens.map(async (aToken) => {
      const valuation = await getATokenValuation(
        aToken.address,
        aToken.balance,
        aToken.symbol,
        aToken.chainId,
        underlyingPrices?.get(aToken.address.toLowerCase())
      );

      results.set(aToken.address.toLowerCase(), valuation);
    })
  );

  console.log(`[Aave] Batch valuation complete: ${results.size}/${aTokens.length} aTokens`);
  return results;
}

/**
 * Check if an address is a valid Aave V3 aToken
 *
 * @param address - Token address to check
 * @param chainId - Chain ID
 * @returns True if address is a valid aToken
 */
export async function isValidAToken(
  address: Address,
  chainId: ChainId
): Promise<boolean> {
  try {
    const underlyingAsset = await getUnderlyingAsset(address, chainId);
    return underlyingAsset !== null;
  } catch {
    return false;
  }
}
