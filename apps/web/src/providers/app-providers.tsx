'use client';

import { ClerkProvider, useAuth } from '@clerk/nextjs';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createContext, type ReactNode, useContext, useEffect, useState } from 'react';

import { publicEnvironment } from '@/config/env';
import { type ClerkLocalization, loadClerkLocale } from '@/features/authentication/clerk-locales';
import { ApiError } from '@/services/api/api-client';

import { usePageMessages } from './use-page-messages';

const AuthenticationContext = createContext(false);
export function useAuthenticationEnabled() {
  return useContext(AuthenticationContext);
}

function QueryScope({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: (attempt, error) =>
              attempt < 1 && !(error instanceof ApiError && error.status < 500),
          },
          mutations: { retry: false },
        },
      }),
  );
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

function AuthenticatedQueries({ children }: { children: ReactNode }) {
  const { userId } = useAuth();
  // Remounting drops all cached personal data when the signed-in identity changes.
  return <QueryScope key={userId ?? 'anonymous'}>{children}</QueryScope>;
}

function LocalizedAuthentication({
  children,
  initialLocalization,
}: {
  children: ReactNode;
  initialLocalization?: ClerkLocalization;
}) {
  const {
    locale,
    messages: { app },
  } = usePageMessages();
  const [localization, setLocalization] = useState<ClerkLocalization | undefined>(
    initialLocalization,
  );
  const [languageError, setLanguageError] = useState(false);
  useEffect(() => {
    let active = true;
    void loadClerkLocale(locale).then(
      (resource) => {
        if (!active) return;
        setLocalization(resource);
        setLanguageError(false);
      },
      () => {
        if (active) setLanguageError(true);
      },
    );
    return () => {
      active = false;
    };
  }, [locale]);
  return (
    <ClerkProvider
      publishableKey={publicEnvironment.clerkPublishableKey}
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      localization={localization}
    >
      {languageError ? (
        <p role="status" className="p-3 text-sm">
          {app.serviceUnavailable}
        </p>
      ) : null}
      <AuthenticatedQueries>{children}</AuthenticatedQueries>
    </ClerkProvider>
  );
}

export function AppProviders({
  children,
  authEnabled,
  initialLocalization,
}: {
  children: ReactNode;
  authEnabled: boolean;
  initialLocalization?: ClerkLocalization;
}) {
  return (
    <AuthenticationContext.Provider value={authEnabled}>
      {authEnabled ? (
        <LocalizedAuthentication initialLocalization={initialLocalization}>
          {children}
        </LocalizedAuthentication>
      ) : (
        <QueryScope>{children}</QueryScope>
      )}
    </AuthenticationContext.Provider>
  );
}
