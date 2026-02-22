'use client';

import Link from 'next/link';
import { SubscribeForm } from './subscribe-form';

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
          {/* Brand column */}
          <div>
            <span className="text-lg font-bold text-zinc-900 dark:text-zinc-50">AI Bazaar</span>
            <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              Where builders discover what&apos;s worth using.
            </p>
          </div>
          {/* Quick links */}
          <div>
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Explore</h3>
            <nav className="mt-3 flex flex-col gap-2">
              <Link href="/" className="text-sm text-zinc-600 hover:text-indigo-600 dark:text-zinc-400 dark:hover:text-indigo-400">Home</Link>
              <Link href="/tools" className="text-sm text-zinc-600 hover:text-indigo-600 dark:text-zinc-400 dark:hover:text-indigo-400">Explore Tools</Link>
              <Link href="/packs" className="text-sm text-zinc-600 hover:text-indigo-600 dark:text-zinc-400 dark:hover:text-indigo-400">Starter Packs</Link>
              <Link href="/reads" className="text-sm text-zinc-600 hover:text-indigo-600 dark:text-zinc-400 dark:hover:text-indigo-400">Learn</Link>
              <Link href="/guides" className="text-sm text-zinc-600 hover:text-indigo-600 dark:text-zinc-400 dark:hover:text-indigo-400">Guides</Link>
              <Link href="/submit" className="text-sm text-zinc-600 hover:text-indigo-600 dark:text-zinc-400 dark:hover:text-indigo-400">Share a Tool</Link>
              <Link href="/ask" className="text-sm text-zinc-600 hover:text-indigo-600 dark:text-zinc-400 dark:hover:text-indigo-400">Ask AI</Link>
            </nav>
          </div>
          {/* Newsletter */}
          <div>
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Stay in the loop</h3>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">Top 5 AI tools weekly.</p>
            <div className="mt-3">
              <SubscribeForm source="footer" compact />
            </div>
          </div>
        </div>
        <div className="mt-8 border-t border-zinc-200 pt-6 text-center dark:border-zinc-800">
          <p className="text-sm text-zinc-500">AI Bazaar {currentYear}</p>
        </div>
      </div>
    </footer>
  );
}
