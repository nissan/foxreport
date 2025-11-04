/**
 * Filter Badge Component
 *
 * Displays active filters as dismissible badges
 */

"use client";

import * as React from "react";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface FilterBadgeProps {
  label: string;
  value: string;
  onRemove?: () => void;
  className?: string;
  variant?: "default" | "secondary" | "outline" | "destructive";
}

export function FilterBadge({
  label,
  value,
  onRemove,
  className,
  variant = "secondary",
}: FilterBadgeProps) {
  return (
    <Badge
      variant={variant}
      className={cn(
        "gap-2 pr-1 pl-3 py-1 tracking-wide",
        onRemove && "cursor-pointer hover:bg-secondary/80",
        className
      )}
    >
      <span className="text-xs font-medium">
        {label}: <span className="font-semibold">{value}</span>
      </span>
      {onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="rounded-full p-0.5 hover:bg-background/20 transition-colors"
          aria-label={`Remove ${label} filter`}
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </Badge>
  );
}

/**
 * Filter Badge Group Component
 * Container for multiple filter badges with "Clear All" button
 */
interface FilterBadgeGroupProps {
  filters: Array<{ key: string; label: string; value: string }>;
  onRemove: (key: string) => void;
  onClearAll?: () => void;
  className?: string;
}

export function FilterBadgeGroup({
  filters,
  onRemove,
  onClearAll,
  className,
}: FilterBadgeGroupProps) {
  if (filters.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <span className="text-sm text-muted-foreground font-medium">Active Filters:</span>
      {filters.map((filter) => (
        <FilterBadge
          key={filter.key}
          label={filter.label}
          value={filter.value}
          onRemove={() => onRemove(filter.key)}
        />
      ))}
      {onClearAll && filters.length > 1 && (
        <button
          onClick={onClearAll}
          className="text-xs text-muted-foreground hover:text-foreground underline-offset-4 hover:underline transition-colors ml-2"
        >
          Clear all
        </button>
      )}
    </div>
  );
}
