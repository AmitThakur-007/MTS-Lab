import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { REPAIRS_PER_PAGE } from '@/lib/pagination';

export interface RepairPaginationProps {
  currentPage: number;
  totalRecords: number;
  pageSize?: number;
  onPageChange: (newPage: number) => void;
  className?: string;
  itemName?: string;
}

export const RepairPagination: React.FC<RepairPaginationProps> = ({
  currentPage,
  totalRecords,
  pageSize = REPAIRS_PER_PAGE,
  onPageChange,
  className,
  itemName = 'repairs'
}) => {
  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  if (totalRecords <= 0) {
    return null;
  }

  const startRecord = (safeCurrentPage - 1) * pageSize + 1;
  const endRecord = Math.min(safeCurrentPage * pageSize, totalRecords);

  // Generate page numbers with smart ellipsis window
  const getPageNumbers = () => {
    const delta = 1; // Number of pages to show around current page
    const pages: (number | 'ellipsis-left' | 'ellipsis-right')[] = [];

    const rangeStart = Math.max(2, safeCurrentPage - delta);
    const rangeEnd = Math.min(totalPages - 1, safeCurrentPage + delta);

    pages.push(1);

    if (rangeStart > 2) {
      pages.push('ellipsis-left');
    }

    for (let i = rangeStart; i <= rangeEnd; i++) {
      pages.push(i);
    }

    if (rangeEnd < totalPages - 1) {
      pages.push('ellipsis-right');
    }

    if (totalPages > 1) {
      pages.push(totalPages);
    }

    return pages;
  };

  const pages = getPageNumbers();

  return (
    <nav
      role="navigation"
      aria-label="Repair records pagination"
      className={cn(
        "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 sm:p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-2xs transition-colors",
        className
      )}
    >
      {/* Records Count Summary */}
      <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-400">
        <span>
          Showing <span className="font-extrabold text-slate-900 dark:text-slate-100">{startRecord.toLocaleString()}</span> to{' '}
          <span className="font-extrabold text-slate-900 dark:text-slate-100">{endRecord.toLocaleString()}</span> of{' '}
          <span className="font-extrabold text-slate-900 dark:text-slate-100">{totalRecords.toLocaleString()}</span> {itemName}
        </span>
        <span className="hidden md:inline text-slate-300 dark:text-slate-700">•</span>
        <span className="hidden md:inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
          {pageSize} per page
        </span>
      </div>

      {/* Navigation Controls */}
      <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap justify-center">
        {/* First Page */}
        <Button
          type="button"
          variant="outline"
          size="icon"
          disabled={safeCurrentPage <= 1}
          onClick={() => onPageChange(1)}
          className="h-8 w-8 rounded-xl border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
          aria-label="Go to first page"
          title="First page"
        >
          <ChevronsLeft className="h-4 w-4" />
        </Button>

        {/* Previous Page */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={safeCurrentPage <= 1}
          onClick={() => onPageChange(safeCurrentPage - 1)}
          className="h-8 px-2.5 rounded-xl border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
          aria-label="Go to previous page"
        >
          <ChevronLeft className="h-3.5 w-3.5 mr-1" />
          <span className="hidden xs:inline">Prev</span>
        </Button>

        {/* Numeric Page Buttons */}
        <div className="flex items-center gap-1">
          {pages.map((p, idx) => {
            if (p === 'ellipsis-left' || p === 'ellipsis-right') {
              return (
                <span
                  key={`ellipsis-${idx}`}
                  className="px-1.5 text-xs text-slate-400 select-none"
                  aria-hidden="true"
                >
                  •••
                </span>
              );
            }

            const isActive = p === safeCurrentPage;
            return (
              <Button
                key={`page-${p}`}
                type="button"
                variant={isActive ? "default" : "outline"}
                size="icon"
                onClick={() => onPageChange(p)}
                aria-current={isActive ? "page" : undefined}
                aria-label={`Page ${p}`}
                className={cn(
                  "h-8 w-8 rounded-xl text-xs font-bold transition-all cursor-pointer",
                  isActive
                    ? "bg-slate-950 dark:bg-slate-100 text-white dark:text-slate-950 font-black shadow-xs hover:bg-slate-900 dark:hover:bg-white"
                    : "border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                )}
              >
                {p}
              </Button>
            );
          })}
        </div>

        {/* Next Page */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={safeCurrentPage >= totalPages}
          onClick={() => onPageChange(safeCurrentPage + 1)}
          className="h-8 px-2.5 rounded-xl border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
          aria-label="Go to next page"
        >
          <span className="hidden xs:inline">Next</span>
          <ChevronRight className="h-3.5 w-3.5 ml-1" />
        </Button>

        {/* Last Page */}
        <Button
          type="button"
          variant="outline"
          size="icon"
          disabled={safeCurrentPage >= totalPages}
          onClick={() => onPageChange(totalPages)}
          className="h-8 w-8 rounded-xl border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
          aria-label="Go to last page"
          title="Last page"
        >
          <ChevronsRight className="h-4 w-4" />
        </Button>
      </div>
    </nav>
  );
};

export default RepairPagination;
