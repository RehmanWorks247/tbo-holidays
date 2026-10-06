'use client';

import { ClerkProvider, useAuth } from '@clerk/nextjs';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createContext, type ReactNode, useContext, useState } from 'react';

import { publicEnvironment } from '@/config/env';
import { ApiError } from '@/services/api/api-client';

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

export function AppProviders({
  children,
  authEnabled,
}: {
  children: ReactNode;
  authEnabled: boolean;
}) {
  return (
    <AuthenticationContext.Provider value={authEnabled}>
      {authEnabled ? (
        <ClerkProvider
          publishableKey={publicEnvironment.clerkPublishableKey}
          signInUrl="/sign-in"
          signUpUrl="/sign-up"
        >
          <AuthenticatedQueries>{children}</AuthenticatedQueries>
        </ClerkProvider>
      ) : (
        <QueryScope>{children}</QueryScope>
      )}
    </AuthenticationContext.Provider>
  );
}
