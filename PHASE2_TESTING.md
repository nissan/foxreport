# Phase 2 Testing Plan - Historical Price Fetching

**Date**: November 4, 2025
**Phase**: Historical Price Fetching
**Status**: ✅ READY FOR TESTING

---

## What Was Built

### Phase 2 Implementation Summary

**Goal**: Fetch historical token prices at exact transaction timestamps for accurate P&L calculations.

**Key Features**:
1. Enhanced `getHistoricalPrice()` with hourly precision
2. Batch historical price fetching via server API
3. 7-day server-side caching (historical prices don't change)
4. Support for both well-known tokens and contract address lookup
5. Retry logic with exponential backoff for rate limiting

---

## Files Modified/Created

### Modified Files

**lib/prices/index.ts** (67 new lines):
- `getHistoricalPrice()`: Enhanced to use `/market_chart/range` endpoint
- `getBatchHistoricalPrices()`: New function for batch requests
- Queries 1-hour window around timestamp for accuracy
- Finds closest price match within that window

**lib/cache/server-cache.ts** (3 lines):
- Added `historicalPrice` cache key generator
- Format: `historical:{address}:{chainId}:{timestamp}`

### Created Files

**app/api/prices/historical/route.ts** (248 lines):
- Server-side POST endpoint for batch historical price requests
- Checks server cache first (7-day TTL)
- Batches CoinGecko API calls (3 at a time, 1s delays)
- Handles rate limiting with exponential backoff
- Returns cached/fetched/total counts for monitoring

---

## How It Works

### Technical Flow

```
1. Client calls getBatchHistoricalPrices([
     { address: "0x...", chainId: 1, timestamp: 1699123456000 }
   ])
2. Client makes POST to /api/prices/historical
3. Server checks cache (historicalPrice cache key)
4. For cache misses:
   a. Resolve token to CoinGecko coinId
   b. Query /market_chart/range with ±30min window
   c. Find closest price match to exact timestamp
   d. Cache for 7 days (historical prices immutable)
5. Return all prices (cached + fetched)
```

### CoinGecko API Usage

**Endpoint**: `/api/v3/coins/{id}/market_chart/range`

**Parameters**:
- `vs_currency`: usd
- `from`: timestamp - 1800 seconds (30 min before)
- `to`: timestamp + 1800 seconds (30 min after)

**Response** (example):
```json
{
  "prices": [
    [1699122000000, 3450.23],  // [timestamp_ms, price_usd]
    [1699122600000, 3451.15],
    [1699123200000, 3452.89],
    ...
  ]
}
```

**Precision**: The algorithm finds the price with timestamp closest to target.

---

## Test Scenarios

### Test 1: Server Compilation ✅
```bash
# Check pnpm dev terminal
# Expected: No TypeScript errors
# Expected: ✓ Compiled successfully
# OK: WalletConnect SSR warnings (expected, non-blocking)
```

**Status**: ✅ PASS (verified - server compiling successfully)

---

### Test 2: API Endpoint Health Check 🔄

**Objective**: Verify the historical price API is accessible

**Steps**:
```bash
# Option 1: Using curl
curl http://localhost:3000/api/prices/historical

# Expected response:
# {
#   "message": "Historical Price API is running",
#   "cache": {
#     "size": 0,  // or higher if cache has entries
#     "keys": []
#   }
# }
```

**Status**: 🔄 PENDING - Needs manual test

---

### Test 3: Fetch Historical Price for Known Token 🔄

**Objective**: Verify we can fetch a historical price for ETH

**Test Data**:
- Token: ETH (0x0000000000000000000000000000000000000000)
- Chain: Ethereum (1)
- Timestamp: January 1, 2024 at noon UTC (1704110400000)

**Steps**:
```bash
curl -X POST http://localhost:3000/api/prices/historical \
  -H "Content-Type: application/json" \
  -d '{
    "requests": [
      {
        "address": "0x0000000000000000000000000000000000000000",
        "chainId": 1,
        "timestamp": 1704110400000
      }
    ]
  }'

# Expected response:
# {
#   "prices": {
#     "0x0000000000000000000000000000000000000000_1_1704110400000": 2300.45
#   },
#   "cached": 0,
#   "fetched": 1,
#   "total": 1
# }

# Second request (should be cached):
# Same curl command
# Expected: "cached": 1, "fetched": 0
```

**Validation**:
- ✅ Price returned is reasonable for Jan 2024 (ETH was ~$2,200-$2,400)
- ✅ Second request shows cache hit
- ✅ Server logs show "[Historical API] Fetched..." on first request
- ✅ Server logs show "[Historical API] Cache hit: 1/1" on second request

**Status**: 🔄 PENDING - Needs manual test

---

### Test 4: Fetch Historical Price for Multiple Tokens 🔄

**Objective**: Verify batch fetching works correctly

**Test Data**:
- ETH, USDC, WBTC on same timestamp

**Steps**:
```bash
curl -X POST http://localhost:3000/api/prices/historical \
  -H "Content-Type": application/json" \
  -d '{
    "requests": [
      {
        "address": "0x0000000000000000000000000000000000000000",
        "chainId": 1,
        "timestamp": 1704110400000
      },
      {
        "address": "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
        "chainId": 1,
        "timestamp": 1704110400000
      },
      {
        "address": "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599",
        "chainId": 1,
        "timestamp": 1704110400000
      }
    ]
  }'

# Expected:
# 3 prices returned
# cached: 0 (first request)
# fetched: 3
#
# Repeat request:
# cached: 3
# fetched: 0
```

**Validation**:
- ✅ ETH price ~$2,300
- ✅ USDC price ~$1.00
- ✅ WBTC price ~$42,000
- ✅ Batch processing observed (3 requests, 1s delay between)
- ✅ Server cache working (second request instant)

**Status**: 🔄 PENDING - Needs manual test

---

### Test 5: Rate Limiting Behavior 🔄

**Objective**: Verify exponential backoff works

**This is hard to test manually - will be observed in production use**

**Expected Behavior**:
- If CoinGecko returns 429 (rate limited):
  - Wait 1000ms, retry (attempt 1)
  - Wait 2000ms, retry (attempt 2)
  - Wait 4000ms, retry (attempt 3)
  - Return null if all retries fail

**Server Logs to Watch For**:
```
[Historical API] Rate limited, waiting 1000ms
[Historical API] Rate limited, waiting 2000ms
[Historical API] Rate limited, waiting 4000ms
```

**Status**: 🔄 Observable in production

---

### Test 6: Integration with Phase 1 Timestamps 🔄

**Objective**: Verify historical prices work with transaction timestamps from Phase 1

**This will be tested in Phase 5 when we recalculate P&L**

**Conceptual Flow**:
```javascript
// 1. Get transactions with enriched timestamps (Phase 1)
const transactions = await getTransactionHistory(address, chainId);

// 2. Extract unique token/timestamp pairs
const priceRequests = transactions.map(tx => ({
  address: tx.tokenAddress,
  chainId: tx.chainId,
  timestamp: tx.timestamp  // From Phase 1!
}));

// 3. Fetch all historical prices in batch
const historicalPrices = await getBatchHistoricalPrices(priceRequests);

// 4. Calculate accurate P&L
transactions.forEach(tx => {
  const key = `${tx.tokenAddress}_${tx.chainId}_${tx.timestamp}`;
  const historicalPrice = historicalPrices.get(key);
  const valueAtTime = tx.amount * historicalPrice;
  // ... calculate P&L
});
```

**Status**: 🔄 PENDING - Phase 5 integration

---

## Performance Benchmarks

### Expected Performance

| Metric | First Request | Cached Request |
|--------|--------------|----------------|
| 1 token | 2-3 seconds | < 50ms |
| 5 tokens | 6-9 seconds | < 100ms |
| 20 tokens | 25-35 seconds | < 200ms |

**Notes**:
- First request: Includes CoinGecko API latency
- Batch delay: 1000ms between batches of 3
- Cache TTL: 7 days (604,800 seconds)
- Historical prices are immutable (cache can be permanent)

---

## Common Issues & Solutions

### Issue: "Could not resolve coinId"

**Symptom**:
```
[Historical API] Could not resolve coinId for 0x... on chain 1
```

**Cause**: Token not in WELL_KNOWN_TOKENS and CoinGecko doesn't recognize contract address

**Impact**: Returns `null` for that token's price

**Solution**:
- Acceptable - not all tokens have historical data
- P&L calculation should handle null prices gracefully
- Could fallback to current price (less accurate but better than nothing)

---

### Issue: Rate Limiting (429 errors)

**Symptom**:
```
[Historical API] Rate limited, waiting 1000ms
[Historical API] Rate limited, waiting 2000ms
```

**Cause**: Too many CoinGecko requests in short time

**Impact**: Slower price fetching, automatic retry

**Solution**: This is working as designed! Exponential backoff will handle it.

**If persistent**:
- Reduce batch size from 3 to 2 or 1
- Increase delay from 1000ms to 2000ms
- Consider CoinGecko Pro API (paid tier)

---

### Issue: "No prices returned"

**Symptom**:
```
[Historical API] No prices returned for ethereum
```

**Cause**: Timestamp too far in past (before token existed) or too far in future

**Impact**: Returns null

**Solution**:
- Check timestamp is reasonable
- For very old transactions, CoinGecko may not have data
- Fallback to current price or manual price input

---

## Success Criteria

Phase 2 is considered **COMPLETE** if:

✅ **Functionality**
- [ ] Server compiles without errors
- [ ] GET /api/prices/historical returns health check
- [ ] POST /api/prices/historical returns price for ETH
- [ ] Batch request works for multiple tokens
- [ ] Second request shows cache hit

✅ **Performance**
- [ ] Single token: < 5s first request
- [ ] Cached request: < 100ms
- [ ] Batch processing: Delays observed between batches

✅ **Accuracy**
- [ ] ETH price for Jan 2024 is ~$2,200-$2,400
- [ ] USDC price is ~$1.00
- [ ] Prices match expectations for known dates

✅ **Caching**
- [ ] First request: cached=0, fetched=N
- [ ] Second request: cached=N, fetched=0
- [ ] Server cache persists across requests

✅ **Error Handling**
- [ ] Unknown tokens return null gracefully
- [ ] Rate limiting triggers exponential backoff
- [ ] No unhandled errors in server logs

---

## Next Steps After Testing

### If All Tests Pass ✅
1. Update PROGRESS_SUMMARY.md (mark Phase 2 complete)
2. Document test results in this file
3. Proceed to **Phase 3: Exchange Rate API Integration**

### If Tests Fail ❌
1. Document failure details
2. Check server logs for error messages
3. Fix issues and re-test
4. Commit fixes with detailed message

---

## Test Results (To Be Filled In)

### Test Environment
- **Date**: [TBD]
- **Tester**: [User or Claude Code]
- **Node Version**: [run `node -v`]
- **pnpm Version**: [run `pnpm -v`]
- **Server Status**: [Running/Stopped]

### Test 2: API Health Check
- **Status**: PENDING
- **Response**: [paste response]
- **Notes**:

### Test 3: Single Token Historical Price
- **Status**: PENDING
- **ETH Price (Jan 2024)**: [price]
- **Cache Hit (second request)**: [yes/no]
- **Notes**:

### Test 4: Batch Historical Prices
- **Status**: PENDING
- **ETH Price**: [price]
- **USDC Price**: [price]
- **WBTC Price**: [price]
- **Cache Behavior**: [describe]
- **Notes**:

---

## Key Learnings (Phase 2)

### Technical Learnings

**1. CoinGecko Market Chart Range Precision**
- `/market_chart/range` returns hourly price data points
- More accurate than `/history` (daily snapshots)
- Need to find closest timestamp match within window
- 1-hour window (±30 min) balances accuracy vs API cost

**2. Server-Side Caching Strategy**
- Historical prices are immutable → long TTL appropriate
- Using 7 days but could be weeks/months/forever
- Server cache shared across all clients → better hit rate
- In-memory cache on server = fast lookups

**3. CoinId Resolution**
- Well-known tokens: Use hardcoded coinId (faster)
- Other tokens: Must resolve via `/coins/{platform}/contract/{address}`
- Resolution call adds latency but cacheable
- Not all tokens have historical data

**4. Rate Limiting Considerations**
- Historical price API more expensive than current price
- Smaller batch sizes (3 vs 5 for current prices)
- Longer delays (1000ms vs 500ms)
- Exponential backoff essential for retries

**5. Timestamp Format Consistency**
- CoinGecko expects seconds, returns milliseconds in response
- JavaScript uses milliseconds throughout
- Must convert: `Math.floor(timestamp / 1000)` for API params
- But return values already in milliseconds

### Integration Learnings

**Phase 1 ↔ Phase 2 Connection**:
- Phase 1 provides accurate transaction timestamps
- Phase 2 uses those timestamps to fetch historical prices
- Together they enable accurate cost basis calculation
- Next: Phase 5 will combine them for P&L

**Future Optimization Ideas**:
- Could cache coinId resolutions separately
- Could pre-warm cache for common tokens/dates
- Could use CoinGecko Pro for higher rate limits
- Could add fallback to alternative price APIs

---

**Status**: 📋 Phase 2 implementation complete, awaiting manual testing
**Next**: Run tests and document results
**Then**: Proceed to Phase 3 (Exchange Rate APIs)
