'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import Link from 'next/link';

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
}

/**
 * Pagination component — page navigation for browse results.
 *
 * Client Component that generates page URLs preserving current filter state.
 * Uses Link for prefetching. Hides if totalPages <= 1.
 *
 * Shows: Previous, page numbers (with ellipsis for gaps), Next.
 * Page number display: first, last, current, and 1-2 neighbors.
 */
export function Pagination({ currentPage, totalPages }: PaginationProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Hide pagination if only one page
  if (totalPages <= 1) {
    return null;
  }

  /**
   * Create a URL for a specific page number, preserving all other params.
   */
  const createPageURL = (pageNumber: number): string => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', pageNumber.toString());
    return `${pathname}?${params.toString()}`;
  };

  /**
   * Generate array of page numbers to display.
   * Shows: 1, ..., current-1, current, current+1, ..., last
   */
  const getPageNumbers = (): (number | 'ellipsis')[] => {
    const pages: (number | 'ellipsis')[] = [];

    if (totalPages <= 7) {
      // Show all pages if 7 or fewer
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(1);

      // Show ellipsis if there's a gap between 1 and current-1
      if (currentPage > 3) {
        pages.push('ellipsis');
      }

      // Show current page and neighbors
      for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
        pages.push(i);
      }

      // Show ellipsis if there's a gap between current+1 and last
      if (currentPage < totalPages - 2) {
        pages.push('ellipsis');
      }

      // Always show last page
      pages.push(totalPages);
    }

    return pages;
  };

  const pageNumbers = getPageNumbers();

  return (
    <nav className="flex items-center justify-center gap-2" aria-label="Pagination">
      {/* Previous button */}
      {currentPage > 1 ? (
        <Link
          href={createPageURL(currentPage - 1)}
          className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50 dark:hover:bg-zinc-800"
        >
          Previous
        </Link>
      ) : (
        <span className="rounded-lg border border-zinc-200 bg-zinc-100 px-3 py-2 text-sm font-medium text-zinc-400 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-600">
          Previous
        </span>
      )}

      {/* Page numbers */}
      <div className="flex gap-1">
        {pageNumbers.map((page, index) => {
          if (page === 'ellipsis') {
            return (
              <span
                key={`ellipsis-${index}`}
                className="flex h-10 w-10 items-center justify-center text-zinc-600 dark:text-zinc-400"
              >
                ...
              </span>
            );
          }

          const isCurrentPage = page === currentPage;

          return (
            <Link
              key={page}
              href={createPageURL(page)}
              className={`flex h-10 w-10 items-center justify-center rounded-lg text-sm font-medium transition-colors ${
                isCurrentPage
                  ? 'bg-blue-600 text-white'
                  : 'border border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50 dark:hover:bg-zinc-800'
              }`}
              aria-current={isCurrentPage ? 'page' : undefined}
            >
              {page}
            </Link>
          );
        })}
      </div>

      {/* Next button */}
      {currentPage < totalPages ? (
        <Link
          href={createPageURL(currentPage + 1)}
          className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50 dark:hover:bg-zinc-800"
        >
          Next
        </Link>
      ) : (
        <span className="rounded-lg border border-zinc-200 bg-zinc-100 px-3 py-2 text-sm font-medium text-zinc-400 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-600">
          Next
        </span>
      )}
    </nav>
  );
}
