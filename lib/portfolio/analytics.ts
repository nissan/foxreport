import { Address } from "viem";
import {
  PortfolioData,
  PortfolioSummary,
  TokenBalance,
  Transaction,
  DeFiPosition,
  ChainId,
} from "@/types/portfolio";
import { getMultiChainBalances } from "@/lib/blockchain/balances";
import { getMultiChainTransactionHistory, getDeposits, getWithdrawals } from "@/lib/blockchain/transactions";
import { getMultiChainDeFiPositions } from "@/lib/defi/protocols";
import { getBatchTokenPrices } from "@/lib/prices";
import { getChainName } from "@/lib/blockchain/chains";
import { localCache, getCacheKey } from "@/lib/cache/storage";

/**
 * Enriches token balances with current USD prices and values
 */
async function enrichBalancesWithPrices(
  balances: TokenBalance[]
): Promise<TokenBalance[]> {
  const tokens = balances.map((b) => ({ address: b.address, chainId: b.chainId }));
  const priceMap = await getBatchTokenPrices(tokens);

  return balances.map((balance) => {
    const key = `${balance.address.toLowerCase()}_${balance.chainId}`;
    const priceUsd = priceMap.get(key);

    if (priceUsd) {
      const valueUsd = parseFloat(balance.balanceFormatted) * priceUsd;
      return {
        ...balance,
        priceUsd,
        valueUsd,
      };
    }

    // Return balance without price data if price fetch failed
    // This allows the UI to still show token amounts
    return {
      ...balance,
      priceUsd: undefined,
      valueUsd: 0,
    };
  });
}

/**
 * Calculates total deposited value using token transfers and current prices
 * Note: Uses current prices as approximation - ideally should use historical prices
 */
async function calculateDepositedValue(
  transactions: Transaction[],
  balances: TokenBalance[]
): Promise<number> {
  const deposits = getDeposits(transactions);

  let totalValue = 0;

  for (const tx of deposits) {
    // Check if there are token transfers
    if (tx.tokenTransfers && tx.tokenTransfers.length > 0) {
      for (const transfer of tx.tokenTransfers) {
        // Find the token in balances to get its current price
        const token = balances.find(
          (b) => b.address.toLowerCase() === transfer.tokenAddress.toLowerCase()
        );

        if (token && token.priceUsd) {
          const amount = parseFloat(transfer.valueFormatted);
          totalValue += amount * token.priceUsd;
        }
      }
    } else if (tx.value && tx.value !== "0") {
      // Native ETH transfer
      const ethToken = balances.find(
        (b) => b.symbol === "ETH" && b.chainId === tx.chainId
      );

      if (ethToken && ethToken.priceUsd) {
        const amount = parseFloat(tx.valueFormatted);
        totalValue += amount * ethToken.priceUsd;
      }
    }
  }

  return totalValue;
}

/**
 * Calculates total withdrawn value using token transfers and current prices
 */
async function calculateWithdrawnValue(
  transactions: Transaction[],
  balances: TokenBalance[]
): Promise<number> {
  const withdrawals = getWithdrawals(transactions);

  let totalValue = 0;

  for (const tx of withdrawals) {
    // Check if there are token transfers
    if (tx.tokenTransfers && tx.tokenTransfers.length > 0) {
      for (const transfer of tx.tokenTransfers) {
        // Find the token in balances to get its current price
        const token = balances.find(
          (b) => b.address.toLowerCase() === transfer.tokenAddress.toLowerCase()
        );

        if (token && token.priceUsd) {
          const amount = parseFloat(transfer.valueFormatted);
          totalValue += amount * token.priceUsd;
        }
      }
    } else if (tx.value && tx.value !== "0") {
      // Native ETH transfer
      const ethToken = balances.find(
        (b) => b.symbol === "ETH" && b.chainId === tx.chainId
      );

      if (ethToken && ethToken.priceUsd) {
        const amount = parseFloat(tx.valueFormatted);
        totalValue += amount * ethToken.priceUsd;
      }
    }
  }

  return totalValue;
}

/**
 * Calculates portfolio summary statistics
 */
async function calculateSummary(
  address: Address,
  balances: TokenBalance[],
  transactions: Transaction[],
  defiPositions: DeFiPosition[]
): Promise<PortfolioSummary> {
  // Calculate total current value from balances
  const totalValueFromBalances = balances.reduce((total, balance) => {
    return total + (balance.valueUsd || 0);
  }, 0);

  // Add DeFi position values
  const totalValueFromDefi = defiPositions.reduce((total, position) => {
    return total + (position.totalValueUsd || 0);
  }, 0);

  const totalValueUsd = totalValueFromBalances + totalValueFromDefi;

  // Calculate deposited and withdrawn values using actual token prices
  const totalDepositedUsd = await calculateDepositedValue(transactions, balances);
  const totalWithdrawnUsd = await calculateWithdrawnValue(transactions, balances);
  const netDepositedUsd = totalDepositedUsd - totalWithdrawnUsd;

  // Calculate P&L
  const pnlUsd = totalValueUsd - netDepositedUsd;
  const pnlPercentage = netDepositedUsd > 0 ? (pnlUsd / netDepositedUsd) * 100 : 0;

  return {
    address,
    totalValueUsd,
    totalDepositedUsd,
    totalWithdrawnUsd,
    netDepositedUsd,
    pnlUsd,
    pnlPercentage,
    lastUpdated: Date.now(),
  };
}

/**
 * Calculates chain breakdown of portfolio
 */
function calculateChainBreakdown(balances: TokenBalance[]) {
  const chainMap = new Map<ChainId, { totalValue: number; tokenCount: number }>();

  balances.forEach((balance) => {
    const existing = chainMap.get(balance.chainId) || { totalValue: 0, tokenCount: 0 };
    chainMap.set(balance.chainId, {
      totalValue: existing.totalValue + (balance.valueUsd || 0),
      tokenCount: existing.tokenCount + 1,
    });
  });

  return Array.from(chainMap.entries()).map(([chainId, data]) => ({
    chainId,
    chainName: getChainName(chainId),
    totalValueUsd: data.totalValue,
    tokenCount: data.tokenCount,
  }));
}

/**
 * Main function to fetch and analyze complete portfolio data
 */
export async function getPortfolioData(address: Address): Promise<PortfolioData> {
  // Check cache first
  const cacheKey = getCacheKey.portfolio(address);
  const cached = localCache.get<PortfolioData>(cacheKey);

  if (cached) {
    console.log(`Using cached portfolio data for ${address}`);
    return cached;
  }

  try {
    console.log(`Fetching fresh portfolio data for ${address}`);

    // Fetch all data in parallel
    const [balancesRaw, transactions, defiPositions] = await Promise.all([
      getMultiChainBalances(address),
      getMultiChainTransactionHistory(address, 100),
      getMultiChainDeFiPositions(address),
    ]);

    // Enrich balances with prices
    const balances = await enrichBalancesWithPrices(balancesRaw);

    // Calculate summary
    const summary = await calculateSummary(address, balances, transactions, defiPositions);

    // Calculate chain breakdown
    const chainBreakdown = calculateChainBreakdown(balances);

    const portfolioData: PortfolioData = {
      summary,
      balances,
      transactions,
      defiPositions,
      chainBreakdown,
    };

    // Cache for 5 minutes
    localCache.set(cacheKey, portfolioData, 5);

    return portfolioData;
  } catch (error) {
    console.error(`Error fetching portfolio data for ${address}:`, error);
    throw error;
  }
}

/**
 * Forces a refresh of portfolio data (bypasses cache)
 */
export async function refreshPortfolioData(address: Address): Promise<PortfolioData> {
  const cacheKey = getCacheKey.portfolio(address);
  localCache.remove(cacheKey);
  return getPortfolioData(address);
}
