import { TokenBalance } from "@/types/portfolio";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { getChainName } from "@/lib/blockchain/chains";

interface TokenBalancesTableProps {
  balances: TokenBalance[];
}

export function TokenBalancesTable({ balances }: TokenBalancesTableProps) {
  const formatCurrency = (value: number | undefined) => {
    if (value === undefined) return "N/A";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatNumber = (value: string) => {
    const num = parseFloat(value);
    if (num === 0) return "0";
    if (num < 0.001) return "< 0.001";
    return new Intl.NumberFormat("en-US", {
      maximumFractionDigits: 6,
    }).format(num);
  };

  // Sort by value USD descending
  const sortedBalances = [...balances].sort((a, b) => {
    const aValue = a.valueUsd || 0;
    const bValue = b.valueUsd || 0;
    return bValue - aValue;
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Token Balances</CardTitle>
        <CardDescription>
          {balances.length} tokens across {new Set(balances.map((b) => b.chainId)).size} chains
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Token</TableHead>
              <TableHead>Chain</TableHead>
              <TableHead className="text-right">Balance</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead className="text-right">Value</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedBalances.map((balance, index) => (
              <TableRow key={`${balance.address}-${balance.chainId}-${index}`}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    {balance.logo && (
                      <img
                        src={balance.logo}
                        alt={balance.symbol}
                        className="w-6 h-6 rounded-full"
                      />
                    )}
                    <div>
                      <div>{balance.symbol}</div>
                      <div className="text-xs text-muted-foreground">{balance.name}</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{getChainName(balance.chainId)}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  {formatNumber(balance.balanceFormatted)}
                </TableCell>
                <TableCell className="text-right">
                  {balance.priceUsd ? formatCurrency(balance.priceUsd) : "N/A"}
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatCurrency(balance.valueUsd)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
