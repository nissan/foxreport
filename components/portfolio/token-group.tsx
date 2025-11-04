/**
 * Token Group Component
 *
 * Displays grouped tokens (L1 or L2) with subtotal and sortable table
 */

"use client";

import * as React from "react";
import { type ChainLayer, type TokenBalance } from "@/types/portfolio";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface TokenGroupProps {
  title: string;
  layer: ChainLayer;
  tokens: TokenBalance[];
  totalValueUsd: number;
  children: React.ReactNode;
  className?: string;
  defaultExpanded?: boolean;
}

export function TokenGroup({
  title,
  layer,
  tokens,
  totalValueUsd,
  children,
  className,
  defaultExpanded = true,
}: TokenGroupProps) {
  const [isExpanded, setIsExpanded] = React.useState(defaultExpanded);

  const layerColor = layer === "L1" ? "text-primary" : "text-accent";
  const layerBadge = layer === "L1" ? "bg-primary/10" : "bg-accent/10";

  return (
    <Card className={cn("overflow-hidden", className)}>
      {/* Group Header */}
      <div
        className={cn(
          "flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50 transition-colors border-b",
          !isExpanded && "border-b-0"
        )}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <div className={cn("px-2 py-1 rounded-md text-xs font-bold tracking-wider", layerBadge, layerColor)}>
            {layer}
          </div>
          <h3 className="text-lg font-bold tracking-wide">{title}</h3>
          <span className="text-sm text-muted-foreground">
            ({tokens.length} {tokens.length === 1 ? "token" : "tokens"})
          </span>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-xs text-muted-foreground tracking-wider">TOTAL VALUE</div>
            <div className="text-lg font-bold tracking-wide">
              ${totalValueUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
          <svg
            className={cn("h-5 w-5 transition-transform text-muted-foreground", isExpanded && "rotate-180")}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {/* Group Content (Table) */}
      {isExpanded && <div className="p-4">{children}</div>}
    </Card>
  );
}

/**
 * Subtotal Row Component
 * Used at the bottom of each group's table
 */
interface SubtotalRowProps {
  label: string;
  totalValue: number;
  className?: string;
}

export function SubtotalRow({ label, totalValue, className }: SubtotalRowProps) {
  return (
    <div className={cn("flex items-center justify-between py-3 px-4 bg-muted/30 rounded-md mt-2 border", className)}>
      <span className="font-semibold tracking-wide">{label}</span>
      <span className="font-bold text-lg tracking-wide">
        ${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </span>
    </div>
  );
}
