import { mainnet, arbitrum, base } from "wagmi/chains";
import { ChainId, ChainLayer } from "@/types/portfolio";

export const SUPPORTED_CHAINS = [mainnet, arbitrum, base] as const;

export const CHAIN_INFO = {
  [mainnet.id]: {
    name: "Ethereum",
    shortName: "ETH",
    nativeCurrency: "ETH",
    explorerUrl: "https://etherscan.io",
    alchemyNetwork: "eth-mainnet",
    layer: "L1" as ChainLayer,
  },
  [arbitrum.id]: {
    name: "Arbitrum",
    shortName: "ARB",
    nativeCurrency: "ETH",
    explorerUrl: "https://arbiscan.io",
    alchemyNetwork: "arb-mainnet",
    layer: "L2" as ChainLayer,
  },
  [base.id]: {
    name: "Base",
    shortName: "BASE",
    nativeCurrency: "ETH",
    explorerUrl: "https://basescan.org",
    alchemyNetwork: "base-mainnet",
    layer: "L2" as ChainLayer,
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

// L1/L2 Classification Helpers
export function getChainLayer(chainId: ChainId): ChainLayer {
  return CHAIN_INFO[chainId]?.layer || "L1";
}

export function getL1Chains(): ChainId[] {
  return Object.keys(CHAIN_INFO)
    .map(Number)
    .filter((id) => CHAIN_INFO[id as ChainId].layer === "L1") as ChainId[];
}

export function getL2Chains(): ChainId[] {
  return Object.keys(CHAIN_INFO)
    .map(Number)
    .filter((id) => CHAIN_INFO[id as ChainId].layer === "L2") as ChainId[];
}

export function isL1Chain(chainId: ChainId): boolean {
  return CHAIN_INFO[chainId]?.layer === "L1";
}

export function isL2Chain(chainId: ChainId): boolean {
  return CHAIN_INFO[chainId]?.layer === "L2";
}
