# Safe Wallet Amount Calculation Fix

## Problem

When connecting a Safe wallet address, the deposit/withdrawal amounts shown in the portfolio summary were incorrect. This was because:

1. **Hardcoded ETH Price**: The calculation used a mock ETH price of $2,000 instead of actual current prices
2. **Ignored Token Transfers**: Only counted native ETH transfers, not ERC-20 token transfers
3. **No Token Type Differentiation**: Didn't account for different tokens having different prices

## Solution

Updated the portfolio analytics to properly calculate deposit/withdrawal values:

### Changes Made

#### 1. `calculateDepositedValue()` Function (lib/portfolio/analytics.ts)

**Before:**
```typescript
function calculateDepositedValue(transactions: Transaction[]): number {
  const deposits = getDeposits(transactions);
  return deposits.reduce((total, tx) => {
    const value = parseFloat(tx.valueFormatted);
    return total + value;
  }, 0);
}
// Then multiplied by hardcoded $2000
```

**After:**
```typescript
async function calculateDepositedValue(
  transactions: Transaction[],
  balances: TokenBalance[]
): Promise<number> {
  const deposits = getDeposits(transactions);
  let totalValue = 0;

  for (const tx of deposits) {
    // Check token transfers
    if (tx.tokenTransfers && tx.tokenTransfers.length > 0) {
      for (const transfer of tx.tokenTransfers) {
        // Find token price from current balances
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
```

#### 2. `calculateWithdrawnValue()` Function

Applied the same fix to withdrawals - now properly accounts for:
- Token transfers (ERC-20, ERC-721, ERC-1155)
- Native ETH transfers
- Actual token prices from CoinGecko

#### 3. `calculateSummary()` Function

- Made async to support the updated deposit/withdrawal calculations
- Removed hardcoded `* 2000` multiplier
- Now uses real token prices for accurate USD values

### How It Works Now

1. **Fetch Transactions**: Get all deposit/withdrawal transactions across chains
2. **Identify Token Transfers**: Check each transaction for token transfer events
3. **Match Token Prices**: Find the corresponding token in the current balance list
4. **Calculate Value**: Multiply token amount by current USD price
5. **Sum All Transfers**: Aggregate values across all tokens and chains

### Accuracy Notes

- **Current Limitation**: Still uses current prices as approximation for historical transactions
- **Future Enhancement**: Should fetch actual historical prices at the time of each deposit/withdrawal
- **Safe Wallets**: Now properly handles Safe multisig transactions which often involve token transfers
- **Multi-Token Support**: Correctly values deposits/withdrawals of USDC, USDT, DAI, WBTC, etc.

## Testing

To verify the fix:

1. Enter a Safe wallet address with multiple token transactions
2. Check the "DEPOSITED" and "WITHDRAWN" amounts
3. Values should now reflect actual token prices, not hardcoded ETH price
4. P&L calculation should be more accurate

## Example

**Before (Wrong):**
- User deposits 1000 USDC
- System calculated: 1000 * $2000 = $2,000,000 (incorrect!)

**After (Correct):**
- User deposits 1000 USDC
- System calculates: 1000 * $1.00 = $1,000 (correct!)

## Future Improvements

For production accuracy, implement:

1. **Historical Price API**: Fetch token prices at transaction timestamps
2. **Safe Transaction Parsing**: Better handling of Safe multisig internal transactions
3. **Gas Cost Tracking**: Include transaction fees in P&L calculations
4. **Swap Detection**: Identify and handle DEX swaps differently from deposits/withdrawals
