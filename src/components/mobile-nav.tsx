'use client';

import { useState } from 'react';
import Link from 'next/link';

export function MobileNav() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="sm:hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-center rounded-lg p-2 text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
        aria-label="Toggle menu"
      >
        {isOpen ? (
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        )}
      </button>
      {isOpen && (
        <div className="absolute left-0 right-0 top-16 z-50 border-b border-zinc-200 bg-white px-4 py-4 dark:border-zinc-800 dark:bg-zinc-900">
          <nav className="flex flex-col gap-3">
            <Link
              href="/"
              onClick={() => setIsOpen(false)}
              className="text-sm font-medium text-zinc-600 hover:text-indigo-600 dark:text-zinc-400 dark:hover:text-indigo-400"
            >
              Home
            </Link>
            <Link
              href="/ask"
              onClick={() => setIsOpen(false)}
              className="text-sm font-medium text-zinc-600 hover:text-indigo-600 dark:text-zinc-400 dark:hover:text-indigo-400"
            >
              Ask AI
            </Link>
            <Link
              href="/tools"
              onClick={() => setIsOpen(false)}
              className="text-sm font-medium text-zinc-600 hover:text-indigo-600 dark:text-zinc-400 dark:hover:text-indigo-400"
            >
              Explore
            </Link>
            <Link
              href="/packs"
              onClick={() => setIsOpen(false)}
              className="text-sm font-medium text-zinc-600 hover:text-indigo-600 dark:text-zinc-400 dark:hover:text-indigo-400"
            >
              Packs
            </Link>
            <Link
              href="/reads"
              onClick={() => setIsOpen(false)}
              className="text-sm font-medium text-zinc-600 hover:text-indigo-600 dark:text-zinc-400 dark:hover:text-indigo-400"
            >
              Learn
            </Link>
            <Link
              href="/submit"
              onClick={() => setIsOpen(false)}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-center text-sm font-medium text-white hover:bg-indigo-700"
            >
              Share a Tool
            </Link>
          </nav>
        </div>
      )}
    </div>
  );
}
