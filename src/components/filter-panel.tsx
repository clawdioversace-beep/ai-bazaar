'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useState } from 'react';

export interface FilterPanelProps {
  categories: Array<{
    category: string;
    count: number;
    label: string;
  }>;
  chains: string[];
  runtimes: string[];
}

/**
 * FilterPanel component — interactive filter controls for browse page.
 *
 * Client Component ('use client') that updates URL searchParams on filter changes.
 * All filter state lives in the URL — no client-side state for filter values.
 *
 * Supports:
 * - Category dropdown (with counts)
 * - Chain dropdown
 * - Runtime dropdown
 * - Protocol dropdown (All/MCP/ACP)
 * - Sort toggle (Popular/Recent)
 * - Clear all button
 *
 * Mobile: collapsible panel. Desktop: horizontal layout.
 */
export function FilterPanel({ categories, chains, runtimes }: FilterPanelProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isOpen, setIsOpen] = useState(true);

  // Read current filter values from URL
  const currentCategory = searchParams.get('category') || '';
  const currentChain = searchParams.get('chain') || '';
  const currentRuntime = searchParams.get('runtime') || '';
  const currentProtocol = searchParams.get('protocol') || '';
  const currentSort = searchParams.get('sort') || 'popular';

  /**
   * Update a single filter parameter and navigate to the new URL.
   * Resets page to 1 when filters change.
   */
  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());

    if (value === '' || value === 'all') {
      params.delete(key);
    } else {
      params.set(key, value);
    }

    // Reset to page 1 when filters change
    params.delete('page');

    router.push(`${pathname}?${params.toString()}`);
  };

  /**
   * Clear all filters and navigate to base /tools page.
   */
  const clearAll = () => {
    router.push(pathname);
  };

  // Check if any filters are active
  const hasActiveFilters =
    currentCategory || currentChain || currentRuntime || currentProtocol || currentSort !== 'popular';

  return (
    <div className="mb-6 rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      {/* Mobile toggle button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between p-4 text-sm font-medium text-zinc-900 dark:text-zinc-50 md:hidden"
      >
        <span>Filters</span>
        <svg
          className={`h-5 w-5 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Filter controls */}
      <div
        className={`${
          isOpen ? 'block' : 'hidden'
        } space-y-4 p-4 md:flex md:flex-wrap md:items-center md:gap-4 md:space-y-0`}
      >
        {/* Category filter */}
        <div className="flex flex-col gap-1 md:flex-row md:items-center md:gap-2">
          <label
            htmlFor="category-filter"
            className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Category
          </label>
          <select
            id="category-filter"
            value={currentCategory}
            onChange={(e) => updateFilter('category', e.target.value)}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
          >
            <option value="">All Categories</option>
            {categories.map(({ category, label, count }) => (
              <option key={category} value={category}>
                {label} ({count})
              </option>
            ))}
          </select>
        </div>

        {/* Chain filter */}
        <div className="flex flex-col gap-1 md:flex-row md:items-center md:gap-2">
          <label
            htmlFor="chain-filter"
            className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Chain
          </label>
          <select
            id="chain-filter"
            value={currentChain}
            onChange={(e) => updateFilter('chain', e.target.value)}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
          >
            <option value="">All Chains</option>
            {chains.map((chain) => (
              <option key={chain} value={chain}>
                {chain.charAt(0).toUpperCase() + chain.slice(1)}
              </option>
            ))}
          </select>
        </div>

        {/* Runtime filter */}
        <div className="flex flex-col gap-1 md:flex-row md:items-center md:gap-2">
          <label
            htmlFor="runtime-filter"
            className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Runtime
          </label>
          <select
            id="runtime-filter"
            value={currentRuntime}
            onChange={(e) => updateFilter('runtime', e.target.value)}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
          >
            <option value="">All Runtimes</option>
            {runtimes.map((runtime) => (
              <option key={runtime} value={runtime}>
                {runtime.charAt(0).toUpperCase() + runtime.slice(1)}
              </option>
            ))}
          </select>
        </div>

        {/* Protocol filter */}
        <div className="flex flex-col gap-1 md:flex-row md:items-center md:gap-2">
          <label
            htmlFor="protocol-filter"
            className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Protocol
          </label>
          <select
            id="protocol-filter"
            value={currentProtocol}
            onChange={(e) => updateFilter('protocol', e.target.value)}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
          >
            <option value="">All Protocols</option>
            <option value="mcp">MCP Compatible</option>
            <option value="acp">ACP Compatible</option>
          </select>
        </div>

        {/* Sort toggle */}
        <div className="flex flex-col gap-1 md:flex-row md:items-center md:gap-2">
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Sort by</span>
          <div className="flex gap-1 rounded-lg border border-zinc-200 p-1 dark:border-zinc-700">
            <button
              onClick={() => updateFilter('sort', 'popular')}
              className={`rounded px-3 py-1 text-sm font-medium transition-colors ${
                currentSort === 'popular'
                  ? 'bg-blue-600 text-white'
                  : 'text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800'
              }`}
            >
              Popular
            </button>
            <button
              onClick={() => updateFilter('sort', 'recent')}
              className={`rounded px-3 py-1 text-sm font-medium transition-colors ${
                currentSort === 'recent'
                  ? 'bg-blue-600 text-white'
                  : 'text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800'
              }`}
            >
              Recent
            </button>
          </div>
        </div>

        {/* Clear all button */}
        {hasActiveFilters && (
          <button
            onClick={clearAll}
            className="text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 md:ml-auto"
          >
            Clear all
          </button>
        )}
      </div>
    </div>
  );
}
