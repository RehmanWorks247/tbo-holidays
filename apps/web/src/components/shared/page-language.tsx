'use client';

import { useEffect } from 'react';

import { usePageMessages } from '@/providers/use-page-messages';

export function PageLanguage() {
  const {
    messages: { app },
  } = usePageMessages();
  useEffect(() => {
    document.title = app.pageTitle;
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute('content', app.pageDescription);
  }, [app.pageTitle, app.pageDescription]);
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-card focus:p-3 focus:text-foreground"
    >
      {app.skipContent}
    </a>
  );
}
