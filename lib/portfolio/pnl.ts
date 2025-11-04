/**
 * Profit & Loss Calculation Service (Phase 5)
 *
 * Calculates accurate P&L using:
 * - Phase 1: Exact transaction timestamps from blockchain
 * - Phase 2: Historical prices at transaction time for cost basis
 * - Phase 3: Current prices and FX rates for valuation
 * - Phase 4: Currency conversion for display
 *
 * P&L Formula:
 * - Cost Basis = Amount * Historical Price (at transaction time)
 * - Current Value = Amount * Current Price
 * - Profit/Loss = Current Value - Cost Basis
 * - P&L % = (Profit/Loss / Cost Basis) * 100
 */

import { Address } from "viem";
import { ChainId, Transaction, TokenTransfer } from "@/types/portfolio";
import { getHistoricalPrice, getBatchHistoricalPrices } from "@/lib/prices";

export interface PnLCalculationOptions {
  includeTokenTransfers?: boolean;  // Calculate P&L for token transfers
  batchSize?: number;                // Batch size for historical price fetching
}

export interface PortfolioPnLSummary {
  totalCostBasisUsd: number;
  totalCurrentValueUsd: number;
  totalProfitLossUsd: number;
  totalProfitLossPercentage: number;
  transactionCount: number;
  profitableTransactions: number;
  lossTransactions: number;
  breakEvenTransactions: number;
}

/**
 * Calculate P&L for a single transaction
 * Enriches transaction object with P&L fields
 */
export async function calculateTransactionPnL(
  transaction: Transaction,
  currentPriceUsd: number
): Promise<Transaction> {
  // Skip if no historical price available or invalid transaction
  if (!transaction.timestamp || !transaction.value) {
    return transaction;
  }

  try {
    // Get historical price at transaction time (Phase 2)
    const historicalPriceUsd = await getHistoricalPrice(
      transaction.to || transaction.from,  // Token address (use 'to' for deposits, 'from' for withdrawals)
      transaction.chainId,
      transaction.timestamp
    );

    if (!historicalPriceUsd) {
      console.warn(`No historical price for transaction ${transaction.hash}`);
      return transaction;
    }

    // Parse transaction value
    const amount = parseFloat(transaction.valueFormatted);

    // Calculate cost basis (value at transaction time)
    const costBasisUsd = amount * historicalPriceUsd;

    // Calculate current value
    const currentValueUsd = amount * currentPriceUsd;

    // Calculate P&L
    const profitLossUsd = currentValueUsd - costBasisUsd;
    const profitLossPercentage = costBasisUsd > 0
      ? (profitLossUsd / costBasisUsd) * 100
      : 0;

    return {
      ...transaction,
      historicalPriceUsd,
      costBasisUsd,
      currentValueUsd,
      profitLossUsd,
      profitLossPercentage,
    };
  } catch (error) {
    console.error(`Error calculating P&L for transaction ${transaction.hash}:`, error);
    return transaction;
  }
}

/**
 * Calculate P&L for a token transfer
 */
export async function calculateTokenTransferPnL(
  transfer: TokenTransfer,
  timestamp: number,
  chainId: ChainId,
  currentPriceUsd: number
): Promise<TokenTransfer> {
  try {
    // Get historical price at transaction time
    const historicalPriceUsd = await getHistoricalPrice(
      transfer.tokenAddress,
      chainId,
      timestamp
    );

    if (!historicalPriceUsd) {
      return transfer;
    }

    // Parse transfer value
    const amount = parseFloat(transfer.valueFormatted);

    // Calculate cost basis
    const costBasisUsd = amount * historicalPriceUsd;

    // Calculate current value
    const currentValueUsd = amount * currentPriceUsd;

    // Calculate P&L
    const profitLossUsd = currentValueUsd - costBasisUsd;
    const profitLossPercentage = costBasisUsd > 0
      ? (profitLossUsd / costBasisUsd) * 100
      : 0;

    return {
      ...transfer,
      historicalPriceUsd,
      costBasisUsd,
      profitLossUsd,
      profitLossPercentage,
    };
  } catch (error) {
    console.error(`Error calculating P&L for token transfer:`, error);
    return transfer;
  }
}

/**
 * Calculate P&L for multiple transactions in batch
 * Uses Phase 2's batch historical price fetching for efficiency
 */
export async function calculateBatchTransactionPnL(
  transactions: Transaction[],
  currentPrices: Map<string, number>,  // Map<"address_chainId", priceUsd>
  options: PnLCalculationOptions = {}
): Promise<Transaction[]> {
  const {
    includeTokenTransfers = false,
    batchSize = 50,
  } = options;

  if (transactions.length === 0) {
    return transactions;
  }

  console.log(`[P&L] Calculating P&L for ${transactions.length} transactions...`);

  // Step 1: Collect all unique price requests
  const priceRequests: Array<{
    address: Address;
    chainId: ChainId;
    timestamp: number;
  }> = [];

  transactions.forEach((tx) => {
    if (!tx.timestamp) return;

    // Add main transaction
    const tokenAddress = tx.to || tx.from;
    priceRequests.push({
      address: tokenAddress,
      chainId: tx.chainId,
      timestamp: tx.timestamp,
    });

    // Add token transfers if requested
    if (includeTokenTransfers && tx.tokenTransfers) {
      tx.tokenTransfers.forEach((transfer) => {
        priceRequests.push({
          address: transfer.tokenAddress,
          chainId: tx.chainId,
          timestamp: tx.timestamp,
        });
      });
    }
  });

  // Step 2: Fetch all historical prices in batch (Phase 2)
  console.log(`[P&L] Fetching ${priceRequests.length} historical prices...`);
  const historicalPrices = await getBatchHistoricalPrices(priceRequests);
  console.log(`[P&L] Retrieved ${historicalPrices.size} historical prices`);

  // Step 3: Calculate P&L for each transaction
  const enrichedTransactions = transactions.map((tx) => {
    if (!tx.timestamp) return tx;

    const tokenAddress = tx.to || tx.from;
    const priceKey = `${tokenAddress.toLowerCase()}_${tx.chainId}_${tx.timestamp}`;
    const historicalPriceUsd = historicalPrices.get(priceKey);

    if (!historicalPriceUsd) {
      return tx;
    }

    // Get current price
    const currentPriceKey = `${tokenAddress.toLowerCase()}_${tx.chainId}`;
    const currentPriceUsd = currentPrices.get(currentPriceKey);

    if (!currentPriceUsd) {
      return tx;
    }

    // Calculate P&L
    const amount = parseFloat(tx.valueFormatted);
    const costBasisUsd = amount * historicalPriceUsd;
    const currentValueUsd = amount * currentPriceUsd;
    const profitLossUsd = currentValueUsd - costBasisUsd;
    const profitLossPercentage = costBasisUsd > 0
      ? (profitLossUsd / costBasisUsd) * 100
      : 0;

    // Enrich token transfers if requested
    let enrichedTokenTransfers = tx.tokenTransfers;
    if (includeTokenTransfers && tx.tokenTransfers) {
      enrichedTokenTransfers = tx.tokenTransfers.map((transfer) => {
        const transferPriceKey = `${transfer.tokenAddress.toLowerCase()}_${tx.chainId}_${tx.timestamp}`;
        const transferHistoricalPrice = historicalPrices.get(transferPriceKey);

        if (!transferHistoricalPrice) return transfer;

        const transferCurrentPriceKey = `${transfer.tokenAddress.toLowerCase()}_${tx.chainId}`;
        const transferCurrentPrice = currentPrices.get(transferCurrentPriceKey);

        if (!transferCurrentPrice) return transfer;

        const transferAmount = parseFloat(transfer.valueFormatted);
        const transferCostBasis = transferAmount * transferHistoricalPrice;
        const transferCurrentValue = transferAmount * transferCurrentPrice;
        const transferPnL = transferCurrentValue - transferCostBasis;
        const transferPnLPercentage = transferCostBasis > 0
          ? (transferPnL / transferCostBasis) * 100
          : 0;

        return {
          ...transfer,
          historicalPriceUsd: transferHistoricalPrice,
          costBasisUsd: transferCostBasis,
          profitLossUsd: transferPnL,
          profitLossPercentage: transferPnLPercentage,
        };
      });
    }

    return {
      ...tx,
      historicalPriceUsd,
      costBasisUsd,
      currentValueUsd,
      profitLossUsd,
      profitLossPercentage,
      tokenTransfers: enrichedTokenTransfers,
    };
  });

  console.log(`[P&L] Calculated P&L for ${enrichedTransactions.filter(tx => tx.profitLossUsd !== undefined).length} transactions`);

  return enrichedTransactions;
}

/**
 * Calculate portfolio-wide P&L summary
 */
export function calculatePortfolioPnLSummary(
  transactions: Transaction[]
): PortfolioPnLSummary {
  let totalCostBasisUsd = 0;
  let totalCurrentValueUsd = 0;
  let profitableTransactions = 0;
  let lossTransactions = 0;
  let breakEvenTransactions = 0;
  let transactionCount = 0;

  transactions.forEach((tx) => {
    if (tx.costBasisUsd !== undefined && tx.currentValueUsd !== undefined) {
      totalCostBasisUsd += tx.costBasisUsd;
      totalCurrentValueUsd += tx.currentValueUsd;
      transactionCount++;

      if (tx.profitLossUsd !== undefined) {
        if (tx.profitLossUsd > 0) {
          profitableTransactions++;
        } else if (tx.profitLossUsd < 0) {
          lossTransactions++;
        } else {
          breakEvenTransactions++;
        }
      }
    }
  });

  const totalProfitLossUsd = totalCurrentValueUsd - totalCostBasisUsd;
  const totalProfitLossPercentage = totalCostBasisUsd > 0
    ? (totalProfitLossUsd / totalCostBasisUsd) * 100
    : 0;

  return {
    totalCostBasisUsd,
    totalCurrentValueUsd,
    totalProfitLossUsd,
    totalProfitLossPercentage,
    transactionCount,
    profitableTransactions,
    lossTransactions,
    breakEvenTransactions,
  };
}

/**
 * Filter transactions by P&L status
 */
export function filterTransactionsByPnL(
  transactions: Transaction[],
  filter: "profitable" | "loss" | "breakeven" | "all" = "all"
): Transaction[] {
  if (filter === "all") {
    return transactions;
  }

  return transactions.filter((tx) => {
    if (tx.profitLossUsd === undefined) return false;

    switch (filter) {
      case "profitable":
        return tx.profitLossUsd > 0;
      case "loss":
        return tx.profitLossUsd < 0;
      case "breakeven":
        return tx.profitLossUsd === 0;
      default:
        return true;
    }
  });
}

/**
 * Sort transactions by P&L
 */
export function sortTransactionsByPnL(
  transactions: Transaction[],
  order: "asc" | "desc" = "desc"
): Transaction[] {
  return [...transactions].sort((a, b) => {
    const pnlA = a.profitLossUsd || 0;
    const pnlB = b.profitLossUsd || 0;

    return order === "desc" ? pnlB - pnlA : pnlA - pnlB;
  });
}

/**
 * Get top N profitable transactions
 */
export function getTopProfitableTransactions(
  transactions: Transaction[],
  count: number = 10
): Transaction[] {
  return sortTransactionsByPnL(
    filterTransactionsByPnL(transactions, "profitable"),
    "desc"
  ).slice(0, count);
}

/**
 * Get top N loss transactions
 */
export function getTopLossTransactions(
  transactions: Transaction[],
  count: number = 10
): Transaction[] {
  return sortTransactionsByPnL(
    filterTransactionsByPnL(transactions, "loss"),
    "asc"
  ).slice(0, count);
}
