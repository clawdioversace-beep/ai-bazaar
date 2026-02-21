import type { Metadata } from 'next';
import { AskSearch } from '@/components/ask-search';

export const metadata: Metadata = {
  title: 'What Should I Build With? | AI Bazaar',
  description:
    'Ask a question in plain English and get personalized AI tool recommendations from 3,000+ curated tools across AI agents, MCP servers, DeFi, and Web3.',
};

export default function AskPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-4xl">
          What should I build with?
        </h1>
        <p className="mt-3 text-lg leading-relaxed text-zinc-600 dark:text-zinc-400">
          Describe your project and get curated tool recommendations from our catalog
        </p>
      </div>
      <AskSearch />
    </div>
  );
}
