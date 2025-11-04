"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import type { SupportedCurrency, FXRate } from "./fx-rates";

/**
 * Currency Context - Manages user's preferred display currency
 *
 * Features:
 * - User preference persistence (localStorage)
 * - Current FX rates caching
 * - Currency conversion helpers
 * - Type-safe currency selection
 */

interface CurrencyContextValue {
  // Current user preference
  currency: SupportedCurrency;

  // Change currency (persists to localStorage)
  setCurrency: (currency: SupportedCurrency) => void;

  // Current FX rates (loaded from API)
  rates: FXRate[] | null;

  // Loading state for FX rates
  isLoadingRates: boolean;

  // Error state for FX rate fetching
  ratesError: string | null;

  // Convert USD amount to user's currency
  convertToUserCurrency: (amountUSD: number) => number;

  // Get current exchange rate for user's currency
  getUserCurrencyRate: () => number;

  // Format amount in user's currency with symbol
  formatAmount: (amountUSD: number) => string;

  // Refresh FX rates from API
  refreshRates: () => Promise<void>;
}

const CurrencyContext = createContext<CurrencyContextValue | undefined>(undefined);

const STORAGE_KEY = "foxreport_preferred_currency";
const DEFAULT_CURRENCY: SupportedCurrency = "USD";

// Currency symbols for formatting
const CURRENCY_SYMBOLS: Record<SupportedCurrency, string> = {
  USD: "$",
  AUD: "A$",
  GBP: "£",
  CAD: "C$",
};

interface CurrencyProviderProps {
  children: React.ReactNode;
}

export function CurrencyProvider({ children }: CurrencyProviderProps) {
  const [currency, setCurrencyState] = useState<SupportedCurrency>(DEFAULT_CURRENCY);
  const [rates, setRates] = useState<FXRate[] | null>(null);
  const [isLoadingRates, setIsLoadingRates] = useState(false);
  const [ratesError, setRatesError] = useState<string | null>(null);

  // Load user preference from localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && ["USD", "AUD", "GBP", "CAD"].includes(stored)) {
        setCurrencyState(stored as SupportedCurrency);
      }
    }
  }, []);

  // Fetch FX rates on mount and when currency changes
  const fetchRates = useCallback(async () => {
    setIsLoadingRates(true);
    setRatesError(null);

    try {
      const response = await fetch("/api/fx-rates");

      if (!response.ok) {
        throw new Error(`Failed to fetch FX rates: ${response.status}`);
      }

      const data = await response.json();
      setRates(data.rates as FXRate[]);
    } catch (error) {
      console.error("[Currency Context] Error fetching FX rates:", error);
      setRatesError(error instanceof Error ? error.message : "Unknown error");

      // Set fallback rates on error
      const fallbackRates: FXRate[] = [
        { baseCurrency: "USD", targetCurrency: "USD", rate: 1.0, timestamp: Date.now(), source: "fallback" },
        { baseCurrency: "USD", targetCurrency: "AUD", rate: 1.54, timestamp: Date.now(), source: "fallback" },
        { baseCurrency: "USD", targetCurrency: "GBP", rate: 0.79, timestamp: Date.now(), source: "fallback" },
        { baseCurrency: "USD", targetCurrency: "CAD", rate: 1.37, timestamp: Date.now(), source: "fallback" },
      ];
      setRates(fallbackRates);
    } finally {
      setIsLoadingRates(false);
    }
  }, []);

  // Fetch rates on mount
  useEffect(() => {
    fetchRates();
  }, [fetchRates]);

  // Update currency and persist to localStorage
  const setCurrency = useCallback((newCurrency: SupportedCurrency) => {
    setCurrencyState(newCurrency);

    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, newCurrency);
    }

    console.log(`[Currency Context] Currency changed to ${newCurrency}`);
  }, []);

  // Get exchange rate for user's currency
  const getUserCurrencyRate = useCallback((): number => {
    if (!rates) return 1.0;

    const rate = rates.find((r) => r.targetCurrency === currency);
    return rate?.rate || 1.0;
  }, [rates, currency]);

  // Convert USD amount to user's currency
  const convertToUserCurrency = useCallback((amountUSD: number): number => {
    const rate = getUserCurrencyRate();
    return amountUSD * rate;
  }, [getUserCurrencyRate]);

  // Format amount with currency symbol
  const formatAmount = useCallback((amountUSD: number): string => {
    const convertedAmount = convertToUserCurrency(amountUSD);
    const symbol = CURRENCY_SYMBOLS[currency];

    // Format with 2 decimal places and thousands separators
    const formatted = new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(convertedAmount);

    return `${symbol}${formatted}`;
  }, [convertToUserCurrency, currency]);

  // Refresh rates from API
  const refreshRates = useCallback(async () => {
    await fetchRates();
  }, [fetchRates]);

  const value: CurrencyContextValue = {
    currency,
    setCurrency,
    rates,
    isLoadingRates,
    ratesError,
    convertToUserCurrency,
    getUserCurrencyRate,
    formatAmount,
    refreshRates,
  };

  return (
    <CurrencyContext.Provider value={value}>
      {children}
    </CurrencyContext.Provider>
  );
}

/**
 * Hook to access currency context
 *
 * Usage:
 * ```tsx
 * const { currency, setCurrency, formatAmount } = useCurrency();
 *
 * // Display amount in user's currency
 * <div>{formatAmount(1234.56)}</div>  // "$1,234.56" or "A$1,900.00"
 *
 * // Change currency
 * <button onClick={() => setCurrency("AUD")}>Switch to AUD</button>
 * ```
 */
export function useCurrency() {
  const context = useContext(CurrencyContext);

  if (context === undefined) {
    throw new Error("useCurrency must be used within a CurrencyProvider");
  }

  return context;
}

/**
 * Hook for historical currency conversion
 * Fetches FX rates for a specific date/timestamp
 *
 * Usage:
 * ```tsx
 * const { convertHistorical, isLoading } = useHistoricalCurrency();
 *
 * const priceInAUD = await convertHistorical(
 *   1234.56,  // USD amount
 *   1704110400000,  // timestamp
 *   "AUD"  // target currency
 * );
 * ```
 */
export function useHistoricalCurrency() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const convertHistorical = useCallback(async (
    amountUSD: number,
    timestamp: number,
    targetCurrency: SupportedCurrency
  ): Promise<number> => {
    if (targetCurrency === "USD") {
      return amountUSD;
    }

    setIsLoading(true);
    setError(null);

    try {
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
      const dateString = Object.keys(data.rates)[0];
      const rates = data.rates[dateString] as FXRate[];

      const rate = rates.find((r) => r.targetCurrency === targetCurrency);

      if (!rate) {
        throw new Error(`No rate found for ${targetCurrency}`);
      }

      return amountUSD * rate.rate;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setError(errorMessage);
      console.error("[Historical Currency] Error:", err);

      // Return USD amount as fallback
      return amountUSD;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { convertHistorical, isLoading, error };
}

/**
 * Get currency symbol for a given currency
 */
export function getCurrencySymbol(currency: SupportedCurrency): string {
  return CURRENCY_SYMBOLS[currency];
}

/**
 * Get currency label for display
 */
export function getCurrencyLabel(currency: SupportedCurrency): string {
  const labels: Record<SupportedCurrency, string> = {
    USD: "US Dollar",
    AUD: "Australian Dollar",
    GBP: "British Pound",
    CAD: "Canadian Dollar",
  };
  return labels[currency];
}
