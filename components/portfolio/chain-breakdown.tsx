"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PortfolioData } from "@/types/portfolio";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";

interface ChainBreakdownProps {
  data: PortfolioData["chainBreakdown"];
}

const COLORS = ["#3b82f6", "#8b5cf6", "#06b6d4", "#10b981", "#f59e0b"];

export function ChainBreakdown({ data }: ChainBreakdownProps) {
  const chartData = data.map((item) => ({
    name: item.chainName,
    value: item.totalValueUsd,
    tokens: item.tokenCount,
  }));

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background border rounded-lg p-3 shadow-lg">
          <p className="font-semibold">{payload[0].name}</p>
          <p className="text-sm text-muted-foreground">
            Value: {formatCurrency(payload[0].value)}
          </p>
          <p className="text-sm text-muted-foreground">
            Tokens: {payload[0].payload.tokens}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Chain Breakdown</CardTitle>
        <CardDescription>Portfolio distribution across chains</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={(props: any) => {
                const { name, percent } = props;
                return `${name} ${(percent * 100).toFixed(0)}%`;
              }}
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>

        <div className="mt-4 space-y-2">
          {data.map((item, index) => (
            <div
              key={item.chainId}
              className="flex items-center justify-between p-2 rounded-lg border"
            >
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: COLORS[index % COLORS.length] }}
                />
                <span className="font-medium">{item.chainName}</span>
              </div>
              <div className="text-right">
                <div className="font-semibold">{formatCurrency(item.totalValueUsd)}</div>
                <div className="text-sm text-muted-foreground">{item.tokenCount} tokens</div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
