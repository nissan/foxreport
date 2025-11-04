import { Address } from "viem";

export type ChainId = 1 | 42161 | 8453; // Ethereum, Arbitrum, Base
export type ChainLayer = "L1" | "L2";

// Token type classification
export type TokenType = "native" | "erc20" | "wrapped" | "aToken" | "lpToken";

// Transaction category (enhanced from simple type)
export type TransactionCategory =
  | "deposit"          // Incoming transfer
  | "withdrawal"       // Outgoing transfer
  | "transfer"         // Internal transfer
  | "swap"             // Token swap
  | "defi_interaction" // DeFi protocol interaction (Aave, Uniswap, etc.)
  | "unknown";

export interface TokenBalance {
  address: Address;
  symbol: string;
  name: string;
  decimals: number;
  balance: string;
  balanceFormatted: string;
  priceUsd?: number;
  valueUsd?: number;
  chainId: ChainId;
  logo?: string;
  // Token type detection
  tokenType?: TokenType;
  // Underlying assets for wrapped tokens
  underlyingAssets?: {
    address: Address;
    symbol: string;
    amount: string;
    valueUsd?: number;
  }[];
}

export interface Transaction {
  hash: string;
  from: Address;
  to: Address | null;
  value: string;
  valueFormatted: string;
  timestamp: number;
  blockNumber: number;
  chainId: ChainId;
  type: "deposit" | "withdrawal" | "swap" | "unknown"; // Legacy field
  category?: TransactionCategory; // Enhanced categorization
  tokenTransfers?: TokenTransfer[];
  // P&L fields (Phase 5)
  historicalPriceUsd?: number;  // Token price at transaction time
  costBasisUsd?: number;        // Value at transaction time (amount * historicalPrice)
  currentValueUsd?: number;     // Current value (amount * currentPrice)
  profitLossUsd?: number;       // Current value - cost basis
  profitLossPercentage?: number; // (P&L / cost basis) * 100
}

export interface TokenTransfer {
  from: Address;
  to: Address;
  value: string;
  valueFormatted: string;
  tokenAddress: Address;
  symbol: string;
  decimals: number;
  priceUsd?: number;
  valueUsd?: number;
  // P&L fields (Phase 5)
  historicalPriceUsd?: number;  // Token price at transaction time
  costBasisUsd?: number;        // Value at transaction time
  profitLossUsd?: number;       // Current value - cost basis
  profitLossPercentage?: number; // (P&L / cost basis) * 100
}

export interface DeFiPosition {
  protocol: "aave" | "uniswap" | "gmx" | "other";
  type: "lending" | "borrowing" | "liquidity" | "staking" | "perpetual";
  chainId: ChainId;
  tokens: {
    symbol: string;
    amount: string;
    amountFormatted: string;
    valueUsd?: number;
  }[];
  totalValueUsd?: number;
  apy?: number;
  metadata?: Record<string, any>;
}

export interface PortfolioSummary {
  address: Address;
  totalValueUsd: number;
  totalDepositedUsd: number;
  totalWithdrawnUsd: number;
  netDepositedUsd: number;
  pnlUsd: number;
  pnlPercentage: number;
  lastUpdated: number;
}

export interface PortfolioData {
  summary: PortfolioSummary;
  balances: TokenBalance[];
  transactions: Transaction[];
  defiPositions: DeFiPosition[];
  chainBreakdown: {
    chainId: ChainId;
    chainName: string;
    totalValueUsd: number;
    tokenCount: number;
  }[];
}

export interface PriceData {
  tokenAddress: Address;
  chainId: ChainId;
  priceUsd: number;
  timestamp: number;
  source: "chainlink" | "coingecko" | "alchemy";
}

export interface CachedData<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

export interface WalletInfo {
  address: Address;
  type: "eoa" | "safe" | "contract";
  ensName?: string;
  chainId?: ChainId;
}

// Funding Analysis Types
export interface ChainFundingSummary {
  chainId: ChainId;
  chainName: string;
  layer: ChainLayer;
  totalDeposits: number;       // USD value of all incoming transfers
  totalWithdrawals: number;    // USD value of all outgoing transfers
  netFunding: number;           // deposits - withdrawals
  depositCount: number;
  withdrawalCount: number;
}

export interface FundingSummary {
  overallTotalDeposits: number;
  overallTotalWithdrawals: number;
  overallNetFunding: number;
  l1TotalDeposits: number;
  l1TotalWithdrawals: number;
  l1NetFunding: number;
  l2TotalDeposits: number;
  l2TotalWithdrawals: number;
  l2NetFunding: number;
  chainBreakdown: ChainFundingSummary[];
  profitTaken?: number; // If net is negative, this is the profit extracted
}
