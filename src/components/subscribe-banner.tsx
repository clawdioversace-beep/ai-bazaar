'use client';

import { useEffect, useState } from 'react';
import { SubscribeForm } from './subscribe-form';

const COOKIE_NAME = 'ai_bazaar_banner_dismissed';
const DISMISS_DAYS = 7;

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function setCookie(name: string, value: string, days: number) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/`;
}

export function SubscribeBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (getCookie(COOKIE_NAME)) return;

    const onScroll = () => {
      const scrollPercent = window.scrollY / (document.documentElement.scrollHeight - window.innerHeight);
      if (scrollPercent > 0.5) {
        setVisible(true);
        window.removeEventListener('scroll', onScroll);
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    setVisible(false);
    setCookie(COOKIE_NAME, '1', DISMISS_DAYS);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-zinc-200 bg-white/95 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-900/95">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex flex-1 items-center gap-4">
          <p className="hidden text-sm font-medium text-zinc-900 dark:text-zinc-50 sm:block">
            Get the top 5 new AI tools delivered weekly
          </p>
          <SubscribeForm source="banner" compact />
        </div>
        <button
          onClick={dismiss}
          className="flex-shrink-0 rounded p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
          aria-label="Dismiss"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
