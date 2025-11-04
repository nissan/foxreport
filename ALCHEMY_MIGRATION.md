# Alchemy Migration: Phase 1 Complete

**Date**: November 4, 2025
**Status**: ✅ PHASE 1 COMPLETE - REST API Integration
**Priority**: CRITICAL - Fixes CoinGecko rate limiting (429 errors)

---

## Problem Statement

**CoinGecko Rate Limiting Issues**:
- Free tier: 10-50 requests/minute
- Large portfolios (Vitalik.eth = 302 tokens) exhaust quota immediately
- Hundreds of 429 errors when loading portfolios
- aTokens and GLP fail to get accurate prices (fallback to 1:1 or $0)

**Solution**: Migrate to Alchemy Prices API (10-100x higher rate limits, included with existing plan)

---

## Phase 1: REST API Integration (COMPLETE)

### Files Created (1)

#### 1. `lib/prices/alchemy-prices.ts` (323 lines)
**Purpose**: Alchemy Prices REST API client (future-proof, not deprecated SDK)

**Functions**:
- `getAlchemyCurrentPrice()` - Single token current price
- `getAlchemyBatchCurrentPrices()` - Batch current prices (groups by chain)
- `getAlchemyHistoricalPrice()` - Historical price at timestamp (1-hour window)
- `getAlchemyBatchHistoricalPrices()` - Batch historical prices
- `testAlchemyPricesAPI()` - Health check with WETH

**Design**:
- Server-side only (API key security)
- Returns `null` on errors for graceful CoinGecko fallback
- Network mapping: `ChainId → Alchemy network string`
- Consistent Map key format: `"address_chainId"` or `"address_chainId_timestamp"`
- Error logging with `[Alchemy]` prefix

### Files Modified (2)

#### 2. `app/api/prices/route.ts` (Updated)
**Changes**:
- Added Alchemy import and integration
- Feature flag: `USE_ALCHEMY_PRICES` environment variable
- Try Alchemy first, fall back to CoinGecko for missing tokens
- Batch processing without delays (Alchemy has higher limits)
- Response includes `source: "Alchemy" | "CoinGecko"`
- Maintains existing cache behavior (5-30 min TTL)

**Flow**:
```typescript
if (USE_ALCHEMY_PRICES === "true") {
  1. Try Alchemy batch fetch (all tokens at once, no delays)
  2. Cache successful results
  3. Fall back to CoinGecko for tokens Alchemy didn't return
} else {
  // Original CoinGecko-only logic
}
```

#### 3. `app/api/prices/historical/route.ts` (Updated)
**Changes**:
- Added Alchemy historical price integration
- Feature flag: `USE_ALCHEMY_PRICES` environment variable
- Try Alchemy first, fall back to CoinGecko for missing prices
- Timestamp conversion: ms → seconds for Alchemy API
- Response includes `source: "Alchemy" | "CoinGecko"`
- Maintains long cache TTL (7 days for historical prices)

**Flow**:
```typescript
if (USE_ALCHEMY_PRICES === "true") {
  1. Try Alchemy batch historical fetch
  2. Cache successful results with 7-day TTL
  3. Fall back to CoinGecko for missing timestamps
} else {
  // Original CoinGecko-only logic
}
```

---

## Build Status

✅ **TypeScript**: Compiles successfully
✅ **All imports**: Resolved correctly
✅ **No new errors**: Only expected indexedDB warnings (WalletConnect SSR)

---

## Testing Checklist

### Manual Testing (Before Commit)
- [ ] Add `USE_ALCHEMY_PRICES=true` to `.env.local`
- [ ] Add `NEXT_PUBLIC_ALCHEMY_API_KEY=<key>` to `.env.local`
- [ ] Test current prices API: `/api/prices` with 10+ common tokens
- [ ] Verify response includes `source: "Alchemy"`
- [ ] Test historical prices API: `/api/prices/historical` with 5+ tokens
- [ ] Compare prices: Alchemy vs CoinGecko for accuracy
- [ ] Test with `USE_ALCHEMY_PRICES=false` (should use CoinGecko only)

### Automated Testing (Future)
- [ ] Unit tests for `lib/prices/alchemy-prices.ts`
- [ ] Integration tests for API routes with both providers
- [ ] Rate limit simulation tests
- [ ] Cache behavior tests

---

## Phase 2: DeFi Protocol Integration (NEXT)

### Goals
1. **aToken Pricing** (`lib/defi/aave-pricing.ts`)
   - Query Aave V3 Pool contracts for exchange rates
   - Calculate underlying asset value from aToken balance
   - Support all Aave V3 markets (Ethereum, Arbitrum, Base)

2. **GLP Pricing** (`lib/defi/gmx-pricing.ts`)
   - Query GMX Vault for GLP total supply and AUM
   - Calculate GLP price from `AUM / totalSupply`
   - Support GMX on Arbitrum

3. **Token Valuation** (`lib/tokens/valuation.ts`)
   - Replace TODO comments with real contract calls
   - Integrate aToken and GLP pricing modules
   - Maintain hybrid approach: protocol contracts → estimates → fallback

### Files to Create
1. `lib/defi/aave-pricing.ts` (~150 lines)
2. `lib/defi/gmx-pricing.ts` (~100 lines)

### Files to Modify
1. `lib/tokens/valuation.ts` - Replace TODOs with real implementations

---

## Environment Variables

### Required for Alchemy Migration
```bash
# .env.local
USE_ALCHEMY_PRICES=true                          # Feature flag (default: false)
NEXT_PUBLIC_ALCHEMY_API_KEY=<your-api-key>      # Alchemy API key
```

### Optional for Gradual Rollout
```bash
ALCHEMY_ROLLOUT_PERCENTAGE=10   # Gradual rollout: 10% → 50% → 100%
```

---

## Rollout Strategy

### Phase 1: Internal Testing (Current)
- Feature flag: `false` (CoinGecko only)
- Manual testing with `USE_ALCHEMY_PRICES=true`
- Verify no regressions

### Phase 2: Gradual Rollout (10% → 50% → 100%)
- Implement percentage-based rollout
- Monitor error rates and price accuracy
- Increase percentage over 1-2 weeks

### Phase 3: Full Migration
- Default to Alchemy for all users
- Keep CoinGecko as fallback for unsupported tokens
- Remove feature flag after stabilization

---

## Known Limitations

### Alchemy Prices API
- Only supports major chains (Ethereum, Arbitrum, Base, Polygon, Optimism)
- May not have all long-tail tokens that CoinGecko has
- Historical prices limited to 1-hour granularity

### CoinGecko Fallback
- Still needed for:
  - Unsupported chains
  - Very new/obscure tokens
  - Tokens Alchemy doesn't track
- Rate limiting still applies to fallback requests

---

## Next Steps

1. **Add environment variables** to `.env.local`
2. **Test Alchemy integration** with real portfolio data
3. **Create aToken pricing module** (`lib/defi/aave-pricing.ts`)
4. **Create GLP pricing module** (`lib/defi/gmx-pricing.ts`)
5. **Update token valuation** with real contract calls
6. **Commit Phase 1** to git
7. **Deploy to staging** for monitoring
8. **Resume UI Checkpoint 3** after Phase 2 complete

---

## Files Summary

**Created**: 1 file (323 lines)
- `lib/prices/alchemy-prices.ts`

**Modified**: 2 files
- `app/api/prices/route.ts` - Alchemy current prices integration
- `app/api/prices/historical/route.ts` - Alchemy historical prices integration

**Total Changes**: ~600 lines (323 new + ~277 modified)

---

**Phase 1 Status**: ✅ COMPLETE
**Next Phase**: Phase 2 - DeFi Protocol Integration (aTokens + GLP)
**Resume Instructions**: Continue from Phase 2 or resume UI Checkpoint 3 after testing
