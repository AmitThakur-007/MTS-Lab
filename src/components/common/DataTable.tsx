import React, { useState, useMemo } from 'react';
import { 
  ChevronDown, 
  ChevronUp, 
  ChevronsUpDown, 
  ChevronLeft, 
  ChevronRight, 
  Search,
  RefreshCw,
  CheckSquare,
  Square
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TableSkeleton } from '@/components/common/SkeletonLoaders';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { BulkActionBar, BulkActionItem } from '@/components/common/BulkActionBar';
import { cn } from '@/lib/utils';

export interface ColumnDef<T> {
  id: string;
  header: string | React.ReactNode;
  accessorKey?: keyof T;
  cell?: (row: T, index: number) => React.ReactNode;
  sortable?: boolean;
  align?: 'left' | 'center' | 'right';
  className?: string;
  hideOnMobile?: boolean;
}

export interface DataTableProps<T> {
  data: T[];
  columns: ColumnDef<T>[];
  keyExtractor: (item: T) => string;
  
  // States
  isLoading?: boolean;
  isError?: boolean;
  errorMessage?: string;
  onRetry?: () => void;
  
  // Selection & Bulk
  enableSelection?: boolean;
  selectedIds?: string[];
  onSelectionChange?: (selectedIds: string[]) => void;
  bulkActions?: BulkActionItem[];
  onBulkDelete?: (selectedIds: string[]) => void;
  onBulkExport?: (selectedIds: string[]) => void;

  // Pagination
  currentPage?: number;
  totalPages?: number;
  pageSize?: number;
  totalRecords?: number;
  onPageChange?: (page: number) => void;

  // Sorting
  sortColumn?: string;
  sortDirection?: 'asc' | 'desc';
  onSortChange?: (column: string, direction: 'asc' | 'desc') => void;

  // Empty State Customization
  emptyTitle?: string;
  emptyDescription?: string;
  emptyActionLabel?: string;
  onEmptyAction?: () => void;

  className?: string;
}

export function DataTable<T>({
  data,
  columns,
  keyExtractor,
  isLoading = false,
  isError = false,
  errorMessage,
  onRetry,
  enableSelection = false,
  selectedIds = [],
  onSelectionChange,
  bulkActions,
  onBulkDelete,
  onBulkExport,
  currentPage = 1,
  totalPages = 1,
  pageSize = 15,
  totalRecords,
  onPageChange,
  sortColumn,
  sortDirection = 'asc',
  onSortChange,
  emptyTitle = 'No records found',
  emptyDescription = 'There are no items to display matching your criteria.',
  emptyActionLabel,
  onEmptyAction,
  className,
}: DataTableProps<T>) {
  const allVisibleIds = useMemo(() => data.map(keyExtractor), [data, keyExtractor]);
  const isAllSelected = allVisibleIds.length > 0 && allVisibleIds.every((id) => selectedIds.includes(id));
  const isSomeSelected = allVisibleIds.some((id) => selectedIds.includes(id)) && !isAllSelected;

  const toggleSelectAll = () => {
    if (!onSelectionChange) return;
    if (isAllSelected) {
      onSelectionChange(selectedIds.filter((id) => !allVisibleIds.includes(id)));
    } else {
      const merged = Array.from(new Set([...selectedIds, ...allVisibleIds]));
      onSelectionChange(merged);
    }
  };

  const toggleSelectRow = (id: string) => {
    if (!onSelectionChange) return;
    if (selectedIds.includes(id)) {
      onSelectionChange(selectedIds.filter((item) => item !== id));
    } else {
      onSelectionChange([...selectedIds, id]);
    }
  };

  const handleSort = (colId: string, sortable?: boolean) => {
    if (!sortable || !onSortChange) return;
    if (sortColumn === colId) {
      onSortChange(colId, sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      onSortChange(colId, 'asc');
    }
  };

  if (isLoading) {
    return (
      <div className={className}>
        <TableSkeleton rows={pageSize > 10 ? 8 : pageSize} columns={columns.length} />
      </div>
    );
  }

  if (isError) {
    return (
      <div className={className}>
        <ErrorState
          title="Failed to load table records"
          message={errorMessage || 'An error occurred while communicating with the database.'}
          onRetry={onRetry}
        />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className={className}>
        <EmptyState
          title={emptyTitle}
          description={emptyDescription}
          actionLabel={emptyActionLabel}
          onAction={onEmptyAction}
        />
      </div>
    );
  }

  return (
    <div className={cn('space-y-3', className)}>
      {/* Floating/Inline Bulk Action Bar */}
      {enableSelection && selectedIds.length > 0 && (
        <BulkActionBar
          selectedIds={selectedIds}
          totalCount={totalRecords || data.length}
          onSelectAll={
            totalRecords && selectedIds.length < totalRecords
              ? () => onSelectionChange?.(allVisibleIds)
              : undefined
          }
          onClearSelection={() => onSelectionChange?.([])}
          actions={bulkActions}
          onBulkDelete={onBulkDelete}
          onBulkExport={onBulkExport}
        />
      )}

      {/* Main Table Container */}
      <div className="w-full border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-slate-900 shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            {/* Table Header */}
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-[11px] select-none">
                {enableSelection && (
                  <th className="p-3 sm:p-3.5 w-10 text-center">
                    <button
                      type="button"
                      onClick={toggleSelectAll}
                      className="text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                      title={isAllSelected ? 'Deselect all visible' : 'Select all visible'}
                    >
                      {isAllSelected ? (
                        <CheckSquare className="w-4 h-4 text-cyan-500" />
                      ) : isSomeSelected ? (
                        <div className="w-4 h-4 rounded bg-cyan-500 flex items-center justify-center text-white text-[10px]">
                          -
                        </div>
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                  </th>
                )}

                {columns.map((col) => {
                  const isSorted = sortColumn === col.id;
                  return (
                    <th
                      key={col.id}
                      onClick={() => handleSort(col.id, col.sortable)}
                      className={cn(
                        'p-3 sm:p-3.5 font-bold',
                        col.sortable && 'cursor-pointer hover:text-slate-900 dark:hover:text-white transition-colors',
                        col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-right' : 'text-left',
                        col.hideOnMobile && 'hidden md:table-cell',
                        col.className
                      )}
                    >
                      <div
                        className={cn(
                          'inline-flex items-center gap-1.5',
                          col.align === 'right' && 'justify-end',
                          col.align === 'center' && 'justify-center'
                        )}
                      >
                        <span>{col.header}</span>
                        {col.sortable && (
                          <span className="text-slate-400">
                            {isSorted ? (
                              sortDirection === 'asc' ? (
                                <ChevronUp className="w-3.5 h-3.5 text-cyan-500" />
                              ) : (
                                <ChevronDown className="w-3.5 h-3.5 text-cyan-500" />
                              )
                            ) : (
                              <ChevronsUpDown className="w-3.5 h-3.5 opacity-40" />
                            )}
                          </span>
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>

            {/* Table Body */}
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {data.map((row, index) => {
                const id = keyExtractor(row);
                const isSelected = selectedIds.includes(id);

                return (
                  <tr
                    key={id}
                    className={cn(
                      'transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/40 group',
                      isSelected && 'bg-cyan-50/40 dark:bg-cyan-950/20'
                    )}
                  >
                    {enableSelection && (
                      <td className="p-3 sm:p-3.5 text-center">
                        <button
                          type="button"
                          onClick={() => toggleSelectRow(id)}
                          className="text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-cyan-500" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </td>
                    )}

                    {columns.map((col) => {
                      const value = col.cell
                        ? col.cell(row, index)
                        : col.accessorKey
                        ? (row[col.accessorKey] as any)
                        : null;

                      return (
                        <td
                          key={col.id}
                          className={cn(
                            'p-3 sm:p-3.5 align-middle',
                            col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-right' : 'text-left',
                            col.hideOnMobile && 'hidden md:table-cell',
                            col.className
                          )}
                        >
                          {value}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {totalPages > 1 && onPageChange && (
          <div className="p-3 sm:p-4 bg-slate-50 dark:bg-slate-950/40 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
            <div>
              Showing{' '}
              <span className="font-mono font-bold text-slate-800 dark:text-slate-200 tabular-nums">
                {(currentPage - 1) * pageSize + 1}
              </span>{' '}
              to{' '}
              <span className="font-mono font-bold text-slate-800 dark:text-slate-200 tabular-nums">
                {Math.min(currentPage * pageSize, totalRecords || data.length)}
              </span>
              {totalRecords && (
                <>
                  {' '}
                  of{' '}
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200 tabular-nums">
                    {totalRecords}
                  </span>{' '}
                  records
                </>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onPageChange(currentPage - 1)}
                disabled={currentPage <= 1}
                className="h-8 px-2.5 rounded-xl border-slate-200 dark:border-slate-700 text-xs font-bold cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5 mr-1" />
                Previous
              </Button>

              <div className="px-2 font-mono font-bold text-slate-800 dark:text-slate-200 tabular-nums">
                Page {currentPage} of {totalPages}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => onPageChange(currentPage + 1)}
                disabled={currentPage >= totalPages}
                className="h-8 px-2.5 rounded-xl border-slate-200 dark:border-slate-700 text-xs font-bold cursor-pointer"
              >
                Next
                <ChevronRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
