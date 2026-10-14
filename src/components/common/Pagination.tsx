import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { REPAIRS_PER_PAGE } from '@/lib/pagination';

interface PaginationProps {
  currentPage: number;
  totalItems: number;
  pageSize?: number;
  onPageChange: (page: number) => void;
  className?: string;
  itemLabel?: string;
  itemsLabel?: string;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalItems,
  pageSize = REPAIRS_PER_PAGE,
  onPageChange,
  className,
  itemLabel = 'repair',
  itemsLabel = 'repairs'
}) => {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  if (totalItems <= 0) return null;

  const startItem = (safeCurrentPage - 1) * pageSize + 1;
  const endItem = Math.min(safeCurrentPage * pageSize, totalItems);

  // Generate page numbers with smart ellipsis
  const getPageNumbers = (): (number | 'ellipsis')[] => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const pages: (number | 'ellipsis')[] = [];
    const showLeftEllipsis = safeCurrentPage > 3;
    const showRightEllipsis = safeCurrentPage < totalPages - 2;

    pages.push(1);

    if (showLeftEllipsis) {
      pages.push('ellipsis');
    }

    const start = Math.max(2, safeCurrentPage - 1);
    const end = Math.min(totalPages - 1, safeCurrentPage + 1);

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    if (showRightEllipsis) {
      pages.push('ellipsis');
    }

    pages.push(totalPages);
    return pages;
  };

  const pages = getPageNumbers();

  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row items-center justify-between gap-3 px-3 sm:px-4 py-3 bg-white/90 dark:bg-slate-900/90 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs transition-colors",
        className
      )}
      aria-label="Pagination Navigation"
    >
      {/* Information text */}
      <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 text-center sm:text-left select-none">
        Showing <span className="font-extrabold text-slate-900 dark:text-slate-100">{startItem}</span> to{' '}
        <span className="font-extrabold text-slate-900 dark:text-slate-100">{endItem}</span> of{' '}
        <span className="font-extrabold text-slate-900 dark:text-slate-100">{totalItems}</span>{' '}
        {totalItems === 1 ? itemLabel : itemsLabel}
        {pageSize !== REPAIRS_PER_PAGE && (
          <span className="ml-1 text-[11px] text-slate-400 font-normal">({pageSize}/page)</span>
        )}
      </div>

      {/* Pagination Controls */}
      <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap justify-center">
        {/* First Page */}
        <Button
          variant="outline"
          size="icon"
          onClick={() => onPageChange(1)}
          disabled={safeCurrentPage <= 1}
          aria-label="Go to first page"
          className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronsLeft className="h-4 w-4" />
        </Button>

        {/* Previous Page */}
        <Button
          variant="outline"
          size="icon"
          onClick={() => onPageChange(safeCurrentPage - 1)}
          disabled={safeCurrentPage <= 1}
          aria-label="Go to previous page"
          className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        {/* Numeric Page Buttons */}
        <div className="flex items-center gap-1">
          {pages.map((p, idx) => {
            if (p === 'ellipsis') {
              return (
                <span
                  key={`ellipsis-${idx}`}
                  className="px-1 text-slate-400 dark:text-slate-600 text-xs select-none"
                >
                  •••
                </span>
              );
            }

            const isCurrent = p === safeCurrentPage;
            return (
              <Button
                key={`page-${p}`}
                variant={isCurrent ? "default" : "outline"}
                size="sm"
                onClick={() => onPageChange(p)}
                aria-label={`Go to page ${p}`}
                aria-current={isCurrent ? "page" : undefined}
                className={cn(
                  "h-8 min-w-[32px] sm:h-9 sm:min-w-[36px] px-2 sm:px-3 text-xs font-black rounded-xl cursor-pointer transition-all",
                  isCurrent
                    ? "bg-slate-950 text-white dark:bg-white dark:text-slate-950 shadow-sm"
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
          variant="outline"
          size="icon"
          onClick={() => onPageChange(safeCurrentPage + 1)}
          disabled={safeCurrentPage >= totalPages}
          aria-label="Go to next page"
          className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>

        {/* Last Page */}
        <Button
          variant="outline"
          size="icon"
          onClick={() => onPageChange(totalPages)}
          disabled={safeCurrentPage >= totalPages}
          aria-label="Go to last page"
          className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronsRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export default Pagination;
