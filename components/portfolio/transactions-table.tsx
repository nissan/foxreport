import { Transaction } from "@/types/portfolio";
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
import { ArrowDownToLine, ArrowUpFromLine, ArrowLeftRight, ExternalLink } from "lucide-react";
import { CHAIN_INFO } from "@/lib/blockchain/chains";

interface TransactionsTableProps {
  transactions: Transaction[];
}

export function TransactionsTable({ transactions }: TransactionsTableProps) {
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const getTypeIcon = (type: Transaction["type"]) => {
    switch (type) {
      case "deposit":
        return <ArrowDownToLine className="h-4 w-4 text-green-600" />;
      case "withdrawal":
        return <ArrowUpFromLine className="h-4 w-4 text-red-600" />;
      case "swap":
        return <ArrowLeftRight className="h-4 w-4 text-blue-600" />;
      default:
        return <ArrowLeftRight className="h-4 w-4 text-gray-600" />;
    }
  };

  const getTypeLabel = (type: Transaction["type"]) => {
    switch (type) {
      case "deposit":
        return "Deposit";
      case "withdrawal":
        return "Withdrawal";
      case "swap":
        return "Swap";
      default:
        return "Unknown";
    }
  };

  const getExplorerUrl = (hash: string, chainId: number) => {
    const chainInfo = CHAIN_INFO[chainId as keyof typeof CHAIN_INFO];
    return `${chainInfo?.explorerUrl}/tx/${hash}`;
  };

  // Show last 20 transactions
  const recentTransactions = transactions.slice(0, 20);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Transactions</CardTitle>
        <CardDescription>
          Showing {recentTransactions.length} of {transactions.length} transactions
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Hash</TableHead>
              <TableHead>Chain</TableHead>
              <TableHead>From/To</TableHead>
              <TableHead>Date</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {recentTransactions.map((tx) => (
              <TableRow key={`${tx.hash}-${tx.chainId}`}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {getTypeIcon(tx.type)}
                    <span className="text-sm">{getTypeLabel(tx.type)}</span>
                  </div>
                </TableCell>
                <TableCell className="font-mono text-sm">
                  {formatAddress(tx.hash)}
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{getChainName(tx.chainId)}</Badge>
                </TableCell>
                <TableCell className="font-mono text-sm text-muted-foreground">
                  {tx.type === "deposit" ? formatAddress(tx.from) : formatAddress(tx.to || tx.from)}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatDate(tx.timestamp)}
                </TableCell>
                <TableCell>
                  <a
                    href={getExplorerUrl(tx.hash, tx.chainId)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
