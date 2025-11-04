import { NextRequest, NextResponse } from "next/server";
import { serverCache, serverCacheKeys } from "@/lib/cache/server-cache";
import {
  getCurrentFXRates,
  getHistoricalFXRates,
  type SupportedCurrency,
  type FXRate,
  type HistoricalFXRate,
} from "@/lib/currency/fx-rates";

/**
 * GET /api/fx-rates - Fetch current FX rates
 *
 * Query params:
 *   ?currencies=AUD,GBP,CAD (optional, defaults to all supported)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const currenciesParam = searchParams.get("currencies");

    // Parse requested currencies or use defaults
    const currencies: SupportedCurrency[] = currenciesParam
      ? (currenciesParam.split(",") as SupportedCurrency[])
      : ["USD", "AUD", "GBP", "CAD"];

    // Check cache first (24-hour TTL for current rates)
    const cacheKey = serverCacheKeys.currentFXRates();
    const cached = serverCache.get<FXRate[]>(cacheKey);

    if (cached) {
      console.log("[FX API] Current rates from cache");
      return NextResponse.json({
        rates: cached,
        source: "cache",
        timestamp: cached[0]?.timestamp || Date.now(),
      });
    }

    // Fetch current rates
    const rates = await getCurrentFXRates(currencies);

    // Cache for 24 hours (1440 minutes)
    serverCache.set(cacheKey, rates, 1440);

    console.log(
      `[FX API] Fetched current rates for ${currencies.join(", ")} from ${rates[0]?.source}`
    );

    return NextResponse.json({
      rates,
      source: "api",
      timestamp: rates[0]?.timestamp || Date.now(),
    });
  } catch (error) {
    console.error("[FX API] Error in GET /api/fx-rates:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/fx-rates/historical - Fetch historical FX rates
 *
 * Request body:
 * {
 *   "requests": [
 *     { "timestamp": 1704110400000, "currencies": ["AUD", "GBP"] }
 *   ]
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { requests } = body as {
      requests: Array<{
        timestamp: number;
        currencies?: SupportedCurrency[];
      }>;
    };

    if (!requests || !Array.isArray(requests)) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    const results: Record<string, HistoricalFXRate[]> = {};
    let cached = 0;
    let fetched = 0;

    for (const { timestamp, currencies } of requests) {
      // Convert timestamp to date string for cache key
      const date = new Date(timestamp);
      const dateString = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

      // Check cache first (permanent TTL for historical data)
      const cacheKey = serverCacheKeys.historicalFXRates(dateString);
      let rates = serverCache.get<HistoricalFXRate[]>(cacheKey);

      if (rates) {
        cached++;
      } else {
        // Fetch historical rates
        const requestedCurrencies = currencies || ["USD", "AUD", "GBP", "CAD"];
        rates = await getHistoricalFXRates(timestamp, requestedCurrencies);

        // Cache permanently (historical data never changes)
        // Using 30 days (43200 minutes) as "permanent" to allow eventual cleanup
        serverCache.set(cacheKey, rates, 43200);
        fetched++;

        console.log(
          `[FX API] Fetched historical rates for ${dateString} from ${rates[0]?.source}`
        );
      }

      results[dateString] = rates;
    }

    console.log(
      `[FX API] Historical rates - ${cached} cached, ${fetched} fetched, ${requests.length} total`
    );

    return NextResponse.json({
      rates: results,
      cached,
      fetched,
      total: requests.length,
    });
  } catch (error) {
    console.error("[FX API] Error in POST /api/fx-rates/historical:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
