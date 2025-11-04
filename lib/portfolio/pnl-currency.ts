/**
 * P&L Currency Conversion Utilities (Phase 5 + Phase 4)
 *
 * Converts P&L calculations to user's preferred currency using Phase 3 FX rates
 * and Phase 4 currency context.
 */

import type { Transaction, TokenTransfer } from "@/types/portfolio";
import type { SupportedCurrency, FXRate } from "@/lib/currency/fx-rates";
import type { PortfolioPnLSummary } from "./pnl";

/**
 * Convert P&L summary to user's currency
 */
export function convertPnLSummaryToCurrency(
  summary: PortfolioPnLSummary,
  rates: FXRate[],
  targetCurrency: SupportedCurrency
): PortfolioPnLSummary {
  if (targetCurrency === "USD") {
    return summary;
  }

  const rate = rates.find((r) => r.targetCurrency === targetCurrency);
  if (!rate) {
    console.warn(`No FX rate found for ${targetCurrency}, returning USD values`);
    return summary;
  }

  return {
    ...summary,
    totalCostBasisUsd: summary.totalCostBasisUsd * rate.rate,
    totalCurrentValueUsd: summary.totalCurrentValueUsd * rate.rate,
    totalProfitLossUsd: summary.totalProfitLossUsd * rate.rate,
    // Percentage stays the same regardless of currency
  };
}

/**
 * Convert transaction P&L to user's currency
 */
export function convertTransactionPnLToCurrency(
  transaction: Transaction,
  rates: FXRate[],
  targetCurrency: SupportedCurrency
): Transaction {
  if (targetCurrency === "USD" || !transaction.profitLossUsd) {
    return transaction;
  }

  const rate = rates.find((r) => r.targetCurrency === targetCurrency);
  if (!rate) {
    return transaction;
  }

  return {
    ...transaction,
    historicalPriceUsd: transaction.historicalPriceUsd
      ? transaction.historicalPriceUsd * rate.rate
      : undefined,
    costBasisUsd: transaction.costBasisUsd
      ? transaction.costBasisUsd * rate.rate
      : undefined,
    currentValueUsd: transaction.currentValueUsd
      ? transaction.currentValueUsd * rate.rate
      : undefined,
    profitLossUsd: transaction.profitLossUsd * rate.rate,
    // Percentage stays the same
  };
}

/**
 * Convert multiple transactions' P&L to user's currency
 */
export function convertBatchTransactionPnLToCurrency(
  transactions: Transaction[],
  rates: FXRate[],
  targetCurrency: SupportedCurrency
): Transaction[] {
  if (targetCurrency === "USD") {
    return transactions;
  }

  const rate = rates.find((r) => r.targetCurrency === targetCurrency);
  if (!rate) {
    console.warn(`No FX rate found for ${targetCurrency}`);
    return transactions;
  }

  return transactions.map((tx) => convertTransactionPnLToCurrency(tx, rates, targetCurrency));
}

/**
 * Format P&L amount with currency symbol
 */
export function formatPnLAmount(
  amountUsd: number,
  currency: SupportedCurrency,
  showSign: boolean = true
): string {
  const symbols: Record<SupportedCurrency, string> = {
    USD: "$",
    AUD: "A$",
    GBP: "£",
    CAD: "C$",
  };

  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(amountUsd));

  const symbol = symbols[currency];
  const sign = showSign && amountUsd !== 0 ? (amountUsd > 0 ? "+" : "-") : "";

  return `${sign}${symbol}${formatted}`;
}

/**
 * Format P&L percentage
 */
export function formatPnLPercentage(
  percentage: number,
  showSign: boolean = true
): string {
  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(percentage));

  const sign = showSign && percentage !== 0 ? (percentage > 0 ? "+" : "-") : "";

  return `${sign}${formatted}%`;
}

/**
 * Get P&L color class for UI
 */
export function getPnLColorClass(profitLoss: number): string {
  if (profitLoss > 0) return "text-green-600 dark:text-green-400";
  if (profitLoss < 0) return "text-red-600 dark:text-red-400";
  return "text-gray-600 dark:text-gray-400";
}

/**
 * Get P&L status label
 */
export function getPnLStatus(profitLoss: number): "profit" | "loss" | "breakeven" {
  if (profitLoss > 0) return "profit";
  if (profitLoss < 0) return "loss";
  return "breakeven";
}

/**
 * Format complete P&L display with amount and percentage
 */
export function formatPnLDisplay(
  profitLossUsd: number,
  profitLossPercentage: number,
  currency: SupportedCurrency
): {
  amount: string;
  percentage: string;
  colorClass: string;
  status: "profit" | "loss" | "breakeven";
} {
  return {
    amount: formatPnLAmount(profitLossUsd, currency),
    percentage: formatPnLPercentage(profitLossPercentage),
    colorClass: getPnLColorClass(profitLossUsd),
    status: getPnLStatus(profitLossUsd),
  };
}

/**
 * Historical P&L conversion (for specific transaction dates)
 */
export async function convertHistoricalPnLToCurrency(
  amountUsd: number,
  timestamp: number,
  targetCurrency: SupportedCurrency
): Promise<number> {
  if (targetCurrency === "USD") {
    return amountUsd;
  }

  try {
    // Convert timestamp to date string
    const date = new Date(timestamp);
    const dateString = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

    // Fetch historical FX rate
    const response = await fetch("/api/fx-rates/historical", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: [{ timestamp, currencies: [targetCurrency] }],
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch historical FX rates: ${response.status}`);
    }

    const data = await response.json();
    const rates = data.rates[dateString] as FXRate[];

    const rate = rates.find((r) => r.targetCurrency === targetCurrency);
    if (!rate) {
      throw new Error(`No historical FX rate found for ${targetCurrency}`);
    }

    return amountUsd * rate.rate;
  } catch (error) {
    console.error("[P&L Currency] Error converting historical P&L:", error);
    // Return USD amount as fallback
    return amountUsd;
  }
}
