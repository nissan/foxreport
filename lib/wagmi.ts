import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { mainnet, arbitrum, base } from "wagmi/chains";
import { http } from "wagmi";

const alchemyApiKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;
const walletConnectProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;

if (!alchemyApiKey) {
  throw new Error("NEXT_PUBLIC_ALCHEMY_API_KEY is not set");
}

if (!walletConnectProjectId) {
  throw new Error("NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is not set");
}

export const config = getDefaultConfig({
  appName: "FoxReport - Crypto Portfolio Analysis",
  projectId: walletConnectProjectId,
  chains: [mainnet, arbitrum, base],
  transports: {
    [mainnet.id]: http(`https://eth-mainnet.g.alchemy.com/v2/${alchemyApiKey}`),
    [arbitrum.id]: http(`https://arb-mainnet.g.alchemy.com/v2/${alchemyApiKey}`),
    [base.id]: http(`https://base-mainnet.g.alchemy.com/v2/${alchemyApiKey}`),
  },
  ssr: true,
});
