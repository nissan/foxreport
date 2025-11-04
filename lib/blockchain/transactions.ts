import { Address, formatEther } from "viem";
import { getAlchemyClient } from "./client";
import { ChainId, Transaction, TokenTransfer } from "@/types/portfolio";
import { localCache, getCacheKey } from "@/lib/cache/storage";
import { AssetTransfersCategory, AssetTransfersResponse, SortingOrder } from "alchemy-sdk";

/**
 * Determines transaction type based on transfer direction and patterns
 */
function determineTransactionType(
  transfer: AssetTransfersResponse["transfers"][0],
  userAddress: Address
): "deposit" | "withdrawal" | "swap" | "unknown" {
  const from = transfer.from?.toLowerCase();
  const to = transfer.to?.toLowerCase();
  const user = userAddress.toLowerCase();

  if (to === user) return "deposit";
  if (from === user) return "withdrawal";

  return "unknown";
}

/**
 * Enriches transactions with actual block timestamps from the blockchain
 * Uses caching to minimize API calls
 */
async function enrichTransactionsWithTimestamps(
  transactions: Transaction[],
  chainId: ChainId
): Promise<Transaction[]> {
  if (transactions.length === 0) return transactions;

  const client = getAlchemyClient(chainId);
  const blockTimestampCache = new Map<number, number>();

  // Get unique block numbers
  const uniqueBlockNumbers = Array.from(
    new Set(transactions.map((tx) => tx.blockNumber))
  );

  // Fetch block timestamps in batch (limit to avoid overwhelming the API)
  const BATCH_SIZE = 10;
  for (let i = 0; i < uniqueBlockNumbers.length; i += BATCH_SIZE) {
    const batch = uniqueBlockNumbers.slice(i, i + BATCH_SIZE);

    await Promise.allSettled(
      batch.map(async (blockNumber) => {
        try {
          // Check local cache first
          const cacheKey = getCacheKey.blockTimestamp(blockNumber, chainId);
          const cached = localCache.get<number>(cacheKey);

          if (cached) {
            blockTimestampCache.set(blockNumber, cached);
            return;
          }

          // Fetch from blockchain
          const block = await client.core.getBlock(blockNumber);
          const timestamp = block.timestamp * 1000; // Convert to milliseconds

          // Cache block timestamp for 24 hours (blocks don't change)
          localCache.set(cacheKey, timestamp, 1440);
          blockTimestampCache.set(blockNumber, timestamp);
        } catch (error) {
          console.error(`Error fetching timestamp for block ${blockNumber}:`, error);
          // Use current time as fallback
          blockTimestampCache.set(blockNumber, Date.now());
        }
      })
    );

    // Small delay between batches to be respectful to API
    if (i + BATCH_SIZE < uniqueBlockNumbers.length) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  // Update transactions with timestamps
  return transactions.map((tx) => ({
    ...tx,
    timestamp: blockTimestampCache.get(tx.blockNumber) || Date.now(),
  }));
}

/**
 * Fetches transaction history for an address on a specific chain
 */
export async function getTransactionHistory(
  address: Address,
  chainId: ChainId,
  maxCount: number = 100
): Promise<Transaction[]> {
  // Check cache first
  const cacheKey = getCacheKey.transactions(address, chainId);
  const cached = localCache.get<Transaction[]>(cacheKey);

  if (cached) {
    console.log(`Using cached transactions for ${address} on chain ${chainId}`);
    return cached;
  }

  try {
    const client = getAlchemyClient(chainId);

    // Get incoming transfers (deposits)
    const incomingTransfers = await client.core.getAssetTransfers({
      toAddress: address,
      category: [
        AssetTransfersCategory.EXTERNAL,
        AssetTransfersCategory.ERC20,
        AssetTransfersCategory.ERC721,
        AssetTransfersCategory.ERC1155,
      ],
      maxCount,
      order: SortingOrder.DESCENDING,
    });

    // Get outgoing transfers (withdrawals)
    const outgoingTransfers = await client.core.getAssetTransfers({
      fromAddress: address,
      category: [
        AssetTransfersCategory.EXTERNAL,
        AssetTransfersCategory.ERC20,
        AssetTransfersCategory.ERC721,
        AssetTransfersCategory.ERC1155,
      ],
      maxCount,
      order: SortingOrder.DESCENDING,
    });

    // Combine and deduplicate transfers
    const allTransfers = [
      ...incomingTransfers.transfers,
      ...outgoingTransfers.transfers,
    ];

    // Convert to our Transaction format
    const transactions: Transaction[] = allTransfers
      .map((transfer) => {
        if (!transfer.hash || !transfer.blockNum) return null;

        // Note: Timestamp will be fetched separately in batch to avoid too many API calls
        const timestamp = 0; // Placeholder, will be populated by enrichTransactionsWithTimestamps()

        const tokenTransfer: TokenTransfer | undefined =
          transfer.rawContract?.address
            ? {
                from: (transfer.from || "0x0000000000000000000000000000000000000000") as Address,
                to: (transfer.to || "0x0000000000000000000000000000000000000000") as Address,
                value: transfer.rawContract.value || "0",
                valueFormatted: transfer.value?.toString() || "0",
                tokenAddress: transfer.rawContract.address as Address,
                symbol: transfer.asset || "UNKNOWN",
                decimals: Number(transfer.rawContract.decimal) || 18,
              }
            : undefined;

        return {
          hash: transfer.hash,
          from: (transfer.from || "0x0000000000000000000000000000000000000000") as Address,
          to: (transfer.to || null) as Address | null,
          value: transfer.value?.toString() || "0",
          valueFormatted: transfer.value?.toString() || "0",
          timestamp,
          blockNumber: parseInt(transfer.blockNum, 16),
          chainId,
          type: determineTransactionType(transfer, address),
          tokenTransfers: tokenTransfer ? [tokenTransfer] : undefined,
        } as Transaction;
      })
      .filter((tx): tx is Transaction => tx !== null);

    // Sort by block number descending
    transactions.sort((a, b) => b.blockNumber - a.blockNumber);

    // Remove duplicates by hash
    const uniqueTransactions = Array.from(
      new Map(transactions.map((tx) => [tx.hash, tx])).values()
    );

    // Enrich with actual block timestamps
    const enrichedTransactions = await enrichTransactionsWithTimestamps(
      uniqueTransactions,
      chainId
    );

    // Cache for 10 minutes
    localCache.set(cacheKey, enrichedTransactions, 10);

    return enrichedTransactions;
  } catch (error) {
    console.error(`Error fetching transaction history for ${address} on chain ${chainId}:`, error);
    throw error;
  }
}

/**
 * Fetches transaction history across all supported chains
 */
export async function getMultiChainTransactionHistory(
  address: Address,
  maxCountPerChain: number = 50
): Promise<Transaction[]> {
  const chains: ChainId[] = [1, 42161, 8453];

  try {
    const transactions = await Promise.all(
      chains.map(async (chainId) => {
        try {
          return await getTransactionHistory(address, chainId, maxCountPerChain);
        } catch (error) {
          console.error(`Error fetching transactions for chain ${chainId}:`, error);
          return [];
        }
      })
    );

    // Flatten and sort by timestamp
    const allTransactions = transactions.flat();
    allTransactions.sort((a, b) => b.timestamp - a.timestamp);

    return allTransactions;
  } catch (error) {
    console.error("Error fetching multi-chain transaction history:", error);
    throw error;
  }
}

/**
 * Filters transactions to only deposits
 */
export function getDeposits(transactions: Transaction[]): Transaction[] {
  return transactions.filter((tx) => tx.type === "deposit");
}

/**
 * Filters transactions to only withdrawals
 */
export function getWithdrawals(transactions: Transaction[]): Transaction[] {
  return transactions.filter((tx) => tx.type === "withdrawal");
}
