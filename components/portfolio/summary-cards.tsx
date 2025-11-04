import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PortfolioSummary } from "@/types/portfolio";
import { TrendingUp, TrendingDown } from "lucide-react";
import { IconWallet, IconArrowDownCircle, IconArrowUpCircle, IconChartLine } from "@tabler/icons-react";

interface SummaryCardsProps {
  summary: PortfolioSummary;
}

export function SummaryCards({ summary }: SummaryCardsProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatPercentage = (value: number) => {
    return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
  };

  const isProfitable = summary.pnlUsd >= 0;

  const cards = [
    {
      title: "TOTAL VALUE",
      value: formatCurrency(summary.totalValueUsd),
      subtitle: "Current portfolio value",
      icon: IconWallet,
      gradient: "from-primary/20 to-primary/5",
      borderClass: "neon-border",
    },
    {
      title: "DEPOSITED",
      value: formatCurrency(summary.totalDepositedUsd),
      subtitle: `Net: ${formatCurrency(summary.netDepositedUsd)}`,
      icon: IconArrowDownCircle,
      gradient: "from-accent/20 to-accent/5",
      borderClass: "neon-border-blue",
    },
    {
      title: "WITHDRAWN",
      value: formatCurrency(summary.totalWithdrawnUsd),
      subtitle: "From portfolio",
      icon: IconArrowUpCircle,
      gradient: "from-accent/20 to-primary/5",
      borderClass: "neon-border-purple",
    },
    {
      title: "P&L",
      value: formatCurrency(summary.pnlUsd),
      subtitle: formatPercentage(summary.pnlPercentage),
      icon: isProfitable ? TrendingUp : TrendingDown,
      gradient: isProfitable ? "from-green-500/20 to-green-500/5" : "from-red-500/20 to-red-500/5",
      borderClass: isProfitable ? "neon-border" : "neon-border",
      valueColor: isProfitable ? "text-green-400" : "text-red-400",
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {cards.map((card, index) => (
        <motion.div
          key={card.title}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
          whileHover={{ scale: 1.05, y: -5 }}
        >
          <Card className={`${card.borderClass} backdrop-blur-xl bg-card/50 border-2 overflow-hidden`}>
            <div className={`absolute inset-0 bg-gradient-to-br ${card.gradient} opacity-50`} />
            <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-bold tracking-widest">{card.title}</CardTitle>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
              >
                <card.icon className="h-5 w-5 text-primary" />
              </motion.div>
            </CardHeader>
            <CardContent className="relative">
              <motion.div
                className={`text-2xl font-bold tracking-wide ${card.valueColor || ""}`}
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200 }}
              >
                {card.value}
              </motion.div>
              <p className="text-xs text-muted-foreground mt-1 tracking-wide">{card.subtitle}</p>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}
