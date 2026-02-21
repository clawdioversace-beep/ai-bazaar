import type { Metadata } from 'next';
import { AskSearch } from '@/components/ask-search';

export const metadata: Metadata = {
  title: 'Ask AI Bazaar — Find the Right Tools',
  description:
    'Ask a question in plain English and get personalized AI tool recommendations. Powered by 3,000+ tools across AI agents, MCP servers, DeFi, and Web3.',
};

export default function AskPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50 sm:text-4xl">
          Ask AI Bazaar
        </h1>
        <p className="mt-3 text-lg text-zinc-600 dark:text-zinc-400">
          Describe what you&apos;re building and get personalized tool recommendations
        </p>
      </div>
      <AskSearch />
    </div>
  );
}
