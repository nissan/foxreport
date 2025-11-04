import { useState, useEffect } from "react";
import { Address } from "viem";
import { PortfolioData } from "@/types/portfolio";
import { getPortfolioData, refreshPortfolioData } from "@/lib/portfolio/analytics";

export function usePortfolio(address: Address | null) {
  const [data, setData] = useState<PortfolioData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = async (forceRefresh = false) => {
    if (!address) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const portfolioData = forceRefresh
        ? await refreshPortfolioData(address)
        : await getPortfolioData(address);

      setData(portfolioData);
    } catch (err) {
      setError(err as Error);
      console.error("Error fetching portfolio data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [address]);

  const refresh = () => fetchData(true);

  return {
    data,
    loading,
    error,
    refresh,
  };
}
