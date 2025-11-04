/**
 * Sortable Table Component
 *
 * Wrapper around TanStack Table with built-in sorting, indicators, and styling
 */

"use client";

import * as React from "react";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
  type ColumnSort,
} from "@tanstack/react-table";
import { ArrowUpDown, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface SortableTableProps<TData> {
  data: TData[];
  columns: ColumnDef<TData>[];
  defaultSort?: ColumnSort[];
  onSortChange?: (sorting: SortingState) => void;
  emptyMessage?: string;
  className?: string;
}

export function SortableTable<TData>({
  data,
  columns,
  defaultSort = [],
  onSortChange,
  emptyMessage = "No data available",
  className,
}: SortableTableProps<TData>) {
  const [sorting, setSorting] = React.useState<SortingState>(defaultSort);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: (updater) => {
      const newSorting = typeof updater === "function" ? updater(sorting) : updater;
      setSorting(newSorting);
      onSortChange?.(newSorting);
    },
    state: {
      sorting,
    },
  });

  return (
    <div className={cn("rounded-md border border-border", className)}>
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                const canSort = header.column.getCanSort();
                const isSorted = header.column.getIsSorted();

                return (
                  <TableHead key={header.id} className="font-semibold">
                    {header.isPlaceholder ? null : (
                      <div
                        className={cn(
                          "flex items-center gap-2",
                          canSort && "cursor-pointer select-none hover:text-foreground",
                          !canSort && "cursor-default"
                        )}
                        onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {canSort && (
                          <span className="ml-auto">
                            {isSorted === "asc" ? (
                              <ChevronUp className="h-4 w-4 text-primary" />
                            ) : isSorted === "desc" ? (
                              <ChevronDown className="h-4 w-4 text-primary" />
                            ) : (
                              <ArrowUpDown className="h-4 w-4 text-muted-foreground opacity-50" />
                            )}
                          </span>
                        )}
                      </div>
                    )}
                  </TableHead>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows?.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow key={row.id} data-state={row.getIsSelected() && "selected"}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                {emptyMessage}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

/**
 * Sort indicator component for custom column headers
 */
export function SortIndicator({ sorted }: { sorted: false | "asc" | "desc" }) {
  if (sorted === "asc") {
    return <ChevronUp className="h-4 w-4 text-primary" />;
  }
  if (sorted === "desc") {
    return <ChevronDown className="h-4 w-4 text-primary" />;
  }
  return <ArrowUpDown className="h-4 w-4 text-muted-foreground opacity-50" />;
}
