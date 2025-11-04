import { Alchemy, Network } from "alchemy-sdk";
import { ChainId } from "@/types/portfolio";
import { CHAIN_INFO } from "./chains";

const alchemyApiKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;

if (!alchemyApiKey) {
  throw new Error("NEXT_PUBLIC_ALCHEMY_API_KEY is not set");
}

// Map our chain IDs to Alchemy networks
const ALCHEMY_NETWORK_MAP: Record<ChainId, Network> = {
  1: Network.ETH_MAINNET,
  42161: Network.ARB_MAINNET,
  8453: Network.BASE_MAINNET,
};

// Create Alchemy clients for each supported chain
const alchemyClients: Record<ChainId, Alchemy> = {
  1: new Alchemy({
    apiKey: alchemyApiKey,
    network: ALCHEMY_NETWORK_MAP[1],
  }),
  42161: new Alchemy({
    apiKey: alchemyApiKey,
    network: ALCHEMY_NETWORK_MAP[42161],
  }),
  8453: new Alchemy({
    apiKey: alchemyApiKey,
    network: ALCHEMY_NETWORK_MAP[8453],
  }),
};

export function getAlchemyClient(chainId: ChainId): Alchemy {
  return alchemyClients[chainId];
}

export { alchemyClients };
