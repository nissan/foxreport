import { Address, formatUnits } from "viem";
import { getAlchemyClient } from "./client";
import { ChainId, TokenBalance } from "@/types/portfolio";
import { localCache, getCacheKey } from "@/lib/cache/storage";

/**
 * Fetches token balances for an address on a specific chain
 */
export async function getTokenBalances(
  address: Address,
  chainId: ChainId
): Promise<TokenBalance[]> {
  // Check cache first
  const cacheKey = getCacheKey.balances(address, chainId);
  const cached = localCache.get<TokenBalance[]>(cacheKey);

  if (cached) {
    console.log(`Using cached balances for ${address} on chain ${chainId}`);
    return cached;
  }

  try {
    const client = getAlchemyClient(chainId);

    // Get token balances using Alchemy SDK
    const balancesResponse = await client.core.getTokenBalances(address);

    // Filter out tokens with zero balance and fetch metadata
    const nonZeroBalances = balancesResponse.tokenBalances.filter(
      (token) => token.tokenBalance && token.tokenBalance !== "0"
    );

    // Fetch metadata for each token
    const balancesWithMetadata = await Promise.all(
      nonZeroBalances.map(async (token) => {
        try {
          const metadata = await client.core.getTokenMetadata(token.contractAddress);

          const balance = token.tokenBalance || "0";
          const decimals = metadata.decimals || 18;
          const balanceFormatted = formatUnits(BigInt(balance), decimals);

          return {
            address: token.contractAddress as Address,
            symbol: metadata.symbol || "UNKNOWN",
            name: metadata.name || "Unknown Token",
            decimals,
            balance,
            balanceFormatted,
            chainId,
            logo: metadata.logo || undefined,
          } as TokenBalance;
        } catch (error) {
          console.error(`Error fetching metadata for token ${token.contractAddress}:`, error);
          return null;
        }
      })
    );

    // Filter out failed fetches
    const validBalances = balancesWithMetadata.filter((b): b is TokenBalance => b !== null);

    // Also get native ETH balance
    const ethBalance = await client.core.getBalance(address);
    const ethBalanceFormatted = formatUnits(BigInt(ethBalance.toString()), 18);

    validBalances.unshift({
      address: "0x0000000000000000000000000000000000000000" as Address,
      symbol: "ETH",
      name: "Ethereum",
      decimals: 18,
      balance: ethBalance.toString(),
      balanceFormatted: ethBalanceFormatted,
      chainId,
    });

    // Cache for 5 minutes
    localCache.set(cacheKey, validBalances, 5);

    return validBalances;
  } catch (error) {
    console.error(`Error fetching token balances for ${address} on chain ${chainId}:`, error);
    throw error;
  }
}

/**
 * Fetches token balances across all supported chains
 */
export async function getMultiChainBalances(address: Address): Promise<TokenBalance[]> {
  const chains: ChainId[] = [1, 42161, 8453];

  try {
    const balances = await Promise.all(
      chains.map(async (chainId) => {
        try {
          return await getTokenBalances(address, chainId);
        } catch (error) {
          console.error(`Error fetching balances for chain ${chainId}:`, error);
          return [];
        }
      })
    );

    // Flatten the array
    return balances.flat();
  } catch (error) {
    console.error("Error fetching multi-chain balances:", error);
    throw error;
  }
}
