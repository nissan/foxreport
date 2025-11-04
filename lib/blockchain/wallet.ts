import { Address, isAddress } from "viem";
import { normalize } from "viem/ens";
import { getAlchemyClient } from "./client";
import { WalletInfo, ChainId } from "@/types/portfolio";
import { localCache, getCacheKey } from "@/lib/cache/storage";

/**
 * Validates if a string is a valid Ethereum address
 */
export function isValidAddress(address: string): boolean {
  return isAddress(address);
}

/**
 * Detects the type of wallet (EOA, Safe multisig, or contract)
 */
export async function detectWalletType(
  address: Address,
  chainId: ChainId = 1
): Promise<"eoa" | "safe" | "contract"> {
  try {
    const client = getAlchemyClient(chainId);
    const code = await client.core.getCode(address);

    // If no code, it's an EOA (Externally Owned Account)
    if (!code || code === "0x") {
      return "eoa";
    }

    // Check if it's a Safe multisig by looking for common Safe contract patterns
    // Safe contracts typically have specific function selectors
    const isSafe = await checkIfSafe(address, chainId);
    if (isSafe) {
      return "safe";
    }

    // Otherwise, it's a generic contract
    return "contract";
  } catch (error) {
    console.error("Error detecting wallet type:", error);
    return "eoa"; // Default to EOA on error
  }
}

/**
 * Checks if an address is a Safe multisig wallet
 */
async function checkIfSafe(address: Address, chainId: ChainId): Promise<boolean> {
  try {
    const client = getAlchemyClient(chainId);
    const code = await client.core.getCode(address);

    // Safe contracts contain specific bytecode patterns
    // This is a simplified check - you could enhance it by calling getOwners() or other Safe-specific methods
    if (code && code.length > 2) {
      // Check for common Safe proxy patterns
      const safeMasterCopySelector = "0xa619486e"; // masterCopy()
      const safeOwnersSelector = "0xa0e67e2b"; // getOwners()

      return code.includes(safeMasterCopySelector.slice(2)) || code.includes(safeOwnersSelector.slice(2));
    }

    return false;
  } catch (error) {
    console.error("Error checking if Safe:", error);
    return false;
  }
}

/**
 * Resolves ENS name to address or returns the address if already valid
 */
export async function resolveAddressOrENS(input: string): Promise<Address | null> {
  // First check if it's already a valid address
  if (isValidAddress(input)) {
    return input as Address;
  }

  // Check if it looks like an ENS name
  if (input.endsWith(".eth")) {
    try {
      const client = getAlchemyClient(1); // ENS is only on mainnet
      const normalizedName = normalize(input);
      const address = await client.core.resolveName(normalizedName);

      if (address && isValidAddress(address)) {
        return address as Address;
      }
    } catch (error) {
      console.error("Error resolving ENS name:", error);
    }
  }

  return null;
}

/**
 * Reverse lookup ENS name for an address
 */
export async function lookupENS(address: Address): Promise<string | null> {
  try {
    const client = getAlchemyClient(1); // ENS is only on mainnet
    const ensName = await client.core.lookupAddress(address);
    return ensName;
  } catch (error) {
    console.error("Error looking up ENS:", error);
    return null;
  }
}

/**
 * Gets comprehensive wallet information with caching
 */
export async function getWalletInfo(address: Address, chainId: ChainId = 1): Promise<WalletInfo> {
  // Check cache first
  const cacheKey = getCacheKey.walletInfo(address);
  const cached = localCache.get<WalletInfo>(cacheKey);

  if (cached) {
    return cached;
  }

  // Fetch fresh data
  const [type, ensName] = await Promise.all([detectWalletType(address, chainId), lookupENS(address)]);

  const walletInfo: WalletInfo = {
    address,
    type,
    ensName: ensName || undefined,
    chainId,
  };

  // Cache for 1 hour
  localCache.set(cacheKey, walletInfo, 60);

  return walletInfo;
}
