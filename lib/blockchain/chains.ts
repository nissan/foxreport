import { mainnet, arbitrum, base } from "wagmi/chains";
import { ChainId } from "@/types/portfolio";

export const SUPPORTED_CHAINS = [mainnet, arbitrum, base] as const;

export const CHAIN_INFO = {
  [mainnet.id]: {
    name: "Ethereum",
    shortName: "ETH",
    nativeCurrency: "ETH",
    explorerUrl: "https://etherscan.io",
    alchemyNetwork: "eth-mainnet",
  },
  [arbitrum.id]: {
    name: "Arbitrum",
    shortName: "ARB",
    nativeCurrency: "ETH",
    explorerUrl: "https://arbiscan.io",
    alchemyNetwork: "arb-mainnet",
  },
  [base.id]: {
    name: "Base",
    shortName: "BASE",
    nativeCurrency: "ETH",
    explorerUrl: "https://basescan.org",
    alchemyNetwork: "base-mainnet",
  },
} as const;

export function getChainInfo(chainId: ChainId) {
  return CHAIN_INFO[chainId];
}

export function getChainName(chainId: ChainId) {
  return CHAIN_INFO[chainId]?.name || "Unknown";
}

export function isValidChainId(chainId: number): chainId is ChainId {
  return chainId in CHAIN_INFO;
}
