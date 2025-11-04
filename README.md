# FoxReport - Crypto Portfolio Analysis

A comprehensive crypto portfolio analysis tool that tracks DeFi positions, calculates P&L, and monitors portfolios across Ethereum, Arbitrum, and Base chains.

## Features

- **Multi-Chain Support**: Analyze portfolios across Ethereum, Arbitrum, and Base
- **Wallet Type Detection**: Supports EOA addresses, Safe multisigs, smart contract wallets, and ENS names
- **Token Balances**: View all token holdings with real-time USD values
- **Transaction History**: Track deposits, withdrawals, and swaps across chains
- **DeFi Integration**: Monitor positions in Aave, Uniswap, and GMX (placeholder integration)
- **P&L Tracking**: Compare initial deposit values with current holdings
- **Local Caching**: Minimize RPC calls with localStorage/sessionStorage caching
- **Dark Mode**: Full theme support with next-themes

## Tech Stack

- **Framework**: Next.js 16 with App Router
- **UI**: shadcn/ui components with Tailwind CSS v4
- **Web3**: RainbowKit, Wagmi, Viem
- **Blockchain Data**: Alchemy SDK
- **Charts**: Recharts
- **Price Data**: CoinGecko API

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm (or npm/yarn)
- Alchemy API key
- WalletConnect Project ID

### Installation

1. Install dependencies:
```bash
pnpm install
```

2. Set up environment variables:

Create a `.env.local` file with:
```bash
NEXT_PUBLIC_ALCHEMY_API_KEY=your_alchemy_api_key
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_walletconnect_project_id
```

3. Run the development server:
```bash
pnpm dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

## Usage

### Analyzing a Portfolio

1. Enter a wallet address (0x...) or ENS name (vitalik.eth) on the landing page
2. Click "Analyze" to fetch portfolio data
3. View:
   - **Summary Cards**: Total value, deposits, withdrawals, and P&L
   - **Balances Tab**: All token holdings across chains with USD values
   - **Transactions Tab**: Recent deposit/withdrawal history
   - **Chains Tab**: Portfolio breakdown by chain with pie chart
   - **DeFi Tab**: DeFi protocol positions (when available)

### Data Caching

- **Token Balances**: Cached for 5 minutes
- **Transactions**: Cached for 10 minutes
- **Prices**: Cached for 5 minutes (session storage)
- **Portfolio Summary**: Cached for 5 minutes

Click "Refresh" to bypass cache and fetch fresh data.

## Project Structure

```
foxreport/
├── app/
│   ├── layout.tsx              # Root layout with Web3 providers
│   ├── page.tsx                # Landing page with address input
│   └── portfolio/[address]/    # Portfolio analysis page
│       └── page.tsx
├── components/
│   ├── ui/                     # shadcn/ui components
│   ├── providers.tsx           # Web3 and theme providers
│   └── portfolio/              # Portfolio-specific components
│       ├── summary-cards.tsx
│       ├── token-balances-table.tsx
│       ├── transactions-table.tsx
│       └── chain-breakdown.tsx
├── lib/
│   ├── wagmi.ts                # Wagmi configuration
│   ├── blockchain/             # Blockchain utilities
│   │   ├── chains.ts
│   │   ├── client.ts
│   │   ├── wallet.ts
│   │   ├── balances.ts
│   │   └── transactions.ts
│   ├── defi/                   # DeFi protocol integrations
│   │   └── protocols.ts
│   ├── prices/                 # Price data service
│   │   └── index.ts
│   ├── portfolio/              # Portfolio analytics
│   │   └── analytics.ts
│   └── cache/                  # Caching utilities
│       └── storage.ts
├── hooks/
│   └── usePortfolio.ts         # Portfolio data hook
└── types/
    └── portfolio.ts            # TypeScript types
```

## Supported Chains

| Chain | Chain ID | RPC Provider |
|-------|----------|--------------|
| Ethereum | 1 | Alchemy |
| Arbitrum | 42161 | Alchemy |
| Base | 8453 | Alchemy |

## API Integrations

### Alchemy SDK
- Token balances via `getTokenBalances()`
- Token metadata via `getTokenMetadata()`
- Transaction history via `getAssetTransfers()`
- ENS resolution via `resolveName()` and `lookupAddress()`

### CoinGecko API
- Current token prices
- Historical prices for P&L calculations
- No API key required (uses public endpoints)

## DeFi Protocol Integration

Current implementation includes placeholder integrations for:
- **Aave V3**: Lending/borrowing positions
- **Uniswap V3**: Liquidity provider positions
- **GMX**: Perpetual trading positions (Arbitrum only)

To implement full DeFi integrations:
1. Add protocol ABIs to `lib/defi/abis/`
2. Implement contract calls in `lib/defi/protocols.ts`
3. Parse position data and calculate values

## Limitations & Notes

- **Price Data**: Currently uses CoinGecko for well-known tokens. Lesser-known tokens may not have price data.
- **Historical Prices**: P&L calculations use simplified logic. Full implementation should fetch historical prices at deposit timestamps.
- **DeFi Positions**: Current implementation is a placeholder. Full integration requires ABI calls to protocol contracts.
- **Rate Limiting**: Be mindful of Alchemy and CoinGecko rate limits. Caching helps minimize requests.
- **Transaction Timestamps**: Alchemy SDK doesn't provide timestamps directly; would need additional block fetches for accurate timestamps.

## Future Enhancements

- [ ] Implement full DeFi protocol integrations with ABIs
- [ ] Add historical price fetching for accurate P&L
- [ ] Support more chains (Polygon, Optimism, etc.)
- [ ] Add NFT portfolio tracking
- [ ] Export portfolio data to CSV/PDF
- [ ] Portfolio comparison over time with charts
- [ ] Wallet watchlist feature
- [ ] Mobile app version

## Acknowledgments

- Built with [Next.js](https://nextjs.org/)
- UI components from [shadcn/ui](https://ui.shadcn.com/)
- Web3 integration via [RainbowKit](https://www.rainbowkit.com/) and [Wagmi](https://wagmi.sh/)
- Blockchain data from [Alchemy](https://www.alchemy.com/)
- Price data from [CoinGecko](https://www.coingecko.com/)
