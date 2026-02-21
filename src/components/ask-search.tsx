'use client';

import { useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { CATEGORY_LABELS } from '@/lib/categories';
import type { Category } from '@/lib/categories';

interface ToolResult {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  category: string;
  stars: number | null;
  downloads: number | null;
  sourceUrl: string;
  hypeScore: number | null;
}

const EXAMPLE_QUERIES = [
  'What tools do I need to build an AI agent?',
  'I want to build an MCP server for my team',
  'Best stack for a DeFi trading bot on Solana',
  'How do I add AI to my Next.js app?',
];

/**
 * AskSearch — Client Component for natural language search.
 *
 * Single-turn Q&A: user types a question, gets a streamed AI response
 * with tool cards below. Not a chat — each query is independent.
 */
export function AskSearch() {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [streamedText, setStreamedText] = useState('');
  const [tools, setTools] = useState<ToolResult[]>([]);
  const [error, setError] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const handleSearch = useCallback(async (searchQuery?: string) => {
    const q = (searchQuery ?? query).trim();
    if (!q || q.length < 3) return;

    // Abort previous request if any
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoading(true);
    setStreamedText('');
    setTools([]);
    setError('');
    setHasSearched(true);

    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || `Request failed (${res.status})`);
        setIsLoading(false);
        return;
      }

      // Check for fallback (no Groq key) response
      const contentType = res.headers.get('content-type') ?? '';
      if (contentType.includes('application/json')) {
        const data = await res.json();
        if (data.fallback) {
          setTools(data.listings ?? []);
          setStreamedText(
            data.listings?.length
              ? 'Here are the most relevant tools based on your search:'
              : 'No matching tools found. Try rephrasing your query.'
          );
          setIsLoading(false);
          return;
        }
      }

      // Extract tool data from header
      const listingsHeader = res.headers.get('X-Listings');
      if (listingsHeader) {
        try {
          const parsed = JSON.parse(decodeURIComponent(listingsHeader));
          setTools(parsed);
        } catch {
          // Header parsing failed — tools will be empty
        }
      }

      // Stream the plain text response
      const reader = res.body?.getReader();
      if (!reader) {
        setError('Failed to read response stream');
        setIsLoading(false);
        return;
      }

      const decoder = new TextDecoder();
      let fullText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        fullText += chunk;
        setStreamedText(fullText);
      }

      setIsLoading(false);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setError('Something went wrong. Please try again.');
      setIsLoading(false);
    }
  }, [query]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSearch();
  };

  const handleExampleClick = (example: string) => {
    setQuery(example);
    handleSearch(example);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Search input */}
      <form onSubmit={handleSubmit} className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="What are you building? e.g. 'AI agent that trades on Solana'"
          maxLength={500}
          className="w-full rounded-xl border border-zinc-300 bg-white px-5 py-4 pr-24 text-base shadow-sm placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-200 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:placeholder:text-zinc-500 dark:focus:ring-zinc-700"
        />
        <button
          type="submit"
          disabled={isLoading || query.trim().length < 3}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-indigo-500 dark:hover:bg-indigo-400"
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Thinking
            </span>
          ) : (
            'Ask'
          )}
        </button>
      </form>

      {/* Example queries — shown before first search */}
      {!hasSearched && (
        <div className="flex flex-col gap-3">
          <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
            Try asking:
          </p>
          <div className="flex flex-wrap gap-2">
            {EXAMPLE_QUERIES.map((example) => (
              <button
                key={example}
                onClick={() => handleExampleClick(example)}
                className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-left text-sm text-zinc-700 transition-colors hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-zinc-500 dark:hover:bg-zinc-800"
              >
                {example}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Streamed response */}
      {streamedText && (
        <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="prose prose-zinc max-w-none text-sm dark:prose-invert">
            <MarkdownRenderer text={streamedText} />
          </div>
          {isLoading && (
            <span className="mt-2 inline-block h-4 w-1 animate-pulse bg-zinc-400" />
          )}
        </div>
      )}

      {/* Tool cards */}
      {tools.length > 0 && (
        <div className="flex flex-col gap-4">
          <h3 className="text-sm font-semibold text-zinc-500 uppercase tracking-wide dark:text-zinc-400">
            Recommended Tools
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {tools.map((tool) => (
              <ToolCard key={tool.id} tool={tool} />
            ))}
          </div>
        </div>
      )}

      {/* No results */}
      {hasSearched && !isLoading && !streamedText && !error && tools.length === 0 && (
        <p className="text-center text-sm text-zinc-500 dark:text-zinc-400">
          No matching tools found. Try rephrasing your query.
        </p>
      )}
    </div>
  );
}

/** Minimal markdown renderer for bold text and line breaks */
function MarkdownRenderer({ text }: { text: string }) {
  // Split by paragraphs (double newline)
  const paragraphs = text.split(/\n\n+/);

  return (
    <>
      {paragraphs.map((p, i) => {
        // Handle bullet points
        const lines = p.split('\n');
        const isList = lines.every(l => l.startsWith('- ') || l.startsWith('* ') || l.trim() === '');

        if (isList && lines.some(l => l.startsWith('- ') || l.startsWith('* '))) {
          return (
            <ul key={i} className="list-disc pl-5 space-y-1">
              {lines.filter(l => l.startsWith('- ') || l.startsWith('* ')).map((l, j) => (
                <li key={j}>
                  <InlineMarkdown text={l.slice(2)} />
                </li>
              ))}
            </ul>
          );
        }

        // Handle headings
        if (p.startsWith('### ')) {
          return <h4 key={i} className="font-semibold mt-3"><InlineMarkdown text={p.slice(4)} /></h4>;
        }
        if (p.startsWith('## ')) {
          return <h3 key={i} className="font-semibold mt-3"><InlineMarkdown text={p.slice(3)} /></h3>;
        }

        return (
          <p key={i}>
            <InlineMarkdown text={p} />
          </p>
        );
      })}
    </>
  );
}

/** Render inline markdown: **bold** */
function InlineMarkdown({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={i}>{part.slice(2, -2)}</strong>;
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

/** Compact tool card for search results */
function ToolCard({ tool }: { tool: ToolResult }) {
  const categoryLabel = CATEGORY_LABELS[tool.category as Category] ?? tool.category;

  return (
    <Link
      href={`/tools/${tool.slug}`}
      className="flex flex-col gap-2 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm transition-all duration-200 hover:shadow-md hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-semibold text-zinc-900 dark:text-zinc-50">
          {tool.name}
        </span>
        {tool.hypeScore !== null && tool.hypeScore > 70 && (
          <span className="shrink-0 rounded-full bg-orange-100 px-1.5 py-0.5 text-xs font-semibold text-orange-700 dark:bg-orange-900/30 dark:text-orange-300">
            <svg className="inline h-3 w-3 mr-0.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 23c-3.5 0-7-2.5-7-7 0-3.5 2-6 4-8 .5-.5 1.5 0 1.5.5 0 2 1 3 2.5 4.5 .5-1.5 1-3 1-5 0-.5.5-1 1-.5 2 1.5 4 4 4 7.5 0 4.5-3.5 8-7 8z"/>
            </svg>
            {tool.hypeScore}
          </span>
        )}
      </div>
      <p className="text-sm text-zinc-600 dark:text-zinc-400 line-clamp-2">
        {tool.tagline}
      </p>
      <div className="flex items-center gap-2 text-xs text-zinc-500">
        <span className="rounded-full bg-zinc-100 px-2 py-0.5 font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
          {categoryLabel}
        </span>
        {tool.stars !== null && tool.stars > 0 && (
          <span>{tool.stars.toLocaleString()} stars</span>
        )}
      </div>
    </Link>
  );
}
