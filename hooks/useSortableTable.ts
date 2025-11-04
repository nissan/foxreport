/**
 * Sortable Table State Hook
 *
 * Manages table state including sorting, filtering, and pagination
 */

import { useState, useMemo } from "react";
import type { SortingState, ColumnSort } from "@tanstack/react-table";

interface UseSortableTableOptions<TData> {
  data: TData[];
  defaultSort?: ColumnSort[];
  filterFn?: (item: TData, searchTerm: string) => boolean;
}

export function useSortableTable<TData>({
  data,
  defaultSort = [],
  filterFn,
}: UseSortableTableOptions<TData>) {
  const [sorting, setSorting] = useState<SortingState>(defaultSort);
  const [searchTerm, setSearchTerm] = useState("");

  // Filter data based on search term
  const filteredData = useMemo(() => {
    if (!searchTerm || !filterFn) return data;
    return data.filter((item) => filterFn(item, searchTerm));
  }, [data, searchTerm, filterFn]);

  // Get current sort info
  const currentSort = sorting[0];
  const sortField = currentSort?.id;
  const sortDirection = currentSort?.desc ? "desc" : "asc";

  return {
    data: filteredData,
    sorting,
    setSorting,
    searchTerm,
    setSearchTerm,
    sortField,
    sortDirection,
    hasSearch: searchTerm.length > 0,
    totalCount: data.length,
    filteredCount: filteredData.length,
  };
}

/**
 * Hook for managing filter state
 */
interface UseTableFiltersOptions {
  defaultFilters?: Record<string, any>;
}

export function useTableFilters({ defaultFilters = {} }: UseTableFiltersOptions = {}) {
  const [filters, setFilters] = useState<Record<string, any>>(defaultFilters);

  const setFilter = (key: string, value: any) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const clearFilter = (key: string) => {
    setFilters((prev) => {
      const newFilters = { ...prev };
      delete newFilters[key];
      return newFilters;
    });
  };

  const clearAllFilters = () => {
    setFilters({});
  };

  const hasFilters = Object.keys(filters).length > 0;
  const activeFilterCount = Object.keys(filters).length;

  return {
    filters,
    setFilter,
    clearFilter,
    clearAllFilters,
    hasFilters,
    activeFilterCount,
  };
}
