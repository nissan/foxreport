/**
 * Token Balances Table Component
 *
 * Displays token holdings grouped by L1/L2 with sortable columns:
 * - L1 section: Ethereum
 * - L2 section: Arbitrum, Base
 * - Sortable by: Token Name, Balance, Price, Value
 * - Token type badges: aToken, GLP, LP, Wrapped
 * - Underlying asset tooltips for wrapped tokens
 */

"use client";

import * as React from "react";
import { TokenBalance } from "@/types/portfolio";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SortableTable } from "@/components/ui/sortable-table";
import { TokenGroup } from "@/components/portfolio/token-group";
import { getChainName, getChainLayer, getL1Chains, getL2Chains } from "@/lib/blockchain/chains";
import { detectTokenType } from "@/lib/tokens/detection";
import { ColumnDef } from "@tanstack/react-table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Info } from "lucide-react";

interface TokenBalancesTableProps {
  balances: TokenBalance[];
}

export function TokenBalancesTable({ balances }: TokenBalancesTableProps) {
  // Format currency helper
  const formatCurrency = (value: number | undefined) => {
    if (value === undefined) return "N/A";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  // Format number helper
  const formatNumber = (value: string) => {
    const num = parseFloat(value);
    if (num === 0) return "0";
    if (num < 0.001) return "< 0.001";
    return new Intl.NumberFormat("en-US", {
      maximumFractionDigits: 6,
    }).format(num);
  };

  // Detect token types and add to balances
  const balancesWithTypes = React.useMemo(
    () =>
      balances.map((balance) => ({
        ...balance,
        tokenType: detectTokenType(balance.address, balance.symbol, balance.chainId),
      })),
    [balances]
  );

  // Group balances by L1/L2 and by individual chains
  const l1Chains = getL1Chains();
  const l2Chains = getL2Chains();

  const l1Balances = balancesWithTypes.filter((b) => l1Chains.includes(b.chainId));

  // Group L2 balances by individual chain
  const l2BalancesByChain = l2Chains.reduce((acc, chainId) => {
    const chainBalances = balancesWithTypes.filter((b) => b.chainId === chainId);
    if (chainBalances.length > 0) {
      acc[chainId] = chainBalances;
    }
    return acc;
  }, {} as Record<number, typeof balancesWithTypes>);

  // Calculate total values
  const l1TotalValue = l1Balances.reduce((sum, b) => sum + (b.valueUsd || 0), 0);

  // Define columns for sortable table
  const columns: ColumnDef<TokenBalance & { tokenType?: string }>[] = [
    {
      accessorKey: "symbol",
      header: "Token",
      cell: ({ row }) => {
        const balance = row.original;
        return (
          <div className="flex items-center gap-2">
            {balance.logo && (
              <img
                src={balance.logo}
                alt={balance.symbol}
                className="w-6 h-6 rounded-full"
              />
            )}
            <div>
              <div className="font-medium">{balance.symbol}</div>
              <div className="text-xs text-muted-foreground">{balance.name}</div>
            </div>
          </div>
        );
      },
      enableSorting: true,
    },
    {
      accessorKey: "chainId",
      header: "Chain",
      cell: ({ row }) => (
        <Badge variant="outline">{getChainName(row.original.chainId)}</Badge>
      ),
      enableSorting: true,
    },
    {
      accessorKey: "tokenType",
      header: "Type",
      cell: ({ row }) => {
        const tokenType = row.original.tokenType;
        if (!tokenType || tokenType === "erc20" || tokenType === "native") return null;

        const typeLabels: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
          aToken: { label: "Aave", variant: "secondary" },
          lpToken: { label: "LP", variant: "outline" },
          wrapped: { label: "Wrapped", variant: "outline" },
        };

        const typeInfo = typeLabels[tokenType];
        if (!typeInfo) return null;

        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant={typeInfo.variant} className="cursor-help gap-1">
                  {typeInfo.label}
                  <Info className="h-3 w-3" />
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <div className="max-w-xs">
                  {tokenType === "aToken" && (
                    <div>
                      <p className="font-semibold">Aave Lending Position</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Represents deposited assets earning interest in Aave V3
                      </p>
                      {row.original.underlyingAssets && row.original.underlyingAssets.length > 0 && (
                        <p className="text-xs mt-2">
                          Underlying: {row.original.underlyingAssets[0].symbol}
                        </p>
                      )}
                    </div>
                  )}
                  {tokenType === "lpToken" && (
                    <div>
                      <p className="font-semibold">Liquidity Provider Token</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Represents a share of a liquidity pool (Uniswap, Curve, etc.)
                      </p>
                    </div>
                  )}
                  {tokenType === "wrapped" && (
                    <div>
                      <p className="font-semibold">Wrapped Token</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Tokenized version of the underlying asset (e.g., WETH, WBTC)
                      </p>
                      {row.original.underlyingAssets && row.original.underlyingAssets.length > 0 && (
                        <p className="text-xs mt-2">
                          Underlying: {row.original.underlyingAssets[0].symbol}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      },
      enableSorting: false,
    },
    {
      accessorKey: "balanceFormatted",
      header: "Balance",
      cell: ({ row }) => (
        <div className="text-right">{formatNumber(row.original.balanceFormatted)}</div>
      ),
      enableSorting: true,
      sortingFn: (rowA, rowB) => {
        const a = parseFloat(rowA.original.balanceFormatted);
        const b = parseFloat(rowB.original.balanceFormatted);
        return a - b;
      },
    },
    {
      accessorKey: "priceUsd",
      header: "Price",
      cell: ({ row }) => (
        <div className="text-right">
          {row.original.priceUsd ? formatCurrency(row.original.priceUsd) : "N/A"}
        </div>
      ),
      enableSorting: true,
    },
    {
      accessorKey: "valueUsd",
      header: "Value",
      cell: ({ row }) => (
        <div className="text-right font-medium">{formatCurrency(row.original.valueUsd)}</div>
      ),
      enableSorting: true,
    },
  ];

  if (balances.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Token Balances</CardTitle>
          <CardDescription>No tokens found</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header Card */}
      <Card>
        <CardHeader>
          <CardTitle>Token Balances</CardTitle>
          <CardDescription>
            {balances.length} tokens across {new Set(balances.map((b) => b.chainId)).size} chains
          </CardDescription>
        </CardHeader>
      </Card>

      {/* L1 Tokens Group */}
      {l1Balances.length > 0 && (
        <TokenGroup
          title="Ethereum"
          layer="L1"
          tokens={l1Balances}
          totalValueUsd={l1TotalValue}
          defaultExpanded={true}
        >
          <SortableTable
            data={l1Balances}
            columns={columns}
            defaultSort={[{ id: "valueUsd", desc: true }]}
            emptyMessage="No L1 tokens found"
          />
        </TokenGroup>
      )}

      {/* L2 Tokens - Separate Group per Chain */}
      {Object.entries(l2BalancesByChain).map(([chainIdStr, chainBalances]) => {
        const chainId = parseInt(chainIdStr) as import("@/types/portfolio").ChainId;
        const chainName = getChainName(chainId);
        const chainTotalValue = chainBalances.reduce((sum, b) => sum + (b.valueUsd || 0), 0);

        return (
          <TokenGroup
            key={chainId}
            title={chainName}
            layer="L2"
            tokens={chainBalances}
            totalValueUsd={chainTotalValue}
            defaultExpanded={true}
          >
            <SortableTable
              data={chainBalances}
              columns={columns}
              defaultSort={[{ id: "valueUsd", desc: true }]}
              emptyMessage={`No tokens found on ${chainName}`}
            />
          </TokenGroup>
        );
      })}
    </div>
  );
}
