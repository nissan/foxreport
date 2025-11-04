/**
 * Foreign Exchange Rate Service
 * Supports multi-currency conversion for USD, AUD, GBP, CAD
 *
 * Primary API: Open Exchange Rates (https://openexchangerates.org)
 * Backup API: ExchangeRate-API (https://exchangerate-api.com)
 *
 * Free tier limits:
 * - Open Exchange Rates: 1,000 requests/month
 * - ExchangeRate-API: 1,500 requests/month
 */

export type SupportedCurrency = "USD" | "AUD" | "GBP" | "CAD";

export interface FXRate {
  baseCurrency: "USD";
  targetCurrency: SupportedCurrency;
  rate: number;
  timestamp: number;
  source: "openexchangerates" | "exchangerate-api" | "fallback";
}

export interface HistoricalFXRate extends FXRate {
  date: string; // YYYY-MM-DD format
}

/**
 * Sleep utility for rate limiting
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry wrapper with exponential backoff
 */
async function fetchWithRetry(
  url: string,
  maxRetries: number = 3
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url);

      if (response.status === 429) {
        const waitTime = Math.pow(2, attempt) * 1000;
        console.warn(`[FX API] Rate limited, waiting ${waitTime}ms`);
        await sleep(waitTime);
        continue;
      }

      return response;
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxRetries - 1) {
        await sleep(1000 * (attempt + 1));
      }
    }
  }

  throw lastError || new Error("Max retries exceeded");
}

/**
 * Fetch current FX rates from Open Exchange Rates
 */
async function fetchOpenExchangeRates(
  currencies: SupportedCurrency[]
): Promise<Record<SupportedCurrency, number> | null> {
  const apiKey = process.env.OPEN_EXCHANGE_RATES_API_KEY;

  if (!apiKey) {
    console.warn("[FX] Open Exchange Rates API key not configured");
    return null;
  }

  try {
    const symbols = currencies.join(",");
    const response = await fetchWithRetry(
      `https://openexchangerates.org/api/latest.json?app_id=${apiKey}&symbols=${symbols}`
    );

    if (!response.ok) {
      console.error(`[FX] Open Exchange Rates error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    return data.rates as Record<SupportedCurrency, number>;
  } catch (error) {
    console.error("[FX] Error fetching from Open Exchange Rates:", error);
    return null;
  }
}

/**
 * Fetch current FX rates from ExchangeRate-API (backup)
 */
async function fetchExchangeRateAPI(
  currencies: SupportedCurrency[]
): Promise<Record<SupportedCurrency, number> | null> {
  const apiKey = process.env.EXCHANGE_RATE_API_KEY;

  if (!apiKey) {
    console.warn("[FX] ExchangeRate-API key not configured");
    return null;
  }

  try {
    const response = await fetchWithRetry(
      `https://v6.exchangerate-api.com/v6/${apiKey}/latest/USD`
    );

    if (!response.ok) {
      console.error(`[FX] ExchangeRate-API error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    const rates: Record<SupportedCurrency, number> = {};

    currencies.forEach((currency) => {
      if (data.conversion_rates[currency]) {
        rates[currency] = data.conversion_rates[currency];
      }
    });

    return rates;
  } catch (error) {
    console.error("[FX] Error fetching from ExchangeRate-API:", error);
    return null;
  }
}

/**
 * Fallback FX rates (approximate, for when APIs unavailable)
 * These should be updated periodically or removed if you want to enforce API usage
 */
const FALLBACK_RATES: Record<SupportedCurrency, number> = {
  USD: 1.0,
  AUD: 1.54, // Approximate AUD/USD rate
  GBP: 0.79, // Approximate GBP/USD rate
  CAD: 1.37, // Approximate CAD/USD rate
};

/**
 * Get current FX rates for specified currencies
 * Tries primary API, then backup, then fallback
 */
export async function getCurrentFXRates(
  currencies: SupportedCurrency[] = ["USD", "AUD", "GBP", "CAD"]
): Promise<FXRate[]> {
  const timestamp = Date.now();

  // Try primary API (Open Exchange Rates)
  let rates = await fetchOpenExchangeRates(currencies);
  let source: FXRate["source"] = "openexchangerates";

  // Try backup API if primary fails
  if (!rates) {
    rates = await fetchExchangeRateAPI(currencies);
    source = "exchangerate-api";
  }

  // Use fallback rates if both APIs fail
  if (!rates) {
    console.warn("[FX] Both APIs failed, using fallback rates");
    rates = FALLBACK_RATES;
    source = "fallback";
  }

  // Convert to FXRate format
  return currencies.map((currency) => ({
    baseCurrency: "USD",
    targetCurrency: currency,
    rate: rates![currency] || FALLBACK_RATES[currency],
    timestamp,
    source,
  }));
}

/**
 * Fetch historical FX rate from Open Exchange Rates
 */
async function fetchHistoricalOpenExchangeRates(
  date: string, // YYYY-MM-DD
  currencies: SupportedCurrency[]
): Promise<Record<SupportedCurrency, number> | null> {
  const apiKey = process.env.OPEN_EXCHANGE_RATES_API_KEY;

  if (!apiKey) {
    console.warn("[FX] Open Exchange Rates API key not configured");
    return null;
  }

  try {
    const symbols = currencies.join(",");
    const response = await fetchWithRetry(
      `https://openexchangerates.org/api/historical/${date}.json?app_id=${apiKey}&symbols=${symbols}`
    );

    if (!response.ok) {
      console.error(
        `[FX] Open Exchange Rates historical error: ${response.status}`
      );
      return null;
    }

    const data = await response.json();
    return data.rates as Record<SupportedCurrency, number>;
  } catch (error) {
    console.error(
      "[FX] Error fetching historical from Open Exchange Rates:",
      error
    );
    return null;
  }
}

/**
 * Fetch historical FX rate from ExchangeRate-API (backup)
 * Note: Historical data only available on paid plans, will use current as fallback
 */
async function fetchHistoricalExchangeRateAPI(
  date: string,
  currencies: SupportedCurrency[]
): Promise<Record<SupportedCurrency, number> | null> {
  const apiKey = process.env.EXCHANGE_RATE_API_KEY;

  if (!apiKey) {
    console.warn("[FX] ExchangeRate-API key not configured");
    return null;
  }

  try {
    // ExchangeRate-API free tier doesn't support historical
    // Paid tier format: https://v6.exchangerate-api.com/v6/API-KEY/history/USD/YEAR/MONTH/DAY
    // For now, return null to trigger fallback
    console.warn(
      "[FX] ExchangeRate-API historical requires paid plan, using fallback"
    );
    return null;
  } catch (error) {
    console.error(
      "[FX] Error fetching historical from ExchangeRate-API:",
      error
    );
    return null;
  }
}

/**
 * Get historical FX rates for a specific date
 * Note: Historical rates require API keys (free tier on Open Exchange Rates)
 */
export async function getHistoricalFXRates(
  timestamp: number,
  currencies: SupportedCurrency[] = ["USD", "AUD", "GBP", "CAD"]
): Promise<HistoricalFXRate[]> {
  // Convert timestamp to YYYY-MM-DD format
  const date = new Date(timestamp);
  const dateString = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

  // Try primary API (Open Exchange Rates)
  let rates = await fetchHistoricalOpenExchangeRates(dateString, currencies);
  let source: HistoricalFXRate["source"] = "openexchangerates";

  // Try backup API if primary fails
  if (!rates) {
    rates = await fetchHistoricalExchangeRateAPI(dateString, currencies);
    source = "exchangerate-api";
  }

  // Use current rates as fallback for historical if APIs unavailable
  if (!rates) {
    console.warn(
      `[FX] Historical rates unavailable for ${dateString}, using current rates`
    );
    const currentRates = await getCurrentFXRates(currencies);
    return currentRates.map((rate) => ({
      ...rate,
      date: dateString,
      source: "fallback" as const,
    }));
  }

  // Convert to HistoricalFXRate format
  return currencies.map((currency) => ({
    baseCurrency: "USD",
    targetCurrency: currency,
    rate: rates![currency] || FALLBACK_RATES[currency],
    timestamp,
    date: dateString,
    source,
  }));
}

/**
 * Convert amount from USD to target currency
 */
export function convertCurrency(
  amountUSD: number,
  fxRate: FXRate
): number {
  return amountUSD * fxRate.rate;
}

/**
 * Get exchange rate for a specific currency pair
 */
export function getFXRate(
  rates: FXRate[],
  targetCurrency: SupportedCurrency
): FXRate | undefined {
  return rates.find((rate) => rate.targetCurrency === targetCurrency);
}
