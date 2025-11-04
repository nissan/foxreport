"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { Address, isAddress } from "viem";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { SummaryCards } from "@/components/portfolio/summary-cards";
import { TokenBalancesTable } from "@/components/portfolio/token-balances-table";
import { TransactionsTable } from "@/components/portfolio/transactions-table";
import { ChainBreakdown } from "@/components/portfolio/chain-breakdown";
import { usePortfolio } from "@/hooks/usePortfolio";
import { ArrowLeft, RefreshCw, TrendingUp, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface PageProps {
  params: Promise<{ address: string }>;
}

export default function PortfolioPage({ params }: PageProps) {
  const router = useRouter();
  const { address: addressParam } = use(params);

  // Validate address
  if (!isAddress(addressParam)) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
        <div className="container mx-auto px-4 py-8">
          <Card className="max-w-md mx-auto">
            <CardHeader>
              <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
              <CardTitle className="text-center">Invalid Address</CardTitle>
              <CardDescription className="text-center">
                The provided address is not a valid Ethereum address
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => router.push("/")} className="w-full">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Home
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const address = addressParam as Address;
  const { data, loading, error, refresh } = usePortfolio(address);

  const handleRefresh = () => {
    toast.info("Refreshing portfolio data...");
    refresh();
  };

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => router.push("/")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-bold">FoxReport</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Address Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <h2 className="text-2xl font-bold">Portfolio Analysis</h2>
          </div>
          <div className="flex items-center gap-2">
            <code className="text-sm bg-muted px-3 py-1 rounded-md">{formatAddress(address)}</code>
            {data?.summary.lastUpdated && (
              <Badge variant="outline">
                Updated: {new Date(data.summary.lastUpdated).toLocaleTimeString()}
              </Badge>
            )}
          </div>
        </div>

        {/* Loading State */}
        {loading && !data && (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {[...Array(4)].map((_, i) => (
                <Card key={i}>
                  <CardHeader>
                    <Skeleton className="h-4 w-24" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-8 w-32 mb-2" />
                    <Skeleton className="h-3 w-24" />
                  </CardContent>
                </Card>
              ))}
            </div>
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-48" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-64 w-full" />
              </CardContent>
            </Card>
          </div>
        )}

        {/* Error State */}
        {error && (
          <Card className="border-destructive">
            <CardHeader>
              <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
              <CardTitle className="text-center">Error Loading Portfolio</CardTitle>
              <CardDescription className="text-center">{error.message}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={handleRefresh} className="w-full">
                <RefreshCw className="mr-2 h-4 w-4" />
                Try Again
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Data Display */}
        {data && !loading && (
          <div className="space-y-6">
            {/* Summary Cards */}
            <SummaryCards summary={data.summary} />

            {/* Tabs for different views */}
            <Tabs defaultValue="balances" className="space-y-4">
              <TabsList>
                <TabsTrigger value="balances">Balances</TabsTrigger>
                <TabsTrigger value="transactions">Transactions</TabsTrigger>
                <TabsTrigger value="chains">Chains</TabsTrigger>
                {data.defiPositions.length > 0 && (
                  <TabsTrigger value="defi">DeFi Positions</TabsTrigger>
                )}
              </TabsList>

              <TabsContent value="balances" className="space-y-4">
                <TokenBalancesTable balances={data.balances} />
              </TabsContent>

              <TabsContent value="transactions" className="space-y-4">
                <TransactionsTable transactions={data.transactions} />
              </TabsContent>

              <TabsContent value="chains" className="space-y-4">
                <ChainBreakdown data={data.chainBreakdown} />
              </TabsContent>

              {data.defiPositions.length > 0 && (
                <TabsContent value="defi" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>DeFi Positions</CardTitle>
                      <CardDescription>
                        Your positions across DeFi protocols
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">
                        {data.defiPositions.length} positions found
                      </p>
                    </CardContent>
                  </Card>
                </TabsContent>
              )}
            </Tabs>
          </div>
        )}
      </main>
    </div>
  );
}
